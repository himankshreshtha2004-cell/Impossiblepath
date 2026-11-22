import asyncio, sys
from playwright.async_api import async_playwright
URL = 'http://127.0.0.1:5190/'
OUT = '/home/claude/impossible-path/qa/t'
LEVEL = int(sys.argv[1]) if len(sys.argv) > 1 else 1
SETUP = sys.argv[2] if len(sys.argv) > 2 else ''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 1280, "height": 800}); errs = []
        pg.on("pageerror", lambda e: errs.append("PAGE " + str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        await pg.goto(URL); await pg.wait_for_timeout(6000)
        await pg.screenshot(path=OUT + "_title.png")
        await pg.evaluate(f"window.__ipGame.useGame.getState().startLevel({LEVEL})"); await pg.wait_for_timeout(9000)
        await pg.screenshot(path=OUT + f"_l{LEVEL}.png")
        if SETUP:
            await pg.evaluate("(()=>{const w=window.__ipGame.getWorld();" + SETUP + "})()"); await pg.wait_for_timeout(2500)
            await pg.screenshot(path=OUT + f"_l{LEVEL}_b.png")
        print("\n".join(errs[:25]))
        await b.close()
asyncio.run(main())
