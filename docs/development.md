# Development

[← Mechanical design](mechanical-design.md)

The chassis is modelled in [brepjs](https://github.com/andymai/brepjs): code-first B-rep CAD in TypeScript, with OpenCascade compiled to WebAssembly as the kernel. Requires Node 24+ (`brew install node`), and ImageMagick to crop the renders.

```bash
make install
```

## Make targets

```bash
make            # list the targets
make layout     # print the layout, mass budget, checks and cut list
make verify     # type-check, pass the layout checks, and verify each part
make render     # render each part and scene, and refresh media/
make views      # render the whole mower in colour from several angles, into media/views/ (VIEWS="side top" for some)
make export     # STEP + STL of each printed part, STEP of each machined part and scene, into out/
make preview SCENE=mower   # live viewer, re-evaluates on save
make clean      # drop out/
```

`make layout` takes overrides, to try a change without editing the defaults:

```bash
make layout ARGS="bladeDiameter=400 trayDiameter=440"
```

It exits non-zero if a check fails, and writes the whole layout to `out/layout.json`.

## Layout

[src/layout.ts](../src/layout.ts) is the source of every dimension:

- `defaults`: every parameter, flat and numeric, in the same style as the parts.
- `schema`: each parameter's label, unit, range and group.
- `layout(params)`: positions, tube centrelines (`members`), the cut list, the mass budget, the centre of gravity, the tip angles and the `checks`.

Printed parts and scenes take their positions from `layout()` rather than from numbers of their own, so they follow any change.

## Parts and scenes

- **Parts:** each printed part is a `src/<name>.brep.ts` module, in the pattern from [params.ts](../src/params.ts). It has `defaults`, a `schema`, a `design(params)` returning the `model` and its `expected` dimensions, and a default export building it at its defaults. `make verify` checks each one is a valid solid matching its `expected`. Each part is built as it prints, so `make export` gives STLs ready to slice.
- **Scenes:** `src/assemblies/` holds scenes, not parts. [mower.brep.ts](../src/assemblies/mower.brep.ts) draws the whole machine from the layout, with the printed nodes in place, for renders.

## Frame nodes

- [src/nodes.ts](../src/nodes.ts) is the nodes' geometry as numbers, all taken from the layout. For each node it gives the tubes it holds (with their bolts), the spigots and tunnels for cross members, and its outline. It also has the node checks and the holes to drill in the tubes.
- [src/node-solid.ts](../src/node-solid.ts) builds a half from that, as it prints.
- [src/node-part.ts](../src/node-part.ts) wraps a half as a part.
- The sixteen `src/*-node-*.brep.ts` modules are one line each: which node, which half, which side. The cradle, deck and box nodes are the same fore and aft, so they have one module per half.

A node's parameters are the layout's: its schema offers the `Nodes` group (walls, arms, bolts, fits), and the rest of the layout sets its shape.

## Front beam

- [src/front-beam.ts](../src/front-beam.ts) is the front beam's parts as numbers: the saddle, the pivot hanger and its stops, the castor pads, their checks, and the holes they need.
- [src/front-beam-solid.ts](../src/front-beam-solid.ts) builds them as they print, and places them on the mower for the scene.
- The four `src/pivot-*.brep.ts` and `src/castor-pad.brep.ts` modules wrap them as parts. Their schema, in [src/params-front-beam.ts](../src/params-front-beam.ts), offers the `Front beam` group, the castor mounting, and the walls and fits they share with the nodes.

## Fittings

- [src/fittings.ts](../src/fittings.ts) is the clamped-on parts for the battery cradle, deck and top, as numbers. That's the battery stop, the deck hanger block and deck plate, the electronics backplate and rail cap, the antenna mount and the e-stop housing, with their checks and the holes they need.
- [src/fittings-solid.ts](../src/fittings-solid.ts) builds each in a frame of its own, as it prints, with its extent and where it sits on the mower.
- [src/fitting-part.ts](../src/fitting-part.ts) wraps one as a part, and each fitting's `src/*.brep.ts` module names which.
- [src/shapes.ts](../src/shapes.ts) has the small shape helpers they share.
- [src/holes.ts](../src/holes.ts) merges every part's holes into one drill list per tube, for the report and the drill jigs.

## Edge finish and labels

[src/finish.ts](../src/finish.ts) chamfers every printed part's hard edges as its part module builds it. Then [src/label.ts](../src/label.ts) engraves the part's label into its face up. Both are slow on the big nodes, and a full `make verify` takes several minutes. `SWARDBOT_FAST=1 make verify` skips both, for quick work on a part's shape.

## Machined parts

[src/blade.ts](../src/blade.ts) is the blade adapter as numbers, with its checks. [src/blade-solid.ts](../src/blade-solid.ts) builds the hub and washer, and `src/machined/` holds their part modules. The Makefile verifies and renders those like any part, but exports them as STEP only, so they can't be sliced by mistake.

## Drill jigs and end caps

- [src/drill-jigs.ts](../src/drill-jigs.ts) makes the end jig from the standard hole distances (`boltInset`, `boltPitch`). It checks every tube end's holes from `allHoles()` sit at them, and lists the holes part way along, which are drilled through their parts. It has its own parameters (`jigDefaults`): walls, fits, guide bosses and the pilot size.
- [src/drill-jig-part.ts](../src/drill-jig-part.ts) builds the jig, and [src/drill-jig-end.brep.ts](../src/drill-jig-end.brep.ts) is its part module.
- [src/end-cap.brep.ts](../src/end-cap.brep.ts) is a standalone part, taking the tube's size from the layout's defaults.
