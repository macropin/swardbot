/**
 * The battery cradle's, deck's and top's clamped-on parts, built from
 * ./fittings.ts.
 *
 * Each part is built in a frame of its own (`local`), lying as it prints, and
 * comes with its extent in that frame (`extentOf`) and where it goes on the
 * mower (`placed`). A part module centres it on the bed; the assembly scene
 * places it.
 */
import { cylinder, rotate, translate, type ValidSolid } from 'brepjs';

import { fittings, type Fittings } from './fittings.js';
import type { Layout } from './layout.js';
import { nodeDims } from './nodes.js';
import {
  boltDown,
  channelY,
  frustum,
  hexagon,
  join,
  OVER,
  prism,
  remove,
  roundedRect,
  span,
  teardrop,
  type Vec2,
} from './shapes.js';

/** How far the e-stop housing's roof steps in round its cavity. */
const CORBEL = 6;

export type FittingName =
  | 'battery-stop'
  | 'deck-hanger-block'
  | 'deck-plate'
  | 'electronics-backplate'
  | 'electronics-rail-cap'
  | 'antenna-mount'
  | 'estop-housing'
  | 'estop-clamp'
  | 'axle-clamp';

type Extent = { x: [number, number]; y: [number, number]; z: [number, number] };

// ---------------------------------------------------------------------------
// Battery stop: a U-clip on the front floor tube, open on top, its front wall
// standing up as a lip in front of the battery. It prints on its side, so the
// batteries' push on the lip runs along its layers rather than across them: X
// is the mower's X and Y its Z, both about the tube's centre, and Z its Y.
// ---------------------------------------------------------------------------

function batteryStop(l: Layout, f: Fittings): ValidSolid {
  const d = nodeDims(l);
  const { back, front, halfY, bottom, backTop, lipTop } = f.batteryStop;
  const width = 2 * halfY;
  let body: ValidSolid = span(-back, front, bottom, lipTop, 0, width);
  body = remove(body, span(-d.channelHalf, d.channelHalf, -d.channelHalf, lipTop + OVER, -OVER, width + OVER));
  body = remove(body, span(-back - OVER, 0, backTop, lipTop + OVER, -OVER, width + OVER));
  return remove(body, teardrop(d.boltHole, 'x', -back - OVER, back + front + 2 * OVER, [0, halfY]));
}

// ---------------------------------------------------------------------------
// Deck hanger block: one half of a clamp on a cross tube, the rod behind it.
// Built with the split face on z = 0, the tube along Y at x = 0.
// ---------------------------------------------------------------------------

function deckHangerBlock(l: Layout, f: Fittings): ValidSolid {
  const d = nodeDims(l);
  const T = d.thickness;
  const { front, rear, halfY, rodOffset, rodHole } = f.block;
  let body: ValidSolid = span(-rear, front, -halfY, halfY, 0, T);
  body = remove(body, channelY(d.channelHalf, d.channelDepth, -halfY - OVER, halfY + OVER));
  body = remove(body, cylinder(rodHole, T + 2 * OVER, { at: [-rodOffset, 0, -OVER] }));
  return boltDown(body, [0, 0], d.boltHole, T, d.nutRadius, d.nutDepth);
}

// ---------------------------------------------------------------------------
// Deck plate: base on the bed, ribs up. Built about the motor's axis.
// ---------------------------------------------------------------------------

