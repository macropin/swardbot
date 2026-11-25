# To do

[← Mechanical design](mechanical-design.md)

What's left before SwardBot can run, beyond the chassis in [Mechanical design](mechanical-design.md).

## Needed before a first run

- [ ] **Hub motor cable exit.** Most single-sided hub motors bring their cables out through the end of the hollow axle, but the axle ends blind inside the rear node's inner half. The cable has nowhere to go, and the batteries sit only 5 mm from the node's inner face. Add a cable channel from the axle's end to somewhere clear of the batteries, probably up inside the node toward the rail. Confirm the route against the actual motor first.
- [ ] **Inside the electronics box:**
  - a mount for the Pixhawk that isolates it from vibration: the blade motor will shake its motion sensors, and ArduPilot is sensitive to that;
  - a tray for the ESCs and the DC-DC converter;
  - cable glands.
- [ ] **Power hardware:** find a home for each of these:
  - the main isolator switch;
  - the main fuse;
  - the charge port;
  - the link joining the two batteries in series;
  - covers for the battery terminals.
- [ ] **Cable routing:**
  - clips on the tubes;
  - strain relief at the wheels;
  - a run for the GPS antenna cables along the top bar;
  - routes from the box to the hub motors, the mower motor and the e-stop.
- [ ] **Weather cover** over the batteries and electronics, so the batteries' terminals and the box's glands don't sit in the rain.

## Worth adding

- [ ] **Deck safety:** a rubber flap or skirt round the front of the deck, against thrown stones and feet.
- [ ] **Obstacle sensing:** there's none yet. A front bumper with micro-switches is simple and reports straight to ArduPilot.
- [ ] **Tie-down points** for transport.

## Not parts, but still to do

- [ ] **Confirm the guessed components**, listed under [Open items](mechanical-design.md#open-items). Each is a number to change in [src/layout.ts](../src/layout.ts), and the checks will flag anything that stops fitting:
  - the hub motor's axle and cable;
  - the mower motor's flange and shaft;
  - the castors' bolt holes;
  - the electronics box;
  - the blade's centre hole.
- [ ] **First test prints:** a front node, an end cap, a battery stop and the drill jig. Fit them on offcuts of the real tube to check `fitTolerance`, `clampSqueeze` and strength before printing the rest.
- [ ] **Sweep the parameter limits:** a `make sweep`, like gorillacart's, that builds the layout and parts at each parameter's limits, to find which ranges actually build.
