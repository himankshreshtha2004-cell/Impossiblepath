import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 1280, "height": 800})
        await pg.goto('http://127.0.0.1:5190/'); await pg.wait_for_timeout(6000)
        await pg.screenshot(path='/home/claude/impossible-path/qa/ui_title.png')
        await pg.get_by_role('button', name='Chapters').click(); await pg.wait_for_timeout(1500)
        await pg.locator('.node').nth(13).hover(); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/home/claude/impossible-path/qa/ui_chapters.png')
        m = await b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        await m.goto('http://127.0.0.1:5190/'); await m.wait_for_timeout(6000)
        await m.screenshot(path='/home/claude/impossible-path/qa/ui_mobile_title.png')
        await m.evaluate("window.__ipGame.useGame.getState().startLevel(1)"); await m.wait_for_timeout(4000)
        await m.screenshot(path='/home/claude/impossible-path/qa/ui_mobile_l1.png')
        await b.close()
asyncio.run(main())
