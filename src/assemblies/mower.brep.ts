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
import { fittings } from '../fittings.js';
import { deckRodBodies, fittingBodies } from '../fittings-solid.js';
import { frontBeamBodies } from '../front-beam-solid.js';
import { installed, nodeHalf } from '../node-solid.js';
import { nodeDims, nodes } from '../nodes.js';
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

/** A drive wheel: its tyre, and the hub motor with its axle stub. */
function driveWheel(l: Layout, y: number): { tyre: ValidSolid; hub: ValidSolid } {
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
  return { tyre: single(unwrap(cut(tyre, hub))), hub: single(unwrap(fuse(hub, stub))) };
}

/** A castor: its plate and fork, and its wheel on the axle. */
function castor(l: Layout, y: number): { fork: ValidSolid; wheel: ValidSolid } {
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
  return {
    fork: single(unwrap(fuse(plate, single(unwrap(cut(fork, slot)))))),
    wheel: single(unwrap(fuse(wheel, axle))),
  };
}

function tray(l: Layout): ValidSolid {
  const p = l.params;
  const d = l.deck;
  const outer = cylinder(p.trayDiameter / 2 + TRAY_SHEET, p.trayDepth, { at: [d.x, 0, d.trayBottom] });
  const inner = cylinder(p.trayDiameter / 2, p.trayDepth - TRAY_SHEET + OVER, {
    at: [d.x, 0, d.trayBottom - OVER],
  });
  const lip = cylinder(l.deck.radius, 3, { at: [d.x, 0, d.trayBottom] });
  return single(unwrap(cut(single(unwrap(fuse(outer, lip))), inner)));
}

const blade = (l: Layout) =>
  box(l.params.bladeDiameter, 45, 4, { centered: true, at: [l.deck.x, 0, l.deck.bladeZ] });

function mowerMotor(l: Layout): ValidSolid[] {
  const p = l.params;
  const d = l.deck;
  const motor = cylinder(p.mowerMotorDiameter / 2, p.mowerMotorLength, { at: [d.x, 0, d.motorZ] });
  const shaft = cylinder(8, d.motorZ - d.bladeZ, { at: [d.x, 0, d.bladeZ] });
  return [motor, shaft];
}

const antennas = (l: Layout) => l.antennas.map((a) => cylinder(45, 18, { at: a }));

/** The e-stop's mushroom head and its collar, on top of its housing. */
function estopButton(l: Layout): ValidSolid {
  const e = fittings(l).estop;
  const top = l.params.apexHeight + nodeDims(l).thickness + e.depth + e.top;
  const collar = cylinder(e.hole + 4, 8, { at: [0, 0, top - OVER] });
  const head = cylinder(20, 12, { at: [0, 0, top + 8 - OVER] });
  return single(unwrap(fuse(collar, head)));
}

/** Both halves of every node, on both side frames. */
export function nodeBodies(l: Layout = layout()): ValidSolid[] {
  return nodes(l).flatMap((n) =>
    (['left', 'right'] as const).flatMap((side) =>
      (['outer', 'inner'] as const).map((half) => installed(l, nodeHalf(l, n, half, side), half, side)),
    ),
  );
}

/** What a group of bodies is made of, for colouring a render. */
export type Material =
  | 'aluminium'
  | 'printed'
  | 'steel'
  | 'stainless'
  | 'rubber'
  | 'hub'
  | 'castor'
  | 'battery'
  | 'motor'
  | 'enclosure'
  | 'antenna'
  | 'button';

export interface PartGroup {
  readonly name: string;
  readonly material: Material;
  readonly bodies: readonly ValidSolid[];
}

/**
 * The mower's bodies, grouped by what they are. The groups from `front beam`
 * on are everything that rolls on the pivot pin: the beam, its saddle and
 * castor pads, the pin and the castors.
 */
export function mowerGroups(l: Layout = layout()): PartGroup[] {
  const frontBeamTubes = l.members.filter((m) => m.group === 'front beam');
  const tubes = l.members.filter((m) => m.group !== 'front beam');
  const fb = frontBeamBodies(l);
  // frontBeamBodies: saddle ×2, hanger cap, hanger, castor pads ×4, the pin.
  const [saddleUpper, saddleLower, hangerCap, hangerLower, ...rest] = fb;
  const pads = rest.slice(0, -1);
  const pin = rest[rest.length - 1]!;
  const wheels = [l.wheel.y, -l.wheel.y].map((y) => driveWheel(l, y));
  const castors = [l.castor.y, -l.castor.y].map((y) => castor(l, y));
  return [
    { name: 'frame', material: 'aluminium', bodies: tubes.map((m) => tube(m, l.tube.size, l.tube.wall)) },
    { name: 'nodes', material: 'printed', bodies: nodeBodies(l) },
    { name: 'pivot hanger', material: 'printed', bodies: [hangerCap!, hangerLower!] },
    { name: 'fittings', material: 'printed', bodies: fittingBodies(l) },
    { name: 'deck rods', material: 'steel', bodies: deckRodBodies(l) },
    { name: 'tyres', material: 'rubber', bodies: wheels.map((w) => w.tyre) },
    { name: 'hub motors', material: 'hub', bodies: wheels.map((w) => w.hub) },
    { name: 'batteries', material: 'battery', bodies: l.batteries.map(block) },
    { name: 'tray', material: 'stainless', bodies: [tray(l)] },
    { name: 'blade', material: 'steel', bodies: [blade(l), ...bladeAdapterBodies(l)] },
    { name: 'mower motor', material: 'motor', bodies: mowerMotor(l) },
    { name: 'electronics box', material: 'enclosure', bodies: [block(l.electronics)] },
    { name: 'antennas', material: 'antenna', bodies: antennas(l) },
    { name: 'e-stop', material: 'button', bodies: [estopButton(l)] },
    { name: 'front beam', material: 'aluminium', bodies: frontBeamTubes.map((m) => tube(m, l.tube.size, l.tube.wall)) },
    { name: 'front beam printed', material: 'printed', bodies: [saddleUpper!, saddleLower!, ...pads] },
    { name: 'pivot pin', material: 'steel', bodies: [pin] },
    { name: 'castors', material: 'castor', bodies: castors.map((c) => c.fork) },
    { name: 'castor wheels', material: 'rubber', bodies: castors.map((c) => c.wheel) },
  ];
}

/** Every body of the mower, in the layout's frame. */
export function mowerBodies(l: Layout = layout()): AnyShape[] {
  return mowerGroups(l).flatMap((g) => g.bodies);
}

export default function mowerScene(): Compound {
  return compound(mowerBodies());
}
