import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 1280, "height": 800})
        await pg.goto('http://127.0.0.1:5190/'); await pg.wait_for_timeout(3000)
        await pg.evaluate("window.__ipGame.useGame.getState().startLevel(2)"); await pg.wait_for_timeout(9000)
        W="window.__ipGame.getWorld()"
        await pg.evaluate(f"(()=>{{const w={W}; w.setStop('B',1); w.setStop('T1',180); w.setStop('T2',180); w.node='L:m'}})()")
        await pg.wait_for_timeout(1500)
        c = await pg.evaluate(f"{W}.liveCenter('L:m')")
        x,y = await pg.evaluate(f"__ip.toScreen({c})")
        await pg.screenshot(path='dbg5.png', clip={'x':x-160,'y':y-160,'width':320,'height':320})
        print(c, x, y, await pg.evaluate(f"JSON.stringify(__ip.hitAt({x},{y}))"), await pg.evaluate(f"JSON.stringify(__ip.hitAt({x+20},{y+30}))"))
        await b.close()
asyncio.run(main())
