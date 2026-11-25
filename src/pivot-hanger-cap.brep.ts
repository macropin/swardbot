/**
 * Pivot hanger, upper half: print one.
 *
 * Clamps over the front cross member's middle, bolted through it to the pivot
 * hanger below.
 *
 * As exported it lies as it prints: split face down, no supports. See
 * ./front-beam.ts.
 */
import type { ValidSolid } from 'brepjs';

import { hangerCap } from './front-beam-solid.js';
import { finish } from './finish.js';
import { engrave, labelOptions } from './label.js';
import { frontBeam } from './front-beam.js';
import { defaults, layout, type LayoutParams } from './layout.js';
import { nodeDims } from './nodes.js';
import { frontBeamSchema } from './params-front-beam.js';

export { defaults };
export const schema = frontBeamSchema;

export function design(params: LayoutParams = defaults) {
  const l = layout(params);
  const fb = frontBeam(l);
  const d = nodeDims(l);

  function model(): ValidSolid {
    const finished = finish(hangerCap(l, fb), { edge: params.edgeChamfer, corner: params.cornerChamfer }, 'pivot-hanger-cap');
    return engrave(finished, 'HANGER CAP', labelOptions(params), 'pivot-hanger-cap');
  }

  // -------------------------------------------------------------------------
  // Declared intent — asserted by `brep verify --check`
  // -------------------------------------------------------------------------

  const [x, y, z] = [2 * d.armHalf, 2 * fb.hanger.halfY, d.thickness];
  const expected = {
    bounds: { xMin: -x / 2, xMax: x / 2, yMin: -y / 2, yMax: y / 2, zMin: 0, zMax: z },
    tolerancePct: 0.1,
  };

  return { model, expected };
}

const standard = design();

export const { expected } = standard;

export default function pivotHangerCap() {
  return standard.model();
}
