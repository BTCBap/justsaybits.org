#!/usr/bin/env python3
"""One-tap checks for the PS2 menu and content lists.

Run against a built preview:

    npm run build
    npx vite preview --port 4302
    python3 scripts/tap-once-check.py

The context is a real touch device (390 x 844, hasTouch, isMobile). WebKit is
used when its host libraries are present; otherwise Chromium with the same
touch context is the fallback, and the header says which engine ran.
"""
import asyncio
import os
import sys

from playwright.async_api import async_playwright

BASE = os.environ.get('BASE', 'http://localhost:4302').rstrip('/')
CHROME = os.environ.get('CHROME') or '/usr/bin/google-chrome'

failures = []


def check(condition, label, detail=''):
    if condition:
        print(f'PASS  {label}')
    else:
        failures.append(f'{label} {detail}'.strip())
        print(f'FAIL  {label} {detail}'.strip())


async def settle_boot(page):
    """Dismiss the power gate if it is up, then wait for the overlay to go."""
    power = page.locator('.boot__power')
    if await power.count():
        await power.tap()
    try:
        await page.locator('.boot').wait_for(state='detached', timeout=6000)
    except Exception:
        pass
    await page.wait_for_timeout(350)


async def goto_menu(page):
    await page.goto(BASE + '/', wait_until='networkidle')
    await settle_boot(page)
    await page.locator('.menu-stage').wait_for(state='visible', timeout=5000)
    await page.wait_for_timeout(250)


async def touch_drag(page, x_from, y_from, x_to, y_to):
    cdp = await page.context.new_cdp_session(page)
    await cdp.send('Input.dispatchTouchEvent', {
        'type': 'touchStart',
        'touchPoints': [{'x': x_from, 'y': y_from, 'id': 1, 'radiusX': 5, 'radiusY': 5, 'force': 1}],
    })
    steps = 18
    for i in range(1, steps + 1):
        x = x_from + (x_to - x_from) * i / steps
        y = y_from + (y_to - y_from) * i / steps
        await cdp.send('Input.dispatchTouchEvent', {
            'type': 'touchMove',
            'touchPoints': [{'x': x, 'y': y, 'id': 1, 'radiusX': 5, 'radiusY': 5, 'force': 1}],
        })
        await page.wait_for_timeout(16)
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    await page.wait_for_timeout(650)


async def tap_once(page, locator):
    box = await locator.bounding_box()
    if not box:
        return False
    await page.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + 18)
    return True


async def main():
    async with async_playwright() as p:
        engine = 'webkit'
        try:
            browser = await p.webkit.launch()
        except Exception:
            engine = 'chromium'
            browser = await p.chromium.launch(executable_path=CHROME)
        print(f'Engine: {engine} (WebKit unavailable, Chromium touch context used)'
              if engine == 'chromium' else 'Engine: webkit')

        context = await browser.new_context(
            viewport={'width': 390, 'height': 844},
            has_touch=True,
            is_mobile=True,
            device_scale_factor=2,
        )
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))

        await goto_menu(page)
        active = await page.locator('.menu-option[aria-selected="true"]').get_attribute('id')
        target = page.locator(f'.menu-option:not([aria-selected="true"])').first
        target_id = await target.get_attribute('id')
        await tap_once(page, target)
        await page.wait_for_timeout(900)
        check(
            page.url.rstrip('/') != BASE,
            'one tap opens a non-active tile',
            f'still on {page.url} after tapping {target_id} (active was {active})',
        )
        await goto_menu(page)

        # Swipe, then tap a freshly peeking tile once: the drag guard must not
        # swallow the next tap.
        await touch_drag(page, 330, 400, 60, 400)
        after_swipe = await page.locator('.menu-option[aria-selected="true"]').get_attribute('id')
        check(after_swipe != active, 'a swipe moves the selection once', f'{active} -> {after_swipe}')
        target = page.locator('.menu-option:not([aria-selected="true"])').first
        await tap_once(page, target)
        await page.wait_for_timeout(900)
        check(
            page.url.rstrip('/') != BASE,
            'one tap after a swipe opens the tile',
            f'still on {page.url}',
        )

        # A content list scrolled with a real touch gesture must open its row
        # on the next tap, not the tap after that.
        await page.goto(BASE + '/content/essays', wait_until='networkidle')
        await settle_boot(page)
        await page.locator('.essay-row').first.wait_for(state='visible', timeout=5000)
        await touch_drag(page, 195, 640, 195, 260)
        scroll_top = await page.evaluate(
            "document.querySelector('.ps2-scroll')?.scrollTop ?? 0"
        )
        check(scroll_top > 80, 'touch scroll moved the list', f'scrollTop={scroll_top}')
        row = await page.evaluate("""() => {
          for (const el of document.querySelectorAll('.essay-row')) {
            const r = el.getBoundingClientRect();
            if (r.top > 200 && r.bottom < 760) {
              return { x: r.left + r.width / 2, y: r.top + r.height / 2, href: el.getAttribute('href') };
            }
          }
          return null;
        }""")
        check(row is not None, 'a scrolled essay row is visible')
        if row:
            await page.touchscreen.tap(row['x'], row['y'])
            await page.wait_for_timeout(1100)
            check(
                page.url.rstrip('/').endswith(row['href'].rstrip('/')),
                'one tap after a touch scroll opens the essay',
                f'expected {row["href"]}, got {page.url}',
            )

        check(not errors, 'no page errors', '; '.join(errors[:3]))
        await browser.close()

    if failures:
        print(f'\n{len(failures)} FAILURE(S)')
        for failure in failures:
            print(' -', failure)
        sys.exit(1)
    print('\nAll one-tap checks passed.')


if __name__ == '__main__':
    asyncio.run(main())
