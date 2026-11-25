/**
 * Small shape helpers the printed parts share.
 */
import { box, cut, cylinder, fuse, rotate, Sketcher, translate, unwrap, type ValidSolid } from 'brepjs';

import { single } from './solid.js';

export type Vec2 = [number, number];

/** Overshoot so cuts clear the faces instead of leaving zero-thickness skins. */
export const OVER = 1;

export const join = (a: ValidSolid, b: ValidSolid) => single(unwrap(fuse(a, b)));
export const remove = (a: ValidSolid, b: ValidSolid) => single(unwrap(cut(a, b)));

/** A box from corner to corner. */
export const span = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  box(x1 - x0, y1 - y0, z1 - z0, { centered: true, at: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] });

/** A prism standing on a polygon in the XY plane, from z0 up by `height`. */
export function prism(points: readonly Vec2[], z0: number, height: number): ValidSolid {
  const [first, ...rest] = points;
  if (!first) throw new Error('prism needs a polygon');
  let sketch = new Sketcher('XY', z0).movePointerTo(first);
  for (const q of rest) sketch = sketch.lineTo(q);
  return single(sketch.close().extrude(height));
}

export const hexagon = (at: Vec2, radius: number): Vec2[] =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    return [at[0] + radius * Math.cos(a), at[1] + radius * Math.sin(a)];
  });

/** A rectangle with its corners rounded to radius r, as a polygon. */
export function roundedRect(x0: number, x1: number, y0: number, y1: number, r: number, steps = 6): Vec2[] {
  const corners: [number, number, number][] = [
    [x1 - r, y0 + r, -90],
    [x1 - r, y1 - r, 0],
    [x0 + r, y1 - r, 90],
    [x0 + r, y0 + r, 180],
  ];
  return corners.flatMap(([cx, cy, a0]) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((a0 + (90 * i) / steps) * Math.PI) / 180;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Vec2;
    }),
  );
}

/** A vertical hole through a part `top` high, and a hex pocket for its nut sunk into the top face. */
export function boltDown(body: ValidSolid, at: Vec2, hole: number, top: number, nutRadius: number, nutDepth: number) {
  let out = remove(body, cylinder(hole, top + 2 * OVER, { at: [at[0], at[1], -OVER] }));
  out = remove(out, prism(hexagon(at, nutRadius), top - nutDepth, nutDepth + OVER));
  return out;
}

/** A clamp half's channel for a tube along Y, open on the split face at z = 0. */
export const channelY = (channelHalf: number, depth: number, y0: number, y1: number) =>
  span(-channelHalf, channelHalf, y0, y1, -OVER, depth);

/**
 * A horizontal hole that prints without support: round below, with a 45° roof
 * rising to a point above, instead of a flat arc the bridge would sag across.
 * Along X or Y from `from`, `length` long, its centre at `at` across it
 * (y and z for X, x and z for Y). Not for bores that bear on a pin.
 */
export function teardrop(radius: number, axis: 'x' | 'y', from: number, length: number, at: Vec2): ValidSolid {
  const steps = 16;
  const arc = Array.from({ length: steps + 1 }, (_, i) => {
    const a = ((135 + (270 * i) / steps) * Math.PI) / 180;
    return [radius * Math.cos(a), radius * Math.sin(a)] as Vec2;
  });
  // Built along Z with its point toward +Y, then turned so it runs along the
  // axis with its point up.
  const upright = prism([...arc, [0, radius * Math.SQRT2]], 0, length);
  if (axis === 'x') {
    // Z to X, Y to Z, X to Y: a third of a turn about (1, 1, 1).
    const turned = rotate(upright, 120, { axis: [1, 1, 1] });
    return translate(turned, [from, at[0], at[1]]);
  }
  // Z to Y, Y to Z, X to -X: a half turn about (0, 1, 1).
  const turned = rotate(upright, 180, { axis: [0, 1, 1] });
  return translate(turned, [at[0], from, at[1]]);
}

/** A frustum on a polygon at z0 and a smaller one at z1, its sides ruled: a corbel, or a lead-in. */
export function frustum(bottom: readonly Vec2[], z0: number, top: readonly Vec2[], z1: number): ValidSolid {
  const sketch = (points: readonly Vec2[], z: number) => {
    const [first, ...rest] = points;
    let s = new Sketcher('XY', z).movePointerTo(first!);
    for (const q of rest) s = s.lineTo(q);
    return s.close();
  };
  return single(sketch(bottom, z0).loftWith(sketch(top, z1), { ruled: true }));
}
