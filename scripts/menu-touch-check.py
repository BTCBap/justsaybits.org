#!/usr/bin/env python3
"""Touch, haptic and layout checks for the PS2 main menu.

Run against a built preview:

    npm run build
    npx vite preview --port 4302
    python3 scripts/menu-touch-check.py

Needs Playwright for Python and a Chromium/Chrome binary. Set CHROME to point
at one; otherwise Playwright's bundled browser or a system Chrome is used.
"""
import asyncio
import os
import shutil
import sys

from playwright.async_api import async_playwright

BASE = os.environ.get('BASE', 'http://localhost:4302').rstrip('/')
CHROME = os.environ.get('CHROME') or shutil.which('google-chrome') \
    or shutil.which('chromium') or shutil.which('chromium-browser')
IPHONE_UA = ('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) '
             'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 '
             'Mobile/15E148 Safari/604.1')

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
        await gate.click()
    try:
        await page.locator('.boot').wait_for(state='detached', timeout=8000)
    except Exception:
        pass
    await page.wait_for_timeout(500)


async def open_menu(page):
    await page.goto(BASE + '/', wait_until='networkidle')
    await page.wait_for_timeout(700)
    await boot(page)
    await page.locator('.menu-stage').wait_for(state='visible', timeout=5000)
    await page.wait_for_timeout(450)


async def counter(page):
    return (await page.locator('.menu-counter span').first.inner_text()).strip()


async def swipe(client, x1, y1, x2, y2, steps=8):
    await client.send('Input.dispatchTouchEvent', {
        'type': 'touchStart',
        'touchPoints': [{'x': x1, 'y': y1, 'radiusX': 6, 'radiusY': 6, 'force': 1}],
    })
    for step in range(1, steps + 1):
        x = x1 + (x2 - x1) * step / steps
        y = y1 + (y2 - y1) * step / steps
        await client.send('Input.dispatchTouchEvent', {
            'type': 'touchMove',
            'touchPoints': [{'x': x, 'y': y, 'radiusX': 6, 'radiusY': 6, 'force': 1}],
        })
        await asyncio.sleep(0.018)
    await client.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    await asyncio.sleep(0.55)


