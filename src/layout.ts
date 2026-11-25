/**
 * SwardBot chassis layout.
 *
 * Every dimension the chassis is built from, and everything that follows from
 * them: where the wheels, batteries, deck and castors sit, the centrelines and
 * cut lengths of every tube, the mass budget, and the checks that the layout
 * works (clearances, weight on the castors, tip angles). Parts and assembly
 * scenes take their positions from here, so changing one component moves
 * everything that depends on it.
 *
 * The layout packs itself from the back: the batteries sit over the rear axle,
 * the deck goes just ahead of them, and the castors just far enough ahead of
 * the deck to swing clear of it. The side frames sit just outside the battery
 * cradle, and the drive wheels just outside the side frames.
 *
 * Units: millimetres, kilograms, degrees. Frame: X forward from the rear axle,
 * Y to the left, Z up from the ground. The machine is symmetric about Y = 0.
 */
import { DesignError, type Numeric, type Schema } from './params.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

/**
 * Bought-in component sizes are typical values until the parts are in hand;
 * the ones marked GUESS are placeholders for a part not yet chosen.
 */
export const defaults = {
  // Drive wheels: 10" BLDC hub motors with encoders, axle on one side.
  /** Tyre outside diameter. */
  wheelDiameter: 254,
  /** Tyre width. */
  wheelWidth: 65,
  /** Axle diameter: assumed. */
  axleDiameter: 20,
  /** Axle width across its flats, which key it against the motor's torque. GUESS. */
  axleFlats: 16,
  /**
   * Axle length out of the wheel's inner face. GUESS. It passes through the axle
   * clamp and the rear node's outer half, ending blind in the inner half, so it
   * sets how far out the wheel sits.
   */
  axleLength: 75,
  /** Room between the rear node and the wheel for the clamp that grips the axle's flats. GUESS. */
  axleClampLength: 25,
  /** Each wheel with its motor. GUESS. */
  wheelMass: 5,

  // Castors: 5" swivel plate castors on the front roll beam.
  castorWheelDiameter: 125,
  castorWheelWidth: 32,
  /** Ground to the top of the mounting plate. */
  castorHeight: 165,
  /** Swivel axis to wheel axle, horizontally. */
  castorTrail: 40,
  /** Mounting plate along X and across Y. */
  castorPlateLength: 80,
  castorPlateWidth: 100,
  /** Swivel axis to swivel axis. */
  castorTrack: 550,
  /** Least gap between a swinging castor and the deck. */
  castorDeckGap: 15,
  castorMass: 0.8,

  // Batteries: 12V 100Ah LiFePO4, side by side with their long side fore-aft.
  batteryCount: 2,
  batteryLength: 330,
  batteryWidth: 172,
  batteryHeight: 215,
  batteryMass: 11,
  /** Between neighbouring batteries. */
  batteryGap: 10,
  /** Around the batteries inside the cradle, each side. */
  batteryClearance: 5,
  /** Centre of the batteries ahead of the rear axle: forward enough to keep the machine from tipping back. */
  batteryX: 60,
  /** Battery stops on the front floor tube: the lip in front of each battery, how high and how wide. */
  batteryStopLip: 40,
  batteryStopWidth: 30,
  /** The stop's front wall and lip, thick enough to take the batteries' push when braking. */
  batteryStopLipThickness: 8,

  // Deck: a blade under an upturned stainless tray, hung from the frame.
  bladeDiameter: 340,
  bladeMass: 0.5,
  /** Tray inside diameter, and how deep it is under its flat top. */
  trayDiameter: 360,
  trayDepth: 50,
  /** Rolled rim, beyond the inside diameter. */
  trayLip: 5,
  trayMass: 0.8,
  /** Blade up to the underside of the tray's top. */
  bladeToTrayTop: 30,
  /** The tray's sheet. */
  trayThickness: 1,

  // Blade adapter: a hub turned from aluminium or steel, never printed.
  /** Mower motor shaft: diameter, length out of the motor's face, and the thread tapped in its end. GUESS. */
  motorShaft: 12,
  motorShaftLength: 30,
  motorShaftBolt: 6,
  /** The blade: its thickness, and the hole in its middle. GUESS. */
  bladeThickness: 3,
  bladeHole: 12,
  /** The hub: the flange the blade clamps against (and the washer under it), the body, and the flange's thickness. */
  bladeClamp: 50,
  hubDiameter: 28,
  hubFlange: 6,
  /** The clamp washer under the blade, cut from flat bar. */
  bladeWasher: 5,
  /** The hub's top below the tray's top. */
  hubClearance: 3,
  /** Set screw through the hub on to the shaft's flat. */
  hubSetScrew: 6,
  /** Range the hangers adjust over, and the height drawn. */
  cutHeightMin: 40,
  cutHeightMax: 100,
  cutHeight: 70,
  /** Battery cradle to the deck's rim. */
  deckGap: 20,
  /**
   * The deck hangs on four threaded rods, held in hanger blocks clamped to the
   * deck beam (this far behind the deck's centre) and to the front cross
   * member, all this far apart across. Nuts either side of each block set the
   * cut height.
   */
  deckRearHanger: 75,
  deckHangerSpan: 180,
  /** The rods: M8, and their nuts. */
  deckRod: 8,
  deckRodNutAcrossFlats: 13,
  deckRodNutThickness: 6.5,
  /** A hanger block, along its tube each way. */
  deckBlockHalf: 18,
  /** Front rods to the castor beam, which rolls just in front of them. */
  castorBeamGap: 5,
  /** The deck plate the motor stands on: its base, its height with ribs, and the bosses round the rods. */
  deckPlateBase: 8,
  deckPlateHeight: 20,
  deckPlateBoss: 14,
  /** The mower motor's flange: bolts on a circle (M6, to suit the motor), and its spigot through the plate. GUESS. */
  motorBoltCircle: 70,
  motorBoltCount: 4,
  motorBolt: 6,
  motorSpigot: 30,
  /** More bolts through the tray's top into the plate, on this circle. */
  trayBoltCircle: 150,
  trayBolt: 6,
  mowerMotorDiameter: 100,
  mowerMotorLength: 130,
  mowerMotorMass: 3.5,

  // Frame: square aluminium tube.
  tubeSize: 25.4,
  tubeWall: 1.2,
  /** Bunnings sells this tube in 3 m lengths. */
  stockLength: 3000,
  /** Saw kerf and squaring allowance, per cut. */
  kerf: 3,
  /** Side rail centreline above the ground. */
  railHeight: 245,
  /** Top bar centreline above the ground: the GPS bar and carry handle. */
  apexHeight: 500,
  /** Front beam roll each way before it reaches its stops. */
  rollLimit: 6,
  /** Axle to the top of the battery cradle's floor tube beneath it. */
  axleClearance: 3,
  /** Battery cradle to the bumper. */
  bumperGap: 5,

  // Printed nodes: each corner of the side frame's triangle, two clamshell
  // halves split on the frame's plane and bolted through the tubes.
  /** Node walls around each tube, and the web between them. */
  jointWall: 5,
  /** How far a node reaches along each tube beyond the junction. */
  jointArm: 55,
  /** Bolts through the nodes and tubes: M6. */
  boltDiameter: 6,
  /** Hex nut across flats and thickness, sunk into the node's outer face. */
  nutAcrossFlats: 10,
  nutThickness: 5,
  /** First bolt in from the end of a node's arm, and the next one further in. */
  boltInset: 15,
  boltPitch: 25,
  /** Spigot a cross member's end slides over. */
  spigotLength: 35,
  /** Printed-fit slop: clearance across each tube channel, spigot and hole. */
  fitTolerance: 0.4,
  /** How much the two halves squeeze a tube between them before they meet. */
  clampSqueeze: 0.4,

  // Front beam: the castor beam's pivot under the front cross member, its roll
  // stops, and the pads the castors bolt to.
  /** Pivot pin along X through the beam's middle: an M10 bolt. */
  pivotPin: 10,
  /** The saddle clamped on the beam's middle: how far it reaches fore and aft of the beam, and along it each way. */
  saddleCheek: 15,
  saddleHalf: 35,
  /** The pivot hanger's ears either side of the saddle, which the pin turns in: thickness along X, and width. */
  pivotEarThickness: 20,
  pivotEarWidth: 50,
  /** Play between the saddle and each ear, so the pivot turns freely. */
  pivotEndPlay: 0.5,
  /** Roll stops on the pivot hanger: their centres out from the middle, and their width along the beam. */
  rollStopY: 55,
  rollStopWidth: 16,
  /** Castor mounting: bolt (M8), hole spacing on the castor's plate along X and Y, and its plate thickness. GUESS. */
  castorBolt: 8,
  castorBoltSpacingX: 60,
  castorBoltSpacingY: 80,
  castorPlateThickness: 3,
  /** M8 nut across flats and thickness. */
  castorNutAcrossFlats: 13,
  castorNutThickness: 6.5,

  // Printing: a small chamfer on every printed part's hard edges, and a larger
  // one on the corners standing up from the bed (./finish.ts).
  edgeChamfer: 0.6,
  cornerChamfer: 1.5,
  /** A label engraved into each printed part's face up (./label.ts): cap height, depth and stroke. 0 for none. */
  labelHeight: 5,
  labelDepth: 0.6,
  labelStroke: 0.8,

  // Printer bed: Bambu Lab H2S.
  bedX: 340,
  bedY: 320,
  bedZ: 340,

  // On top.
  electronicsLength: 200,
  electronicsWidth: 300,
  electronicsHeight: 120,
  /** Box, flight controller, ESCs, GPS, contactor and wiring. */
  electronicsMass: 3,
  /** Battery tops to the electronics box. */
  electronicsGap: 15,
  /**
   * Two rails between the posts carry a backplate the box screws to: the lower
   * this far above the box's bottom, the upper this far above it.
   */
  electronicsRailLow: 15,
  electronicsRailSpacing: 45,
  /** The backplate's clamps reach this far above and below each rail. */
  electronicsClampBoss: 12,
  /** The backplate's thickness, and how far it stands off the rails to clear the box screws' nuts. */
  backplateThickness: 6,
  backplateStandoff: 8,
  /** The box's mounting holes through its back, across and up, for M6 screws. GUESS. */
  electronicsHoleSpacingY: 260,
  electronicsHoleSpacingZ: 80,
  /** Dual-antenna GPS (UM982) baseline across the top bar. */
  gpsBaseline: 600,
  /** Antenna mounts on the top bar's ends: a socket this long, a pedestal this high, and the antennas' 5/8" bolt. */
  antennaSocketLength: 70,
  antennaPedestalHeight: 24,
  antennaPedestal: 44,
  antennaBolt: 15.9,
  /** The 5/8" bolt's head, across flats and high, held in a slot under the pedestal. */
  antennaBoltHead: 23.8,
  antennaBoltHeadHeight: 10,
  /** E-stop housing on the top bar's middle: a 22 mm button, room for its contact block, and the housing's size. */
  estopHole: 22.5,
  estopDepth: 45,
  estopHousing: 52,

  /** Printed parts and fasteners, as one allowance spread over the frame. */
  printedMass: 4,
} as const;

