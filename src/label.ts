/**
 * Labels engraved into printed parts, so each can be told apart once printed.
 *
 * The text is drawn in a small stroke font of straight lines on a 4 × 6 grid,
 * built in here so the project needs no font file. It's engraved into the
 * part's largest clear flat face that faces up as it prints, centred as near
 * the face's middle as it fits, along the face's long way. If no face up takes
 * it, the bed face does, the text mirrored so it reads from below.
 *
 * Finding room: each candidate face is sampled on a fine grid, inside it or
 * not, and a summed table of the outside cells answers whether any rectangle
 * is clear in a single lookup.
 */
import {
  classifyPointOnFace,
  cut,
  faceCenter,
  fuseAll,
  getBounds,
  getFaces,
  getSurfaceType,
  measureArea,
  normalAt,
  unwrap,
  type Face,
  type ValidSolid,
} from 'brepjs';

import { prism, type Vec2 } from './shapes.js';

/** The label options from a part's parameters. */
export const labelOptions = (p: { labelHeight: number; labelDepth: number; labelStroke: number }): LabelOptions => ({
  height: p.labelHeight,
  depth: p.labelDepth,
  stroke: p.labelStroke,
});

export interface LabelOptions {
  /** Cap height of the text; 0 for no label. */
  height: number;
  /** How deep it's engraved, and its strokes' width. */
  depth: number;
  stroke: number;
}

/** Each glyph's strokes, polylines on a grid 4 wide and 6 high. */
type Glyph = readonly (readonly Vec2[])[];

const O: Glyph = [
  [
    [1, 0],
    [0, 1],
    [0, 5],
    [1, 6],
    [3, 6],
    [4, 5],
    [4, 1],
    [3, 0],
    [1, 0],
  ],
];
const P: Glyph = [
  [
    [0, 0],
    [0, 6],
    [3, 6],
    [4, 5],
    [4, 4],
    [3, 3],
    [0, 3],
  ],
];

const FONT: Readonly<Record<string, Glyph>> = {
  A: [[[0, 0], [0, 4], [2, 6], [4, 4], [4, 0]], [[0, 3], [4, 3]]],
  B: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]], [[3, 3], [4, 2], [4, 1], [3, 0], [0, 0]]],
  C: [[[4, 6], [1, 6], [0, 5], [0, 1], [1, 0], [4, 0]]],
  D: [[[0, 0], [0, 6], [2, 6], [4, 4], [4, 2], [2, 0], [0, 0]]],
  E: [[[4, 6], [0, 6], [0, 0], [4, 0]], [[0, 3], [3, 3]]],
  F: [[[4, 6], [0, 6], [0, 0]], [[0, 3], [3, 3]]],
  G: [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1], [4, 3], [2, 3]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[1, 6], [3, 6]], [[2, 6], [2, 0]], [[1, 0], [3, 0]]],
  J: [[[4, 6], [4, 1], [3, 0], [1, 0], [0, 1]]],
  K: [[[0, 0], [0, 6]], [[4, 6], [0, 2]], [[1, 3], [4, 0]]],
  L: [[[0, 6], [0, 0], [4, 0]]],
  M: [[[0, 0], [0, 6], [2, 3], [4, 6], [4, 0]]],
  N: [[[0, 0], [0, 6], [4, 0], [4, 6]]],
  O,
  P,
  Q: [...O, [[2, 2], [4, 0]]],
  R: [...P, [[2, 3], [4, 0]]],
  S: [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 4], [1, 3], [3, 3], [4, 2], [4, 1], [3, 0], [1, 0], [0, 1]]],
  T: [[[0, 6], [4, 6]], [[2, 6], [2, 0]]],
  U: [[[0, 6], [0, 1], [1, 0], [3, 0], [4, 1], [4, 6]]],
  V: [[[0, 6], [2, 0], [4, 6]]],
  W: [[[0, 6], [1, 0], [2, 3], [3, 0], [4, 6]]],
  X: [[[0, 0], [4, 6]], [[0, 6], [4, 0]]],
  Y: [[[0, 6], [2, 3], [4, 6]], [[2, 3], [2, 0]]],
  Z: [[[0, 6], [4, 6], [0, 0], [4, 0]]],
  '0': [...O, [[0, 1], [4, 5]]],
  '1': [[[1, 5], [2, 6], [2, 0]], [[1, 0], [3, 0]]],
  '2': [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [0, 0], [4, 0]]],
  '3': [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3], [4, 2], [4, 1], [3, 0], [1, 0], [0, 1]], [[1, 3], [3, 3]]],
  '4': [[[3, 0], [3, 6], [0, 2], [4, 2]]],
  '5': [[[4, 6], [0, 6], [0, 3], [3, 3], [4, 2], [4, 1], [3, 0], [0, 0]]],
  '6': [[[4, 6], [2, 6], [0, 4], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]]],
  '7': [[[0, 6], [4, 6], [1, 0]]],
  '8': [
    [[1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3], [1, 3], [0, 2], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3]],
  ],
  '9': [[[4, 3], [1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 2], [2, 0], [0, 0]]],
  '-': [[[1, 3], [3, 3]]],
  '/': [[[0, 0], [4, 6]]],
  ' ': [],
};

