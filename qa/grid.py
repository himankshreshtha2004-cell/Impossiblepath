import asyncio, sys
from playwright.async_api import async_playwright
from PIL import Image
ids = [int(x) for x in sys.argv[1].split(',')]
out = sys.argv[2]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 900, "height": 700})
        await pg.goto('http://127.0.0.1:5190/?clean'); await pg.wait_for_timeout(3000)
        shots = []
        for i in ids:
            await pg.evaluate(f"(()=>{{const g=window.__ipGame.useGame.getState(); g.startLevel({i});}})()")
            await pg.wait_for_timeout(5500)
            f = f'/tmp/lv{i}.png'
            await pg.screenshot(path=f)
            shots.append((i, f))
        await b.close()
    cols = 4
    rows = (len(shots) + cols - 1) // cols
    W = Image.new('RGB', (cols * 450, rows * 350), 'white')
    for k, (i, f) in enumerate(shots):
        im = Image.open(f).resize((450, 350))
        W.paste(im, ((k % cols) * 450, (k // cols) * 350))
    W.save(out)
asyncio.run(main())
