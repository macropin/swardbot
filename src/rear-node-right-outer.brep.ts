/**
 * Rear node, right side, outer half.
 *
 * As exported it lies as it prints: split face down, no supports. See
 * ./nodes.ts for what the nodes hold and ./node-solid.ts for how a half is built.
 */
import { nodePart } from './node-part.js';

export const { defaults, schema, design } = nodePart('rear', 'outer', 'right');

const standard = design();

export const { expected } = standard;

export default function rearNodeRightOuter() {
  return standard.model();
}
