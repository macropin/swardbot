/**
 * Deck plate: print one.
 *
 * Stands on the tray's top and carries the mower motor. The four rods screw into
 * nuts dropped into its underside; the motor's bolts come up through the tray
 * and the plate, clamping the tray to it, and four more bolts hold the tray.
 *
 * As exported it lies as it prints, with no supports. See ./fittings.ts.
 */
import { fittingPart } from './fitting-part.js';

export const { defaults, schema, design } = fittingPart('deck-plate', ['Deck']);

const standard = design();

export const { expected } = standard;

export default function deckPlate() {
  return standard.model();
}
