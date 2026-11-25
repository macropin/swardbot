/**
 * Tube end cap.
 *
 * Closes an open end of the frame's square tube, keeping out water, grass and
 * wasps, and covering the cut edge. A cap the size of the tube, flush with its
 * sides, and a hollow plug that presses into the bore. Ribs down each face of
 * the plug crush a little as it goes in, so it holds whatever the tube's bore
 * actually measures. The plug's corners are chamfered clear of the bore's
 * rounded corners. The cap's own corners are chamfered too, so they sit inside
the tube's rounded outside corners instead of standing proud of them. A small
hole lets water out of tubes that end facing down.
 *
 * At the default layout no tube end is left open: every one ends in a node, on
 * a spigot, in a castor pad or in an antenna mount. Print them for any tube end
 * a variant leaves open, such as the top bar's without the antenna mounts.
 *
 * As exported it lies as it prints: cap face down on the bed, plug up.
 *
 * Units: millimetres. Z up from the bed.
 */
import { cut, cylinder, fuse, box, unwrap, type ValidSolid } from 'brepjs';

import { finish } from './finish.js';
import { engrave, labelOptions } from './label.js';
import { defaults as layoutDefaults } from './layout.js';
import { prism } from './node-solid.js';
import { chamferedSquare, cornerRelief } from './nodes.js';
import { atLeast, type Numeric, type Schema } from './params.js';
import { single } from './solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export const defaults = {
  /** The tube, as the layout has it. */
  tubeSize: layoutDefaults.tubeSize,
  tubeWall: layoutDefaults.tubeWall,

  /** Cap over the end, flush with the tube's sides. */
  capThickness: 2.5,

  /** Plug into the bore: how deep, and its wall. */
  plugDepth: 12,
  plugWall: 1.6,

  /** Clearance of the plug's faces in the bore, in total; the ribs stand proud of it. */
  fitTolerance: layoutDefaults.fitTolerance,

  /** How far the crush ribs stand proud of the bore's faces, before they crush. */
  ribInterference: 0.25,
  ribWidth: 1.2,

  /** Drain hole through the cap: 0 for none. */
  drainHole: 3,

  /**
   * Chamfer on the hard edges (../finish.ts), and on the cap's four corners:
   * at 1.5 they sit inside a tube whose outside corners are rounded to 2.6 or more.
   */
  edgeChamfer: layoutDefaults.edgeChamfer,
  cornerChamfer: layoutDefaults.cornerChamfer,

  /** The label engraved inside the cup (../label.ts). */
  labelHeight: layoutDefaults.labelHeight,
  labelDepth: layoutDefaults.labelDepth,
  labelStroke: layoutDefaults.labelStroke,
} as const;

export type EndCapParams = Numeric<typeof defaults>;

export const schema: Schema<EndCapParams> = {
  tubeSize: { label: 'Tube size', unit: 'mm', min: 19, max: 40, step: 0.1, help: 'Square tube, outside.' },
  tubeWall: { label: 'Tube wall', unit: 'mm', min: 1, max: 3, step: 0.1 },
  plugDepth: { label: 'Plug depth', unit: 'mm', min: 6, max: 25, step: 1 },
  ribInterference: {
    label: 'Rib interference',
    unit: 'mm',
    min: 0,
    max: 0.6,
    step: 0.05,
    help: 'Raise it if caps fall out, lower it if they won’t go in.',
    group: 'Fit',
  },
  fitTolerance: {
    label: 'Fit tolerance',
    unit: 'mm',
    min: 0,
    max: 1,
    step: 0.05,
    help: 'Clearance of the plug in the bore, in total.',
    group: 'Fit',
  },
  drainHole: { label: 'Drain hole', unit: 'mm', min: 0, max: 6, step: 0.5, help: '0 for none.' },
  edgeChamfer: { label: 'Edge chamfer', unit: 'mm', min: 0, max: 1, step: 0.1, help: '0 leaves edges sharp.' },
  cornerChamfer: {
    label: 'Corner chamfer',
    unit: 'mm',
    min: 0,
    max: 4,
    step: 0.1,
    help: 'The cap’s four corners, to sit inside the tube’s rounded corners.',
  },
};

/** Ribs stop short of the plug's tip, so it starts into the bore before they bite. */
const LEAD_IN = 2;

/** Overshoot so cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export function design(params: EndCapParams = defaults) {
  const bore = params.tubeSize - 2 * params.tubeWall;
  const plug = bore - params.fitTolerance;
  const chamfer = cornerRelief(params.tubeWall);
  const proud = params.fitTolerance / 2 + params.ribInterference;
  const top = params.capThickness + params.plugDepth;

  atLeast('The plug’s bore', plug - 2 * params.plugWall, 4);
  atLeast('The plug’s depth', params.plugDepth, LEAD_IN + 4);

  function model(): ValidSolid {
    // The cap, its corners chamfered. Too short to stand up as the finish's
    // corners, so they're cut here.
    let cap: ValidSolid =
      params.cornerChamfer > 0
        ? prism(chamferedSquare([0, 0], params.tubeSize, params.cornerChamfer), 0, params.capThickness)
        : box(params.tubeSize, params.tubeSize, params.capThickness, {
            centered: true,
            at: [0, 0, params.capThickness / 2],
          });
    const body = prism(chamferedSquare([0, 0], plug, chamfer), params.capThickness - OVER, params.plugDepth + OVER);
    cap = single(unwrap(fuse(cap, body)));
    const hollow = prism(
      chamferedSquare([0, 0], plug - 2 * params.plugWall, Math.max(0.1, chamfer - params.plugWall / 2)),
      params.capThickness,
      params.plugDepth + OVER,
    );
    cap = single(unwrap(cut(cap, hollow)));

    // Two crush ribs down each face, a quarter of the way in from each corner.
    const ribLength = params.plugDepth - LEAD_IN;
    for (const turn of [0, 1, 2, 3]) {
      for (const along of [-plug / 4, plug / 4]) {
        const [c, s] = [Math.cos((turn * Math.PI) / 2), Math.sin((turn * Math.PI) / 2)];
        // The rib's centre: on the face's normal, `along` it.
        const n = plug / 2 + proud / 2 - OVER / 2;
        const x = c * n - s * along;
        const y = s * n + c * along;
        const [w, d] = turn % 2 === 0 ? [proud + OVER, params.ribWidth] : [params.ribWidth, proud + OVER];
        const rib = box(w, d, ribLength, { centered: true, at: [x, y, params.capThickness + ribLength / 2] });
        cap = single(unwrap(fuse(cap, rib)));
      }
    }

    if (params.drainHole > 0) {
      cap = single(
        unwrap(cut(cap, cylinder(params.drainHole / 2, params.capThickness + 2 * OVER, { at: [0, 0, -OVER] }))),
      );
    }
    const finished = finish(cap, { edge: params.edgeChamfer, corner: params.cornerChamfer }, 'end-cap');
    return engrave(finished, 'CAP', labelOptions(params), 'end-cap');
  }

  // -------------------------------------------------------------------------
  // Declared intent — asserted by `brep verify --check`
  // -------------------------------------------------------------------------

  const half = params.tubeSize / 2;
  const expected = {
    bounds: { xMin: -half, xMax: half, yMin: -half, yMax: half, zMin: 0, zMax: top },
    tolerancePct: 0.1,
  };

  return { model, expected, plug, proud };
}

const standard = design();

export default function endCap(): ValidSolid {
  return standard.model();
}

export const { expected } = standard;
