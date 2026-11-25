/**
 * E-stop clamp: print one.
 *
 * The lower half of the e-stop housing's clamp on the top bar.
 *
 * As exported it lies as it prints, with no supports. See ./fittings.ts.
 */
import { fittingPart } from './fitting-part.js';

export const { defaults, schema, design } = fittingPart('estop-clamp', ['Electronics']);

const standard = design();

export const { expected } = standard;

export default function estopClamp() {
  return standard.model();
}
