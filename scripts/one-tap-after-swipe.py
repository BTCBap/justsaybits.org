#!/usr/bin/env python3
"""One-tap-after-swipe checks with real touch input.

Run against a built preview:

    npm run build
    npx vite preview --port 4302
    python3 scripts/one-tap-after-swipe.py

Chromium uses CDP Input.dispatchTouchEvent for every gesture and tap. WebKit
uses Playwright's trusted touchscreen tap; its swipe is a JS pointer-event
sequence because Playwright exposes no raw touch-move input for WebKit.
"""
import asyncio
import os
import sys
import time

from playwright.async_api import async_playwright

BASE = os.environ.get('BASE', 'http://localhost:4302').rstrip('/')
CHROME = os.environ.get('CHROME') or '/usr/bin/google-chrome'
IPHONE_UA = ('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) '
             'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 '
             'Mobile/15E148 Safari/604.1')

failures = []
engine = ''


def check(condition, label, detail=''):
    if condition:
        print(f'PASS  [{engine}] {label}')
    else:
        failures.append(f'[{engine}] {label} {detail}'.strip())
        print(f'FAIL  [{engine}] {label} {detail}'.strip())


async def boot(page):
    gate = page.locator('.boot__power')
    if await gate.count():
        await gate.click()
    try:
        await page.locator('.boot').wait_for(state='detached', timeout=8000)
    except Exception:
        pass
    await page.wait_for_timeout(450)


async def open_menu(page):
    await page.goto(BASE + '/', wait_until='networkidle')
    await page.wait_for_timeout(650)
    await boot(page)
    await page.locator('.menu-stage').wait_for(state='visible', timeout=5000)
    await page.wait_for_timeout(420)


async def stage_center(page):
    box = await page.locator('.menu-stage').bounding_box()
    return box['x'] + box['width'] / 2, box['y'] + box['height'] / 2


async def cdp_touch(client, kind, x=None, y=None):
    points = [] if kind == 'touchEnd' else [
        {'x': x, 'y': y, 'id': 1, 'radiusX': 5, 'radiusY': 5, 'force': 1}
    ]
    await client.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': points})


async def cdp_swipe(client, x1, y1, x2, y2, steps=10):
    await cdp_touch(client, 'touchStart', x1, y1)
    for step in range(1, steps + 1):
        x = x1 + (x2 - x1) * step / steps
        y = y1 + (y2 - y1) * step / steps
        await cdp_touch(client, 'touchMove', x, y)
        await asyncio.sleep(0.016)
    await cdp_touch(client, 'touchEnd')


async def js_pointer_swipe(page, x1, y1, x2, y2, steps=10):
    await page.evaluate("""async ({x1, y1, x2, y2, steps}) => {
      const hit = document.elementFromPoint(x1, y1) || document.body;
      const fire = (type, x, y, buttons) => {
        hit.dispatchEvent(new PointerEvent(type, {
          bubbles: true, cancelable: true, composed: true,
          pointerId: 1, pointerType: 'touch', isPrimary: true,
          button: 0, buttons, clientX: x, clientY: y,
        }));
      };
      fire('pointerdown', x1, y1, 1);
      for (let step = 1; step <= steps; step += 1) {
        await new Promise(resolve => setTimeout(resolve, 16));
        fire('pointermove', x1 + (x2 - x1) * step / steps,
             y1 + (y2 - y1) * step / steps, 1);
      }
      fire('pointerup', x2, y2, 0);
    }""", {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'steps': steps})


async def swipe(page, client, direction):
    cx, cy = await stage_center(page)
    if direction == 'left':
        x1, x2 = cx + 145, cx - 145
    else:
        x1, x2 = cx - 145, cx + 145
    if client:
        await cdp_swipe(client, x1, cy, x2, cy)
    else:
        await js_pointer_swipe(page, x1, cy, x2, cy)


async def tap(page, client, x, y):
    if client:
        await cdp_touch(client, 'touchStart', x, y)
        await asyncio.sleep(0.012)
        await cdp_touch(client, 'touchEnd')
    else:
        await page.touchscreen.tap(x, y)


async def selected_id(page):
    return await page.locator('.menu-option[aria-selected="true"]').get_attribute('data-section-id')


async def tile_box(page, section_id):
    return await page.locator(f'[data-section-id="{section_id}"]').bounding_box()


async def wait_for_section(page, section_id, timeout=2500):
    path = '/content/essays' if section_id == 'content' else f'/{section_id}'
    try:
        await page.wait_for_url(f'**{path}', timeout=timeout)
        return True
    except Exception:
        return False


async def tap_centre_case(page, client, direction, delay):
    await open_menu(page)
    before = await selected_id(page)
    started = time.monotonic()
    await swipe(page, client, direction)
    swiped_at = time.monotonic()
    expected = await selected_id(page)
    await asyncio.sleep(delay / 1000)
    box = await tile_box(page, expected)
    if not box:
        check(False, f'swipe {direction} + centre tap at {delay} ms', 'no tile box')
        return
    tap_at = time.monotonic() - swiped_at
    x = box['x'] + box['width'] / 2
    y = box['y'] + box['height'] * 0.42
    await tap(page, client, x, y)
    opened = await wait_for_section(page, expected)
    check(
        opened and expected != before,
        f'swipe {direction} + centre tap at {delay} ms opens on one tap',
        f'expected {expected} (from {before}), tap started at {tap_at * 1000:.0f} ms, at {page.url}',
    )


