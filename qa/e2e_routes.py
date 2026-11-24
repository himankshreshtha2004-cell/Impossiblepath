"""Browser playthrough of EVERY way through each level, with real mouse drags and taps only.

For each level and each of its ways (from qa/routes.json, made by app/scripts/routes-export.ts):
  1. start the level; tap the door straight away and check the traveller does NOT move
     (the door is never reachable before something has been turned or slid);
  2. play the way: world turns with the corner buttons, towers by dragging their wheel (or the
     tower itself), bridges and lifts by dragging them, walking by tapping tiles;
  3. check the level completes, the game credits exactly that way, and the next level loads.

Usage: python3 e2e_routes.py <levels|all> [all | way numbers, e.g. 2 or 1,3]
"""
import asyncio, json, sys
from playwright.async_api import async_playwright
from ipdrive import Driver, W, G
URL = 'http://127.0.0.1:5190/'
ROUTES = json.load(open('/home/claude/impossible-path/qa/routes.json'))
IDS = [int(x) for x in sys.argv[1].split(',')] if len(sys.argv) > 1 and sys.argv[1] != 'all' else sorted(int(k) for k in ROUTES)
# which ways to play: 'all', or a comma list of way numbers (1 = the standard way)
WAYS = sys.argv[2] if len(sys.argv) > 2 else 'all'
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
        ev, wait_for = d.ev, d.wait_for
        turn, slide, set_view, tap = d.turn, d.slide, d.set_view, d.tap

        for lid in IDS:
            info = ROUTES[str(lid)]
            for i, acts in enumerate(info['plays']):
                if WAYS != 'all' and str(i + 1) not in WAYS.split(','): continue
                if acts is None:
                    check(f'level {lid:02d} way {i + 1}', False, 'no visible way to play it'); continue
                await ev(f"{G}.clearHint()")
                await ev(f"{G}.startLevel({lid})")
                await wait_for(f"{G}.phase === 'play' && {G}.levelId === {lid}", 30)
                await ev(f"{G}.clearHint()"); await pg.wait_for_timeout(300)
                # the door can't be reached before anything is moved: tapping it changes nothing
                if i == min(j for j in range(len(info['plays'])) if WAYS == 'all' or str(j + 1) in WAYS.split(',')):
                    door = await ev(f"[...{W}.graph.nodes.values()].find(n => n.tile.exit).key")
                    start_piece = await ev(f"{W}.node.split(':')[0]")
                    x, y = await ev(f"__ip.toScreen({W}.liveCenter('{door}'))")
                    await pg.mouse.click(x, y); await pg.wait_for_timeout(2500)
                    moved_far = await ev(f"{W}.node.split(':')[0] !== '{start_piece}' && {W}.node === '{door}'")
                    check(f'level {lid:02d}: tapping the unreachable door at the start does nothing', not moved_far)
                    await ev(f"{G}.restart()"); await wait_for(f"{G}.phase === 'play'", 20); await ev(f"{G}.clearHint()")
                ok = True; why = ''
                for a in acts:
                    if 'view' in a: ok = await set_view(a['view'])
                    elif 'turn' in a: ok = await turn(a['turn'], a['to'])
                    elif 'slide' in a: ok = await slide(a['slide'], a['to'])
                    else: ok = await tap(a['tap'])
                    if not ok: why = str(a); break
                    await ev(f"{G}.clearHint()")
                done = ok and await wait_for(f"{G}.save.completed.includes({lid}) && ({G}.save.ways?.[{lid}] || []).includes({i})", 25)
                credited = await ev(f"{G}.wayNote ? {G}.wayNote.way : null")
                nxt = lid + 1 if lid < 50 else None
                loaded = True
                if done and nxt:
                    loaded = await wait_for(f"{G}.levelId === {nxt} && {G}.phase !== 'outro'", 25)
                check(f'level {lid:02d} way {i + 1}/{len(info["plays"])} ({" > ".join(info["routes"][i])})', done and credited == i and loaded,
                      f'stuck at {why} — {d.why}' if not ok else f'credited way {credited}, next level loaded={loaded}')
        print('\n'.join(errs[:10]))
        await b.close()
    bad = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(bad)}/{len(results)} passed")
    for n in bad: print('  FAILED:', n)
asyncio.run(main())