async def phone_checks(browser):
    ctx = await browser.new_context(
        viewport={'width': 390, 'height': 844}, device_scale_factor=2,
        is_mobile=True, has_touch=True, user_agent=IPHONE_UA,
    )
    await ctx.add_init_script("""
        window.__vibes = [];
        try {
          Object.defineProperty(Navigator.prototype, 'vibrate', {
            configurable: true,
            value: function (pattern) { window.__vibes.push(pattern); return true; },
          });
        } catch (error) {
          navigator.vibrate = function (pattern) { window.__vibes.push(pattern); return true; };
        }
    """)
    page = await ctx.new_page()
    await open_menu(page)
    client = await ctx.new_cdp_session(page)

    check(await counter(page) == '01 / 06', 'phone starts on 01 / 06')

    layout = await page.evaluate('''() => {
      const box = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
      };
      return {
        arrow: getComputedStyle(document.querySelector('.menu-edge')).display,
        prev: box('.menu-edge--prev'),
        next: box('.menu-edge--next'),
        toggles: box('.menu-toggles'),
        counter: box('.menu-counter'),
        stage: box('.menu-stage'),
        haptics: !!document.querySelector('button[aria-label="Haptics"]'),
      };
    }''')
    check(layout['arrow'] == 'flex', 'phone shows the edge arrows')
    check(layout['prev']['x'] <= 8 and layout['next']['x'] + layout['next']['w'] >= 382,
          'arrows sit on the viewport edges', str([layout['prev'], layout['next']]))
    check(layout['prev']['w'] >= 44 and layout['prev']['h'] >= 44
          and layout['next']['w'] >= 44 and layout['next']['h'] >= 44,
          'arrows keep 44 px tap targets')
    hits = await page.evaluate('''() => {
      const arrows = [...document.querySelectorAll('.menu-edge')];
      const hits = [];
      for (const arrow of arrows) {
        const r = arrow.getBoundingClientRect();
        for (let x = r.left + 2; x < r.right - 1; x += 8) {
          for (let y = r.top + 2; y < r.bottom - 1; y += 8) {
            const hit = document.elementFromPoint(x, y);
            if (hit && hit.closest('.menu-option')) hits.push([x, y]);
          }
        }
      }
      return hits;
    }''')
    check(not hits, 'arrows never sit over a tile pixel', str(hits[:3]))
    check(layout['haptics'], 'phone shows the haptics toggle (iOS fallback)')
    check(abs(layout['toggles']['x'] + layout['toggles']['w'] / 2 - 195) <= 1,
          'toggle row is centred')
    check(abs(layout['counter']['x'] + layout['counter']['w'] / 2 - 195) <= 1,
          'counter is centred')
    check(layout['counter']['y'] + layout['counter']['h'] >= 840,
          'counter sits at the bottom', str(layout['counter']))

    # One tap on a non-active tile selects and opens it.
    await page.tap('[data-section-id="social"]')
    try:
        await page.wait_for_url('**/social', timeout=3000)
        opened = True
    except Exception:
        opened = False
    check(opened, 'one tap opens Social', page.url)
    vibes = await page.evaluate('window.__vibes')
    check(18 in vibes, 'tap fires the 18 ms tick haptic', str(vibes))
    check(35 in vibes, 'open fires the 35 ms confirm haptic', str(vibes))
    check(0 not in vibes, 'no vibrate(0) cancels the new pulse', str(vibes))

    # Swipe on the slider, then on the empty header, then vertically.
    await open_menu(page)
    await page.evaluate('window.__vibes = []')
    slider = await page.locator('.menu-stage-wrap').bounding_box()
    await swipe(client, slider['x'] + slider['width'] - 40,
                slider['y'] + slider['height'] / 2,
                slider['x'] + 40, slider['y'] + slider['height'] / 2)
    check(await counter(page) == '02 / 06', 'slider swipe moves to 02 / 06', await counter(page))
    check(page.url.rstrip('/') == BASE, 'slider swipe does not open a section', page.url)
    swipe_vibes = await page.evaluate('window.__vibes')
    check(18 in swipe_vibes, 'swipe fires the 18 ms tick haptic', str(swipe_vibes))

    await swipe(client, 380, 60, 250, 60)
    check(await counter(page) == '03 / 06', 'header swipe moves to 03 / 06', await counter(page))
    check(page.url.rstrip('/') == BASE, 'header swipe does not open a section', page.url)

    before = await counter(page)
    await swipe(client, 195, 330, 195, 520)
    check(await counter(page) == before, 'vertical swipe leaves the section alone')
    check(page.url.rstrip('/') == BASE, 'vertical swipe does not open a section', page.url)

    # A tap on a toggle after a swipe still works.
    haptics = page.locator('button[aria-label="Haptics"]')
    before_pressed = await haptics.get_attribute('aria-pressed')
    await haptics.tap()
    await page.wait_for_timeout(150)
    after_pressed = await haptics.get_attribute('aria-pressed')
    check(before_pressed != after_pressed, 'toggle tap after a swipe is not swallowed')

    # No motion toggle: the device setting always wins, including over a
    # manual override left in storage by an older build.
    check(await page.locator('button[aria-label="Reduce motion"]').count() == 0,
          'no motion toggle')
    await page.evaluate("""() => {
      localStorage.removeItem('jsb.prefs.v2');
      localStorage.setItem('jsb.prefs.v1', JSON.stringify(
        {sound: true, haptics: true, motion: 'on', soundHintDismissed: true}));
    }""")
    await page.reload(wait_until='networkidle')
    await page.wait_for_timeout(700)
    await boot(page)
    await page.locator('.menu-stage').wait_for(state='visible', timeout=5000)
    await page.wait_for_timeout(400)
    check(await page.evaluate("document.documentElement.dataset.motion") == 'auto',
          'stored motion override falls back to auto')
    prefs = await page.evaluate("JSON.parse(localStorage.getItem('jsb.prefs.v2'))")
    check('motion' not in prefs, 'stored motion override is cleared', str(prefs))
    check(prefs.get('sound') is False,
          'legacy sound:true migrates to off', str(prefs))

    # Reduced motion must not disable the gesture.
    await page.emulate_media(reduced_motion='reduce')
    await page.reload(wait_until='networkidle')
    await page.wait_for_timeout(700)
    await boot(page)
    await page.locator('.menu-stage').wait_for(state='visible', timeout=5000)
    await page.wait_for_timeout(400)
    check(await page.evaluate("document.documentElement.dataset.motion") == 'reduced',
          'reduced motion is active')
    slider = await page.locator('.menu-stage-wrap').bounding_box()
    await swipe(client, slider['x'] + slider['width'] - 40,
                slider['y'] + slider['height'] / 2,
                slider['x'] + 40, slider['y'] + slider['height'] / 2)
    check(await counter(page) == '02 / 06', 'swipe works with reduced motion',
          await counter(page))
    check(page.url.rstrip('/') == BASE, 'reduced-motion swipe does not open a section')

    # The slider alone is the menu: the selected tile opens, and the active
    # section is still announced.
    await open_menu(page)
    live = await page.locator('.menu-stage-wrap').evaluate(
        "e => e.parentElement.querySelector('[role=status]').textContent.trim()")
    check('About' in live, 'live region names the active section', live)
    await page.tap('[data-section-id="about"]')
    try:
        await page.wait_for_url('**/about', timeout=3000)
        check(True, 'tapping the active tile opens the selected section')
    except Exception:
        check(False, 'tapping the active tile opens the selected section', page.url)
    await ctx.close()


