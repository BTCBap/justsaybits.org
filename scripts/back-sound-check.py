#!/usr/bin/env python3
"""Exactly one back sound per back path.

Run against a built preview:

    npm run build
    npx vite preview --port 4302
    python3 scripts/back-sound-check.py

The page records every logical system sound on `jsb:sound`. Each case starts
from a clean log: the Back to Home button tap, Escape, and history.back().
"""
import asyncio
import os
import sys

from playwright.async_api import async_playwright

BASE = os.environ.get('BASE', 'http://localhost:4302').rstrip('/')
CHROME = os.environ.get('CHROME') or '/usr/bin/google-chrome'
PIXEL_UA = ('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36')

failures = []


def check(condition, label, detail=''):
    if condition:
        print(f'PASS  {label}')
    else:
        failures.append(f'{label} {detail}'.strip())
        print(f'FAIL  {label} {detail}'.strip())


async def boot(page):
    gate = page.locator('.boot__power')
    if await gate.count():
        await gate.tap()
    try:
        await page.locator('.boot').wait_for(state='detached', timeout=8000)
    except Exception:
        pass
    await page.wait_for_timeout(500)


async def open_section(page, section='about'):
    tile = page.locator(f'[data-section-id="{section}"]')
    box = await tile.bounding_box()
    if not box:
        raise RuntimeError(f'no tile for {section}')
    await page.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] * 0.42)
    await page.wait_for_url(f'**/{section}', timeout=3000)
    await page.wait_for_timeout(750)


async def reset(page):
    await page.evaluate('window.__sounds = []')
    await page.evaluate('window.__vibes = []')
    await page.wait_for_timeout(120)


async def events(page):
    sounds = await page.evaluate('window.__sounds')
    vibes = await page.evaluate('window.__vibes')
    return sounds if isinstance(sounds, list) else [], vibes if isinstance(vibes, list) else []


async def expect_one(page, label):
    sounds, vibes = await events(page)
    backs = sounds.count('back')
    others = [event for event in sounds if event != 'back']
    check(backs == 1, f'{label}: exactly one back sound', f'{sounds}')
    check(not others, f'{label}: no cursor, confirm or select sound', f'{others}')
    check(len(vibes) == 1, f'{label}: exactly one back haptic', f'{len(vibes)} vibrate call(s)')
    check(page.url.rstrip('/') == BASE, f'{label}: returned to the menu', page.url)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        context = await browser.new_context(
            viewport={'width': 412, 'height': 915},
            device_scale_factor=2.625,
            is_mobile=True,
            has_touch=True,
            user_agent=PIXEL_UA,
        )
        await context.add_init_script("""
            window.__sounds = [];
            window.__vibes = [];
            window.addEventListener('jsb:sound', (event) => {
              window.__sounds.push(event.detail && event.detail.event);
            });
            try {
              Object.defineProperty(Navigator.prototype, 'vibrate', {
                configurable: true,
                value: function (pattern) { window.__vibes.push(pattern); return true; },
              });
            } catch (error) {}
        """)
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))

        await page.goto(BASE + '/', wait_until='networkidle')
        await page.wait_for_timeout(400)
        await boot(page)

        # Button tap: the footer control that returns home.
        await open_section(page)
        await reset(page)
        back = page.locator('button', has_text='Back to Home')
        await back.tap()
        await page.wait_for_timeout(750)
        await expect_one(page, 'Back to Home button tap')

        # Escape on the same screen.
        await open_section(page)
        await reset(page)
        await page.keyboard.press('Escape')
        await page.wait_for_timeout(750)
        await expect_one(page, 'Escape')

        # Browser/Android back gesture.
        await open_section(page)
        await reset(page)
        await page.go_back()
        await page.wait_for_timeout(750)
        await expect_one(page, 'history.back()')

        check(not errors, 'no page errors', '; '.join(errors[:3]))
        await context.close()
        await browser.close()

    if failures:
        print(f'\n{len(failures)} FAILURE(S)')
        for failure in failures:
            print(' -', failure)
        sys.exit(1)
    print('\nAll back-sound checks passed.')


if __name__ == '__main__':
    asyncio.run(main())
