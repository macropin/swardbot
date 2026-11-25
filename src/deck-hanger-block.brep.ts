/**
 * Deck hanger block, one half: print eight, two for each of the deck’s four rods.
 *
 * Two halves clamp on the deck beam or the front cross member, bolted through
 * it, and carry one of the deck's threaded rods behind the tube. Nuts above and
 * below the block set the cut height. Drill the tube through the block.
 *
 * As exported it lies as it prints, with no supports. See ./fittings.ts.
 */
import { fittingPart } from './fitting-part.js';

export const { defaults, schema, design } = fittingPart('deck-hanger-block', ['Deck']);

const standard = design();

export const { expected } = standard;

export default function deckHangerBlock() {
  return standard.model();
}