async def ios_fallback_checks(browser):
    ctx = await browser.new_context(
        viewport={'width': 390, 'height': 844}, device_scale_factor=2,
        is_mobile=True, has_touch=True, user_agent=IPHONE_UA,
    )
    await ctx.add_init_script("""
        try {
          Object.defineProperty(Navigator.prototype, 'vibrate', {
            configurable: true, value: undefined,
          });
        } catch (error) {}
    """)
    page = await ctx.new_page()
    await open_menu(page)
    check(await page.evaluate("typeof navigator.vibrate") == 'undefined',
          'iOS context has no Vibration API')
    check(await page.locator('button[aria-label="Haptics"]').is_visible(),
          'haptics toggle falls back to the iOS switch')

    # The active tile opens with the confirm haptic, so one more switch click
    # must flip the checkbox from whatever the boot tick left it at.
    before = await page.evaluate('''() => {
      const label = [...document.querySelectorAll('label')]
        .find(item => item.querySelector('input[switch]'));
      return label ? label.querySelector('input').checked : null;
    }''')
    await page.tap('[data-section-id="about"]')
    await page.wait_for_url('**/about', timeout=3000)
    hidden = await page.evaluate('''() => {
      const labels = [...document.querySelectorAll('label')]
        .filter(label => label.querySelector('input[switch]'));
      if (!labels.length) return { count: 0 };
      const label = labels[0];
      const input = label.querySelector('input[switch]');
      return {
        count: labels.length,
        ariaHidden: label.getAttribute('aria-hidden'),
        tabIndex: input.tabIndex,
        checked: input.checked,
        opacity: getComputedStyle(label).opacity,
      };
    }''')
    check(hidden.get('count') == 1, 'one hidden switch label exists')
    check(hidden.get('ariaHidden') == 'true', 'switch label is aria-hidden')
    check(hidden.get('tabIndex') == -1, 'switch input is out of the tab order')
    check(hidden.get('checked') is not before, 'switch label click fires synchronously')
    check(hidden.get('opacity') == '0', 'switch label is visually hidden')

    # A second visit reuses the same element.
    await open_menu(page)
    await page.tap('[data-section-id="about"]')
    await page.wait_for_url('**/about', timeout=3000)
    count = await page.evaluate("""() =>
      [...document.querySelectorAll('label')].filter(l => l.querySelector('input[switch]')).length""")
    check(count == 1, 'switch label is appended once', str(count))
    await ctx.close()


