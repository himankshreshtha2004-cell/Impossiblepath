import asyncio, sys
from playwright.async_api import async_playwright
URL = 'http://127.0.0.1:5190/'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/impossible-path/qa/s'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 1280, "height": 800}); errs = []
        pg.on("pageerror", lambda e: errs.append("PAGE " + str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type in ("error", "warning") else None)
        await pg.goto(URL); await pg.wait_for_timeout(9000)
        await pg.screenshot(path=OUT + "_title.png")
        await pg.evaluate("window.__ipGame.useGame.getState().startLevel(1)"); await pg.wait_for_timeout(5000)
        await pg.screenshot(path=OUT + "_l1.png")
        await pg.evaluate("(()=>{const w=window.__ipGame.getWorld(); w.setStop('bridge',360)})()"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT + "_l1_aligned.png")
        print("\n".join(errs[:25]))
        await b.close()
asyncio.run(main())
