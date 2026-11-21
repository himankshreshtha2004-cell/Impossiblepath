"""End-to-end playthrough of Levels 01 and 02 with real mouse input (clicks and drags).

Run with the dev server on :5190.  python3 qa/e2e.py
"""
import asyncio, math, sys, time
from playwright.async_api import async_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5190/'
OUT = '/home/claude/impossible-path/qa/'
results = []


def check(name, ok, info=''):
    results.append((name, ok))
    print(('PASS ' if ok else 'FAIL ') + name + (('  ' + str(info)) if info else ''), flush=True)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 1280, "height": 800})
        errs = []
        pg.on("pageerror", lambda e: errs.append("PAGE " + str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        await pg.goto(URL)
        await pg.evaluate("localStorage.clear()")
        await pg.reload()
        await pg.wait_for_timeout(5000)

        W = "window.__ipGame.getWorld()"
        G = "window.__ipGame.useGame.getState()"

        async def ev(js):
            return await pg.evaluate(js)

        async def scr(name):
            await pg.screenshot(path=OUT + name + '.png')

        async def tile_xy(key):
            return await ev(f"__ip.toScreen({W}.liveCenter('{key}'))")

        async def click_tile(key):
            x, y = await tile_xy(key)
            await pg.mouse.click(x, y)

        async def wait_for(js, timeout=40):
            t0 = time.time()
            while time.time() - t0 < timeout:
                if await ev(js):
                    return True
                await pg.wait_for_timeout(250)
            return False

        async def turn_wheel(sid, degrees):
            """Grab a wheel on its near rim and drag it round its centre by `degrees`."""
            c = await ev(f"__ip.handleAt('{sid}')")
            r = 1.12
            view = await ev(f"{W}.view")
            phi0 = 315 + view  # the rim point nearest the camera in the current world view
            def pt(phi):
                a = math.radians(phi)
                return [c[0] + r * math.cos(a), c[1], c[2] - r * math.sin(a)]
            x, y = await ev(f"__ip.toScreen({pt(phi0)})")
            await pg.mouse.move(x, y)
            await pg.mouse.down()
            steps = max(8, int(abs(degrees) / 7))
            for i in range(1, steps + 1):
                x, y = await ev(f"__ip.toScreen({pt(phi0 + degrees * i / steps)})")
                await pg.mouse.move(x, y)
                await pg.wait_for_timeout(25)
            await pg.mouse.up()
            await pg.wait_for_timeout(1600)

        async def slide_grip(sid, axis, units):
            """Grab a grip and drag it along the structure's slide axis by `units`."""
            h = await ev(f"__ip.handleAt('{sid}')")
            x0, y0 = await ev(f"__ip.toScreen({h})")
            x1, y1 = await ev(f"__ip.toScreen([{h[0] + axis[0] * units}, {h[1] + axis[1] * units}, {h[2] + axis[2] * units}])")
            await pg.mouse.move(x0, y0)
            await pg.mouse.down()
            for i in range(1, 13):
                await pg.mouse.move(x0 + (x1 - x0) * i / 12, y0 + (y1 - y0) * i / 12)
                await pg.wait_for_timeout(25)
            await pg.mouse.up()
            await pg.wait_for_timeout(1500)

        async def drag_body(tile_key, axis, units, offset=(0, 0, 0)):
            """Press on a movable piece of architecture itself and drag it along `axis`."""
            c = await ev(f"{W}.liveCenter('{tile_key}')")
            c = [c[0] + offset[0], c[1] + offset[1], c[2] + offset[2]]
            x0, y0 = await ev(f"__ip.toScreen({c})")
            x1, y1 = await ev(f"__ip.toScreen([{c[0] + axis[0] * units}, {c[1] + axis[1] * units}, {c[2] + axis[2] * units}])")
            await pg.mouse.move(x0, y0)
            await pg.mouse.down()
            for i in range(1, 15):
                await pg.mouse.move(x0 + (x1 - x0) * i / 14, y0 + (y1 - y0) * i / 14)
                await pg.wait_for_timeout(25)
            await pg.mouse.up()
            await pg.wait_for_timeout(1500)

        async def spin_world(dx, at=(1160, 420)):
            """Drag sideways across empty sky to turn the whole world."""
            x, y = at
            await pg.mouse.move(x, y)
            await pg.mouse.down()
            for i in range(1, 21):
                await pg.mouse.move(x + dx * i / 20, y + 4 * math.sin(i / 3))
                await pg.wait_for_timeout(28)
            await pg.wait_for_timeout(220)  # come to rest before letting go (no fling)
            await pg.mouse.up()
            await pg.wait_for_timeout(1500)

        def ang(v):
            return ((v % 360) + 360) % 360

        async def walk(key, timeout=40):
            await click_tile(key)
            return await wait_for(f"{W}.node === '{key}' && !{W}.edge", timeout)

        # ------------------------------------------------------------------ title
        await scr('e2e_01_title')
        btn = pg.get_by_role('button', name='Begin')
        check('title shows Begin', await btn.count() == 1)
        await btn.click()
        ok = await wait_for(f"{G}.phase === 'play' && {G}.screen === 'play'", 20)
        check('Level 01 starts', ok)
        await pg.wait_for_timeout(1200)
        await scr('e2e_02_level01')

        # ------------------------------------------------------------------ level 01
        # Phase A — turn the WHOLE WORLD by dragging the sky
        await click_tile('T:p2')
        await pg.wait_for_timeout(1200)
        check('L1: tower out of reach at the start', await ev(f"{W}.node") == 'S:s0')
        towers_before = await ev(f"JSON.stringify({W}.values)")
        await spin_world(-200)
        await scr('e2e_03_world_turned')
        check('L1 A: dragging the sky turns the whole world to a new view (90°)', ang(await ev(f"{W}.view")) == 90, await ev(f"{W}.view"))
        check('L1 A: tower and platform states unchanged by the world turn', await ev(f"JSON.stringify({W}.values)") == towers_before)
        check('L1 A: from this side the island meets the tower walk (perspective edge live)', await ev(f"{W}.graph.edges.some(e => e.kind === 'illusion' && [e.a,e.b].includes('S:s1'))"))
        check('L1 A: traveller walks across the impossible joint onto the tower', await walk('T:c0'), await ev(f"{W}.node"))
        await scr('e2e_03b_on_tower')

        # Phase B — rotate the tower itself (separately), then the world back
        await turn_wheel('T', -90)
        check('L1 B: wheel turns the ENTIRE tower to 270° (world view unchanged)', ang(await ev(f"{W}.values.T")) == 270 and ang(await ev(f"{W}.view")) == 90, await ev(f"{W}.values.T"))
        check('L1 B: traveller rode the tower', await ev(f"{W}.node") == 'T:c0')
        check('L1 B: from this side the stair head meets nothing', not await ev(f"{W}.graph.edges.some(e => e.kind === 'illusion' && [e.a,e.b].includes('W:w0'))"))
        await spin_world(200)
        check('L1 B: world turned back to 0°', ang(await ev(f"{W}.view")) == 0, await ev(f"{W}.view"))
        check('L1 B: now the stair head joins the far walkway', await ev(f"{W}.graph.edges.some(e => e.kind === 'illusion' && [e.a,e.b].includes('W:w0'))"))
        await scr('e2e_04_aligned')
        check('L1 B: walks up the stairs and across the impossible joint', await walk('W:w0'))
        await scr('e2e_05_crossed')

        # Phase C — move the platform, turn the tower again, second impossible joint
        check('L1 C: climbs to the sliding platform', await walk('P:m'))
        await slide_grip('P', [0, 0, 1], 1)
        check('L1 C: platform pushed along its track (rides it)', await ev(f"{W}.values.P") == 1 and await ev(f"{W}.node") == 'P:m')
        check('L1 C: balcony not reachable yet', not await ev(f"{W}.graph.edges.some(e => e.kind === 'illusion' && [e.a,e.b].includes('T:h'))"))
        await turn_wheel('T', 90)
        check('L1 C: tower turned back to 0°', ang(await ev(f"{W}.values.T")) == 0, await ev(f"{W}.values.T"))
        check('L1 C: previous joint gone, new joint to the door balcony', await ev(f"{W}.graph.edges.filter(e => e.kind === 'illusion').map(e => [e.a,e.b].sort().join()).join() === 'P:m,T:h'"))
        await scr('e2e_06_second_joint')
        await click_tile('T:h')
        ok = await wait_for(f"{G}.phase === 'exit'", 30)
        check('L1 C: crosses to the balcony and through the door', ok)
        await pg.wait_for_timeout(1200)
        await scr('e2e_07_door')
        ok = await wait_for(f"{G}.levelId === 2 && {G}.phase === 'intro'", 30)
        check('transition into Level 02', ok)
        await pg.wait_for_timeout(700)
        await scr('e2e_08_transition')
        ok = await wait_for(f"{G}.phase === 'play'", 30)
        check('Level 02 playable', ok)
        saved = await ev("JSON.parse(localStorage.getItem('impossible-path-save-v1'))")
        check('progress saved', 1 in saved['completed'] and saved['unlocked'] >= 2, saved)
        await pg.wait_for_timeout(1500)
        await scr('e2e_09_level02')

        # ------------------------------------------------------------------ level 02
        await slide_grip('B', [1, 0, 0], 1)
        check('L2 A: bridge in, step onto the first tower', await walk('T1:c0'))
        await turn_wheel('T1', 90)
        check('L2 B: first tower ridden to 180°', ang(await ev(f"{W}.values.T1")) == 180 and await ev(f"{W}.node") == 'T1:c0')
        check('L2 B: crosses to the second tower', await walk('T2:c'))
        await scr('e2e_10_on_T2')
        await turn_wheel('T2', -90)
        check('L2 C: second tower ridden to 180°', ang(await ev(f"{W}.values.T2")) == 180 and await ev(f"{W}.node") == 'T2:c')
        check('L2 C: crosses from its top onto the lift', await walk('L:m'))
        # press on the part of the lift in view (the second tower's landing overlaps its east half)
        hit = await ev(f"(() => {{ const c = {W}.liveCenter('L:m'); const p = __ip.toScreen([c[0] - 0.3, c[1], c[2] - 0.05]); return __ip.hitAt(p[0], p[1]) }})()")
        check('L2 C: the lift is visible and grabbable where pressed', hit and hit['struct'] == 'L', hit and hit['struct'])
        await drag_body('L:m', [0, 1, 0], 2, offset=(-0.3, 0, -0.05))
        check('L2 C: lift raised two storeys by dragging the lift itself (rides it)', await ev(f"{W}.values.L") == 2 and await ev(f"{W}.node") == 'L:m', await ev(f"{W}.values.L"))
        await turn_wheel('T1', -90)
        check('L2 C: first tower turned to 90°', ang(await ev(f"{W}.values.T1")) == 90)
        check('L2 C: no route to the balcony from this side', not await ev(f"{W}.graph.edges.some(e => e.kind === 'illusion' && [e.a,e.b].includes('T1:h1'))"))
        await spin_world(-215, at=(1180, 300))
        await spin_world(-215, at=(1180, 300))
        check('L2 C: world turned round to the far side (180°)', ang(await ev(f"{W}.view")) == 180, await ev(f"{W}.view"))
        check('L2 C: from the far side the balcony meets the lift', await ev(f"{W}.graph.edges.some(e => e.kind === 'illusion' && [e.a,e.b].includes('T1:h1'))"))
        await scr('e2e_11_final_joint')
        await click_tile('T1:h1')
        ok = await wait_for(f"{G}.phase === 'end' || {G}.levelId === 3", 40)
        check('L2: door reached, level complete', ok, await ev(f"{G}.phase"))
        await pg.wait_for_timeout(1200)
        await scr('e2e_12_end')

        # ------------------------------------------------------------------ chapters + pause
        await pg.get_by_role('button', name='Chapters').click()
        await pg.wait_for_timeout(1200)
        await scr('e2e_13_chapters')
        check('chapter map lists 50 levels', await pg.locator('.path .node').count() == 50)
        await pg.locator('.path .node').nth(0).click()
        ok = await wait_for(f"{G}.screen === 'play' && {G}.levelId === 1", 20)
        check('replay Level 01 from the chapter map', ok)
        await wait_for(f"{G}.phase === 'play'", 20)
        # turn the tower by pressing on the tower itself (its south walk) and dragging round
        def body_pt(phi, r=1.0):
            a = math.radians(phi)
            return [r * math.cos(a), 0, -r * math.sin(a)]
        x, y = await ev(f"__ip.toScreen({body_pt(-90)})")
        await pg.mouse.move(x, y); await pg.mouse.down()
        for i in range(1, 16):
            x, y = await ev(f"__ip.toScreen({body_pt(-90 - 90 * i / 15)})")
            await pg.mouse.move(x, y); await pg.wait_for_timeout(25)
        await pg.mouse.up(); await pg.wait_for_timeout(1600)
        check('drag the tower body itself to turn the whole tower', ang(await ev(f"{W}.values.T")) == 270, await ev(f"{W}.values.T"))
        await scr('e2e_13b_body_drag')
        await pg.keyboard.press('Escape')
        await pg.wait_for_timeout(800)
        await scr('e2e_14_pause')
        check('pause menu opens', await pg.get_by_role('button', name='Resume').count() == 1)
        await pg.get_by_role('button', name='Resume').click()
        await pg.get_by_role('button', name='Hint').click()
        await pg.wait_for_timeout(900)
        await scr('e2e_15_hint')
        check('hint appears', bool(await ev(f"{G}.hint && {G}.hint.text")))

        await pg.get_by_role('button', name='Resume').count()

        # ------------------------------------------------------------------ phone: touch swipe + tap
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        mp = await ctx.new_page()
        await mp.goto(URL)
        await mp.wait_for_timeout(5000)
        await mp.evaluate("window.__ipGame.useGame.getState().startLevel(1)")
        t0 = time.time()
        while time.time() - t0 < 30 and not await mp.evaluate(f"{G}.phase === 'play'"):
            await mp.wait_for_timeout(250)
        await mp.wait_for_timeout(800)
        cdp = await ctx.new_cdp_session(mp)
        sx, sy = 340, 760
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': sx, 'y': sy}]})
        for i in range(1, 21):
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': sx - 200 * i / 20, 'y': sy}]})
            await mp.wait_for_timeout(28)
        await mp.wait_for_timeout(220)
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        await mp.wait_for_timeout(1600)
        v = await mp.evaluate(f"{W}.view")
        check('phone: a touch swipe across the sky turns the world', ang(v) in (90, 180), v)
        await mp.evaluate(f"{W}.setView(90)")
        await mp.wait_for_timeout(500)
        x, y = await mp.evaluate(f"__ip.toScreen({W}.liveCenter('T:c0'))")
        await mp.touchscreen.tap(x, y)
        t0 = time.time()
        while time.time() - t0 < 30 and not await mp.evaluate(f"{W}.node === 'T:c0'"):
            await mp.wait_for_timeout(250)
        check('phone: tap to walk across the joint', await mp.evaluate(f"{W}.node") == 'T:c0')
        await mp.screenshot(path=OUT + 'e2e_16_phone.png')
        await ctx.close()

        print('\n'.join(errs[:20]))
        await b.close()
    bad = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(bad)}/{len(results)} passed")
    sys.exit(1 if bad else 0)


asyncio.run(main())
