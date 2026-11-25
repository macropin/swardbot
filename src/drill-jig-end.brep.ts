/**
 * Drill jig for every tube end: print one.
 *
 * Every tube end held in a node, on a spigot or in an antenna mount has its
 * holes the same distances from the end. Slide the jig onto the end until the
 * end meets the stop, and drill through the guides: both for a side frame's
 * tubes, the first only for a cross member's. As exported it lies as it prints.
 * See ./drill-jigs.ts.
 */
import { jigPart } from './drill-jig-part.js';

export const { defaults, schema, design } = jigPart('end');

const standard = design();

export const { expected } = standard;

export default function drillJigEnd() {
  return standard.model();
}