function deckPlate(l: Layout, f: Fittings): ValidSolid {
  const { plate } = f;
  const p = l.params;
  const cx = l.deck.x;
  const [x0, x1, y0, y1] = [plate.x0 - cx, plate.x1 - cx, -plate.halfY, plate.halfY];
  const outline = roundedRect(x0, x1, y0, y1, plate.boss);
  const inside = roundedRect(x0 + plate.rim, x1 - plate.rim, y0 + plate.rim, y1 - plate.rim, plate.boss - plate.rim);
  const rods: Vec2[] = l.deck.rodX.flatMap((x) => [-1, 1].map((s) => [x - cx, s * l.deck.rodY] as Vec2));

  let body = prism(outline, 0, plate.height);
  body = remove(body, prism(inside, plate.base, plate.height));
  body = join(body, cylinder(plate.motorRing.outer, plate.height - plate.base + OVER, { at: [0, 0, plate.base - OVER] }));
  body = remove(body, cylinder(plate.motorRing.inner, plate.height, { at: [0, 0, plate.base] }));
  for (const [x, y] of rods) {
    body = join(body, cylinder(plate.boss, plate.height, { at: [x, y, 0] }));
    // A rib from the motor ring out to each rod's boss.
    const length = Math.hypot(x, y) - plate.motorRing.outer - plate.boss + 2 * OVER;
    const mid = plate.motorRing.outer - OVER + length / 2;
    const angle = (Math.atan2(y, x) * 180) / Math.PI;
    const rib = rotate(span(mid - length / 2, mid + length / 2, -plate.rib / 2, plate.rib / 2, plate.base - OVER, plate.height), angle, {
      axis: [0, 0, 1],
    });
    body = join(body, rib);
  }
  // The rods screw into nuts held in the underside, under the tray's top.
  for (const at of rods) {
    body = remove(body, cylinder(plate.rodHole, plate.height + 2 * OVER, { at: [at[0], at[1], -OVER] }));
    body = remove(body, prism(hexagon(at, plate.rodNut.radius), -OVER, plate.rodNut.depth + OVER));
  }
  body = remove(body, cylinder(p.motorSpigot / 2, plate.height + 2 * OVER, { at: [0, 0, -OVER] }));
  for (const [x, y] of plate.motorBolts) {
    body = remove(body, cylinder((p.motorBolt + p.fitTolerance) / 2, plate.base + 2 * OVER, { at: [x, y, -OVER] }));
  }
  for (const at of plate.trayBolts) {
    body = boltDown(body, at, (p.trayBolt + p.fitTolerance) / 2, plate.base, plate.trayNut.radius, plate.trayNut.depth);
  }
  return body;
}

// ---------------------------------------------------------------------------
// Electronics backplate: face down, its clamps standing up. In its own frame
// X is minus the mower's Y, Y is the mower's Z about the plate's middle, and Z
// runs back from the plate's front face.
// ---------------------------------------------------------------------------

function backplateFrame(f: Fittings) {
  const b = f.backplate;
  const zc = (b.bottom + b.top) / 2;
  return { zc, Z: (x: number) => b.front - x, Y: (z: number) => z - zc };
}

function electronicsBackplate(l: Layout, f: Fittings): ValidSolid {
  const d = nodeDims(l);
  const p = l.params;
  const b = f.backplate;
  const { Z, Y } = backplateFrame(f);
  const thickness = b.front - b.back;
  let body: ValidSolid = span(-b.halfY, b.halfY, Y(b.bottom), Y(b.top), 0, thickness);
  for (const side of [-1, 1]) {
    const y = side * b.clampY;
    const [c0, c1] = [y - b.clampWidth / 2, y + b.clampWidth / 2];
    body = join(body, span(c0, c1, Y(b.bottom), Y(f.railCap.top), thickness - OVER, Z(0)));
    for (const rail of b.rails) {
      body = remove(
        body,
        span(c0 - OVER, c1 + OVER, Y(rail - d.channelHalf), Y(rail + d.channelHalf), Z(d.h - p.clampSqueeze / 2), Z(0) + OVER),
      );
    }
    for (const zb of b.clampBolts) {
      body = remove(body, cylinder(b.clampBolt, Z(0) + 2 * OVER, { at: [y, Y(zb), -OVER] }));
      // A nut slot from the clamp's outer side, between the rail's channel and the plate.
      const [s0, s1] = side > 0 ? [y - b.clampNut.radius, c1 + OVER] : [c0 - OVER, y + b.clampNut.radius];
      body = remove(
        body,
        span(s0, s1, Y(zb) - b.clampNut.af / 2, Y(zb) + b.clampNut.af / 2, Z(b.slotX + b.clampNut.depth), Z(b.slotX)),
      );
    }
  }
  for (const [y, z] of b.boxScrews) {
    body = remove(body, cylinder(b.boxScrew, thickness + 2 * OVER, { at: [y, Y(z), -OVER] }));
    body = remove(body, prism(hexagon([y, Y(z)], b.boxNut.radius), thickness - b.boxNut.depth, b.boxNut.depth + OVER));
  }
  return body;
}

