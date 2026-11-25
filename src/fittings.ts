/**
 * The battery cradle's, deck's and top's clamped-on parts, as numbers.
 *
 * - Battery stop: a U-clip that hangs on the cradle's front floor tube under
 *   each battery, a lip on its front standing up in front of the battery so it
 *   can't slide forward. Two cam straps, around the batteries and the floor
 *   tubes, hold them down.
 * - Deck hanger block: a two-half clamp on the deck beam or the front cross
 *   member, carrying one of the deck's threaded rods behind the tube. Nuts
 *   above and below the block set the cut height.
 * - Deck plate: a ribbed plate on the tray's top that the motor stands on. The
 *   rods screw into nuts held in its underside; the motor's bolts come up
 *   through the tray and the plate, clamping the tray to it.
 * - Electronics backplate and rail caps: the box screws to the backplate, which
 *   clamps to the two electronics rails between the posts with a cap behind
 *   each, standing off them so the box's screws and nuts clear the rails.
 * - Antenna mount: a socket over each end of the top bar, a pedestal on top with
 *   a 5/8" bolt held in a slot, for a survey antenna to screw on to.
 * - E-stop housing: a two-half clamp on the top bar's middle, the upper half a
 *   box for a 22 mm e-stop button and its contact block.
 * - Axle clamp: a block round each drive axle between the rear node and the
 *   wheel, gripping the axle's flats against the motor's torque (./nodes.ts).
 *
 * Frame as in ./layout.ts: X forward, Y to the left, Z up.
 */
import type { Check, Layout } from './layout.js';
import { axleClamp, MIN_LIGAMENT, nodeDims, type Hole } from './nodes.js';

/** Clearance a drilled hole takes over its bolt. */
const DRILL_CLEARANCE = 0.5;

/** Plastic either side of a nut slot. */
const SLOT_SKIN = 2;

/** Nut across flats to its pocket's corner radius, and its pocket's depth. */
const nut = (af: number, thickness: number, fit: number) => ({
  af: af + fit,
  radius: (af + fit) / Math.sqrt(3),
  depth: thickness + 0.5,
});

