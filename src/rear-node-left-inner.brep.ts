/**
 * Rear node, left side, inner half: with spigots for the bumper and the cradle's rear floor tube.
 *
 * As exported it lies as it prints: split face down, no supports. See
 * ./nodes.ts for what the nodes hold and ./node-solid.ts for how a half is built.
 */
import { nodePart } from './node-part.js';

export const { defaults, schema, design } = nodePart('rear', 'inner', 'left');

const standard = design();

export const { expected } = standard;

export default function rearNodeLeftInner() {
  return standard.model();
}
