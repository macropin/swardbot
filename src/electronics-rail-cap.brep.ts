/**
 * Electronics rail cap: print one.
 *
 * Clamps the two electronics rails to the backplate from behind.
 *
 * As exported it lies as it prints, with no supports. See ./fittings.ts.
 */
import { fittingPart } from './fitting-part.js';

export const { defaults, schema, design } = fittingPart('electronics-rail-cap', ['Electronics']);

const standard = design();

export const { expected } = standard;

export default function electronicsRailCap() {
  return standard.model();
}
