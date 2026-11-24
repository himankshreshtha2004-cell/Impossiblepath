"""Play levels in the browser using ONLY the guide: its world-turn button, the wheel and arrow it
points at, and the tile it rings. Checks each level is finished and the next one loads.

Usage: python3 e2e_levels.py 101,102,1,2   (level ids; tutorials are 101–105)
"""
import asyncio, sys
from playwright.async_api import async_playwright
from ipdrive import Driver, W, G, ang
URL = 'http://127.0.0.1:5190/'
IDS = [int(x) for x in (sys.argv[1] if len(sys.argv) > 1 else '101,1,2,3').split(',')]
results = []
def check(name, ok, info=''):
    results.append((name, ok)); print(('PASS ' if ok else 'FAIL ') + name + (('  ' + str(info)) if info else ''), flush=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 1280, "height": 800})
        errs = []
        pg.on("pageerror", lambda e: errs.append("PAGE " + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(3000)
        d = Driver(pg)
        for lid in IDS:
            await d.ev(f"{G}.startLevel({lid})")
            await d.wait_for(f"{G}.phase === 'play' && {G}.levelId === {lid}", 30)
            await d.wait_for(f"{G}.guide", 6)
            if not await d.ev(f"{G}.guide"): await d.ev(f"{G}.showHint()")
            await pg.wait_for_timeout(400)
            await pg.screenshot(path=f'/home/claude/impossible-path/qa/lv{lid:02d}_start.png')
            steps, stuck = [], ''
            for _ in range(60):
                if await d.ev(f"{G}.phase !== 'play' || {G}.levelId !== {lid}"): break
                h = await d.ev(f"(() => {{ const h = {G}.hint; const l = {G}.live; return h && {{ step: {G}.hintStep, view: h.view ?? null, turn: h.turn ?? null, slide: h.slide ?? null, tile: h.tile ?? null, dir: l && l.worldDir ? l.worldDir : null }} }})()")
                if not h: break
                steps.append(h['step'])
                if h['view'] is not None: ok = await d.set_view(h['view'])
                elif h['turn']: ok = await d.turn(h['turn']['id'], h['turn']['to'])
                elif h['slide']: ok = await d.slide(h['slide']['id'], h['slide']['to'])
                elif h['tile']: ok = await d.tap(h['tile'], 40)
                else: ok = True
                if not ok: stuck = str(h); break
                await pg.wait_for_timeout(300)
            ok = await d.wait_for(f"{G}.save.completed.includes({lid}) || ({G}.save.tutorial || []).includes({lid})", 30)
            nxt = 1 if lid == 105 else (lid + 1 if lid != 50 else None)
            loaded = (await d.wait_for(f"{G}.levelId === {nxt} && {G}.phase !== 'outro'", 25)) if (ok and nxt) else ((await d.wait_for(f"{G}.phase === 'end'", 25)) if ok else False)
            check(f'level {lid:02d}: played by the guide alone to the door, then the next level loads', ok and loaded, f'stuck at {stuck}' if stuck else f'{len(steps)} guide steps')
        print('\n'.join(errs[:10]))
        await b.close()
    bad = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(bad)}/{len(results)} passed")
asyncio.run(main())