/** A glyph is 4 units wide; each takes 6 with the space after it. */
const ADVANCE = 6;

/** The label's size at a cap height, in mm: its width and height. */
export function labelSize(text: string, height: number): [number, number] {
  const unit = height / 6;
  return [(text.length * ADVANCE - 2) * unit, height];
}

/** The label's strokes as line segments in mm, from its lower-left corner. */
function segments(text: string, height: number): [Vec2, Vec2][] {
  const unit = height / 6;
  const out: [Vec2, Vec2][] = [];
  [...text.toUpperCase()].forEach((ch, i) => {
    const glyph = FONT[ch];
    if (!glyph) throw new Error(`label: no glyph for '${ch}'`);
    for (const line of glyph) {
      for (let k = 0; k + 1 < line.length; k++) {
        const [a, b] = [line[k]!, line[k + 1]!];
        out.push([
          [(a[0] + i * ADVANCE) * unit, a[1] * unit],
          [(b[0] + i * ADVANCE) * unit, b[1] * unit],
        ]);
      }
    }
  });
  return out;
}

/** Clear of the face's edges by this much, so the label doesn't break through a wall. */
const MARGIN = 1.5;

/** Smallest text worth engraving. */
const SMALLEST = 3;

interface Spot {
  /** The label's centre, its turn (0 or 90° about Z), the face's height, and whether it faces down. */
  at: Vec2;
  turn: 0 | 90;
  z: number;
  down: boolean;
  height: number;
}

/** A face sampled on a grid: inside it or not, as a summed table of the cells outside. */
function raster(face: Face, z: number) {
  const b = getBounds(face);
  const span = Math.max(b.xMax - b.xMin, b.yMax - b.yMin);
  const step = Math.max(0.75, span / 240);
  const nx = Math.max(1, Math.ceil((b.xMax - b.xMin) / step));
  const ny = Math.max(1, Math.ceil((b.yMax - b.yMin) / step));
  // sum[j][i]: cells outside the face below row j and left of column i.
  const sum = Array.from({ length: ny + 1 }, () => new Float64Array(nx + 1));
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = b.xMin + (i + 0.5) * step;
      const y = b.yMin + (j + 0.5) * step;
      const out = classifyPointOnFace(face, [x, y, z]) === 'in' ? 0 : 1;
      sum[j + 1]![i + 1] = out + sum[j]![i + 1]! + sum[j + 1]![i]! - sum[j]![i]!;
    }
  }
  /** Whether the rectangle [x0, x1] × [y0, y1] lies wholly in the face. */
  const clear = (x0: number, x1: number, y0: number, y1: number) => {
    const i0 = Math.floor((x0 - b.xMin) / step);
    const i1 = Math.ceil((x1 - b.xMin) / step);
    const j0 = Math.floor((y0 - b.yMin) / step);
    const j1 = Math.ceil((y1 - b.yMin) / step);
    if (i0 < 0 || j0 < 0 || i1 > nx || j1 > ny) return false;
    return sum[j1]![i1]! - sum[j0]![i1]! - sum[j1]![i0]! + sum[j0]![i0]! === 0;
  };
  return { b, step, clear };
}

