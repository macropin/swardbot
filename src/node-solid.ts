/**
 * A printed node half, built from its geometry in ./nodes.ts.
 *
 * Each half is built as it prints: its split face, which meets the other half,
 * flat on the bed at z = 0, and its outer face up at z = `thickness`. The web
 * between the tubes lies on the bed; around each tube an arm rises the full
 * thickness, with the tube's channel open on the bed side and its roof
 * bridged over it. Spigots stand up off the inner half's outer face, and the
 * bolts' nuts sink into that face. Nothing overhangs, so nothing needs support.
 *
 * In the bed's plane, X is the side frame's u (forward) and Y its v (up), or
 * minus v for the halves that come out mirrored that way up: see `mirrored`.
 * `installed` moves a half from there to where it sits on the mower.
 */
import { box, cut, cylinder, fuse, rotate, Sketcher, translate, unwrap, type ValidSolid } from 'brepjs';

import type { Layout } from './layout.js';
import {
  band,
  boltPoints,
  chamferedSquare,
  channelSpan,
  nodeDims,
  square,
  tunnelBox,
  type NodeSpec,
  type Vec2,
} from './nodes.js';
import { teardrop } from './shapes.js';
import { single } from './solid.js';

export type Half = 'outer' | 'inner';
export type Side = 'left' | 'right';

/** Overshoot so cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

/**
 * Whether a half, laid split face down to print, has the side frame's drawing
 * mirrored in v. The left outer half and the right inner half come out that
 * way, so they share a shape (bar the inner half's spigots), as do the left
 * inner half and the right outer half.
 */
export const mirrored = (side: Side, half: Half) => (side === 'left') === (half === 'outer');

/** A prism standing on a polygon in the XY plane, from z0 up by `height`. */
export function prism(points: readonly Vec2[], z0: number, height: number): ValidSolid {
  const [first, ...rest] = points;
  if (!first) throw new Error('prism needs a polygon');
  let sketch = new Sketcher('XY', z0).movePointerTo(first);
  for (const q of rest) sketch = sketch.lineTo(q);
  return single(sketch.close().extrude(height));
}

const hexagon = (at: Vec2, radius: number): Vec2[] =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    return [at[0] + radius * Math.cos(a), at[1] + radius * Math.sin(a)];
  });

const join = (a: ValidSolid, b: ValidSolid) => single(unwrap(fuse(a, b)));
const remove = (a: ValidSolid, b: ValidSolid) => single(unwrap(cut(a, b)));

/** A node half as it prints, in the bed's frame: X = u, Y = ±v (absolute), Z up from the split face. */
export function nodeHalf(l: Layout, n: NodeSpec, half: Half, side: Side): ValidSolid {
  const p = l.params;
  const d = nodeDims(l);
  const T = d.thickness;
  const flip = mirrored(side, half);
  const at = (q: Vec2): Vec2 => [q[0], flip ? -q[1] : q[1]];
  const all = (qs: readonly Vec2[]) => qs.map(at);

  // The web on the bed, and the arms and tunnel walls rising from it.
  let body = prism(all(n.outline), 0, d.wall);
  for (const seat of n.seats) body = join(body, prism(all(band(seat, seat.start, seat.stop, d.armHalf)), 0, T));
  for (const t of n.tunnels) body = join(body, prism(all(tunnelBox(t, d)), 0, T));
  for (const b of n.bosses ?? []) body = join(body, prism(all(square(b.at, b.half)), 0, T));

  // Each tube's channel, open on the split face.
  for (const seat of n.seats) {
    const [s0, s1] = channelSpan(seat, p.fitTolerance, OVER);
    body = remove(body, prism(all(band(seat, s0, s1, d.channelHalf)), -OVER, d.channelDepth + OVER));
  }

  // Cross members running through: their tunnel, and a bolt across each along u,
  // from the tunnel's rear face into a nut dropped into a slot in its front wall.
  // The slot opens on the outer face, so the nut goes in before the halves close.
  for (const t of n.tunnels) {
    body = remove(body, prism(all(square(t.at, d.channelHalf)), -OVER, T + 2 * OVER));
    const [u, v] = at(t.at);
    const rear = u - d.channelHalf - d.wall - OVER;
    const front = u + d.channelHalf + d.tunnelFrontWall + OVER;
    body = remove(body, teardrop(d.boltHole, 'x', rear, front - rear, [v, T / 2]));
    const slotFrom = u + d.channelHalf + d.slotSkin;
    const slotBottom = T / 2 - d.nutRadius;
    body = remove(
      body,
      box(d.nutDepth, d.nutAF, T - slotBottom + OVER, {
        centered: true,
        at: [slotFrom + d.nutDepth / 2, v, slotBottom + (T - slotBottom + OVER) / 2],
      }),
    );
  }

  // Bolts across the frame, through both halves and the tube; nuts sunk into the outer face.
  for (const b of boltPoints(n)) {
    const [x, y] = at(b.at);
    body = remove(body, cylinder(d.boltHole, T + 2 * OVER, { at: [x, y, -OVER] }));
    body = remove(body, prism(hexagon([x, y], d.nutRadius), T - d.nutDepth, d.nutDepth + OVER));
  }

  // Bolts through both halves that pass no tube, nuts sunk into the outer face.
  for (const q of n.extraBolts ?? []) {
    const [x, y] = at(q);
    body = remove(body, cylinder(d.boltHole, T + 2 * OVER, { at: [x, y, -OVER] }));
    body = remove(body, prism(hexagon([x, y], d.nutRadius), T - d.nutDepth, d.nutDepth + OVER));
  }

  // The drive axle: through the outer half, blind in the inner half.
  if (n.axle) {
    const [x, y] = at(n.axle);
    const depth = half === 'outer' ? T + 2 * OVER : d.axleDepth + OVER;
    body = remove(body, cylinder(d.axleHole, depth, { at: [x, y, -OVER] }));
  }

  // Spigots for the cross members that end here, on the inner half, each with a
  // bolt across it along v.
  if (half === 'inner') {
    for (const sp of n.spigots) {
      const [x, y] = at(sp.at);
      const spigot = prism(chamferedSquare([x, y], d.spigot, d.spigotChamfer), T - OVER, d.spigotLength + OVER);
      body = join(body, spigot);
      const across = d.spigot + 2 * OVER;
      // The standard distance in from the cross member's end, like every tube end's first bolt.
      body = remove(body, teardrop(d.boltHole, 'y', y - across / 2, across, [x, T + l.params.boltInset]));
    }
  }

  return body;
}

/**
 * Moves a half from its printing position to where it sits on the mower, in
 * the layout's frame: its split face on the side frame's plane, its outer face
 * outward for the outer half and inward for the inner one.
 */
export function installed(l: Layout, solid: ValidSolid, half: Half, side: Side): ValidSolid {
  const turned = rotate(solid, mirrored(side, half) ? -90 : 90, { axis: [1, 0, 0] });
  return translate(turned, [0, side === 'left' ? l.railY : -l.railY, 0]);
}
