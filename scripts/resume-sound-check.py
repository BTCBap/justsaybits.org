#!/usr/bin/env python3
"""No sound when a tab is resumed or the page is reopened.

Run against a built preview:

    npm run build
    npx vite preview --port 4302
    python3 scripts/resume-sound-check.py

After the boot gesture, the check clears its counters, toggles visibility,
pageshow (bfcache) and focus, and resumes every AudioContext directly. None of
those paths may schedule a voice. A real click afterwards must still play.
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
window.__sounds = [];
window.__osc = [];
window.__contexts = [];
window.addEventListener('jsb:sound', (event) => {
  window.__sounds.push((event.detail || {}).event);
});
const Original = window.AudioContext || window.webkitAudioContext;
if (Original) {
  const createOscillator = Original.prototype.createOscillator;
  Original.prototype.createOscillator = function () {
    const osc = createOscillator.call(this);
    const start = osc.start.bind(osc);
    osc.start = function (...args) { window.__osc.push(osc.type); start(...args); };
    return osc;
  };
  window.AudioContext = function (...args) {
    const ctx = new Original(...args);
    window.__contexts.push(ctx);
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


async def counts(page):
    return await page.evaluate("""() => ({
      sounds: window.__sounds.slice(),
      oscillators: window.__osc.length,
      contexts: window.__contexts.length,
      states: window.__contexts.map(c => c.state),
    })""")


async def boot(page):
    gate = page.locator('.boot__power')
    if await gate.count():
        await gate.click()
    try:
        await page.locator('.boot').wait_for(state='detached', timeout=8000)
    except Exception:
        pass
    await page.wait_for_timeout(500)


async def reset(page):
    await page.evaluate('window.__sounds = []; window.__osc = []')
    await page.wait_for_timeout(100)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=CHROME,
            args=['--no-sandbox', '--autoplay-policy=document-user-activation-required'],
        )
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        await context.add_init_script(INSTRUMENT)
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))

        await page.goto(BASE + '/', wait_until='networkidle')
        await page.wait_for_timeout(300)
        before = await counts(page)
        check(before['contexts'] == 0, 'no AudioContext before a gesture', str(before))

        await boot(page)
        await reset(page)

        # Background the tab, foreground it, restore from bfcache and focus.
        await page.evaluate("""
          Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'hidden',
          });
          document.dispatchEvent(new Event('visibilitychange'));
        """)
        await page.wait_for_timeout(150)
        await page.evaluate("""
          Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'visible',
          });
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
          window.dispatchEvent(new Event('focus'));
        """)
        await page.wait_for_timeout(200)

        # Resume every context outside a gesture, as a restore path might.
        await page.evaluate("""async () => {
          for (const ctx of window.__contexts) {
            try { await ctx.resume(); } catch (error) {}
          }
        }""")
        await page.wait_for_timeout(500)

        after = await counts(page)
        check(not after['sounds'], 'visibilitychange, pageshow and focus play no sound', str(after['sounds']))
        check(after['oscillators'] == 0, 'resuming the context starts no voice', str(after))

        # The next real gesture must still work after the context was parked.
        await page.click('.menu-edge--next')
        await page.wait_for_timeout(350)
        played = await counts(page)
        check(played['oscillators'] >= 1, 'the next click plays a voice', str(played))
        check(bool(played['sounds']), 'the next click emits a sound event', str(played['sounds']))

        # Reopening the page starts silent: no context and no voice until power.
        await page.reload(wait_until='networkidle')
        await page.wait_for_timeout(900)
        reopened = await counts(page)
        check(reopened['contexts'] == 0, 'reopened page creates no AudioContext', str(reopened))
        check(not reopened['sounds'], 'reopened page plays no sound', str(reopened['sounds']))
        check(reopened['oscillators'] == 0, 'reopened page starts no voice', str(reopened))

        check(not errors, 'no page errors', '; '.join(errors[:3]))
        await context.close()
        await browser.close()

    if failures:
        print(f'\n{len(failures)} FAILURE(S)')
        for failure in failures:
            print(' -', failure)
        sys.exit(1)
    print('\nAll resume-sound checks passed.')


if __name__ == '__main__':
    asyncio.run(main())
