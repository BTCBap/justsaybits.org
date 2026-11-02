#!/usr/bin/env python3
"""Audio path check for the PS2 menu.

Runs against a built preview with a strict autoplay policy and a real click:

    npm run build
    npx vite preview --port 4302
    python3 scripts/sound-check.py

Instruments AudioContext.prototype.createOscillator/createBufferSource so a
started voice can be counted without listening to the output. Fails if the
context is not running after the power-on click or if a menu move/open starts
no voice. A fresh profile starts muted: no AudioContext and no
navigator.audioSession write may happen until the sound icon is used.
"""
import asyncio
import os
import shutil
import sys

from playwright.async_api import async_playwright

BASE = os.environ.get('BASE', 'http://localhost:4302').rstrip('/')
CHROME = os.environ.get('CHROME') or shutil.which('google-chrome') \
    or shutil.which('chromium') or shutil.which('chromium-browser')

INSTRUMENT = """
window.__audio = { contexts: [], oscillators: 0, buffers: 0, states: [], voices: [], stops: [], sessionWrites: [] };
// Older iOS exposes navigator.audioSession. Instrument it so any write from
// the site is visible: the site must never change the shared audio session.
try {
  Object.defineProperty(Navigator.prototype, 'audioSession', {
    configurable: true,
    get() {
      const stub = {};
      Object.defineProperty(stub, 'type', {
        get() { return 'auto'; },
        set(value) { window.__audio.sessionWrites.push(value); },
      });
      return stub;
    },
    set(value) { window.__audio.sessionWrites.push(value); },
  });
} catch (error) {}
const Original = window.AudioContext || window.webkitAudioContext;
if (Original) {
  const createOscillator = Original.prototype.createOscillator;
  Original.prototype.createOscillator = function () {
    const osc = createOscillator.call(this);
    const start = osc.start.bind(osc);
    const stop = osc.stop.bind(osc);
    osc.start = function (...args) {
      window.__audio.oscillators += 1;
      window.__audio.voices.push({ type: osc.type, start: args[0] });
      start(...args);
    };
    osc.stop = function (when) {
      window.__audio.stops.push(when);
      stop(when);
    };
    return osc;
  };
  const createBufferSource = Original.prototype.createBufferSource;
  Original.prototype.createBufferSource = function () {
    const source = createBufferSource.call(this);
    const start = source.start.bind(source);
    source.start = function (...args) { window.__audio.buffers += 1; start(...args); };
    return source;
  };
  window.AudioContext = function (...args) {
    const ctx = new Original(...args);
    window.__audio.contexts.push(ctx);
    window.__audio.states.push(ctx.state);
    ctx.addEventListener('statechange', () => window.__audio.states.push(ctx.state));
    return ctx;
  };
  window.AudioContext.prototype = Original.prototype;
}
"""

failures = []


def check(condition, label, detail=''):
    if condition:
        print(f'PASS  {label}')
    else:
        failures.append(f'{label} {detail}'.strip())
        print(f'FAIL  {label} {detail}'.strip())


