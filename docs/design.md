# Design

The design target is currently the following:

- 25.2V nominal power system, achieved with 2 x 12.6V LiFePO4 100Ah batteries (simplicity and low cost)
- PixHawk flight controller and compatible GPS modules (UM982) for rover and base station
- Motor ESC running AM32 open source firmware, and with minimum "8S" voltage capacity (29.6v), and minimum 20A (eg NeutronRC 70A-G071)
- 2 x 10" rear wheels with BLDC hub motor and encoders
- 2 x 5" front castor wheels
- 400W mower motor
- 34cm blade under a 36cm stainless tray

Chassis is 25.4mm square aluminium tube (Bunnings), cut square and joined with 3D-printed nodes. 2020 extrusion is a possible variant. See [Mechanical design](mechanical-design.md).

The chassis will employ a zero-turn kinematic design. Dimensions are parametric, worked out from the components in [src/layout.ts](../src/layout.ts).
