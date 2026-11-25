/**
 * The front beam's printed parts, as numbers: the pivot it rolls on, its roll
 * stops, and the pads the castors bolt to.
 *
 * - Pivot saddle: two halves clamped on the beam's middle, split level with
 *   its centreline like the nodes, bolted through it. Between them they clamp
 *   the pivot pin, an M10 bolt running fore-aft through the beam, and reach
 *   fore and aft of the beam to grip it along their length.
 * - Pivot hanger: two halves clamped on the front cross member's middle. The
 *   lower half carries two ears, ahead of and behind the saddle, which the pin
 *   turns in, and the roll stops. The ears are thick fore-aft, because a castor
 *   catching a tussock pushes the beam back and bends them that way.
 * - Roll stops: pads under the hanger, either side of the saddle, which the
 *   beam's top meets when it has rolled `rollLimit` either way.
 * - Castor pads: two halves clamped on each end of the beam, the castor's plate
 *   bolted under them with four bolts that also clamp the halves. The beam's
 *   ends need no holes, and each pad's end wall caps its end.
 *
 * Every part is two identical halves, printed split face down.
 *
 * Frame as in ./layout.ts: X forward, Y to the left, Z up.
 */
import type { Check, Layout } from './layout.js';
import { MIN_LIGAMENT, nodeDims, type Hole } from './nodes.js';

/** Plastic below the pin's bore in each ear. */
const EAR_BELOW = 8;

/** Clearance a drilled hole takes over its bolt or pin. */
const DRILL_CLEARANCE = 0.5;

const rad = (deg: number) => (deg * Math.PI) / 180;