/** The cap behind both rails: back face down, the rails' channels up. X is the mower's Y, Z forward from its back. */
function electronicsRailCap(l: Layout, f: Fittings): ValidSolid {
  const d = nodeDims(l);
  const p = l.params;
  const b = f.backplate;
  const c = f.railCap;
  const { Y } = backplateFrame(f);
  const T = -c.back;
  let body: ValidSolid = span(-c.halfY, c.halfY, Y(c.bottom), Y(c.top), 0, T);
  for (const rail of b.rails) {
    body = remove(
      body,
      span(-c.halfY - OVER, c.halfY + OVER, Y(rail - d.channelHalf), Y(rail + d.channelHalf), T - (d.h - p.clampSqueeze / 2), T + OVER),
    );
  }
  for (const side of [-1, 1]) {
    for (const zb of b.clampBolts) {
      body = remove(body, cylinder(b.clampBolt, T + 2 * OVER, { at: [side * b.clampY, Y(zb), -OVER] }));
    }
  }
  return body;
}

// ---------------------------------------------------------------------------
// Antenna mount: as it sits, the socket's bottom on the bed. Y runs along the
// bar from its end (0) inward (negative); X fore-aft.
// ---------------------------------------------------------------------------

function antennaMount(l: Layout, f: Fittings): ValidSolid {
  const d = nodeDims(l);
  const a = f.antenna;
  const H = a.halfX;
  const top = 2 * H;
  let body: ValidSolid = span(-H, H, -a.socketLength, l.params.fitTolerance / 2 + d.wall, 0, top);
  body = join(body, span(-H, H, -a.centre - a.pedestal / 2, -a.centre + a.pedestal / 2, top - OVER, top + a.pedestalHeight));
  body = remove(body, span(-d.channelHalf, d.channelHalf, -a.socketLength - OVER, l.params.fitTolerance / 2, H - d.channelHalf, H + d.channelHalf));
  // The bolt's head slides into a slot from the pedestal's outer end; its shank comes up through the top.
  const headRadius = a.headAF / Math.sqrt(3);
  body = remove(body, span(-a.headAF / 2, a.headAF / 2, -a.centre - headRadius, -a.centre + a.pedestal / 2 + OVER, top, top + a.headHeight));
  body = remove(body, cylinder(a.boltHole, a.pedestalHeight + 2 * OVER, { at: [0, -a.centre, top - OVER] }));
  return remove(body, teardrop(d.boltHole, 'x', -H - OVER, top + 2 * OVER, [-a.pin, H]));
}

// ---------------------------------------------------------------------------
// E-stop housing and clamp: two halves on the top bar, split level with its
// centreline, split face down; the bar along Y.
// ---------------------------------------------------------------------------

function estopHousing(l: Layout, f: Fittings): ValidSolid {
  const d = nodeDims(l);
  const e = f.estop;
  const T = d.thickness;
  const H = e.housing / 2;
  let body: ValidSolid = span(-H, H, -e.halfY, e.halfY, 0, T);
  body = join(body, span(-H, H, -H, H, T - OVER, T + e.depth + e.top));
  body = remove(body, channelY(d.channelHalf, d.channelDepth, -e.halfY - OVER, e.halfY + OVER));
  // The cavity's roof steps in at 45° round its edges, shortening the bridge the
  // printer has to span under the button's hole.
  const inner = H - e.wall;
  const corbel = Math.max(0, Math.min(CORBEL, inner - e.hole - 3));
  body = remove(body, span(-inner, inner, -inner, inner, T, T + e.depth - corbel + OVER / 10));
  if (corbel > 0) {
    const square = (r: number): Vec2[] => [
      [-r, -r],
      [r, -r],
      [r, r],
      [-r, r],
    ];
    body = remove(body, frustum(square(inner), T + e.depth - corbel, square(inner - corbel), T + e.depth));
  }
  body = remove(body, cylinder(e.hole, e.top + 2 * OVER, { at: [0, 0, T + e.depth - OVER] }));
  body = remove(body, teardrop(e.cable, 'x', -H - OVER, e.wall + 2 * OVER, [0, T + e.depth / 3]));
  for (const y of [-e.boltY, e.boltY]) body = boltDown(body, [0, y], d.boltHole, T, d.nutRadius, d.nutDepth);
  return body;
}