export type LayoutParams = Numeric<typeof defaults>;

const mm = (label: string, min: number, max: number, group: string, help?: string, step = 1) =>
  ({ label, unit: 'mm', min, max, step, group, ...(help ? { help } : {}) }) as const;
const kg = (label: string, min: number, max: number, group: string) =>
  ({ label, unit: '', min, max, step: 0.1, group, help: 'In kilograms.' }) as const;
const count = (label: string, min: number, max: number, group: string) =>
  ({ label, unit: '', min, max, step: 1, group }) as const;

/**
 * What may be changed, and over what range the layout accepts it. Parameters
 * interact, so a value in range can still lay out a machine that fails a check
 * (batteries too far back tip it over backward): the checks have the last word.
 */
export const schema: Schema<LayoutParams> = {
  wheelDiameter: mm('Wheel diameter', 200, 330, 'Drive wheels'),
  wheelWidth: mm('Wheel width', 40, 100, 'Drive wheels'),
  axleDiameter: mm('Axle diameter', 10, 25, 'Drive wheels'),
  axleFlats: mm('Axle across flats', 8, 22, 'Drive wheels'),
  axleLength: mm('Axle length', 50, 120, 'Drive wheels', 'Out of the wheel inner face.'),
  axleClampLength: mm('Axle clamp length', 10, 50, 'Drive wheels', 'Room between the rear node and the wheel.'),
  wheelMass: kg('Wheel mass', 2, 10, 'Drive wheels'),

  castorWheelDiameter: mm('Castor wheel diameter', 75, 150, 'Castors'),
  castorWheelWidth: mm('Castor wheel width', 20, 50, 'Castors'),
  castorHeight: mm('Castor height', 100, 200, 'Castors', 'Ground to the top of the plate.'),
  castorTrail: mm('Castor trail', 20, 60, 'Castors'),
  castorPlateLength: mm('Castor plate length', 50, 120, 'Castors'),
  castorPlateWidth: mm('Castor plate width', 50, 120, 'Castors'),
  castorTrack: mm('Castor track', 400, 700, 'Castors'),
  castorDeckGap: mm('Castor to deck gap', 5, 50, 'Castors'),
  castorMass: kg('Castor mass', 0.2, 3, 'Castors'),

  batteryCount: count('Batteries', 1, 2, 'Batteries'),
  batteryLength: mm('Battery length', 150, 400, 'Batteries'),
  batteryWidth: mm('Battery width', 100, 250, 'Batteries'),
  batteryHeight: mm('Battery height', 100, 260, 'Batteries'),
  batteryMass: kg('Battery mass', 2, 15, 'Batteries'),
  batteryGap: mm('Gap between batteries', 0, 30, 'Batteries'),
  batteryClearance: mm('Clearance in cradle', 2, 15, 'Batteries'),
  batteryX: mm('Batteries ahead of axle', -50, 120, 'Batteries'),
  batteryStopLip: mm('Battery stop lip', 15, 80, 'Batteries'),
  batteryStopWidth: mm('Battery stop width', 15, 60, 'Batteries'),
  batteryStopLipThickness: mm('Battery stop lip thickness', 4, 15, 'Batteries'),

  bladeDiameter: mm('Blade diameter', 250, 460, 'Deck'),
  bladeMass: kg('Blade mass', 0.2, 2, 'Deck'),
  trayDiameter: mm('Tray inside diameter', 270, 500, 'Deck'),
  trayDepth: mm('Tray depth', 30, 90, 'Deck'),
  trayLip: mm('Tray rim', 0, 15, 'Deck'),
  trayMass: kg('Tray mass', 0.2, 3, 'Deck'),
  bladeToTrayTop: mm('Blade to tray top', 15, 60, 'Deck'),
  trayThickness: mm('Tray sheet', 0.5, 3, 'Deck', undefined, 0.1),
  motorShaft: mm('Motor shaft', 8, 20, 'Blade'),
  motorShaftLength: mm('Motor shaft length', 15, 60, 'Blade', 'Out of the motor’s face.'),
  motorShaftBolt: mm('Thread in the shaft’s end', 4, 10, 'Blade'),
  bladeThickness: mm('Blade thickness', 2, 6, 'Blade', undefined, 0.5),
  bladeHole: mm('Blade centre hole', 8, 26, 'Blade', undefined, 0.1),
  bladeClamp: mm('Blade clamp', 35, 70, 'Blade', 'The hub’s flange and the washer.'),
  hubDiameter: mm('Hub body', 20, 40, 'Blade'),
  hubFlange: mm('Hub flange thickness', 4, 12, 'Blade'),
  bladeWasher: mm('Blade washer thickness', 3, 10, 'Blade'),
  hubClearance: mm('Hub below the tray', 1, 10, 'Blade'),
  hubSetScrew: mm('Hub set screw', 4, 8, 'Blade'),
  cutHeightMin: mm('Lowest cut', 20, 80, 'Deck'),
  cutHeightMax: mm('Highest cut', 60, 150, 'Deck'),
  cutHeight: mm('Cut height drawn', 20, 150, 'Deck'),
  deckGap: mm('Cradle to deck gap', 5, 60, 'Deck'),
  deckRearHanger: mm('Deck beam behind deck centre', 60, 160, 'Deck'),
  deckHangerSpan: mm('Rods apart, across', 140, 300, 'Deck'),
  deckRod: mm('Rod', 6, 12, 'Deck'),
  deckRodNutAcrossFlats: mm('Rod nut across flats', 10, 19, 'Deck', undefined, 0.1),
  deckRodNutThickness: mm('Rod nut thickness', 4, 10, 'Deck', undefined, 0.1),
  deckBlockHalf: mm('Hanger block half-length', 15, 35, 'Deck'),
  castorBeamGap: mm('Front rods to castor beam', 2, 20, 'Deck'),
  deckPlateBase: mm('Deck plate base', 5, 15, 'Deck'),
  deckPlateHeight: mm('Deck plate height', 10, 40, 'Deck'),
  deckPlateBoss: mm('Deck plate rod boss', 10, 20, 'Deck'),
  motorBoltCircle: mm('Motor bolt circle', 30, 150, 'Deck'),
  motorBoltCount: count('Motor bolts', 2, 8, 'Deck'),
  motorBolt: mm('Motor bolt', 3, 8, 'Deck'),
  motorSpigot: mm('Motor spigot hole', 10, 60, 'Deck'),
  trayBoltCircle: mm('Tray bolt circle', 80, 300, 'Deck'),
  trayBolt: mm('Tray bolt', 3, 8, 'Deck'),
  mowerMotorDiameter: mm('Motor diameter', 60, 140, 'Deck'),
  mowerMotorLength: mm('Motor length', 60, 200, 'Deck'),
  mowerMotorMass: kg('Motor mass', 1, 8, 'Deck'),

  tubeSize: mm('Tube size', 19, 40, 'Frame', 'Square tube, outside.', 0.1),
  tubeWall: mm('Tube wall', 1, 3, 'Frame', undefined, 0.1),
  stockLength: mm('Stock length', 1000, 6500, 'Frame'),
  kerf: mm('Kerf per cut', 0, 5, 'Frame', undefined, 0.5),
  railHeight: mm('Rail height', 200, 300, 'Frame'),
  apexHeight: mm('Top bar height', 400, 700, 'Frame'),
  rollLimit: { label: 'Front roll limit', unit: '°', min: 3, max: 10, step: 0.5, group: 'Frame' },
  axleClearance: mm('Axle to cradle floor', 1, 20, 'Frame'),
  bumperGap: mm('Cradle to bumper', 0, 30, 'Frame'),

  jointWall: mm('Node wall', 3, 10, 'Nodes', undefined, 0.5),
  jointArm: mm('Node arm', 35, 90, 'Nodes', 'Along each tube beyond the junction.'),
  boltDiameter: mm('Bolt diameter', 4, 8, 'Nodes'),
  nutAcrossFlats: mm('Nut across flats', 7, 13, 'Nodes', undefined, 0.1),
  nutThickness: mm('Nut thickness', 3, 7, 'Nodes', undefined, 0.1),
  boltInset: mm('First bolt in from arm end', 10, 30, 'Nodes'),
  boltPitch: mm('Bolt pitch', 15, 40, 'Nodes'),
  spigotLength: mm('Spigot length', 20, 60, 'Nodes'),
  fitTolerance: {
    label: 'Fit tolerance',
    unit: 'mm',
    min: 0,
    max: 1,
    step: 0.05,
    group: 'Nodes',
    help: 'Clearance taken off each fit in total. Raise it if tubes go in tight.',
  },
  clampSqueeze: mm('Clamp squeeze', 0, 1, 'Nodes', 'Raise it if tubes are loose once bolted.', 0.05),

  pivotPin: mm('Pivot pin', 8, 12, 'Front beam'),
  saddleCheek: mm('Saddle cheek', 8, 30, 'Front beam', 'Fore and aft of the beam: the pin’s grip.'),
  saddleHalf: mm('Saddle half-length', 25, 60, 'Front beam'),
  pivotEarThickness: mm('Pivot ear thickness', 10, 30, 'Front beam'),
  pivotEarWidth: mm('Pivot ear width', 30, 70, 'Front beam'),
  pivotEndPlay: mm('Pivot end play', 0.2, 2, 'Front beam', undefined, 0.1),
  rollStopY: mm('Roll stops out from the middle', 40, 70, 'Front beam'),
  rollStopWidth: mm('Roll stop width', 8, 30, 'Front beam'),
  castorBolt: mm('Castor bolt', 6, 10, 'Castors'),
  castorBoltSpacingX: mm('Castor holes apart, fore-aft', 40, 80, 'Castors'),
  castorBoltSpacingY: mm('Castor holes apart, across', 50, 100, 'Castors'),
  castorPlateThickness: mm('Castor plate thickness', 2, 6, 'Castors', undefined, 0.5),
  castorNutAcrossFlats: mm('Castor nut across flats', 10, 17, 'Castors', undefined, 0.1),
  castorNutThickness: mm('Castor nut thickness', 4, 9, 'Castors', undefined, 0.1),

  edgeChamfer: mm('Edge chamfer', 0, 2, 'Printer', '0 leaves edges sharp.', 0.1),
  cornerChamfer: mm('Corner chamfer', 0, 4, 'Printer', 'On edges standing up from the bed.', 0.1),
  labelHeight: mm('Label height', 0, 10, 'Printer', 'Its biggest; it shrinks to fit. 0 for no label.', 0.5),
  labelDepth: mm('Label depth', 0.2, 1.5, 'Printer', undefined, 0.1),
  labelStroke: mm('Label stroke', 0.4, 1.5, 'Printer', undefined, 0.1),
  bedX: mm('Bed X', 180, 400, 'Printer'),
  bedY: mm('Bed Y', 180, 400, 'Printer'),
  bedZ: mm('Bed Z', 180, 400, 'Printer'),

  electronicsLength: mm('Electronics box length', 100, 300, 'Electronics'),
  electronicsWidth: mm('Electronics box width', 150, 360, 'Electronics'),
  electronicsHeight: mm('Electronics box height', 60, 200, 'Electronics'),
  electronicsMass: kg('Electronics mass', 0.5, 8, 'Electronics'),
  electronicsGap: mm('Battery to box gap', 5, 60, 'Electronics'),
  electronicsRailLow: mm('Lower rail above box bottom', 5, 60, 'Electronics'),
  electronicsRailSpacing: mm('Rails apart', 30, 90, 'Electronics'),
  electronicsClampBoss: mm('Backplate clamp reach', 8, 20, 'Electronics'),
  backplateThickness: mm('Backplate thickness', 4, 10, 'Electronics'),
  backplateStandoff: mm('Backplate standoff', 4, 20, 'Electronics'),
  electronicsHoleSpacingY: mm('Box holes apart, across', 50, 340, 'Electronics'),
  electronicsHoleSpacingZ: mm('Box holes apart, up', 20, 180, 'Electronics'),
  gpsBaseline: mm('GPS antenna baseline', 300, 1000, 'Electronics'),
  antennaSocketLength: mm('Antenna socket length', 50, 120, 'Electronics'),
  antennaPedestalHeight: mm('Antenna pedestal height', 18, 50, 'Electronics'),
  antennaPedestal: mm('Antenna pedestal', 36, 80, 'Electronics'),
  antennaBolt: mm('Antenna bolt', 6, 20, 'Electronics', '5/8" is 15.9 mm.', 0.1),
  antennaBoltHead: mm('Antenna bolt head across flats', 10, 30, 'Electronics', undefined, 0.1),
  antennaBoltHeadHeight: mm('Antenna bolt head height', 4, 14, 'Electronics', undefined, 0.5),
  estopHole: mm('E-stop hole', 16, 30, 'Electronics', undefined, 0.1),
  estopDepth: mm('E-stop depth', 25, 80, 'Electronics'),
  estopHousing: mm('E-stop housing', 40, 80, 'Electronics'),

  printedMass: kg('Printed parts and fasteners', 0.5, 8, 'Frame'),
};