export function frontBeam(l: Layout) {
  const p = l.params;
  const d = nodeDims(l);
  const { h } = d;
  const fit = p.fitTolerance;
  const F = l.wheelbase;
  const R = l.railZ;
  const B = l.beamZ;
  const roll = rad(p.rollLimit);

  const pin = {
    radius: p.pivotPin / 2,
    /** In the ears it turns: a running fit. */
    earBore: (p.pivotPin + fit) / 2,
    /** In the saddle it's clamped, squeezed like the tubes. */
    saddleBore: (p.pivotPin - p.clampSqueeze) / 2,
  };

  /** Bolts through a clamp, clear of what lies between them: far enough out for their nut pockets. */
  const boltRoom = d.nutRadius + MIN_LIGAMENT;

  const saddle = {
    halfX: h + p.saddleCheek,
    halfY: p.saddleHalf,
    /** Bolts along the beam either side of the pin, as far out as their nut pockets allow. */
    boltY: p.saddleHalf - boltRoom,
  };

  const earIn = saddle.halfX + p.pivotEndPlay;
  const earOut = earIn + p.pivotEarThickness;
  const stopIn = p.rollStopY - p.rollStopWidth / 2;
  const stopOut = p.rollStopY + p.rollStopWidth / 2;
  /** Where the stop's face sits: the beam's top meets its outer edge rolled `rollLimit` about the pin. */
  const stopFace = B + stopOut * Math.sin(roll) + h * Math.cos(roll);
  const hanger = {
    halfY: stopOut,
    earIn,
    earOut,
    earHalfY: p.pivotEarWidth / 2,
    /** Gussets on the ears' outer faces, reaching out this far at the root. */
    gusset: 15,
    /** The ears' bottom edge, below the pin. */
    earBottom: B - pin.earBore - EAR_BELOW,
    stopIn,
    stopOut,
    stopFace,
    /** Bolts along the cross member, inboard of the stops. */
    boltY: stopIn - boltRoom,
  };

  const castorNutAF = p.castorNutAcrossFlats + fit;
  const pad = {
    halfX: p.castorPlateLength / 2,
    /** Along the beam from the castor's centre: the plate's inner edge, and the end wall past the beam's end. */
    yIn: -p.castorPlateWidth / 2,
    yOut: p.castorPlateWidth / 2 + d.wall,
    bolts: [
      [-p.castorBoltSpacingX / 2, -p.castorBoltSpacingY / 2],
      [p.castorBoltSpacingX / 2, -p.castorBoltSpacingY / 2],
      [p.castorBoltSpacingX / 2, p.castorBoltSpacingY / 2],
      [-p.castorBoltSpacingX / 2, p.castorBoltSpacingY / 2],
    ] as [number, number][],
    boltHole: (p.castorBolt + fit) / 2,
    nutAF: castorNutAF,
    nutRadius: castorNutAF / Math.sqrt(3),
    nutDepth: p.castorNutThickness + 0.5,
  };

  /** The pin, an M10 bolt: through both ears, with a washer each end and a nyloc nut. */
  const pinLength = 2 * earOut + 2 * 2 + p.pivotPin;

  // --- Checks ---------------------------------------------------------------

  const checks: Check[] = [];
  const atLeast = (name: string, value: number, min: number, unit: Check['unit'] = 'mm') =>
    checks.push({ name, ok: value >= min - 1e-9, value, unit, limit: `≥ ${min}` });
  const clearance = 8;

  atLeast('Saddle bolts clear of the pivot pin', saddle.boltY - pin.radius - boltRoom, 0);
  atLeast('Roll stops clear of the saddle', stopIn - saddle.halfY, clearance);
  // The front deck rods' hanger blocks clamp to the cross member too.
  atLeast('Pivot hanger clear of the deck hanger blocks', l.deck.rodY - p.deckBlockHalf - hanger.halfY, clearance);
  // The saddle's lowest corner, rolled to the stops, and the ears, over the deck at its highest.
  const trayTop = p.cutHeightMax + p.bladeToTrayTop;
  atLeast(
    'Saddle clear of the deck at the highest cut',
    B - d.thickness * Math.cos(roll) - saddle.halfY * Math.sin(roll) - trayTop,
    clearance,
  );
  atLeast('Pivot ears clear of the deck at the highest cut', hanger.earBottom - trayTop, clearance);
  atLeast('Saddle clear of the pivot hanger, rolled', R - d.thickness - (B + d.thickness * Math.cos(roll) + saddle.halfY * Math.sin(roll)), clearance);
  atLeast(
    'Castor bolts clear of the beam',
    p.castorBoltSpacingX / 2 - Math.max(pad.boltHole, pad.nutRadius) - d.channelHalf,
    MIN_LIGAMENT,
  );
  atLeast(
    'Castor bolts inside the pad',
    Math.min(pad.halfX - p.castorBoltSpacingX / 2, -pad.yIn - p.castorBoltSpacingY / 2) - pad.nutRadius,
    2,
  );

  const parts = [
    { name: 'pivot-saddle', size: [2 * saddle.halfX, 2 * saddle.halfY, d.thickness] },
    { name: 'pivot-hanger', size: [2 * (earOut + hanger.gusset), 2 * hanger.halfY, R - hanger.earBottom] },
    { name: 'pivot-hanger-cap', size: [2 * d.armHalf, 2 * hanger.halfY, d.thickness] },
    { name: 'castor-pad', size: [2 * pad.halfX, pad.yOut - pad.yIn, d.thickness] },
  ];
  for (const part of parts) {
    const [x, y, z] = part.size as [number, number, number];
    const long = Math.max(x, y);
    const short = Math.min(x, y);
    atLeast(
      `${part.name}: fits the printer bed`,
      Math.min(Math.max(p.bedX, p.bedY) - long, Math.min(p.bedX, p.bedY) - short, p.bedZ - z),
      0,
    );
  }

  // --- Holes to drill --------------------------------------------------------------
  //
  // Both in the middle of a tube, far from either end, so they're drilled through
  // the parts themselves, clamped on at the tube's marked middle.

  const beam = l.members.find((m) => m.name === 'front beam')!;
  const cross = l.members.find((m) => m.name === 'front cross member')!;
  const bolt = p.boltDiameter + DRILL_CLEARANCE;
  const holes = new Map<string, Hole[]>([
    [
      'front beam',
      [
        { at: beam.length / 2 - saddle.boltY, diameter: bolt, through: 'top and bottom', for: 'saddle bolt', node: 'front beam' },
        { at: beam.length / 2, diameter: p.pivotPin + DRILL_CLEARANCE, through: 'front and back', for: 'pivot pin', node: 'front beam' },
        { at: beam.length / 2 + saddle.boltY, diameter: bolt, through: 'top and bottom', for: 'saddle bolt', node: 'front beam' },
      ],
    ],
    [
      'front cross member',
      [
        { at: cross.length / 2 - hanger.boltY, diameter: bolt, through: 'top and bottom', for: 'pivot hanger bolt', node: 'front beam' },
        { at: cross.length / 2 + hanger.boltY, diameter: bolt, through: 'top and bottom', for: 'pivot hanger bolt', node: 'front beam' },
      ],
    ],
  ]);

  return { F, R, B, pin, pinLength, saddle, hanger, pad, checks, holes };
}

export type FrontBeam = ReturnType<typeof frontBeam>;
