import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 1280, "height": 800})
        await pg.goto('http://127.0.0.1:5190/'); await pg.wait_for_timeout(3000)
        await pg.evaluate("window.__ipGame.useGame.getState().startLevel(2)"); await pg.wait_for_timeout(9000)
        W="window.__ipGame.getWorld()"
        await pg.evaluate(f"(()=>{{const w={W}; w.setStop('B',1); w.setStop('T1',180); w.setStop('T2',90); w.node='L:m'}})()")
        await pg.wait_for_timeout(1500)
        h = await pg.evaluate("__ip.handleAt('L')")
        x0,y0 = await pg.evaluate(f"__ip.toScreen({h})")
        x1,y1 = await pg.evaluate(f"__ip.toScreen([{h[0]},{h[1]+1},{h[2]}])")
        print('grip', h, x0, y0, x1, y1)
        await pg.screenshot(path='dbg4.png', clip={'x':x0-150,'y':y0-150,'width':300,'height':300})
        await pg.mouse.move(x0,y0); await pg.mouse.down(); await pg.wait_for_timeout(300)
        print('dragging', await pg.evaluate(f"{W}.dragging"))
        await pg.mouse.up()
        await b.close()
asyncio.run(main())
