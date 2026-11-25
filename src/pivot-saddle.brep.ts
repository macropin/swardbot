/**
 * Pivot saddle, one half: print two.
 *
 * Clamps on the front beam's middle, the two halves bolted through it, and
 * clamps the pivot pin between them. The pin turns in the pivot hanger's ears.
 * Clamp it on at the beam's marked middle and drill the beam through its holes:
 * the bolt holes at 6.5 mm, the pin's at 9.5 mm (its bore guides that), opened
 * out to 10.5 mm once the saddle is off.
 *
 * As exported it lies as it prints: split face down, no supports. See
 * ./front-beam.ts.
 */
import type { ValidSolid } from 'brepjs';

import { saddleHalf } from './front-beam-solid.js';
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
    const finished = finish(saddleHalf(l, fb), { edge: params.edgeChamfer, corner: params.cornerChamfer }, 'pivot-saddle');
    return engrave(finished, 'SADDLE', labelOptions(params), 'pivot-saddle');
  }

  // -------------------------------------------------------------------------
  // Declared intent — asserted by `brep verify --check`
  // -------------------------------------------------------------------------

  const [x, y, z] = [2 * fb.saddle.halfX, 2 * fb.saddle.halfY, d.thickness];
  const expected = {
    bounds: { xMin: -x / 2, xMax: x / 2, yMin: -y / 2, yMax: y / 2, zMin: 0, zMax: z },
    tolerancePct: 0.1,
  };

  return { model, expected };
}

const standard = design();

export const { expected } = standard;

export default function pivotSaddle() {
  return standard.model();
}