function estopClamp(l: Layout, f: Fittings): ValidSolid {
  const d = nodeDims(l);
  const e = f.estop;
  const T = d.thickness;
  let body: ValidSolid = span(-d.armHalf, d.armHalf, -e.halfY, e.halfY, 0, T);
  body = remove(body, channelY(d.channelHalf, d.channelDepth, -e.halfY - OVER, e.halfY + OVER));
  for (const y of [-e.boltY, e.boltY]) body = boltDown(body, [0, y], d.boltHole, T, d.nutRadius, d.nutDepth);
  return body;
}

// ---------------------------------------------------------------------------
// Axle clamp: its face against the rear node on the bed, the axle's bore
// standing up. X fore-aft, Y up the mower, about the axle's centre.
// ---------------------------------------------------------------------------

/** The axle's section: round, with flats top and bottom. */
function flattedBore(radius: number, flats: number, steps = 12): Vec2[] {
  const t = Math.asin(Math.min(1, flats / radius));
  const arc = (from: number, to: number) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = from + ((to - from) * i) / steps;
      return [radius * Math.cos(a), radius * Math.sin(a)] as Vec2;
    });
  return [...arc(-t, t), ...arc(Math.PI - t, Math.PI + t)];
}

function axleClampSolid(l: Layout, f: Fittings): ValidSolid {
  const d = nodeDims(l);
  const c = f.clamp;
  let body: ValidSolid = span(-c.half, c.half, -c.half, c.half, 0, c.length);
  body = remove(body, prism(flattedBore(c.bore, c.flats), -OVER, c.length + 2 * OVER));
  // Slit through to the front, pinched shut by a bolt across it.
  body = remove(body, span(0, c.half + OVER, -c.slit / 2, c.slit / 2, -OVER, c.length + OVER));
  body = remove(body, teardrop(d.boltHole, 'y', -c.half - OVER, 2 * c.half + 2 * OVER, [c.pinch, c.length / 2]));
  for (const [x, y] of c.bolts) body = remove(body, cylinder(d.boltHole, c.length + 2 * OVER, { at: [x, y, -OVER] }));
  return body;
}

// ---------------------------------------------------------------------------
// Extents and builders, by name
// ---------------------------------------------------------------------------

export function local(name: FittingName, l: Layout, f: Fittings = fittings(l)): ValidSolid {
  switch (name) {
    case 'battery-stop':
      return batteryStop(l, f);
    case 'deck-hanger-block':
      return deckHangerBlock(l, f);
    case 'deck-plate':
      return deckPlate(l, f);
    case 'electronics-backplate':
      return electronicsBackplate(l, f);
    case 'electronics-rail-cap':
      return electronicsRailCap(l, f);
    case 'antenna-mount':
      return antennaMount(l, f);
    case 'estop-housing':
      return estopHousing(l, f);
    case 'estop-clamp':
      return estopClamp(l, f);
    case 'axle-clamp':
      return axleClampSolid(l, f);
  }
}