async def tap_peeking_case(page, client, direction):
    await open_menu(page)
    await swipe(page, client, direction)
    await asyncio.sleep(0.12)
    target = await page.evaluate("""() => {
      const active = document.querySelector('.menu-option[aria-selected="true"]');
      for (const tile of document.querySelectorAll('[data-section-id]')) {
        if (tile === active) continue;
        const style = getComputedStyle(tile);
        const rect = tile.getBoundingClientRect();
        const centre = rect.x + rect.width / 2;
        if (style.visibility === 'visible' && rect.width > 20
            && centre > 12 && centre < 378) {
          return { id: tile.dataset.sectionId, x: rect.x + rect.width / 2,
                   y: rect.y + rect.height * 0.42 };
        }
      }
      return null;
    }""")
    if not target:
        check(False, f'swipe {direction} + peeking tap', 'no peeking tile found')
        return
    await tap(page, client, target['x'], target['y'])
    check(
        await wait_for_section(page, target['id']),
        f'swipe {direction} + tap a peeking tile opens on one tap',
        f'expected {target["id"]}, at {page.url}',
    )


async def swipe_only_case(page, client, direction):
    await open_menu(page)
    before = await selected_id(page)
    await swipe(page, client, direction)
    after = await selected_id(page)
    await page.wait_for_timeout(900)
    check(
        page.url.rstrip('/') == BASE + '' or page.url.rstrip('/') == BASE,
        f'swipe {direction} alone never opens a section',
        page.url,
    )
    check(after != before, f'swipe {direction} moves one section', f'{before} -> {after}')


async def haptic_focus_case(page, client):
    await open_menu(page)
    # The first tick creates the hidden iOS switch.
    await swipe(page, client, 'left')
    await page.wait_for_timeout(80)
    state = await page.evaluate("""() => {
      const label = document.querySelector('label[data-haptic-switch]');
      const input = label ? label.querySelector('input') : null;
      return {
        exists: !!input,
        tabIndex: input ? input.getAttribute('tabindex') : null,
        activeIsInput: !!input && document.activeElement === input,
        activeTag: document.activeElement ? document.activeElement.tagName : null,
      };
    }""")
    check(state['exists'], 'haptic fallback switch exists after a swipe', str(state))
    check(state['tabIndex'] == '-1', 'haptic switch is out of the tab order', str(state))
    check(not state['activeIsInput'], 'haptic switch never keeps focus', str(state))

    if state['exists']:
        leaked = await page.evaluate("""async () => {
          let seen = 0;
          const count = () => { seen += 1; };
          document.addEventListener('click', count);
          document.querySelector('label[data-haptic-switch]').click();
          await new Promise(resolve => setTimeout(resolve, 30));
          document.removeEventListener('click', count);
          return seen;
        }""")
        check(leaked == 0, 'haptic switch click never reaches the document', f'{leaked} click(s)')


async def touch_affordance_case(page):
    state = await page.evaluate("""() => {
      const tile = document.querySelector('.menu-option');
      const root = tile ? tile.closest('[style*="pan-y"]') : null;
      return {
        hover: matchMedia('(hover: hover) and (pointer: fine)').matches,
        highlight: getComputedStyle(tile).webkitTapHighlightColor,
        touchAction: root ? getComputedStyle(root).touchAction : null,
      };
    }""")
    check(state['hover'] is False, 'touch device never matches the fine-hover query', str(state))
    check(
        state['highlight'] in ('rgba(0, 0, 0, 0)', 'transparent'),
        'tiles keep -webkit-tap-highlight-color transparent',
        str(state),
    )
    check(state['touchAction'] == 'pan-y', 'menu keeps touch-action: pan-y', str(state))


async def run_suite(browser, label):
    global engine
    engine = label
    is_webkit = label == 'webkit'
    context = await browser.new_context(
        viewport={'width': 390, 'height': 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        user_agent=IPHONE_UA,
    )
    await context.add_init_script("""
        try {
          Object.defineProperty(Navigator.prototype, 'vibrate', {
            configurable: true, value: undefined,
          });
        } catch (error) {}
    """)
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    client = None if is_webkit else await context.new_cdp_session(page)

    for direction in ('left', 'right'):
        for delay in (50, 150, 400):
            await tap_centre_case(page, client, direction, delay)

    for direction in ('left', 'right'):
        await tap_peeking_case(page, client, direction)

    for direction in ('left', 'right'):
        await swipe_only_case(page, client, direction)

    await haptic_focus_case(page, client)
    await touch_affordance_case(page)

    check(not errors, 'no page errors', '; '.join(errors[:3]))
    await context.close()


async def main():
    async with async_playwright() as p:
        chromium = await p.chromium.launch(
            executable_path=CHROME, args=['--no-sandbox'],
        )
        try:
            await run_suite(chromium, 'chromium')
        finally:
            await chromium.close()

        try:
            webkit = await p.webkit.launch()
        except Exception as error:
            reason = ' '.join(str(error).split())
            print(f'SKIP  [webkit] host cannot launch WebKit: {reason[:240]}')
            print('      Install the WebKit host libraries (playwright install-deps webkit) to run these cases.')
        else:
            try:
                await run_suite(webkit, 'webkit')
            finally:
                await webkit.close()

    if failures:
        print(f'\n{len(failures)} FAILURE(S)')
        for failure in failures:
            print(' -', failure)
        sys.exit(1)
    print('\nAll one-tap-after-swipe checks passed.')


if __name__ == '__main__':
    asyncio.run(main())