export function fittings(l: Layout) {
  const p = l.params;
  const d = nodeDims(l);
  const { h } = d;
  const fit = p.fitTolerance;
  const T = d.thickness;
  const bolt = p.boltDiameter + DRILL_CLEARANCE;
  const checks: Check[] = [];
  const atLeast = (name: string, value: number, min: number, unit: Check['unit'] = 'mm') =>
    checks.push({ name, ok: value >= min - 1e-9, value, unit, limit: `≥ ${min}` });
  const holes = new Map<string, Hole[]>();
  const hole = (member: string, h: Hole) => holes.set(member, [...(holes.get(member) ?? []), h]);
  const member = (name: string) => l.members.find((m) => m.name === name)!;

  // --- Battery stop ---------------------------------------------------------------

  const batteryCentres = l.batteries.map((b) => (b.min[1] + b.max[1]) / 2);
  const batteryStop = {
    /** Round the tube, from its centre: the U's back and front walls, open on top. */
    back: d.armHalf,
    front: d.channelHalf + p.batteryStopLipThickness,
    halfY: p.batteryStopWidth / 2,
    /** Its bottom, below the tube's centre; the back wall's top, just under the tube's top, which the battery sits on. */
    bottom: -d.armHalf,
    backTop: h - 1,
    /** The lip's top, above the tube's top. */
    lipTop: h + p.batteryStopLip,
    centres: batteryCentres,
  };
  const frontFloor = member('cradle floor, front');
  for (const y of batteryCentres) {
    hole('cradle floor, front', {
      at: y - frontFloor.from[1],
      diameter: bolt,
      through: 'front and back',
      for: 'battery stop bolt',
      node: 'battery stop',
    });
  }

  // --- Deck hanger block and deck plate -------------------------------------------------

  const rodNut = nut(p.deckRodNutAcrossFlats, p.deckRodNutThickness, fit);
  const rodHole = (p.deckRod + fit) / 2;
  const block = {
    /** Fore of the tube's centre, and aft of it to clear the rod's nuts. */
    front: d.armHalf,
    rear: l.deck.rodOffset + rodNut.radius + 1,
    halfY: p.deckBlockHalf,
    rodOffset: l.deck.rodOffset,
    rodHole,
  };
  atLeast('Deck hanger block: rod clear of the tube', block.rodOffset - rodHole - d.channelHalf, MIN_LIGAMENT);
  atLeast('Deck hanger block: room for the rod’s nuts', block.halfY - rodNut.radius, 1);
  for (const name of ['deck beam', 'front cross member']) {
    const m = member(name);
    for (const y of [-l.deck.rodY, l.deck.rodY]) {
      hole(name, { at: y - m.from[1], diameter: bolt, through: 'top and bottom', for: 'deck hanger block bolt', node: 'deck hanger' });
    }
  }

  const motorRing = { inner: p.mowerMotorDiameter / 2 + 1, outer: p.mowerMotorDiameter / 2 + 6 };
  const plate = {
    ...l.deck.plate,
    base: p.deckPlateBase,
    height: p.deckPlateHeight,
    boss: p.deckPlateBoss,
    rim: 5,
    rib: 6,
    motorRing,
    motorBolts: Array.from({ length: p.motorBoltCount }, (_, i) => {
      const a = (2 * Math.PI * (i + 0.5)) / p.motorBoltCount;
      return [(p.motorBoltCircle / 2) * Math.cos(a), (p.motorBoltCircle / 2) * Math.sin(a)] as [number, number];
    }),
    trayBolts: [0, 1, 2, 3].map((i) => {
      const a = (Math.PI / 2) * i;
      return [(p.trayBoltCircle / 2) * Math.cos(a), (p.trayBoltCircle / 2) * Math.sin(a)] as [number, number];
    }),
    rodNut,
    rodHole,
    trayNut: nut(p.nutAcrossFlats, p.nutThickness, fit),
  };
  const toDeck = l.deck.x;
  const plateInside = Math.min(toDeck - plate.x0, plate.x1 - toDeck, plate.halfY) - plate.rim;
  atLeast('Deck plate: motor ring inside the plate', plateInside - motorRing.outer, 0);
  atLeast(
    'Deck plate: tray bolts between the motor ring and the rim',
    Math.min(p.trayBoltCircle / 2 - motorRing.outer, plateInside - p.trayBoltCircle / 2) - plate.trayNut.radius,
    1,
  );
  atLeast('Deck plate: motor bolts inside the motor', motorRing.inner - p.motorBoltCircle / 2 - p.motorBolt, 0);

  // --- Electronics backplate and rail caps ------------------------------------------------

  const [low, high] = l.electronicsRails;
  /** Every bolt here is the frame's M6, and its nut. */
  const m6nut = nut(p.nutAcrossFlats, p.nutThickness, fit);
  const backplate = {
    /** The plate's back and front faces; the box sits on the front. */
    back: h + fit / 2 + p.backplateStandoff,
    front: l.electronics.min[0],
    halfY: p.electronicsWidth / 2,
    bottom: low - d.channelHalf - p.electronicsClampBoss,
    top: l.electronics.max[2],
    rails: [low, high],
    /** Clamps round both rails, either side of the middle, this wide, with bolts below, between and above the rails. */
    clampY: p.electronicsWidth / 2 - 80,
    clampWidth: 30,
    clampBolts: [low - d.channelHalf - p.electronicsClampBoss / 2, (low + high) / 2, high + d.channelHalf + p.electronicsClampBoss / 2],
    boss: p.electronicsClampBoss,
    clampBolt: (p.boltDiameter + fit) / 2,
    clampNut: m6nut,
    /** A nut slot in each clamp, between the rail's channel and the plate. */
    slotX: h - p.clampSqueeze / 2 + SLOT_SKIN,
    boxScrews: [-1, 1].flatMap((sy) =>
      [-1, 1].map(
        (sz) =>
          [
            (sy * p.electronicsHoleSpacingY) / 2,
            (l.electronics.min[2] + l.electronics.max[2]) / 2 + (sz * p.electronicsHoleSpacingZ) / 2,
          ] as [number, number],
      ),
    ),
    boxScrew: (p.boltDiameter + fit) / 2,
    boxNut: m6nut,
  };
  atLeast('Backplate: nut slot fits between the rail and the plate', backplate.back - backplate.slotX - m6nut.depth, 0);
  atLeast(
    'Backplate: room for a clamp bolt between the rails',
    high - low - 2 * d.channelHalf - m6nut.af - 2 * SLOT_SKIN,
    0,
  );
  atLeast(
    'Backplate: box screws clear of the clamps',
    Math.min(...backplate.boxScrews.map(([y]) => Math.abs(Math.abs(y) - backplate.clampY))) -
      backplate.clampWidth / 2 -
      backplate.boxNut.radius,
    2,
  );
  atLeast(
    'Backplate: box screws inside the plate',
    Math.min(
      ...backplate.boxScrews.map(([y, z]) =>
        Math.min(backplate.halfY - Math.abs(y), z - backplate.bottom, backplate.top - z),
      ),
    ) - backplate.boxNut.radius,
    2,
  );
  /** One cap behind both rails, clamping them to the backplate. */
  const railCap = {
    back: -T,
    halfY: backplate.clampY + backplate.clampWidth / 2,
    bottom: backplate.bottom,
    top: high + d.channelHalf + p.electronicsClampBoss,
  };

  // --- Antenna mounts ----------------------------------------------------------------

  const topBar = member('top bar');
  const barEnd = topBar.length / 2;
  const antenna = {
    /** Along the bar from its end, inward: the socket's open end, and the antenna's centre. */
    socketLength: p.antennaSocketLength,
    centre: barEnd - p.gpsBaseline / 2,
    pedestal: p.antennaPedestal,
    pedestalHeight: p.antennaPedestalHeight,
    halfX: d.armHalf,
    boltHole: (p.antennaBolt + fit) / 2,
    headAF: p.antennaBoltHead + fit,
    headHeight: p.antennaBoltHeadHeight + 0.5,
    /** The pin through the socket and the bar, the standard distance in from the bar's end. */
    pin: p.boltInset,
  };
  atLeast(
    'Antenna mount: pedestal over the socket',
    Math.min(antenna.centre - antenna.pedestal / 2, antenna.socketLength - antenna.centre - antenna.pedestal / 2),
    0,
  );
  atLeast('Antenna mount: bolt head slot inside the pedestal', d.armHalf - antenna.headAF / 2, 3);
  atLeast(
    'Antenna mount: room for the bolt head under the pedestal top',
    antenna.pedestalHeight - antenna.headHeight,
    6,
  );
  for (const at of [antenna.pin, topBar.length - antenna.pin]) {
    hole('top bar', { at, diameter: bolt, through: 'front and back', for: 'antenna mount pin', node: 'antenna' });
  }

  // --- E-stop housing -------------------------------------------------------------------

  const estopNut = nut(p.nutAcrossFlats, p.nutThickness, fit);
  const estop = {
    halfY: p.estopHousing / 2 + estopNut.radius * 2 + MIN_LIGAMENT,
    /** The housing on top: square, its cavity, the button's hole in its top. */
    housing: p.estopHousing,
    wall: 3,
    top: 4,
    depth: p.estopDepth,
    hole: (p.estopHole + fit) / 2,
    cable: 5,
    boltY: p.estopHousing / 2 + estopNut.radius + 1,
  };
  for (const y of [-estop.boltY, estop.boltY]) {
    hole('top bar', { at: barEnd + y, diameter: bolt, through: 'top and bottom', for: 'e-stop housing bolt', node: 'estop' });
  }

  // --- Axle clamp ------------------------------------------------------------------------

  const clamp = axleClamp(l);
  atLeast('Axle clamp: the axle has flats', p.axleDiameter - p.axleFlats, 1);
  atLeast('Axle clamp: grips enough of the axle', clamp.length - p.axleDiameter, 0);

  // --- Printer bed --------------------------------------------------------------------

  const parts: [string, number, number, number][] = [
    ['battery-stop', batteryStop.back + batteryStop.front, batteryStop.lipTop - batteryStop.bottom, 2 * batteryStop.halfY],
    ['deck-hanger-block', block.front + block.rear, 2 * block.halfY, T],
    ['deck-plate', plate.x1 - plate.x0, 2 * plate.halfY, plate.height],
    ['electronics-backplate', 2 * backplate.halfY, backplate.top - backplate.bottom, backplate.front],
    ['electronics-rail-cap', 2 * railCap.halfY, railCap.top - railCap.bottom, T],
    ['antenna-mount', 2 * d.armHalf, antenna.socketLength + d.wall, 2 * d.armHalf + antenna.pedestalHeight],
    ['estop-housing', estop.housing, 2 * estop.halfY, T + estop.depth + estop.top],
    ['axle-clamp', 2 * clamp.half, 2 * clamp.half, clamp.length],
  ];
  for (const [name, x, y, z] of parts) {
    atLeast(
      `${name}: fits the printer bed`,
      Math.min(Math.max(p.bedX, p.bedY) - Math.max(x, y), Math.min(p.bedX, p.bedY) - Math.min(x, y), p.bedZ - z),
      0,
    );
  }

  for (const [name, list] of holes) holes.set(name, [...list].sort((a, b) => a.at - b.at));

  return { batteryStop, block, plate, backplate, railCap, antenna, estop, clamp, checks, holes };
}

export type Fittings = ReturnType<typeof fittings>;
