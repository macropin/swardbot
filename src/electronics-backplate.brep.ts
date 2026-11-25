/**
 * Electronics backplate: print one.
 *
 * The electronics box screws to its front, with nuts sunk into its back. Its
 * clamps reach back round the two electronics rails, standing it off them, and
 * the rail cap behind bolts to them, into nuts slid into slots in the clamps.
 *
 * As exported it lies as it prints, with no supports. See ./fittings.ts.
 */
import { fittingPart } from './fitting-part.js';

export const { defaults, schema, design } = fittingPart('electronics-backplate', ['Electronics']);

const standard = design();

export const { expected } = standard;

export default function electronicsBackplate() {
  return standard.model();
}
