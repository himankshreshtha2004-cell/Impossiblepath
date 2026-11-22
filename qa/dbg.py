import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 1280, "height": 800})
        pg.on("pageerror", lambda e: print("PAGE", e)); pg.on("console", lambda m: print("CONSOLE", m.text[:300]) if m.type=="error" else None)
        await pg.goto('http://127.0.0.1:5190/'); await pg.wait_for_timeout(5000)
        await pg.evaluate("window.__ipGame.useGame.getState().startLevel(2)")
        for i in range(6):
            await pg.wait_for_timeout(1500)
            print(await pg.evaluate("JSON.stringify({r:__ip.U.uReveal.value, lo:__ip.U.uFadeLow.value, hi:__ip.U.uFadeHigh.value, rmin:__ip.U.uRevealMin.value, rmax:__ip.U.uRevealMax.value, ph:__ipGame.useGame.getState().phase, tl:__ip.tl.current})"))
        await b.close()
asyncio.run(main())
