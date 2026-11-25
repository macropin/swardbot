/**
 * The whole mower, schematically, from the layout: the tube frame and its
 * printed nodes, wheels, castors, batteries, deck, motor, electronics box and
 * GPS antennas. For checking the layout by eye and for renders. Not a part:
 * the printed parts are their own modules, placed here; bolts aren't drawn.
 *
 * Frame as in ../layout.ts: X forward from the rear axle, Y to the left, Z up
 * from the ground.
 */
import {
  box,
  compound,
  cut,
  cylinder,
  fuse,
  rotate,
  torus,
  translate,
  unwrap,
  type AnyShape,
  type Compound,
  type ValidSolid,
} from 'brepjs';

import { layout, type Box3, type Layout, type Member, type Vec3 } from '../layout.js';
import { bladeAdapterBodies } from '../blade-solid.js';
import { fittingBodies } from '../fittings-solid.js';
import { frontBeamBodies } from '../front-beam-solid.js';
import { installed, nodeHalf } from '../node-solid.js';
import { nodes } from '../nodes.js';
import { single } from '../solid.js';

/** Overshoot so cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

/** Sheet thickness drawn for the tray. */
const TRAY_SHEET = 1.5;

/** Hollow square tube along a member's centreline, its faces square to X, Y or Z where the member allows. */
function tube(m: Member, size: number, wall: number): ValidSolid {
  const hollow = single(
    unwrap(
      cut(
        box(size, size, m.length, { centered: true }),
        box(size - 2 * wall, size - 2 * wall, m.length + 2 * OVER, { centered: true }),
      ),
    ),
  );
  const d: Vec3 = [m.to[0] - m.from[0], m.to[1] - m.from[1], m.to[2] - m.from[2]].map(
    (v) => v / m.length,
  ) as Vec3;
  // Turn Z onto the member's direction, about Z × d. Members lie in the XZ plane
  // or along Y, so this keeps a pair of faces square to Y.
  const axis: Vec3 = [-d[1], d[0], 0];
  const angle = (Math.acos(Math.max(-1, Math.min(1, d[2]))) * 180) / Math.PI;
  const turned = Math.hypot(axis[0], axis[1]) > 1e-9 ? rotate(hollow, angle, { axis }) : hollow;
  const mid: Vec3 = [(m.from[0] + m.to[0]) / 2, (m.from[1] + m.to[1]) / 2, (m.from[2] + m.to[2]) / 2];
  return translate(turned, mid);
}

const block = (b: Box3): ValidSolid =>
  box(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2], {
    centered: true,
    at: [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2],
  });

function driveWheel(l: Layout, y: number): ValidSolid {
  const { wheelWidth, axleDiameter } = l.params;
  const tyreR = wheelWidth / 2;
  const tyre = torus(l.wheel.radius - tyreR, tyreR, { at: [0, y, l.wheel.axleZ], axis: [0, 1, 0] });
  const hub = cylinder(l.wheel.radius - tyreR, wheelWidth * 0.9, {
    at: [0, y - (wheelWidth * 0.9) / 2, l.wheel.axleZ],
    axis: [0, 1, 0],
  });
  // The axle stub, out of the wheel's inner face and through the post.
  const inward = -Math.sign(y);
  // Starting a little inside the hub, so the two fuse into one body.
  const face = y + inward * (wheelWidth * 0.45 - OVER);
  const stub = cylinder(axleDiameter / 2, l.params.axleLength, {
    at: [0, face, l.wheel.axleZ],
    axis: [0, inward, 0],
  });
  return single(unwrap(fuse(single(unwrap(fuse(tyre, hub))), stub)));
}

function castor(l: Layout, y: number): ValidSolid {
  const p = l.params;
  const x = l.wheelbase;
  const plate = box(p.castorPlateLength, p.castorPlateWidth, 4, {
    centered: true,
    at: [x, y, p.castorHeight - 2],
  });
  const wheelX = x - p.castorTrail;
  const r = l.castor.wheelRadius;
  // The fork reaches a little into the plate, and down past the axle.
  const forkTop = p.castorHeight - 2;
  const forkBottom = r - 12;
  const fork = box(p.castorTrail + 20, p.castorWheelWidth + 12, forkTop - forkBottom, {
    centered: true,
    at: [x - p.castorTrail / 2, y, (forkTop + forkBottom) / 2],
  });
  // Open below, leaving the fork's crown whole.
  const slotTop = forkTop - 17;
  const slot = box(2 * r + 2 * OVER, p.castorWheelWidth + 2, slotTop, {
    centered: true,
    at: [wheelX, y, slotTop / 2],
  });
  const wheel = cylinder(r, p.castorWheelWidth, {
    at: [wheelX, y - p.castorWheelWidth / 2, r],
    axis: [0, 1, 0],
  });
  const axle = cylinder(6, p.castorWheelWidth + 12, {
    at: [wheelX, y - (p.castorWheelWidth + 12) / 2, r],
    axis: [0, 1, 0],
  });
  const body = single(unwrap(fuse(plate, single(unwrap(cut(fork, slot))))));
  const wheelOnAxle = single(unwrap(fuse(wheel, axle)));
  return single(unwrap(fuse(body, wheelOnAxle)));
}

function deckBodies(l: Layout): ValidSolid[] {
  const p = l.params;
  const d = l.deck;
  const outer = cylinder(p.trayDiameter / 2 + TRAY_SHEET, p.trayDepth, { at: [d.x, 0, d.trayBottom] });
  const inner = cylinder(p.trayDiameter / 2, p.trayDepth - TRAY_SHEET + OVER, {
    at: [d.x, 0, d.trayBottom - OVER],
  });
  const lip = cylinder(l.deck.radius, 3, { at: [d.x, 0, d.trayBottom] });
  const tray = single(unwrap(cut(single(unwrap(fuse(outer, lip))), inner)));

  const blade = box(p.bladeDiameter, 45, 4, { centered: true, at: [d.x, 0, d.bladeZ] });
  const motor = cylinder(p.mowerMotorDiameter / 2, p.mowerMotorLength, { at: [d.x, 0, d.motorZ] });
  const shaft = cylinder(8, d.motorZ - d.bladeZ, { at: [d.x, 0, d.bladeZ] });
  return [tray, blade, motor, shaft];
}

function topBodies(l: Layout): ValidSolid[] {
  const antennas = l.antennas.map((a) => cylinder(45, 18, { at: a }));
  return [block(l.electronics), ...antennas];
}

/** Both halves of every node, on both side frames. */
export function nodeBodies(l: Layout = layout()): ValidSolid[] {
  return nodes(l).flatMap((n) =>
    (['left', 'right'] as const).flatMap((side) =>
      (['outer', 'inner'] as const).map((half) => installed(l, nodeHalf(l, n, half, side), half, side)),
    ),
  );
}

/** Every body of the mower, in the layout's frame. */
export function mowerBodies(l: Layout = layout()): AnyShape[] {
  const frame = [
    ...l.members.map((m) => tube(m, l.tube.size, l.tube.wall)),
    ...nodeBodies(l),
    ...frontBeamBodies(l),
    ...fittingBodies(l),
    ...bladeAdapterBodies(l),
  ];
  const wheels = [l.wheel.y, -l.wheel.y].map((y) => driveWheel(l, y));
  const castors = [l.castor.y, -l.castor.y].map((y) => castor(l, y));
  const batteries = l.batteries.map(block);
  return [...frame, ...wheels, ...castors, ...batteries, ...deckBodies(l), ...topBodies(l)];
}

export default function mowerScene(): Compound {
  return compound(mowerBodies());
}