/** Where the label fits best: the biggest text, on the highest face up, nearest its middle. */
function findSpot(solid: ValidSolid, text: string, options: LabelOptions): Spot | undefined {
  const flat = (down: boolean) =>
    getFaces(solid)
      .filter((f) => {
        const t = getSurfaceType(f);
        if (!t.ok || t.value !== 'PLANE') return false;
        const n = normalAt(f, faceCenter(f));
        return down ? n[2] < -0.999 : n[2] > 0.999;
      })
      .map((f) => ({ face: f, z: faceCenter(f)[2], area: unwrap(measureArea(f)) }))
      .sort((a, b) => b.z - a.z || b.area - a.area);
  const rasters = new Map<Face, ReturnType<typeof raster>>();

  for (const down of [false, true]) {
    const faces = flat(down);
    for (let height = options.height; height >= SMALLEST - 1e-9; height -= 0.5) {
      const [w, h] = labelSize(text, height);
      for (const { face, z } of faces) {
        const bb = getBounds(face);
        // Too small either way round: skip without sampling it.
        const fitsLong = Math.max(bb.xMax - bb.xMin, bb.yMax - bb.yMin) >= w + 2 * MARGIN;
        const fitsShort = Math.min(bb.xMax - bb.xMin, bb.yMax - bb.yMin) >= h + 2 * MARGIN;
        if (!fitsLong || !fitsShort) continue;
        let r = rasters.get(face);
        if (!r) {
          r = raster(face, z);
          rasters.set(face, r);
        }
        const centre: Vec2 = [(bb.xMin + bb.xMax) / 2, (bb.yMin + bb.yMax) / 2];
        let best: Spot | undefined;
        let bestDistance = Infinity;
        for (const turn of [0, 90] as const) {
          const [hw, hh] = turn === 0 ? [w / 2 + MARGIN, h / 2 + MARGIN] : [h / 2 + MARGIN, w / 2 + MARGIN];
          for (let y = bb.yMin + hh; y <= bb.yMax - hh + 1e-9; y += r.step) {
            for (let x = bb.xMin + hw; x <= bb.xMax - hw + 1e-9; x += r.step) {
              const distance = Math.hypot(x - centre[0], y - centre[1]);
              if (distance >= bestDistance) continue;
              if (r.clear(x - hw, x + hw, y - hh, y + hh)) {
                best = { at: [x, y], turn, z, down, height };
                bestDistance = distance;
              }
            }
          }
        }
        if (best) return best;
      }
    }
  }
  return undefined;
}

/** The part with `text` engraved into it, as `name` for the warning if there's no room. */
/** Set SWARDBOT_FAST=1 to skip labels (and the edge finish), for quick iteration on a part's shape. */
const FAST = typeof process !== 'undefined' && process.env?.SWARDBOT_FAST === '1';

export function engrave(solid: ValidSolid, text: string, options: LabelOptions, name = text): ValidSolid {
  if (options.height <= 0 || !text.trim() || FAST) return solid;
  const spot = findSpot(solid, text, options);
  if (!spot) {
    console.warn(`label: no room on ${name} for '${text}'`);
    return solid;
  }
  const [w, h] = labelSize(text, spot.height);
  const half = options.stroke / 2;
  const turn = (spot.turn * Math.PI) / 180;
  const place = ([x, y]: Vec2): Vec2 => {
    // From the label's lower-left to its centre, mirrored if read from below, turned, then moved to the spot.
    let u = x - w / 2;
    const v = y - h / 2;
    if (spot.down) u = -u;
    return [spot.at[0] + u * Math.cos(turn) - v * Math.sin(turn), spot.at[1] + u * Math.sin(turn) + v * Math.cos(turn)];
  };
  const [z0, depth] = spot.down ? [spot.z - 1, options.depth + 1] : [spot.z - options.depth, options.depth + 1];
  const strokes = segments(text, spot.height).map(([a, b]) => {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const len = Math.hypot(dx, dy) || 1;
    const [ux, uy] = [(dx / len) * half, (dy / len) * half];
    const [nx, ny] = [-uy, ux];
    // A stroke with square ends, overlapping its neighbours at the joints.
    const corners: Vec2[] = [
      [a[0] - ux - nx, a[1] - uy - ny],
      [b[0] + ux - nx, b[1] + uy - ny],
      [b[0] + ux + nx, b[1] + uy + ny],
      [a[0] - ux + nx, a[1] - uy + ny],
    ];
    return prism(corners.map(place), z0, depth);
  });
  const text3d = fuseAll(strokes);
  if (!text3d.ok) {
    console.warn(`label: couldn't build '${text}' for ${name}`);
    return solid;
  }
  const result = cut(solid, text3d.value);
  if (!result.ok) {
    console.warn(`label: couldn't engrave '${text}' into ${name}`);
    return solid;
  }
  return result.value as ValidSolid;
}
