import asyncio, sys, json
from playwright.async_api import async_playwright
LEVEL = int(sys.argv[1]); STATES = json.loads(sys.argv[2])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 1280, "height": 800}); errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto('http://127.0.0.1:5190/?clean'); await pg.wait_for_timeout(4000)
        await pg.evaluate(f"window.__ipGame.useGame.getState().startLevel({LEVEL})"); await pg.wait_for_timeout(8000)
        for i, st in enumerate(STATES):
            js = "(()=>{const w=window.__ipGame.getWorld();" + "".join(f"w.setStop('{k}',{v});" for k,v in st.items() if k not in ('node','view')) + (f"w.node='{st['node']}';" if 'node' in st else '') + (f"w.setView({st['view']});" if 'view' in st else '') + "})()"
            await pg.evaluate(js); await pg.wait_for_timeout(1800)
            await pg.screenshot(path=f'/home/claude/impossible-path/qa/st{LEVEL}_{i}.png')
        print(errs)
        await b.close()
asyncio.run(main())
