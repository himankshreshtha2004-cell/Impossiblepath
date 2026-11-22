import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 1280, "height": 800})
        await pg.goto('http://127.0.0.1:5190/?clean'); await pg.wait_for_timeout(3000)
        for l in (1,2):
            await pg.evaluate(f"window.__ipGame.useGame.getState().startLevel({l})"); await pg.wait_for_timeout(4000)
            print(l, await pg.evaluate("JSON.stringify({f:__ip.frame, z:__ip.camera.zoom})"))
        await b.close()
asyncio.run(main())