/** Acceptable ranges for the derived figures the checks assert. */
export const limits = {
  frontLoadShare: { min: 0.15, max: 0.35 },
  /** Static tip angles: back over the rear axle, forward over the castors, and sideways. */
  rearTip: 30,
  frontTip: 35,
  sideTipFree: 30,
  sideTipOnStops: 35,
  groundClearance: 75,
  /** Least clearance anywhere a check measures one. */
  clearance: 8,
} as const;

/** Aluminium, kg/mm³. */
const ALUMINIUM = 2.7e-6;

/** Past the GPS antennas' centres to the top bar's ends. */
const ANTENNA_MARGIN = 40;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export type Vec3 = [number, number, number];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => scale(a, 1 / norm(a));
const deg = (rad: number) => (rad * 180) / Math.PI;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distance in plan from point p to the line through a and b. */
function planDistance(p: [number, number], a: [number, number], b: [number, number]): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  return Math.abs(dx * (a[1] - p[1]) - dy * (a[0] - p[0])) / Math.hypot(dx, dy);
}

/**
 * How far short of the junction of two centrelines a square-cut tube must stop
 * to butt against the other tube, meeting it at `angle` degrees. At 90° it is
 * half the tube; shallower angles stop it further back, and the printed node
 * fills the wedge between them.
 */
