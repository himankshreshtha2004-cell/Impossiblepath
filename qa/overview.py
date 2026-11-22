import asyncio
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 640, "height": 640})
        await pg.goto('http://127.0.0.1:5190/?clean'); await pg.wait_for_timeout(3000)
        for i in range(1, 51):
            await pg.evaluate(f"window.__ipGame.useGame.getState().startLevel({i})")
            await pg.wait_for_timeout(4200)
            await pg.screenshot(path=f'/tmp/ov{i:02d}.png')
        await b.close()
    T = 220
    W = Image.new('RGB', (10 * T, 5 * T + 0), 'white')
    d = ImageDraw.Draw(W)
    try:
        f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
    except Exception:
        f = None
    for i in range(1, 51):
        im = Image.open(f'/tmp/ov{i:02d}.png').resize((T, T))
        x, y = ((i - 1) % 10) * T, ((i - 1) // 10) * T
        W.paste(im, (x, y))
        d.text((x + 8, y + 6), f'{i:02d}', fill=(60, 60, 70), font=f)
    W.save('/home/claude/all-50-levels.png')
asyncio.run(main())
