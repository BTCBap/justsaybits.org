#!/usr/bin/env python3
"""The Social tile must only open the Social screen, never a social link.

Run against a built preview:

    npm run build
    npx vite preview --port 4302
    python3 scripts/social-tab-check.py

The bug reproduced after the Social chunk was warm: the tap opened the screen
on pointerup, the compatibility click was retargeted to the link now under the
finger, and x.com / LinkedIn opened. Both engines tap the tile twice, then tap
a social row deliberately.
"""
import asyncio
import os
import sys

from playwright.async_api import async_playwright

from sound_prefs import AUDIO_ON

BASE = os.environ.get('BASE', 'http://localhost:4302').rstrip('/')
CHROME = os.environ.get('CHROME') or '/usr/bin/google-chrome'
PIXEL_UA = ('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36')
IPHONE_UA = ('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) '
             'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 '
             'Mobile/15E148 Safari/604.1')
DEVICES = {
    'chromium': {'width': 412, 'height': 915, 'device_scale_factor': 2.625,
                 'user_agent': PIXEL_UA},
    'webkit': {'width': 390, 'height': 844, 'device_scale_factor': 3,
               'user_agent': IPHONE_UA},
}

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
        await gate.tap()
    try:
        await page.locator('.boot').wait_for(state='detached', timeout=8000)
    except Exception:
        pass
    await page.wait_for_timeout(450)


async def open_menu(page):
    await page.goto(BASE + '/', wait_until='networkidle')
    await page.wait_for_timeout(600)
    await boot(page)
    await page.locator('.menu-stage').wait_for(state='visible', timeout=5000)
    await page.wait_for_timeout(420)


async def tap_social_tile(page):
    box = await page.locator('[data-section-id="social"]').bounding_box()
    if not box:
        return False
    await page.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    return True


async def install_probes(page):
    await page.evaluate("""() => {
      window.__socialSounds = [];
      window.__socialLinkClicks = [];
      window.addEventListener('jsb:sound', (event) => {
        window.__socialSounds.push(event.detail && event.detail.event);
      });
      document.addEventListener('click', (event) => {
        const anchor = event.target instanceof Element
          ? event.target.closest('a[href]')
          : null;
        if (anchor && !anchor.getAttribute('href').startsWith('#')) {
          window.__socialLinkClicks.push(anchor.href);
        }
      }, true);
    }""")


async def read_probes(page):
    return await page.evaluate("""() => ({
      sounds: window.__socialSounds || [],
      linkClicks: window.__socialLinkClicks || [],
    })""")


async def assert_clean_open(page, label):
    await page.wait_for_timeout(1000)
    probes = await read_probes(page)
    path = await page.evaluate('location.pathname')
    social = await page.locator('.social-screen').count()
    extra_pages = [p.url for p in page.context.pages if p is not page and not p.is_closed()]
    confirms = probes['sounds'].count('confirm') if isinstance(probes['sounds'], list) else -1
    check(social == 1 and path == '/social',
          f'{label}: the Social tile shows only the Social screen',
          f'path={path}, social={social}')
    check(not extra_pages, f'{label}: no popup or external page', str(extra_pages))
    check(not probes['linkClicks'], f'{label}: no social link is activated',
          str(probes['linkClicks'][:3]))
    check(confirms == 1, f'{label}: one tab-select confirm and no link click sound',
          f'confirms={confirms}, sounds={probes["sounds"][:6]}')


async def back_to_menu(page):
    await page.get_by_role('button', name='Back to Home').tap()
    try:
        await page.wait_for_url(BASE + '/', timeout=3000)
    except Exception:
        pass
    await page.locator('.menu-stage').wait_for(state='visible', timeout=4000)
    await page.wait_for_timeout(550)


async def deliberate_link_tap(page):
    await page.evaluate('window.__socialSounds = []; window.__socialLinkClicks = []')
    box = await page.locator('.social-row').first.bounding_box()
    if not box:
        return None
    popup_task = asyncio.create_task(page.context.wait_for_event('page', timeout=4000))
    await page.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    try:
        popup = await popup_task
    except Exception:
        popup_task.cancel()
        popup = None
    await page.wait_for_timeout(600)
    return popup


async def run_suite(browser, label):
    global engine
    engine = label
    is_webkit = label == 'webkit'
    context = await browser.new_context(
        viewport={'width': DEVICES[label]['width'], 'height': DEVICES[label]['height']},
        device_scale_factor=DEVICES[label]['device_scale_factor'],
        user_agent=DEVICES[label]['user_agent'],
        has_touch=True,
        is_mobile=True,
    )
    await context.add_init_script(AUDIO_ON)
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))

    await open_menu(page)
    await install_probes(page)

    # The first open loads the Social chunk on demand: the screen is still a
    # skeleton when the compatibility click lands.
    check(await tap_social_tile(page), f'{label}: Social tile has a touch target')
    await assert_clean_open(page, 'first tap')
    await back_to_menu(page)

    # Warm chunk: this is the original failure. The screen paints under the
    # finger before the compatibility click is dispatched.
    await page.evaluate('window.__socialSounds = []; window.__socialLinkClicks = []')
    check(await tap_social_tile(page), f'{label}: warm Social tile has a touch target')
    await assert_clean_open(page, 'warm tap')

    popup = await deliberate_link_tap(page)
    probes = await read_probes(page)
    confirms = probes['sounds'].count('confirm') if isinstance(probes['sounds'], list) else 0
    opened = bool(popup) and 'x.com' in (popup.url or '')
    check(opened, f'{label}: a deliberate tap on the first social row opens it',
          f'popup={popup.url if popup else None}')
    check(bool(probes['linkClicks']), f'{label}: the deliberate tap reaches the row link',
          str(probes['linkClicks']))
    check(confirms == 1, f'{label}: the deliberate link tap confirms once',
          f'confirms={confirms}, sounds={probes["sounds"][:6]}')
    if popup is not None and not popup.is_closed():
        await popup.close()

    ignored = 'Failed to start the audio device'
    app_errors = [error for error in errors if ignored not in error]
    check(not app_errors, f'{label}: no page errors', '; '.join(app_errors[:3]))
    await context.close()


async def main():
    async with async_playwright() as p:
        chromium = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        try:
            await run_suite(chromium, 'chromium')
        finally:
            await chromium.close()

        try:
            webkit = await p.webkit.launch()
        except Exception as error:
            reason = ' '.join(str(error).split())
            print(f'SKIP  [webkit] host cannot launch WebKit: {reason[:240]}')
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
    print('\nAll Social tile checks passed.')


if __name__ == '__main__':
    asyncio.run(main())
