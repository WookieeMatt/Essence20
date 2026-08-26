import { verifyDropSelection } from "./drop-handler.mjs";

function makeVehicle(actors, numDrivers, numPassengers) {
  return {
    system: {
      actors,
      crew: { numDrivers, numPassengers },
    },
  };
}

describe("verifyDropSelection", () => {
  test("allows a driver drop when there's an open driver seat", () => {
    const vehicle = makeVehicle({}, 1, 2);
    expect(verifyDropSelection(vehicle, 'driver')).toBe(true);
  });

  test("blocks a driver drop when all driver seats are filled", () => {
    const vehicle = makeVehicle({ a: { vehicleRole: 'driver' } }, 1, 2);
    expect(verifyDropSelection(vehicle, 'driver')).toBe(false);
  });

  test("allows a passenger drop when there's an open passenger seat", () => {
    const vehicle = makeVehicle({ a: { vehicleRole: 'passenger' } }, 1, 2);
    expect(verifyDropSelection(vehicle, 'passenger')).toBe(true);
  });

  test("blocks a passenger drop when all passenger seats are filled", () => {
    const vehicle = makeVehicle({
      a: { vehicleRole: 'passenger' },
      b: { vehicleRole: 'passenger' },
    }, 1, 2);
    expect(verifyDropSelection(vehicle, 'passenger')).toBe(false);
  });

  test("only counts existing occupants with a matching role", () => {
    const vehicle = makeVehicle({
      a: { vehicleRole: 'driver' },
      b: { vehicleRole: 'passenger' },
    }, 1, 2);
    // The one driver seat is filled, but there's still an open passenger seat
    expect(verifyDropSelection(vehicle, 'driver')).toBe(false);
    expect(verifyDropSelection(vehicle, 'passenger')).toBe(true);
  });
});
