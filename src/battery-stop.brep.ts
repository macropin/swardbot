/**
 * Battery stop: print two, one for each battery.
 *
 * A U-clip that hangs on the cradle's front floor tube under a battery, its lip
 * standing up in front of the battery so it can't slide forward. Bolt it
 * through the tube, snug; drill the tube through the clip.
 *
 * It prints on its side, as exported, so the batteries' push on the lip runs
 * along its layers. No supports. See ./fittings.ts.
 */
import { fittingPart } from './fitting-part.js';

export const { defaults, schema, design } = fittingPart('battery-stop', ['Batteries']);

const standard = design();

export const { expected } = standard;

export default function batteryStop() {
  return standard.model();
}
