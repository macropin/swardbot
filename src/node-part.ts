/**
 * One printable node half, as a part: built from the layout at any set of its
 * parameters, centred on the bed with its split face down, with its declared
 * extent for `brep verify`. Each src/*-node-*.brep.ts module is one of these.
 */
import type { ValidSolid } from 'brepjs';
import { translate } from 'brepjs';

import { finish } from './finish.js';
import { engrave, labelOptions } from './label.js';
import { defaults, layout, schema as layoutSchema, type LayoutParams } from './layout.js';
import { nodeHalf, mirrored, type Half, type Side } from './node-solid.js';
import { extent, nodeDims, nodes, type NodeName } from './nodes.js';
import type { Schema } from './params.js';

/** What a user may change on a node: its own dimensions and fits. The rest of the layout sets its shape. */
export const nodeSchema: Schema<LayoutParams> = Object.fromEntries(
  Object.entries(layoutSchema).filter(
    ([name, spec]) =>
      spec?.group === 'Nodes' || ['edgeChamfer', 'cornerChamfer', 'labelHeight', 'labelDepth', 'labelStroke'].includes(name),
  ),
);

/**
 * The label engraved into a half, to tell it apart once printed: the node, and
 * for the corner nodes, which side and half. The apex halves serve two places
 * each, so they're A and B; the cradle, deck and box nodes are the same either side.
 */
export function labelText(name: NodeName, half: Half, side: Side): string {
  const node = name.toUpperCase();
  if (name === 'apex') return `APEX ${mirrored(side, half) ? 'A' : 'B'}`;
  const h = half === 'outer' ? 'OUT' : 'IN';
  if (name === 'rear' || name === 'front') return `${node} ${side === 'left' ? 'L' : 'R'} ${h}`;
  return `${node} ${h}`;
}

export function nodePart(name: NodeName, half: Half, side: Side) {
  function design(params: LayoutParams = defaults) {
    const l = layout(params);
    const spec = nodes(l).find((n) => n.name === name);
    if (!spec) throw new Error(`no ${name} node`);
    const d = nodeDims(l);
    const e = extent(spec);
    const flip = mirrored(side, half);
    const width = e.uMax - e.uMin;
    const depth = e.vMax - e.vMin;
    const centre: [number, number] = [(e.uMin + e.uMax) / 2, ((flip ? -1 : 1) * (e.vMin + e.vMax)) / 2];
    const spigots = half === 'inner' && spec.spigots.length > 0;

    function model(): ValidSolid {
      const finished = finish(
        translate(nodeHalf(l, spec!, half, side), [-centre[0], -centre[1], 0]),
        { edge: params.edgeChamfer, corner: params.cornerChamfer },
        `${name} node, ${side} ${half}`,
      );
      return engrave(finished, labelText(name, half, side), labelOptions(params), `${name} node, ${side} ${half}`);
    }

    // -----------------------------------------------------------------------
    // Declared intent — asserted by `brep verify --check`
    // -----------------------------------------------------------------------

    const expected = {
      bounds: {
        xMin: -width / 2,
        xMax: width / 2,
        yMin: -depth / 2,
        yMax: depth / 2,
        zMin: 0,
        zMax: d.thickness + (spigots ? d.spigotLength : 0),
      },
      tolerancePct: 0.1,
    };

    return { model, expected };
  }

  return { defaults, schema: nodeSchema, design };
}