function buttAllowance(half: number, angle: number): number {
  const a = rad(angle);
  return (half * (1 + Math.abs(Math.cos(a)))) / Math.sin(a);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export type MemberGroup = 'side frame' | 'cross member' | 'battery cradle' | 'deck' | 'front beam';

/** One length of tube, its centreline from end to end as cut. */
export interface Member {
  readonly name: string;
  readonly group: MemberGroup;
  readonly from: Vec3;
  readonly to: Vec3;
  readonly length: number;
}

export interface MassItem {
  readonly name: string;
  readonly mass: number;
  readonly at: Vec3;
}

export interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly value: number;
  readonly unit: 'mm' | '°' | '%' | '';
  /** What it was checked against, readably: "≥ 8", "15–35". */
  readonly limit: string;
}

export interface Box3 {
  readonly min: Vec3;
  readonly max: Vec3;
}

export function layout(params: LayoutParams = defaults) {
  const p = params;
  const h = p.tubeSize / 2;
  const s = p.tubeSize;

  if (p.cutHeightMin > p.cutHeightMax) {
    throw new DesignError('The lowest cut is above the highest');
  }
  if (p.cutHeight < p.cutHeightMin || p.cutHeight > p.cutHeightMax) {
    throw new DesignError(`The cut height drawn, ${p.cutHeight} mm, is outside the hangers' range`);
  }

  // --- Batteries and the side frames around them --------------------------

  const batteriesWidth = p.batteryCount * p.batteryWidth + (p.batteryCount - 1) * p.batteryGap;

  /** Clear width between the side frames: the cradle, or the electronics box if that is wider. */
  const frameInner = Math.max(batteriesWidth + 2 * p.batteryClearance, p.electronicsWidth + 2 * p.batteryClearance);

  /**
   * Side frame centreline. The printed nodes reach a wall's thickness either side
   * of the tubes, so the clear width is between their inner faces, and the cross
   * members end there.
   */
  const railY = frameInner / 2 + h + p.jointWall;
  const crossHalf = frameInner / 2;
  /** The rear node's outer face, which the axle clamp bears against. */
  const frameOuterY = railY + h + p.jointWall;
  const railZ = p.railHeight;

  // --- Drive wheels ------------------------------------------------------

  const wheelRadius = p.wheelDiameter / 2;
  const axleZ = wheelRadius;
  /**
   * The axle runs through the node's outer half, the post, and halfway into the
   * inner half's wall, where it ends blind. What's left of it out of the node is
   * the gap to the wheel, where the axle clamp grips its flats.
   */
  const axleReach = p.jointWall + s + p.jointWall / 2;
  const wheelGap = p.axleLength - axleReach;
  const wheelY = frameOuterY + wheelGap + p.wheelWidth / 2;
  const track = 2 * wheelY;

  // --- Battery cradle ------------------------------------------------------
  //
  // Two floor tubes across the frame carry the batteries. The rear one joins the
  // feet of the two posts just under the axles, tying the axle mounts together;
  // the front one hangs from the rails on a hanger each side.

  const floorTop = axleZ - p.axleDiameter / 2 - p.axleClearance;
  const floorZ = floorTop - h;
  const groundClearance = floorZ - h;

  const batteryRear = p.batteryX - p.batteryLength / 2;
  const batteryFront = p.batteryX + p.batteryLength / 2;
  const batteryBottom = floorTop;
  const batteryTop = batteryBottom + p.batteryHeight;
  const frontFloorX = batteryFront - h;
  const cradleFront = batteryFront + p.batteryClearance;
  const cradleRear = batteryRear - p.batteryClearance;

  const batteries: Box3[] = Array.from({ length: p.batteryCount }, (_, i) => {
    const y0 = -batteriesWidth / 2 + i * (p.batteryWidth + p.batteryGap);
    return {
      min: [batteryRear, y0, batteryBottom],
      max: [batteryFront, y0 + p.batteryWidth, batteryTop],
    };
  });

  // --- Deck -------------------------------------------------------------------

  const deckRadius = p.trayDiameter / 2 + p.trayLip;
  const deckX = cradleFront + p.deckGap + deckRadius;
  const trayTopAt = (cut: number) => cut + p.bladeToTrayTop;
  const carrierZAt = (cut: number) => trayTopAt(cut) + h;
  const hangerY = p.deckHangerSpan / 2;
  /** Each rod stands behind its tube's centreline: clear of the block's clamp round the tube, by a ligament. */
  const rodOffset = h + p.fitTolerance / 2 + p.jointWall + (p.deckRod + p.fitTolerance) / 2 + 4;

  // --- Castors and the front beam -----------------------------------------

  const castorY = p.castorTrack / 2;
  const castorWheelRadius = p.castorWheelDiameter / 2;
  /** Radius the castor wheel sweeps about its swivel axis, in plan. */
  const castorSwing = Math.hypot(p.castorTrail + castorWheelRadius, p.castorWheelWidth / 2);

  /** Rear axle to the castors' swivel axes, the wheelbase: far enough ahead that a swinging castor clears the deck. */
  const wheelbase =
    deckX + Math.sqrt(Math.max(0, (deckRadius + castorSwing + p.castorDeckGap) ** 2 - castorY ** 2));
  const frontX = wheelbase;
  /** Where the castor wheels touch the ground, trailing behind their swivels when driving forward. */
  const castorContactX = wheelbase - p.castorTrail;

  /** The beam sits in the castor pads, a node wall above the castors' plates. */
  const beamZ = p.castorHeight + p.jointWall + h;
  const pivot: Vec3 = [frontX, 0, beamZ];
  const beamHalf = castorY + p.castorPlateWidth / 2;

  /**
   * The deck's rods: the rear pair behind the deck beam, the front pair behind
   * the front cross member, just clear of the castor beam. They screw into nuts
   * held in the deck plate's underside, so the plate, sitting on the tray's top,
   * rises and falls with them.
   */
  const deckBeamX = deckX - p.deckRearHanger;
  const rodX = [deckBeamX - rodOffset, frontX - rodOffset] as const;
  const blockTop = railZ + h + p.jointWall;
  /** Long enough to reach a nut on top of its block with the plate at the lowest cut. */
  const rodLength = blockTop + p.deckRodNutThickness + 3 - trayTopAt(p.cutHeightMin);
  const deck = {
    x: deckX,
    radius: deckRadius,
    bladeZ: p.cutHeight,
    trayTop: trayTopAt(p.cutHeight),
    trayBottom: trayTopAt(p.cutHeight) - p.trayDepth,
    plateBottom: trayTopAt(p.cutHeight),
    motorZ: trayTopAt(p.cutHeight) + p.deckPlateBase,
    beamX: deckBeamX,
    rodX,
    rodY: hangerY,
    rodOffset,
    rodLength,
    blockTop,
    plate: {
      x0: rodX[0] - p.deckPlateBoss,
      x1: rodX[1] + p.deckPlateBoss,
      halfY: hangerY + p.deckPlateBoss,
    },
  };

  // --- Side frame ------------------------------------------------------------
  //
  // Each side is a right triangle: an upright post over the axle, the level rail
  // over the deck, and a leg sloping down from the top of the post to the front
  // of the rail. The post runs whole from the cradle floor to the top bar; the
  // rail is in two lengths either side of it.

  const bumperX = cradleRear - p.bumperGap - h;
  /**
   * The post stops just above the axle: the rear node is solid below it, round
   * the axle, so the axle needn't pass through the tube.
   */
  const postFoot = axleZ + (p.axleDiameter + p.fitTolerance) / 2 + p.jointWall;
  const postTop = p.apexHeight - h;

  /** Where the leg's centreline meets the post's: one tube below the post's top, under the top bar. */
  const legTop: Vec3 = [0, 0, postTop - h];
  const legFoot: Vec3 = [frontX, 0, railZ];
  const legRun = sub(legFoot, legTop);
  const legSlope = deg(Math.atan2(-legRun[2], legRun[0]));
  const legDir = unit(legRun);
  /** How far short of each junction the leg's square-cut ends stop: at the post, and at the rail. */
  const legTopButt = buttAllowance(h, 90 - legSlope);
  const legFootButt = buttAllowance(h, legSlope);
  const legStart = add(legTop, scale(legDir, legTopButt));
  const legEnd = sub(legFoot, scale(legDir, legFootButt));

  const topBarHalf = Math.max(p.gpsBaseline / 2 + ANTENNA_MARGIN, frameOuterY);

  const members: Member[] = [];
  const member = (name: string, group: MemberGroup, from: Vec3, to: Vec3) =>
    members.push({ name, group, from, to, length: norm(sub(to, from)) });

  for (const [side, y] of [
    ['left', railY],
    ['right', -railY],
  ] as const) {
    const at = (v: Vec3): Vec3 => [v[0], y, v[2]];
    member(`post ${side}`, 'side frame', [0, y, postFoot], [0, y, postTop]);
    member(`rear rail ${side}`, 'side frame', [bumperX - h, y, railZ], [-h, y, railZ]);
    member(`front rail ${side}`, 'side frame', [h, y, railZ], [frontX - h, y, railZ]);
    member(`leg ${side}`, 'side frame', at(legStart), at(legEnd));
    member(`cradle hanger ${side}`, 'battery cradle', [frontFloorX, y, floorZ - h], [frontFloorX, y, railZ - h]);
  }

  const across = (name: string, group: MemberGroup, x: number, z: number, half: number) =>
    member(name, group, [x, -half, z], [x, half, z]);
  across('top bar', 'cross member', 0, p.apexHeight, topBarHalf);
  across('bumper', 'cross member', bumperX, railZ, crossHalf);
  across('front cross member', 'cross member', frontX, railZ, crossHalf);
  across('cradle floor, rear', 'battery cradle', 0, floorZ, crossHalf);
  across('cradle floor, front', 'battery cradle', frontFloorX, floorZ, crossHalf);

  across('deck beam', 'deck', deckBeamX, railZ, crossHalf);
  across('front beam', 'front beam', frontX, beamZ, beamHalf);

  // --- Electronics and GPS ---------------------------------------------------

  // The box screws to a backplate, clamped to two rails between the posts and
  // standing off them; the rails end on spigots on a node on each post.
  const boxBottom = batteryTop + p.electronicsGap;
  const electronicsRails = [boxBottom + p.electronicsRailLow, boxBottom + p.electronicsRailLow + p.electronicsRailSpacing] as const;
  const boxBack = h + p.fitTolerance / 2 + p.backplateStandoff + p.backplateThickness;
  const electronics: Box3 = {
    min: [boxBack, -p.electronicsWidth / 2, boxBottom],
    max: [boxBack + p.electronicsLength, p.electronicsWidth / 2, boxBottom + p.electronicsHeight],
  };
  across('electronics rail, lower', 'cross member', 0, electronicsRails[0], crossHalf);
  across('electronics rail, upper', 'cross member', 0, electronicsRails[1], crossHalf);

  /** The antennas sit on pedestals on sockets over the top bar's ends. */
  const antennaZ = p.apexHeight + h + p.fitTolerance / 2 + p.jointWall + p.antennaPedestalHeight;
  const antennas: Vec3[] = [
    [0, p.gpsBaseline / 2, antennaZ],
    [0, -p.gpsBaseline / 2, antennaZ],
  ];

  // --- Mass budget -------------------------------------------------------------

  const tubeArea = s ** 2 - (s - 2 * p.tubeWall) ** 2;
  const tubeMass = (m: Member) => m.length * tubeArea * ALUMINIUM;
  const mid = (m: Member) => scale(add(m.from, m.to), 0.5);
  const centre = (b: Box3) => scale(add(b.min, b.max), 0.5);

  const tubes = members.reduce(
    (acc, m) => {
      const kg = tubeMass(m);
      return { mass: acc.mass + kg, moment: add(acc.moment, scale(mid(m), kg)) };
    },
    { mass: 0, moment: [0, 0, 0] as Vec3 },
  );
  const tubeCentre = scale(tubes.moment, 1 / tubes.mass);

  const motorCentreZ = deck.motorZ + p.mowerMotorLength / 2;
  const masses: MassItem[] = [
    { name: 'batteries', mass: p.batteryCount * p.batteryMass, at: [p.batteryX, 0, (batteryBottom + batteryTop) / 2] },
    { name: 'drive wheels', mass: 2 * p.wheelMass, at: [0, 0, axleZ] },
    { name: 'castors', mass: 2 * p.castorMass, at: [frontX - p.castorTrail / 2, 0, p.castorHeight / 2] },
    { name: 'mower motor', mass: p.mowerMotorMass, at: [deckX, 0, motorCentreZ] },
    { name: 'blade', mass: p.bladeMass, at: [deckX, 0, deck.bladeZ] },
    { name: 'tray', mass: p.trayMass, at: [deckX, 0, deck.trayTop - p.trayDepth / 2] },
    { name: 'electronics', mass: p.electronicsMass, at: centre(electronics) },
    { name: 'tube', mass: tubes.mass, at: tubeCentre },
    { name: 'printed parts, fasteners', mass: p.printedMass, at: tubeCentre },
  ];
  const totalMass = masses.reduce((t, m) => t + m.mass, 0);
  const cg = scale(
    masses.reduce((acc, m) => add(acc, scale(m.at, m.mass)), [0, 0, 0] as Vec3),
    1 / totalMass,
  );

  /** Share of the weight on the castors, statically on the level. */
  const frontLoadShare = cg[0] / castorContactX;

  // --- Stability -----------------------------------------------------------------
  //
  // Static tip angles, from the centre of gravity and the support polygon in
  // plan. While the front beam swings freely the front of the machine rests on
  // its pivot, so the machine stands on three points: the two drive wheels and
  // the pivot. Once the beam reaches its stops it stands on all four wheels.

  const [cx, , cz] = cg;
  const rearTip = deg(Math.atan2(cx, cz));
  const frontTip = deg(Math.atan2(castorContactX - cx, cz));
  const sideTipFree = deg(Math.atan2(planDistance([cx, 0], [0, wheelY], [frontX, 0]), cz));
  const sideTipOnStops = deg(Math.atan2(planDistance([cx, 0], [0, wheelY], [castorContactX, castorY]), cz));

  // --- Checks -----------------------------------------------------------------------

  const checks: Check[] = [];
  const atLeast = (name: string, value: number, min: number, unit: Check['unit'] = 'mm') =>
    checks.push({ name, ok: value >= min - 1e-9, value, unit, limit: `≥ ${min}` });
  const within = (name: string, value: number, min: number, max: number, unit: Check['unit']) =>
    checks.push({ name, ok: value >= min - 1e-9 && value <= max + 1e-9, value, unit, limit: `${min}–${max}` });

  within(
    'Weight on the castors',
    100 * frontLoadShare,
    100 * limits.frontLoadShare.min,
    100 * limits.frontLoadShare.max,
    '%',
  );
  atLeast('Tip angle, backward', rearTip, limits.rearTip, '°');
  atLeast('Tip angle, forward', frontTip, limits.frontTip, '°');
  atLeast('Tip angle, sideways, beam free', sideTipFree, limits.sideTipFree, '°');
  atLeast('Tip angle, sideways, beam on stops', sideTipOnStops, limits.sideTipOnStops, '°');
  atLeast('Ground clearance under the cradle', groundClearance, limits.groundClearance);
  atLeast('Blade tip to tray wall', (p.trayDiameter - p.bladeDiameter) / 2, limits.clearance);
  // The deck plate, at the highest cut, under the pivot saddle rolled to its stops.
  const roll = rad(p.rollLimit);
  atLeast(
    'Deck plate clear of the front beam at the highest cut',
    beamZ - (h + p.jointWall) * Math.cos(roll) - p.saddleHalf * Math.sin(roll) -
      (trayTopAt(p.cutHeightMax) + p.deckPlateHeight),
    limits.clearance,
  );
  atLeast('Deck hanger blocks inside the side frames', crossHalf - (hangerY + p.deckBlockHalf), limits.clearance);
  atLeast('Mower motor clear of the deck beam', deckX - p.mowerMotorDiameter / 2 - (deckBeamX + h), limits.clearance);
  atLeast('Mower motor clear of the deck rods', hangerY - p.deckRod / 2 - p.mowerMotorDiameter / 2, limits.clearance);
  atLeast('Front deck rods clear of the castor beam', frontX - h - (rodX[1] + p.deckRod / 2), p.castorBeamGap);
  atLeast(
    'Castor swing clears the front deck rods',
    Math.hypot(frontX - rodX[1], castorY - hangerY) - castorSwing - p.deckRod / 2,
    limits.clearance,
  );
  atLeast(
    'Electronics rails clear of the batteries',
    electronicsRails[0] - (h + p.fitTolerance / 2) - p.electronicsClampBoss - batteryTop,
    5,
  );
  atLeast('Electronics box between the legs', railY - h - p.electronicsWidth / 2, limits.clearance);
  // Rolled to its stops, the beam's top rises furthest where it passes under the
  // front nodes, which reach down a wall below the rail.
  atLeast(
    'Front beam rolls clear of the front nodes',
    railZ - (h + p.fitTolerance / 2 + p.jointWall) -
      (beamZ + frameOuterY * Math.sin(rad(p.rollLimit)) + h * Math.cos(rad(p.rollLimit))),
    limits.clearance,
  );
  atLeast('Room for the axle clamp', wheelGap - p.axleClampLength, 3);
  atLeast('Battery rear overhangs the rear floor tube', -h - batteryRear, 0);
  atLeast('Battery centre between the floor tubes', Math.min(p.batteryX, frontFloorX - p.batteryX), 0);
  atLeast('Castor swing clears the drive wheel', wheelbase - castorSwing - wheelRadius, limits.clearance);

  // --- Cut list ---------------------------------------------------------------------

  const cutList = cutListOf(members, p.stockLength, p.kerf);

  const overall: Box3 = {
    min: [Math.min(-wheelRadius, bumperX - h), -Math.max(wheelY + p.wheelWidth / 2, topBarHalf), 0],
    max: [
      wheelbase + p.castorTrail + castorWheelRadius,
      Math.max(wheelY + p.wheelWidth / 2, topBarHalf),
      antennaZ + 20,
    ],
  };

  return {
    params: p,
    tube: { size: s, wall: p.tubeWall, half: h },
    frameInner,
    railY,
    railZ,
    crossHalf,
    frameOuterY,
    track,
    wheelbase,
    wheel: { radius: wheelRadius, y: wheelY, axleZ, gap: wheelGap, reach: axleReach },
    castor: { y: castorY, swing: castorSwing, contactX: castorContactX, wheelRadius: castorWheelRadius },
    pivot,
    beamZ,
    floorZ,
    groundClearance,
    batteries,
    batteryTop,
    deck,
    bumperX,
    frontFloorX,
    post: { foot: postFoot, top: postTop },
    leg: {
      top: legTop,
      foot: legFoot,
      slope: legSlope,
      length: norm(sub(legEnd, legStart)),
      topButt: legTopButt,
      footButt: legFootButt,
    },
    legSlope,
    electronics,
    electronicsRails,
    antennas,
    members,
    masses,
    totalMass,
    cg,
    frontLoadShare,
    stability: { rearTip, frontTip, sideTipFree, sideTipOnStops },
    checks,
    cutList,
    overall,
  };
}

