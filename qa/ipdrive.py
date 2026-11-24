"""Shared real-input helpers for the browser tests: every action is a real mouse drag or click.

A tower is turned by dragging its wheel or, if the wheel is out of sight, by pressing on any
visible part of the tower and dragging round its pivot (what a player does). A press that would
land on something else is never made: the test asks the game (`__ip.ownerAt`) what a press at
that spot would grab, using the same rule as a real press. If an attempt turns the world by
mistake, the view is put back.
"""
import math, time

W = "window.__ipGame.getWorld()"
G = "window.__ipGame.useGame.getState()"
def ang(v): return ((v % 360) + 360) % 360

class Driver:
    def __init__(self, pg):
        self.pg = pg
        self.why = ''
    async def ev(self, js): return await self.pg.evaluate(js)
    async def wait_for(self, js, timeout=30):
        t0 = time.time()
        while time.time() - t0 < timeout:
            if await self.ev(js): return True
            await self.pg.wait_for_timeout(200)
        return False
    async def screen(self, p): return await self.ev(f"__ip.toScreen({list(p)})")
    async def drag_path(self, pts):
        x, y = await self.screen(pts[0])
        await self.pg.mouse.move(x, y); await self.pg.mouse.down()
        for q in pts[1:]:
            x, y = await self.screen(q); await self.pg.mouse.move(x, y); await self.pg.wait_for_timeout(22)
        await self.pg.wait_for_timeout(100); await self.pg.mouse.up(); await self.pg.wait_for_timeout(1200)
    async def view(self): return await self.ev(f"Math.round((({W}.view % 360) + 360) % 360)")
    async def set_view(self, v):
        for _ in range(4):
            cur = await self.view()
            if cur == v: return True
            side = 'left' if (v - cur) % 360 == 90 else 'right'
            await self.pg.locator(f'.world-btn.{side}').click()
            await self.wait_for(f"{W}.settledView() !== null", 10); await self.pg.wait_for_timeout(250)
        return await self.view() == v
    async def settle(self, sid):
        await self.wait_for(f"!{W}.anims['{sid}'] && {W}.dragging === null && {W}.settledView() !== null", 6)
    async def turn(self, sid, to):
        to = ang(to)
        v0 = await self.view()
        pivot = await self.ev(f"{W}.map.get('{sid}').origin")
        # press points: the wheel first, then every tile of the tower
        tiles = await self.ev(f"{W}.map.get('{sid}').tiles.map(t => t.id)")
        for attempt in range(8):
            cur = ang(await self.ev(f"{W}.values['{sid}']"))
            d = (to - cur) % 360
            if d > 180: d -= 360
            if d == 0: return True
            presses = []
            c = await self.ev(f"__ip.handleAt('{sid}')")
            wx, wy = await self.screen(c)
            # only use the wheel if no other movable piece stands in front of it
            if (await self.ev(f"__ip.ownerAt({wx}, {wy})")) in (None, sid): presses.append((c, 1.12, True))
            for t in tiles:
                p = await self.ev(f"{W}.liveCenter('{sid}:{t}')")
                r = math.hypot(p[0] - pivot[0], p[2] - pivot[2])
                x, y = await self.screen(p)
                if await self.ev(f"__ip.ownerAt({x}, {y})") == sid: presses.append((p, r, False))
            if attempt >= len(presses): break
            pt, rad, wheel = presses[attempt]
            if wheel:
                phi0 = 315 + await self.ev(f"{W}.view")
                cx, cy, cz = pt
            else:
                cx, cy, cz = pivot[0], pt[1], pivot[2]
                if rad < 0.6:
                    # pressed at the pivot: move out to a circle first, then go round (as a player would)
                    phi0 = 315 + await self.ev(f"{W}.view")
                    rad = 1.0
                else:
                    phi0 = math.degrees(math.atan2(-(pt[2] - pivot[2]), pt[0] - pivot[0]))
            pts = [[cx + rad * math.cos(math.radians(phi0 + d * i / 14)), cy, cz - rad * math.sin(math.radians(phi0 + d * i / 14))] for i in range(15)]
            if not wheel and math.hypot(pt[0] - pivot[0], pt[2] - pivot[2]) < 0.6: pts = [list(pt)] + pts
            others = await self.ev(f"JSON.stringify(Object.fromEntries(Object.entries({W}.values).filter(([k]) => k !== '{sid}')))")
            await self.drag_path(pts)
            await self.settle(sid)
            if await self.view() != v0: await self.set_view(v0)
            if others != await self.ev(f"JSON.stringify(Object.fromEntries(Object.entries({W}.values).filter(([k]) => k !== '{sid}')))"):
                raise RuntimeError(f'turning {sid} moved another piece')
        return ang(await self.ev(f"{W}.values['{sid}']")) == to
    async def slide(self, sid, to):
        v0 = await self.view()
        for attempt in range(3):
            cur = await self.ev(f"{W}.values['{sid}']")
            if abs(cur - to) < 1e-3: return True
            axis = await self.ev(f"{W}.map.get('{sid}').motion.axis")
            t = await self.ev(f"{W}.liveCenter('{sid}:' + {W}.map.get('{sid}').tiles[0].id)")
            delta = to - cur
            pts = [[t[0] + axis[0] * delta * i / 12, t[1] + axis[1] * delta * i / 12, t[2] + axis[2] * delta * i / 12] for i in range(13)]
            await self.drag_path(pts)
            await self.settle(sid)
            if await self.view() != v0: await self.set_view(v0)
        return abs(await self.ev(f"{W}.values['{sid}']") - to) < 1e-3
    async def tap(self, tile, timeout=30):
        """Tap a tile; if nothing happened (e.g. a piece was still settling), tap once more, as a player would."""
        if await self._tap(tile): return True
        first = self.why
        await self.pg.wait_for_timeout(1500)
        ok = await self._tap(tile)
        self.retried = getattr(self, 'retried', 0) + (1 if ok else 0)
        if not ok: self.why = first + ' | again: ' + self.why
        return ok
    async def _tap(self, tile, timeout=30):
        """Tap a visible spot of the tile: the centre if it can be seen, else another point on its
        top — always one where the game's own pick rule says this tile is under the finger."""
        await self.pg.wait_for_timeout(500)  # let the camera finish easing after a world turn
        c = await self.ev(f"{W}.liveCenter('{tile}')")
        spot = None
        for dx, dz in [(0, 0), (0.3, 0.3), (0.3, -0.3), (-0.3, 0.3), (-0.3, -0.3), (0.3, 0), (-0.3, 0), (0, 0.3), (0, -0.3)]:
            x, y = await self.screen([c[0] + dx, c[1], c[2] + dz])
            # a clearly visible spot: the tile is picked there and a few pixels around it
            around = [(x, y), (x + 3, y), (x - 3, y), (x, y + 3), (x, y - 3)]
            if all([await self.ev(f"__ip.pickAt({a}, {b})") == tile for a, b in around]):
                spot = (x, y); break
        if not spot:
            x, y = await self.screen(c)
            self.why = f"no clear spot; centre hits {await self.ev(f'__ip.hitsAt({x}, {y})')}; node {await self.ev(f'{W}.node')}; values {await self.ev(f'JSON.stringify({W}.values)')}; view {await self.view()}"
            return False
        await self.pg.mouse.click(*spot)
        # wait while the traveller is still on the way (slow machines render few frames per second)
        t0 = time.time()
        while time.time() - t0 < 300:
            if await self.ev(f"({W}.node === '{tile}' && !{W}.edge) || {G}.phase !== 'play'"): return True
            if await self.ev(f"!{W}.edge && {W}.path.length === 0") and time.time() - t0 > 12:
                if await self.ev(f"({W}.node === '{tile}') || {G}.phase !== 'play'"): return True
                self.why = f"tapped but traveller stopped at {await self.ev(f'{W}.node')}; reachable now: {await self.ev(f'{W}.walkTo({chr(39)}{tile}{chr(39)})')}"
                return False
            await self.pg.wait_for_timeout(300)
        return False
