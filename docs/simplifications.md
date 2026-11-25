# Simplifications

[← Mechanical design](mechanical-design.md)

Ways to make SwardBot simpler to build. The first three are done; the rest are ideas, not yet in the design.

## Done

- **Fewer drilled holes.** The cradle, deck and box nodes, and the deck hanger blocks, carry little, so they take one bolt in each arm. That's 77 holes in all, down from 87.
- **Standard hole positions.** Every tube end held in a node, on a spigot or in an antenna mount has its holes 15 and 40 mm from its end, so one drill jig (`drill-jig-end`) replaces nine. Holes part way along a tube are drilled through the part that clamps there.
- **Fewer fastener sizes.** Everything is M6 except the castors and deck rods (M8), the pivot pin (M10) and the antennas' 5/8" thread; M4 and M5 are gone.

## Ideas

### Buy the blade adapter

A steel 12 mm-bore rigid flange coupling, with set screws, does the blade hub's job without a lathe. Pair it with a square washer cut from 50 × 5 mm flat bar and an M6 centre bolt into the shaft's end.

- **Check:** the coupling's flange must be wide enough to clamp the blade, and its bore must reach the shaft's end.
- **Saves:** the only machined part.

### Simpler electronics mounting

The box node, the two electronics rails, the backplate and the rail cap (7 prints and 2 tubes) could become two printed brackets that hang the box from the top bar.

- **Costs:** the box would hang off one bar rather than being held at two heights, so it needs a stay to the posts or a strap to stop it swinging.
- **Saves:** 5 prints, 2 tubes and 4 drilled holes.

### One-piece deck hanger blocks

Each deck hanger block is two halves round its tube. A one-piece block that slides on along the tube and is pinned by its bolt would halve the prints, 8 to 4.

- **Costs:** the blocks must go on before the tube's ends are fixed, since they slide on from an end.

### Drop the rear rail tube

The rear rail lies entirely inside the rear node, so the node could carry the bumper by itself.

- **Saves:** one cut and four drilled holes.
- **Costs:** a little stiffness where the frame carries the batteries and bumper, which the rear node would then take alone.
