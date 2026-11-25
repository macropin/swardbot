/**
 * Apex node half B: the left side's inner half, and the right side's outer half. Print two.
 *
 * As exported it lies as it prints: split face down, no supports. See
 * ./nodes.ts for what the nodes hold and ./node-solid.ts for how a half is built.
 */
import { nodePart } from './node-part.js';

export const { defaults, schema, design } = nodePart('apex', 'inner', 'left');

const standard = design();

export const { expected } = standard;

export default function apexNodeB() {
  return standard.model();
}
