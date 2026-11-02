#!/usr/bin/env python3
"""No clicks or clipping in the system voices.

Run against a built preview:

    npm run build
    npx vite preview --port 4302
    python3 scripts/audio-glitch-check.py

An AudioWorklet taps the summed output on the audio thread, so every render
quantum is measured without the main-thread gaps a ScriptProcessor leaves. The
check renders the boot pad, a back tap and a quiesce in the middle of a tone,
then asserts that no sample-to-sample step exceeds DISCONTINUITY and that the
peak stays below 0.9.
"""
import asyncio
import os
import sys

from playwright.async_api import async_playwright

from sound_prefs import AUDIO_ON

BASE = os.environ.get('BASE', 'http://localhost:4302').rstrip('/')
CHROME = os.environ.get('CHROME') or '/usr/bin/google-chrome'
DISCONTINUITY = 0.01
PEAK_LIMIT = 0.9

PROBE = r"""
window.__probe = { peak: 0, delta: 0, frames: 0, at: null };
window.__sounds = [];
window.addEventListener('jsb:sound', (event) => {
  window.__sounds.push((event.detail || {}).event);
});

(() => {
  const source = `
    class TapProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.peak = 0;
        this.delta = 0;
        this.last = null;
        this.at = null;
        this.frames = 0;
        this.port.onmessage = (event) => {
          if (event.data === 'reset') {
            this.peak = 0;
            this.delta = 0;
            this.last = null;
            this.at = null;
            this.frames = 0;
          } else if (event.data === 'read') {
            this.port.postMessage({
              peak: this.peak,
              delta: this.delta,
              frames: this.frames,
              at: this.at,
            });
          }
        };
      }
      process(inputs) {
        const channel = inputs[0] && inputs[0][0];
        if (channel) {
          for (let i = 0; i < channel.length; i += 1) {
            const value = channel[i];
            const size = Math.abs(value);
            if (size > this.peak) this.peak = size;
            if (this.last !== null) {
              const step = Math.abs(value - this.last);
              if (step > this.delta) {
                this.delta = step;
                this.at = { previous: this.last, value, frame: this.frames + i };
              }
            }
            this.last = value;
          }
          this.frames += channel.length;
        }
        return true;
      }
    }
    registerProcessor('jsb-tap', TapProcessor);
  `;
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const probes = new WeakMap();
  const nodes = [];
  const originalConnect = AudioNode.prototype.connect;

  const probeFor = (ctx) => {
    if (probes.has(ctx)) return probes.get(ctx);
    const input = ctx.createGain();
    const mute = ctx.createGain();
    const probe = { input, node: null };
    probes.set(ctx, probe);
    mute.gain.value = 0;
    ctx.audioWorklet.addModule(moduleUrl).then(() => {
      const node = new AudioWorkletNode(ctx, 'jsb-tap', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      node.port.onmessage = (event) => { window.__probe = event.data; };
      // The probe's own edges bypass the override below.
      originalConnect.call(input, node);
      originalConnect.call(node, mute);
      originalConnect.call(mute, ctx.destination);
      probe.node = node;
      nodes.push(node);
    }).catch(() => {});
    return probe;
  };

  window.__probeCommand = (command) => {
    nodes.forEach((node) => node.port.postMessage(command));
  };

  AudioNode.prototype.connect = function (destination, ...rest) {
    try {
      if (destination && destination === this.context.destination) {
        return originalConnect.call(this, probeFor(this.context).input, ...rest);
      }
    } catch (error) {
      // Fall through to the real connection.
    }
    return originalConnect.call(this, destination, ...rest);
  };
})();
"""

failures = []


def check(condition, label, detail=''):
    if condition:
        print(f'PASS  {label}')
    else:
        failures.append(f'{label} {detail}'.strip())
        print(f'FAIL  {label} {detail}'.strip())


async def reset(page):
    await page.evaluate('window.__probeCommand("reset"); window.__sounds = []')
    await page.wait_for_timeout(60)


async def stats(page):
    await page.evaluate('window.__probeCommand("read")')
    await page.wait_for_timeout(80)
    return await page.evaluate('window.__probe')


def assert_clean(label, result):
    check(result['frames'] > 0, f'{label}: audio was captured', str(result))
    check(result['peak'] < PEAK_LIMIT,
          f'{label}: peak below {PEAK_LIMIT}', f"{result['peak']:.4f}")
    check(result['delta'] < DISCONTINUITY,
          f'{label}: no sample step above {DISCONTINUITY}',
          f"{result['delta']:.5f} at {result.get('at')}")


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=CHROME,
            args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
        )
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        await context.add_init_script(AUDIO_ON)
        await context.add_init_script(PROBE)
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))

        await page.goto(BASE + '/', wait_until='networkidle')
        await page.wait_for_timeout(300)

        # 1. The boot pad, from the POWER ON tap through its full tail.
        await page.locator('.boot__power').click()
        await page.wait_for_timeout(6000)
        boot = await stats(page)
        check(boot['peak'] > 0.0005, 'boot: the pad is audible', f"{boot['peak']:.5f}")
        assert_clean('boot', boot)

        await page.wait_for_timeout(200)
        try:
            await page.locator('.boot').wait_for(state='detached', timeout=8000)
        except Exception:
            pass

        # 2. One back tap on a section screen.
        await page.locator('[data-section-id="about"]').click()
        await page.wait_for_url('**/about', timeout=4000)
        await page.wait_for_timeout(900)
        await reset(page)
        await page.keyboard.press('Escape')
        await page.wait_for_url(BASE + '/', timeout=4000)
        await page.wait_for_timeout(600)
        back = await stats(page)
        check(back['peak'] > 0.0005, 'back: the tap is audible', f"{back['peak']:.5f}")
        assert_clean('back', back)

        # 3. Park the tab in the middle of the confirm tone.
        await reset(page)
        await page.locator('[data-section-id="about"]').click()
        await page.wait_for_timeout(45)
        sounds_before = await page.evaluate('window.__sounds.slice()')
        await page.evaluate("""
          Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'hidden',
          });
          document.dispatchEvent(new Event('visibilitychange'));
        """)
        await page.wait_for_timeout(400)
        quiet = await stats(page)
        check(bool(sounds_before), 'quiesce: a voice was playing', str(sounds_before))
        assert_clean('quiesce mid-tone', quiet)

        # 4. The next gesture still plays after the park.
        await page.evaluate("""
          Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'visible',
          });
          document.dispatchEvent(new Event('visibilitychange'));
        """)
        await reset(page)
        await page.keyboard.press('Escape')
        await page.wait_for_timeout(500)
        resumed = await stats(page)
        check(resumed['peak'] > 0.0005, 'after quiesce: next gesture is audible',
              f"{resumed['peak']:.5f}")
        assert_clean('after quiesce', resumed)

        check(not errors, 'no page errors', '; '.join(errors[:3]))
        await context.close()
        await browser.close()

    if failures:
        print(f'\n{len(failures)} FAILURE(S)')
        for failure in failures:
            print(' -', failure)
        sys.exit(1)
    print('\nAll audio-glitch checks passed.')


if __name__ == '__main__':
    asyncio.run(main())