async def desktop_checks(browser):
    ctx = await browser.new_context(viewport={'width': 1440, 'height': 900})
    page = await ctx.new_page()
    await open_menu(page)
    check(await page.locator('.menu-edge--next').is_visible(), 'desktop keeps the arrow')
    await page.locator('.menu-edge--next').click()
    await page.wait_for_timeout(250)
    check(await counter(page) == '02 / 06', 'desktop arrow changes the section')
    check(page.url.rstrip('/') == BASE, 'desktop arrow does not open a section')

    await page.locator('[data-section-id="book"]').hover()
    await page.wait_for_timeout(250)
    title = await page.locator('[role="option"][aria-selected="true"] > span:last-child').inner_text()
    check(title.strip().upper() == 'BOOK', 'hover previews Book', title)
    await page.locator('[data-section-id="book"]').click()
    try:
        await page.wait_for_url('**/book', timeout=3000)
        check(True, 'desktop click opens Book')
    except Exception:
        check(False, 'desktop click opens Book', page.url)

    # Controls must clear every icon and label at fine-pointer widths.
    for width in (768, 900, 1100, 1280, 1440):
        await page.set_viewport_size({'width': width, 'height': 900})
        await open_menu(page)
        collisions = await page.evaluate('''() => {
          const hits = [];
          for (const arrow of document.querySelectorAll('.menu-edge')) {
            const r = arrow.getBoundingClientRect();
            for (let x = r.left + 2; x < r.right - 1; x += 8) {
              for (let y = r.top + 2; y < r.bottom - 1; y += 8) {
                const hit = document.elementFromPoint(x, y);
                if (hit && hit.closest('.menu-option')) hits.push([x, y]);
              }
            }
          }
          return hits;
        }''')
        check(not collisions, f'arrows clear icons and labels at {width}px',
              str(collisions[:2]))

    await page.set_viewport_size({'width': 1440, 'height': 900})
    await page.goto(BASE + '/portfolio/design', wait_until='networkidle')
    await page.wait_for_timeout(700)
    await boot(page)
    await page.locator('.design-tile').first.wait_for(state='visible', timeout=5000)
    await page.wait_for_timeout(500)

    tile_info = await page.evaluate('''() => {
      const frames = [...document.querySelectorAll('.design-tile__image')];
      const square = frames.map(frame => {
        const rect = frame.getBoundingClientRect();
        return { w: Math.round(rect.width), h: Math.round(rect.height) };
      });
      const tile = [...document.querySelectorAll('.design-tile')]
        .find(node => node.textContent.includes('Satoshi Pacioli Accounting'));
      const frame = tile.querySelector('.design-tile__image');
      const image = tile.querySelector('.design-tile__img');
      const f = frame.getBoundingClientRect();
      const i = image.getBoundingClientRect();
      // The img box carries the 8 px padding; the painted mark is contained
      // inside its content box. 720 x 280 is the Satoshi source ratio.
      const pad = parseFloat(getComputedStyle(image).paddingLeft);
      const contentW = i.width - pad * 2;
      const contentH = i.height - pad * 2;
      const ratio = 720 / 280;
      const paintedW = contentW / contentH > ratio ? contentH * ratio : contentW;
      const paintedH = paintedW / ratio;
      return {
        squares: square.every(box => box.w === box.h),
        sizes: square,
        inset: {
          left: (i.left - f.left) + pad + (contentW - paintedW) / 2,
          right: (f.right - i.right) + pad + (contentW - paintedW) / 2,
          top: (i.top - f.top) + pad + (contentH - paintedH) / 2,
          bottom: (f.bottom - i.bottom) + pad + (contentH - paintedH) / 2,
        },
        fit: getComputedStyle(image).objectFit,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    }''')
    check(tile_info['squares'], 'every design tile keeps the square frame',
          str(tile_info['sizes'][:4]))
    check(all(value >= 7 for value in tile_info['inset'].values()),
          'Satoshi image keeps padding inside the frame', str(tile_info['inset']))
    check(tile_info['fit'] == 'contain', 'Satoshi image is contained')
    check(not tile_info['overflow'], 'design grid has no horizontal overflow')
    await ctx.close()


async def main():
    async with async_playwright() as p:
        launch = {'args': ['--no-sandbox']}
        if CHROME:
            launch['executable_path'] = CHROME
        browser = await p.chromium.launch(**launch)
        try:
            await phone_checks(browser)
            await ios_fallback_checks(browser)
            await desktop_checks(browser)
        finally:
            await browser.close()

    if failures:
        print(f'\n{len(failures)} failure(s):')
        for failure in failures:
            print(' -', failure)
        sys.exit(1)
    print('\nAll menu touch checks passed.')


if __name__ == '__main__':
    asyncio.run(main())
