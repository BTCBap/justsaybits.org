#!/usr/bin/env python3
"""Audio path check for the PS2 menu.

Runs against a built preview with a strict autoplay policy and a real click:

    npm run build
    npx vite preview --port 4302
    python3 scripts/sound-check.py

Instruments AudioContext.prototype.createOscillator/createBufferSource so a
started voice can be counted without listening to the output. Fails if the
context is not running after the power-on click or if a menu move/open starts
no voice.
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
window.__audio = { contexts: [], oscillators: 0, buffers: 0, states: [] };
const Original = window.AudioContext || window.webkitAudioContext;
if (Original) {
  const createOscillator = Original.prototype.createOscillator;
  Original.prototype.createOscillator = function () {
    const osc = createOscillator.call(this);
    const start = osc.start.bind(osc);
    osc.start = function (...args) { window.__audio.oscillators += 1; start(...args); };
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
      running: window.__audio.contexts.filter(c => c.state === 'running').length,
      contexts: window.__audio.contexts.length,
      muted: window.__audio.contexts.map(c => c.state === 'suspended'),
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
        check(before['contexts'] == 0, 'no AudioContext before a gesture')

        # A real mouse click on the power control is the first user activation.
        await page.get_by_role('button', name='Power on').click()
        await page.wait_for_timeout(120)
        after_power = await snapshot(page)
        check(after_power['running'] >= 1, 'AudioContext running after the first click',
              str(after_power))
        check(after_power['oscillators'] >= 1 or after_power['buffers'] >= 1,
              'a voice starts from the first click', str(after_power))

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