export function extentOf(name: FittingName, l: Layout, f: Fittings = fittings(l)): Extent {
  const d = nodeDims(l);
  const T = d.thickness;
  switch (name) {
    case 'battery-stop': {
      const s = f.batteryStop;
      return { x: [-s.back, s.front], y: [s.bottom, s.lipTop], z: [0, 2 * s.halfY] };
    }
    case 'deck-hanger-block':
      return { x: [-f.block.rear, f.block.front], y: [-f.block.halfY, f.block.halfY], z: [0, T] };
    case 'deck-plate':
      return {
        x: [f.plate.x0 - l.deck.x, f.plate.x1 - l.deck.x],
        y: [-f.plate.halfY, f.plate.halfY],
        z: [0, f.plate.height],
      };
    case 'electronics-backplate': {
      const b = f.backplate;
      const { Y, Z } = backplateFrame(f);
      return { x: [-b.halfY, b.halfY], y: [Y(b.bottom), Y(b.top)], z: [0, Z(0)] };
    }
    case 'electronics-rail-cap': {
      const { Y } = backplateFrame(f);
      return { x: [-f.railCap.halfY, f.railCap.halfY], y: [Y(f.railCap.bottom), Y(f.railCap.top)], z: [0, -f.railCap.back] };
    }
    case 'antenna-mount':
      return {
        x: [-f.antenna.halfX, f.antenna.halfX],
        y: [-f.antenna.socketLength, l.params.fitTolerance / 2 + d.wall],
        z: [0, 2 * f.antenna.halfX + f.antenna.pedestalHeight],
      };
    case 'estop-housing':
      return {
        x: [-f.estop.housing / 2, f.estop.housing / 2],
        y: [-f.estop.halfY, f.estop.halfY],
        z: [0, T + f.estop.depth + f.estop.top],
      };
    case 'estop-clamp':
      return { x: [-d.armHalf, d.armHalf], y: [-f.estop.halfY, f.estop.halfY], z: [0, T] };
    case 'axle-clamp':
      return { x: [-f.clamp.half, f.clamp.half], y: [-f.clamp.half, f.clamp.half], z: [0, f.clamp.length] };
  }
}

// ---------------------------------------------------------------------------
// On the mower
// ---------------------------------------------------------------------------

const turnX = (s: ValidSolid) => rotate(s, 180, { axis: [1, 0, 0] });
const turnZ = (s: ValidSolid) => rotate(s, 180, { axis: [0, 0, 1] });

/** Every fitting on the mower, in the layout's frame, and the deck's rods. */
export function fittingBodies(l: Layout): ValidSolid[] {
  const f = fittings(l);
  const p = l.params;
  const out: ValidSolid[] = [];

  // Stood up from its side: its Y to the mower's Z, its Z across the mower.
  const stop = rotate(local('battery-stop', l, f), 90, { axis: [1, 0, 0] });
  for (const y of f.batteryStop.centres) out.push(translate(stop, [l.frontFloorX, y + f.batteryStop.halfY, l.floorZ]));

  // Hanger blocks, a pair of halves on each tube at each rod.
  const block = local('deck-hanger-block', l, f);
  for (const x of [l.deck.beamX, l.wheelbase]) {
    for (const y of [-l.deck.rodY, l.deck.rodY]) {
      out.push(translate(block, [x, y, l.railZ]));
      out.push(translate(turnX(block), [x, y, l.railZ]));
    }
  }
  out.push(translate(local('deck-plate', l, f), [l.deck.x, 0, l.deck.plateBottom]));
  for (const x of l.deck.rodX) {
    for (const y of [-l.deck.rodY, l.deck.rodY]) {
      out.push(cylinder(p.deckRod / 2, l.deck.rodLength, { at: [x, y, l.deck.plateBottom] }));
    }
  }

  const { zc } = backplateFrame(f);
  const backplate = rotate(rotate(local('electronics-backplate', l, f), 90, { axis: [1, 0, 0] }), -90, { axis: [0, 0, 1] });
  out.push(translate(backplate, [f.backplate.front, 0, zc]));
  const cap = rotate(rotate(local('electronics-rail-cap', l, f), 90, { axis: [1, 0, 0] }), 90, { axis: [0, 0, 1] });
  out.push(translate(cap, [f.railCap.back, 0, zc]));

  const barEnd = l.members.find((m) => m.name === 'top bar')!.length / 2;
  const mount = translate(local('antenna-mount', l, f), [0, 0, p.apexHeight - f.antenna.halfX]);
  out.push(translate(mount, [0, barEnd, 0]));
  out.push(translate(turnZ(mount), [0, -barEnd, 0]));

  out.push(translate(local('estop-housing', l, f), [0, 0, p.apexHeight]));
  out.push(translate(turnX(local('estop-clamp', l, f)), [0, 0, p.apexHeight]));

  const clamp = local('axle-clamp', l, f);
  out.push(translate(rotate(clamp, -90, { axis: [1, 0, 0] }), [0, l.frameOuterY, l.wheel.axleZ]));
  out.push(translate(rotate(clamp, 90, { axis: [1, 0, 0] }), [0, -l.frameOuterY, l.wheel.axleZ]));
  return out;
}
