/**
 * The front beam's printed parts, built from ./front-beam.ts.
 *
 * Each part is one half of a clamp; both halves of each are the same part.
 * Each is built as it prints: split face flat on the bed at z = 0, centred on
 * the origin in X and Y, the tube's channel open on the bed and bridged over.
 * In the bed's plane X is the mower's X (fore-aft) and Y its Y, along the tube
 * the part clamps. `installed` moves each half to where it sits on the mower.
 */
import { box, cut, cylinder, fuse, rotate, translate, unwrap, type ValidSolid } from 'brepjs';

import { frontBeam, type FrontBeam } from './front-beam.js';
import type { Layout } from './layout.js';
import { prism } from './node-solid.js';
import { nodeDims, type Vec2 } from './nodes.js';
import { single } from './solid.js';

/** Overshoot so cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

/** A prism on a polygon in the XZ plane, from y0 to y1. */
function prismXZ(points: readonly Vec2[], y0: number, y1: number): ValidSolid {
  // Built on XY along Z, then turned a quarter about X: its Y to Z, its Z to -Y.
  return rotate(prism(points, -y1, y1 - y0), 90, { axis: [1, 0, 0] });
}

const join = (a: ValidSolid, b: ValidSolid) => single(unwrap(fuse(a, b)));
const remove = (a: ValidSolid, b: ValidSolid) => single(unwrap(cut(a, b)));

/** A box from corner to corner. */
const span = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  box(x1 - x0, y1 - y0, z1 - z0, { centered: true, at: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] });

const hexagon = (at: Vec2, radius: number): Vec2[] =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    return [at[0] + radius * Math.cos(a), at[1] + radius * Math.sin(a)];
  });

/** A bolt hole down through a half, and its nut's pocket in the face at `top`. */
function boltThrough(body: ValidSolid, at: Vec2, hole: number, top: number, nutRadius: number, nutDepth: number) {
  let out = remove(body, cylinder(hole, top + 2 * OVER, { at: [at[0], at[1], -OVER] }));
  out = remove(out, prism(hexagon(at, nutRadius), top - nutDepth, nutDepth + OVER));
  return out;
}

/** A tube's channel along Y through a half, open on the split face, from y0 to y1. */
function channel(l: Layout, y0: number, y1: number) {
  const d = nodeDims(l);
  return span(-d.channelHalf, d.channelHalf, y0, y1, -OVER, d.channelDepth);
}

// ---------------------------------------------------------------------------
// Pivot saddle: on the beam's middle, clamping the pin
// ---------------------------------------------------------------------------

export function saddleHalf(l: Layout, fb: FrontBeam = frontBeam(l)): ValidSolid {
  const d = nodeDims(l);
  const T = d.thickness;
  const { halfX, halfY, boltY } = fb.saddle;
  let body: ValidSolid = span(-halfX, halfX, -halfY, halfY, 0, T);
  body = remove(body, channel(l, -halfY - OVER, halfY + OVER));
  body = remove(
    body,
    cylinder(fb.pin.saddleBore, 2 * halfX + 2 * OVER, { at: [-halfX - OVER, 0, 0], axis: [1, 0, 0] }),
  );
  for (const y of [-boltY, boltY]) body = boltThrough(body, [0, y], d.boltHole, T, d.nutRadius, d.nutDepth);
  return body;
}

// ---------------------------------------------------------------------------
// Pivot hanger: on the cross member's middle, with the ears and roll stops
// ---------------------------------------------------------------------------

export function hangerCap(l: Layout, fb: FrontBeam = frontBeam(l)): ValidSolid {
  const d = nodeDims(l);
  const T = d.thickness;
  const { halfY, boltY } = fb.hanger;
  let body: ValidSolid = span(-d.armHalf, d.armHalf, -halfY, halfY, 0, T);
  body = remove(body, channel(l, -halfY - OVER, halfY + OVER));
  for (const y of [-boltY, boltY]) body = boltThrough(body, [0, y], d.boltHole, T, d.nutRadius, d.nutDepth);
  return body;
}

/**
 * The hanger's lower half, upside down as it prints: its split face on the bed,
 * and the ears and stops standing up from it. Height above the bed is depth
 * below the cross member's centreline.
 */
