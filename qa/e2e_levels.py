"""Play a sample of generated levels in the browser using ONLY the guide (button, arrow direction, ring)."""
import asyncio, math, sys, time
from playwright.async_api import async_playwright
URL = 'http://127.0.0.1:5190/'
IDS = [int(x) for x in (sys.argv[1] if len(sys.argv) > 1 else '3,12,24,37,50').split(',')]
W = "window.__ipGame.getWorld()"
G = "window.__ipGame.useGame.getState()"
results = []
def check(name, ok, info=''):
    results.append((name, ok)); print(('PASS ' if ok else 'FAIL ') + name + (('  ' + str(info)) if info else ''), flush=True)
def ang(v): return ((v % 360) + 360) % 360

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 1280, "height": 800})
        errs = []
        pg.on("pageerror", lambda e: errs.append("PAGE " + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(4000)
        async def ev(js): return await pg.evaluate(js)
        async def wait_for(js, timeout=40):
            t0 = time.time()
            while time.time() - t0 < timeout:
                if await ev(js): return True
                await pg.wait_for_timeout(250)
            return False
        async def drag_path(pts):
            x, y = await ev(f"__ip.toScreen({pts[0]})")
            await pg.mouse.move(x, y); await pg.mouse.down()
            for q in pts[1:]:
                x, y = await ev(f"__ip.toScreen({q})"); await pg.mouse.move(x, y); await pg.wait_for_timeout(25)
            await pg.wait_for_timeout(120); await pg.mouse.up(); await pg.wait_for_timeout(1500)
        async def turn(sid, deg):
            before = await ev(f"{W}.values['{sid}']")
            c = await ev(f"__ip.handleAt('{sid}')")
            view = await ev(f"{W}.view")
            for (cx, cy, cz, r) in ((c[0], c[1], c[2], 1.12), None):
                break
            phi0 = 315 + view
            pts = [[c[0] + 1.12 * math.cos(math.radians(phi0 + deg * i / 14)), c[1], c[2] - 1.12 * math.sin(math.radians(phi0 + deg * i / 14))] for i in range(15)]
            await drag_path(pts)
            if abs(await ev(f"{W}.values['{sid}']") - before) < 1:
                # wheel hidden: press on the tower itself (its core tile) and drag round
                o = await ev(f"{W}.liveCenter('{sid}:c')")
                pts = [[o[0] + 1.0 * math.cos(math.radians(phi0 + deg * i / 14)), o[1], o[2] - 1.0 * math.sin(math.radians(phi0 + deg * i / 14))] for i in range(15)]
                await drag_path(pts)
        async def slide(sid, delta):
            axis = await ev(f"{W}.map.get('{sid}').motion.axis")
            t = await ev(f"{W}.liveCenter('{sid}:' + {W}.map.get('{sid}').tiles[0].id)")
            pts = [[t[0] + axis[0] * delta * i / 12, t[1] + axis[1] * delta * i / 12, t[2] + axis[2] * delta * i / 12] for i in range(13)]
            await drag_path(pts)
        for lid in IDS:
            await ev(f"{G}.startLevel({lid})")
            await wait_for(f"{G}.phase === 'play' && {G}.levelId === {lid}", 30)
            await wait_for(f"{G}.guide", 10)
            if not await ev(f"{G}.guide"):
                await pg.get_by_role('button', name='Hint', exact=True).click()
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=f'/home/claude/impossible-path/qa/lv{lid:02d}_start.png')
            steps = []
            for _ in range(40):
                if await ev(f"{G}.phase !== 'play' || {G}.levelId !== {lid}"): break
                h = await ev(f"(() => {{ const h = {G}.hint; const l = {G}.live; return h && {{ step: {G}.hintStep, view: h.view ?? null, turn: h.turn ?? null, slide: h.slide ?? null, tile: h.tile ?? null, dir: l && l.worldDir ? l.worldDir : null }} }})()")
                if not h: break
                steps.append(h['step'])
                if h['view'] is not None:
                    side = 'left' if h['dir'] == 1 else 'right'
                    await pg.locator(f'.world-btn.{side}').click()
                    await wait_for(f"{W}.settledView() !== null", 20); await pg.wait_for_timeout(400)
                elif h['turn']:
                    cur = ang(await ev(f"{W}.values['{h['turn']['id']}']"))
                    d = (h['turn']['to'] - cur) % 360
                    if d > 180: d -= 360
                    await turn(h['turn']['id'], d)
                elif h['slide']:
                    cur = await ev(f"{W}.values['{h['slide']['id']}']")
                    await slide(h['slide']['id'], h['slide']['to'] - cur)
                elif h['tile']:
                    x, y = await ev(f"__ip.toScreen({W}.liveCenter('{h['tile']}'))")
                    await pg.mouse.click(x, y)
                    await wait_for(f"({W}.node === '{h['tile']}' && !{W}.edge) || {G}.phase !== 'play'", 40)
                await pg.wait_for_timeout(500)
            ok = await wait_for(f"{G}.save.completed.includes({lid})", 30)
            check(f'level {lid:02d}: played by the guide alone to the door', ok, steps)
        print('\n'.join(errs[:10]))
        await b.close()
    bad = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(bad)}/{len(results)} passed")
asyncio.run(main())