export type Layout = ReturnType<typeof layout>;

// ---------------------------------------------------------------------------
// Cut list
// ---------------------------------------------------------------------------

export interface CutLine {
  readonly length: number;
  readonly count: number;
  readonly names: readonly string[];
}

/**
 * The tubes grouped by length, longest first, and how many stock lengths they
 * cut from: first fit, longest first, with a kerf taken per cut.
 */
function cutListOf(members: readonly Member[], stockLength: number, kerf: number) {
  const round = (v: number) => Math.round(v * 2) / 2;
  const lines = new Map<number, { count: number; names: string[] }>();
  for (const m of members) {
    const key = round(m.length);
    const line = lines.get(key) ?? { count: 0, names: [] };
    line.count++;
    line.names.push(m.name);
    lines.set(key, line);
  }
  const cuts: CutLine[] = [...lines.entries()]
    .sort(([a], [b]) => b - a)
    .map(([length, { count, names }]) => ({ length, count, names }));

  const bars: number[] = [];
  for (const m of [...members].sort((a, b) => b.length - a.length)) {
    const need = m.length + kerf;
    if (need > stockLength) {
      throw new DesignError(`The ${m.name} is ${Math.round(m.length)} mm, longer than a ${stockLength} mm stock length`);
    }
    const i = bars.findIndex((used) => used + need <= stockLength);
    if (i === -1) bars.push(need);
    else bars[i] = (bars[i] ?? 0) + need;
  }

  return {
    cuts,
    totalLength: members.reduce((t, m) => t + m.length, 0),
    stockLengths: bars.length,
  };
}