export function hanger(l: Layout, fb: FrontBeam = frontBeam(l)): ValidSolid {
  const d = nodeDims(l);
  const T = d.thickness;
  const { halfY, earIn, earOut, earHalfY, earBottom, stopIn, stopOut, stopFace, boltY } = fb.hanger;
  const below = (z: number) => fb.R - z;

  let body: ValidSolid = span(-d.armHalf, d.armHalf, -halfY, halfY, 0, T);
  body = join(body, span(-earOut, earOut, -earHalfY, earHalfY, 0, T));
  for (const side of [-1, 1]) {
    const [x0, x1] = side > 0 ? [earIn, earOut] : [-earOut, -earIn];
    body = join(body, span(x0, x1, -earHalfY, earHalfY, T - OVER, below(earBottom)));
    // A gusset on the ear's outer face, stepping out from it at 45° to a foot
    // beside the clamp: a castor's knock bends the ear across its layers, and
    // this spreads the load at its root.
    const g = fb.hanger.gusset;
    const profile: Vec2[] = [
      [earOut - OVER, 0],
      [earOut + g, 0],
      [earOut + g, T],
      [earOut, T + g],
      [earOut - OVER, T + g],
    ];
    const gusset = prismXZ(
      profile.map(([x, z]) => [side * x, z] as Vec2),
      -earHalfY,
      earHalfY,
    );
    body = join(body, gusset);
    const [y0, y1] = side > 0 ? [stopIn, stopOut] : [-stopOut, -stopIn];
    body = join(body, span(-d.h, d.h, y0, y1, T - OVER, below(stopFace)));
  }
  body = remove(body, channel(l, -halfY - OVER, halfY + OVER));
  body = remove(
    body,
    cylinder(fb.pin.earBore, 2 * earOut + 2 * OVER, { at: [-earOut - OVER, 0, below(fb.B)], axis: [1, 0, 0] }),
  );
  for (const y of [-boltY, boltY]) body = boltThrough(body, [0, y], d.boltHole, T, d.nutRadius, d.nutDepth);
  return body;
}

// ---------------------------------------------------------------------------
// Castor pad: on each end of the beam, the castor bolted under it
// ---------------------------------------------------------------------------

/** One half of a castor pad, centred on the castor in X and on its own length in Y, its end wall toward +Y. */
export function castorPadHalf(l: Layout, fb: FrontBeam = frontBeam(l)): ValidSolid {
  const d = nodeDims(l);
  const T = d.thickness;
  const { halfX, yIn, yOut, bolts, boltHole, nutRadius, nutDepth } = fb.pad;
  const beamEnd = l.params.castorPlateWidth / 2;
  let body: ValidSolid = span(-halfX, halfX, yIn, yOut, 0, T);
  body = remove(body, channel(l, yIn - OVER, beamEnd + l.params.fitTolerance / 2));
  for (const b of bolts) body = boltThrough(body, b, boltHole, T, nutRadius, nutDepth);
  return translate(body, [0, -(yIn + yOut) / 2, 0]);
}

// ---------------------------------------------------------------------------
// Placing them on the mower
// ---------------------------------------------------------------------------

export type Upper = 'upper' | 'lower';

/** A clamp half, printed split face down, put back where it goes: centred on `at`, upper half split face down. */
function place(solid: ValidSolid, at: [number, number, number], half: Upper, flipY = false) {
  // The lower half is the same part turned over about X.
  let s = half === 'lower' ? rotate(solid, 180, { axis: [1, 0, 0] }) : solid;
  if (flipY) s = rotate(s, 180, { axis: [0, 0, 1] });
  return translate(s, at);
}

/** Every printed part of the front beam, on the mower, and the pin. */
export function frontBeamBodies(l: Layout): ValidSolid[] {
  const fb = frontBeam(l);
  const saddle = saddleHalf(l, fb);
  const pad = castorPadHalf(l, fb);
  const padCentre = (fb.pad.yIn + fb.pad.yOut) / 2;
  const pads = [1, -1].flatMap((side) =>
    (['upper', 'lower'] as const).map((half) => {
      // The lower half turns over about X, which would put its end wall inward; turn it back about Z.
      const flip = (side < 0) !== (half === 'lower');
      return place(pad, [fb.F, side * (l.castor.y + padCentre), fb.B], half, flip);
    }),
  );
  return [
    place(saddle, [fb.F, 0, fb.B], 'upper'),
    place(saddle, [fb.F, 0, fb.B], 'lower'),
    place(hangerCap(l, fb), [fb.F, 0, fb.R], 'upper'),
    place(hanger(l, fb), [fb.F, 0, fb.R], 'lower'),
    ...pads,
    cylinder(fb.pin.radius, fb.pinLength, { at: [fb.F - fb.pinLength / 2, 0, fb.B], axis: [1, 0, 0] }),
  ];
}