async def snapshot(page):
    data = await page.evaluate("""() => ({
      oscillators: window.__audio.oscillators,
      buffers: window.__audio.buffers,
      states: window.__audio.states.slice(),
      voices: window.__audio.voices.slice(),
      stops: window.__audio.stops.slice(),
      running: window.__audio.contexts.filter(c => c.state === 'running').length,
      contexts: window.__audio.contexts.length,
      muted: window.__audio.contexts.map(c => c.state === 'suspended'),
      sessionWrites: window.__audio.sessionWrites.slice(),
    })""")
    return data


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            executable_path=CHROME,
            headless=True,
            args=['--no-sandbox', '--autoplay-policy=document-user-activation-required'],
        )
        context = await browser.new_context(viewport={'width': 1440, 'height': 900})
        page = await context.new_page()
        await page.add_init_script(INSTRUMENT)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))

        await page.goto(BASE + '/', wait_until='networkidle')
        before = await snapshot(page)
        check(before['contexts'] == 0, 'sound off by default: no AudioContext on load',
              str(before))

        # A real mouse click on the power control is the first user activation.
        await page.get_by_role('button', name='Power on').click()
        await page.wait_for_timeout(200)
        muted = await snapshot(page)
        check(muted['contexts'] == 0, 'sound off: power-on creates no AudioContext', str(muted))
        check(muted['oscillators'] == 0, 'sound off: boot plays no tone', str(muted['voices']))
        check(muted['sessionWrites'] == [], 'no navigator.audioSession write while muted',
              str(muted['sessionWrites']))
        await page.locator('.boot').wait_for(state='detached', timeout=8000)

        # The footer sound icon is the opt-in: it creates the context and the
        # choice persists for the next visit.
        await page.get_by_role('button', name='Sound', exact=True).click()
        await page.wait_for_timeout(350)
        enabled = await snapshot(page)
        check(enabled['contexts'] >= 1, 'sound toggle creates an AudioContext', str(enabled))
        check(enabled['running'] >= 1, 'sound toggle leaves the context running', str(enabled))
        check(enabled['oscillators'] >= 1, 'sound toggle plays a confirm voice', str(enabled))
        saved = await page.evaluate("JSON.parse(localStorage.getItem('jsb.prefs.v2'))")
        check(saved.get('sound') is True, 'sound on persists in jsb.prefs.v2', str(saved))

        # Hiding the page fades the output; it must never suspend the context.
        await page.evaluate("""() => {
          Object.defineProperty(document, 'visibilityState', {
            configurable: true, get: () => 'hidden',
          });
          document.dispatchEvent(new Event('visibilitychange'));
        }""")
        await page.wait_for_timeout(250)
        hidden = await snapshot(page)
        check('suspended' not in hidden['states'], 'hide never suspends the context',
              str(hidden['states']))
        await page.evaluate("""() => {
          Object.defineProperty(document, 'visibilityState', {
            configurable: true, get: () => 'visible',
          });
          document.dispatchEvent(new Event('visibilitychange'));
        }""")

        # A fresh session with sound on: the power gesture plays the boot pad.
        # (A reload in this tab is a returning visitor with no gate.)
        await page.close()
        sound_context = await browser.new_context(viewport={'width': 1440, 'height': 900})
        await sound_context.add_init_script(
            "try { localStorage.setItem('jsb.prefs.v2', JSON.stringify("
            "{sound: true, haptics: true, soundHintDismissed: true})); } catch (error) {}")
        page = await sound_context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.add_init_script(INSTRUMENT)
        await page.goto(BASE + '/', wait_until='networkidle')
        await page.wait_for_timeout(300)
        armed = await snapshot(page)
        check(armed['contexts'] == 0, 'sound on: still no context before a gesture', str(armed))
        await page.get_by_role('button', name='Power on').click()
        await page.wait_for_timeout(120)
        after_power = await snapshot(page)
        check(after_power['running'] >= 1, 'AudioContext running after the first click',
              str(after_power))
        check(after_power['oscillators'] >= 1 or after_power['buffers'] >= 1,
              'a voice starts from the first click', str(after_power))
        check(after_power['oscillators'] == 3, 'boot pad has three voices and no ding',
              str(after_power['voices']))
        boot_span = (max(after_power['stops']) - min(voice['start'] for voice in after_power['voices'])) \
            if after_power['stops'] else 0
        check(boot_span >= 5.3, 'boot tone is ~40% longer than 3.85 s', f'{boot_span:.2f} s')
        check(after_power['sessionWrites'] == [], 'no navigator.audioSession write while audible',
              str(after_power['sessionWrites']))

        await page.locator('.boot').wait_for(state='detached', timeout=8000)
        await page.wait_for_timeout(300)
        before_move = await snapshot(page)

        # The edge arrow is a normal button: clicking it is a menu move.
        await page.click('.menu-edge--next')
        await page.wait_for_timeout(250)
        after_move = await snapshot(page)
        check(after_move['oscillators'] > before_move['oscillators'],
              'a menu move starts an oscillator', f"{before_move} -> {after_move}")
        check(after_move['running'] >= 1, 'context still running after a menu move', str(after_move))

        # One tap on a tile opens it and plays the confirm chime.
        await page.click('.menu-option--active')
        await page.wait_for_timeout(250)
        after_open = await snapshot(page)
        check(after_open['oscillators'] > after_move['oscillators'],
              'a menu open starts an oscillator', f"{after_move} -> {after_open}")
        check(after_open['running'] >= 1, 'context still running after an open', str(after_open))
        # A returning visitor whose old v1 record said sound:true starts muted.
        await page.close()
        legacy_context = await browser.new_context(viewport={'width': 1440, 'height': 900})
        await legacy_context.add_init_script(
            "try { localStorage.setItem('jsb.prefs.v1', JSON.stringify("
            "{sound: true, haptics: false, soundHintDismissed: false})); } catch (error) {}")
        legacy = await legacy_context.new_page()
        legacy_errors = []
        legacy.on('pageerror', lambda error: legacy_errors.append(str(error)))
        await legacy.add_init_script(INSTRUMENT)
        await legacy.goto(BASE + '/', wait_until='networkidle')
        migrated = await legacy.evaluate("JSON.parse(localStorage.getItem('jsb.prefs.v2'))")
        check(migrated.get('sound') is False, 'v1 sound:true migrates to off', str(migrated))
        check(migrated.get('haptics') is False, 'v1 haptics choice is kept', str(migrated))
        check(await legacy.evaluate("localStorage.getItem('jsb.prefs.v1')") is None,
              'the v1 record is cleared after migration')
        await legacy.get_by_role('button', name='Power on').click()
        await legacy.wait_for_timeout(200)
        legacy_snap = await snapshot(legacy)
        check(legacy_snap['contexts'] == 0 and legacy_snap['oscillators'] == 0,
              'migrated visitor boots silently', str(legacy_snap))
        check(not legacy_errors, 'migration: no page errors', '; '.join(legacy_errors[:3]))
        await legacy_context.close()

        check(not errors, 'no page errors', '; '.join(errors[:3]))

        await browser.close()

    print()
    if failures:
        print(f'{len(failures)} audio check(s) failed')
        return 1
    print('All audio checks passed')
    return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
