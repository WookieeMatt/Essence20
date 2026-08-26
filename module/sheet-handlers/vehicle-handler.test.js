import { jest } from '@jest/globals';
import { _flipDriverAndPassenger, prepareSystemActors } from "./vehicle-handler.mjs";

describe("_flipDriverAndPassenger", () => {
  test("swaps the previous occupant to passenger when the new occupant takes driver", () => {
    const actor = { update: jest.fn() };
    _flipDriverAndPassenger(actor, 'newKey', 'driver', 'oldKey');
    expect(actor.update).toHaveBeenCalledWith({ "system.actors.oldKey.vehicleRole": 'passenger' });
    expect(actor.update).toHaveBeenCalledWith({ "system.actors.newKey.vehicleRole": 'driver' });
  });

  test("swaps the previous occupant to driver when the new occupant takes passenger", () => {
    const actor = { update: jest.fn() };
    _flipDriverAndPassenger(actor, 'newKey', 'passenger', 'oldKey');
    expect(actor.update).toHaveBeenCalledWith({ "system.actors.oldKey.vehicleRole": 'driver' });
    expect(actor.update).toHaveBeenCalledWith({ "system.actors.newKey.vehicleRole": 'passenger' });
  });
});

describe("prepareSystemActors", () => {
  afterEach(() => {
    global.fromUuidSync.mockReset();
  });

  test("does nothing to the context when the vehicle has no embedded actors", () => {
    const actor = { system: { actors: {} } };
    const context = {};
    prepareSystemActors(actor, context);
    expect(context.actors).toBeUndefined();
  });

  test("resolves each embedded actor's uuid and attaches them to context.actors", () => {
    const driver = { name: "Driver" };
    const passenger = { name: "Passenger" };
    global.fromUuidSync
      .mockReturnValueOnce(driver)
      .mockReturnValueOnce(passenger);

    const actor = {
      system: {
        actors: {
          a: { uuid: "Actor.driverUuid", vehicleRole: 'driver' },
          b: { uuid: "Actor.passengerUuid", vehicleRole: 'passenger' },
        },
      },
    };
    const context = {};
    prepareSystemActors(actor, context);

    expect(context.actors).toEqual({ a: driver, b: passenger });
    expect(global.fromUuidSync).toHaveBeenCalledWith("Actor.driverUuid");
    expect(global.fromUuidSync).toHaveBeenCalledWith("Actor.passengerUuid");
  });
});
