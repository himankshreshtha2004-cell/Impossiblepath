import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 1280, "height": 800})
        await pg.goto('http://127.0.0.1:5190/'); await pg.wait_for_timeout(3000)
        await pg.evaluate("window.__ipGame.useGame.getState().startLevel(2)"); await pg.wait_for_timeout(9000)
        W="window.__ipGame.getWorld()"
        h = await pg.evaluate("__ip.handleAt('B')")
        x0,y0 = await pg.evaluate(f"__ip.toScreen({h})")
        x1,y1 = await pg.evaluate(f"__ip.toScreen([{h[0]+1},{h[1]},{h[2]}])")
        print('grip', h, x0,y0, '->', x1,y1, await pg.evaluate("window.__ipGame.useGame.getState().phase"))
        await pg.mouse.move(x0,y0); await pg.mouse.down()
        await pg.wait_for_timeout(200)
        print('dragging?', await pg.evaluate(f"{W}.dragging"))
        for i in range(1,13):
            await pg.mouse.move(x0+(x1-x0)*i/12, y0+(y1-y0)*i/12); await pg.wait_for_timeout(25)
        await pg.mouse.up(); await pg.wait_for_timeout(1500)
        print('B', await pg.evaluate(f"{W}.values.B"))
        await pg.screenshot(path='dbg2.png')
        await b.close()
asyncio.run(main())
