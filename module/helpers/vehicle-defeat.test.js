import { jest } from '@jest/globals';
import { crashVehicle, explodeVehicle, handleVehicleZeroHealthTransition } from './vehicle-defeat.mjs';

// applyDamage() (called internally) relies on the rest of jest.setup.js's own global.foundry -
// only DialogV2 needs adding, same augmentation megaform-damage.test.js already uses.
global.foundry.applications.api.DialogV2 = { wait: jest.fn() };

let rollQueue = [];
let originalRoll;
beforeEach(() => {
  rollQueue = [];
  originalRoll = global.Roll;
  global.Roll = class {
    constructor(formula) {
      this.formula = formula;
    }
    async evaluate() {
      this.total = rollQueue.length ? rollQueue.shift() : 0;
      return this;
    }
  };
  ChatMessage.create.mockClear();
  global.fromUuid.mockReset();
});
afterEach(() => {
  global.Roll = originalRoll;
});

function makeVehicle({ type = 'vehicle', crashed = false, health = 10, crew = {}, size = 'huge' } = {}) {
  const actor = {
    name: 'Test Vehicle',
    type,
    items: [],
    system: {
      health: { value: health }, immunities: {}, resistances: {}, size,
      actors: crew, crashed,
      skills: { brawn: { shift: 'd6', modifier: 0 } },
    },
    toggleStatusEffect: jest.fn(),
    getActiveTokens: jest.fn(() => []),
  };
  actor.update = jest.fn(async (data) => {
    if (data['system.health.value'] !== undefined) {
      actor.system.health.value = data['system.health.value'];
    }
    if (data['system.crashed'] !== undefined) {
      actor.system.crashed = data['system.crashed'];
    }
  });

  return actor;
}

function makeCrewMember(name, { health = 5 } = {}) {
  const member = {
    name,
    items: [],
    system: {
      health: { value: health }, immunities: {}, resistances: {},
      skills: { athletics: { shift: 'd6', modifier: 0 }, acrobatics: { shift: 'd4', modifier: 0 } },
    },
    toggleStatusEffect: jest.fn(),
  };
  member.update = jest.fn(async (data) => {
    if (data['system.health.value'] !== undefined) {
      member.system.health.value = data['system.health.value'];
    }
  });

  return member;
}

describe("crashVehicle", () => {
  test("sets system.crashed and posts a chat message, with no crew or movement damage", async () => {
    const vehicle = makeVehicle();

    await crashVehicle(vehicle);

    expect(vehicle.system.crashed).toBe(true);
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: 'E20.VehicleCrashed' }));
  });

  test("no-ops (past a chat note) if already crashed", async () => {
    const vehicle = makeVehicle({ crashed: true });

    await crashVehicle(vehicle);

    expect(vehicle.update).not.toHaveBeenCalled();
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: 'E20.VehicleAlreadyCrashed' }));
  });

  test("deals 1 Blunt damage per 10ft of movement to the vehicle itself, rounded down", async () => {
    const vehicle = makeVehicle({ health: 10 });

    await crashVehicle(vehicle, { movementFeetMoved: 25 });

    expect(vehicle.system.health.value).toBe(8); // floor(25/10) = 2
  });

  test("a crew member who passes the disembark test goes Prone and takes 1d2 fall damage", async () => {
    const crewMember = makeCrewMember('Joe');
    global.fromUuid.mockResolvedValue(crewMember);
    const vehicle = makeVehicle({ crew: { c1: { uuid: 'Actor.Joe' } } });
    rollQueue = [15, 10, 2]; // athletics 15 (beats DIF 13), acrobatics 10, 1d2 fall damage = 2

    await crashVehicle(vehicle);

    expect(crewMember.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });
    expect(crewMember.system.health.value).toBe(3); // 5 - 2
  });

  test("a crew member who fails the disembark test takes half the vehicle's own crash damage instead", async () => {
    const crewMember = makeCrewMember('Joe');
    global.fromUuid.mockResolvedValue(crewMember);
    const vehicle = makeVehicle({ crew: { c1: { uuid: 'Actor.Joe' } } });
    rollQueue = [5, 3]; // athletics 5, acrobatics 3 - both miss DIF 13

    await crashVehicle(vehicle, { movementFeetMoved: 20 }); // vehicle's own crash damage = 2

    expect(crewMember.toggleStatusEffect).not.toHaveBeenCalled();
    expect(crewMember.system.health.value).toBe(4); // 5 - ceil(2/2)
  });

  test("skips a crew entry that can no longer be resolved", async () => {
    global.fromUuid.mockResolvedValue(null);
    const vehicle = makeVehicle({ crew: { c1: { uuid: 'Actor.Gone' } } });

    await expect(crashVehicle(vehicle)).resolves.toBeUndefined();
  });
});

describe("explodeVehicle", () => {
  beforeEach(() => {
    global.canvas = {
      tokens: { placeables: [] },
      grid: { measurePath: jest.fn(() => ({ distance: 10 })) },
    };
  });

  function place(vehicle, target, distance) {
    const vehicleToken = { document: { disposition: 1 }, center: { x: 0, y: 0 } };
    vehicle.getActiveTokens = jest.fn(() => [vehicleToken]);
    const targetToken = { actor: target, document: { disposition: -1 }, center: { x: distance, y: 0 } };
    canvas.tokens.placeables = [vehicleToken, targetToken];
    canvas.grid.measurePath.mockReturnValue({ distance });
  }

  test("Huge Size Class: 2d4 damage in a 30ft radius", async () => {
    const vehicle = makeVehicle({ size: 'huge' });
    const target = makeCrewMember('Bystander');
    place(vehicle, target, 20);
    rollQueue = [6, 20, 1]; // damage total 6, target's Athletics 20 (beats DIF 14), Acrobatics 1

    await explodeVehicle(vehicle);

    expect(target.system.health.value).toBe(2); // 5 - ceil(6/2) on a successful save
  });

  test("a failed save takes full damage, floored at 0", async () => {
    const vehicle = makeVehicle({ size: 'huge' });
    const target = makeCrewMember('Bystander', { health: 5 });
    place(vehicle, target, 20);
    rollQueue = [6, 2, 1]; // damage total 6, both saves miss DIF 14

    await explodeVehicle(vehicle);

    expect(target.system.health.value).toBe(0);
  });

  test("Common Size Class only reaches a 15ft radius", async () => {
    const vehicle = makeVehicle({ size: 'common' });
    const target = makeCrewMember('Bystander');
    place(vehicle, target, 20); // outside the 15ft Common-Long radius
    rollQueue = [6];

    await explodeVehicle(vehicle);

    expect(target.update).not.toHaveBeenCalled();
  });

  test("hits friend and foe alike (getAllNearbyTokens, not disposition-scoped)", async () => {
    const vehicle = makeVehicle({ size: 'huge' });
    const ally = makeCrewMember('Ally');
    const vehicleToken = { document: { disposition: 1 }, center: { x: 0, y: 0 } };
    vehicle.getActiveTokens = jest.fn(() => [vehicleToken]);
    const allyToken = { actor: ally, document: { disposition: 1 }, center: { x: 10, y: 0 } };
    canvas.tokens.placeables = [vehicleToken, allyToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 10 });
    rollQueue = [6, 2, 1]; // damage total 6, ally's saves both miss DIF 14

    await explodeVehicle(vehicle);

    expect(ally.system.health.value).toBe(0); // 5 - 6, floored
  });

  test("a Titanic vehicle (beyond Towering, RAW's own top tier) still uses the largest 2d6/45ft tier", async () => {
    const vehicle = makeVehicle({ size: 'titanic' });
    const target = makeCrewMember('Bystander');
    place(vehicle, target, 40); // within the 45ft Extended II-Towering-and-up radius
    rollQueue = [12, 2, 1]; // damage total 12, saves both miss

    await explodeVehicle(vehicle);

    expect(target.system.health.value).toBe(0); // 5 - 12, floored
  });
});

describe("handleVehicleZeroHealthTransition", () => {
  test("Vehicle: passing the Brawn Test crashes it", async () => {
    const vehicle = makeVehicle();
    rollQueue = [20]; // Brawn Test beats DIF 14

    await handleVehicleZeroHealthTransition(vehicle);

    expect(vehicle.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: true });
    expect(vehicle.system.crashed).toBe(true);
  });

  test("Vehicle: failing the Brawn Test explodes it instead", async () => {
    const vehicle = makeVehicle();
    rollQueue = [5]; // Brawn Test misses DIF 14

    await handleVehicleZeroHealthTransition(vehicle);

    expect(vehicle.system.crashed).toBe(false);
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: 'E20.VehicleExploded' }));
  });

  test("Zord: goes Prone and dormant - no Brawn Test, no crash, no explosion", async () => {
    const zord = makeVehicle({ type: 'zord' });

    await handleVehicleZeroHealthTransition(zord);

    expect(zord.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: true });
    expect(zord.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });
    expect(zord.system.crashed).toBe(false);
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: 'E20.ZordDormant' }));
  });

  test("Fragile: explodes immediately, even with a roll that would have passed the Brawn Test", async () => {
    const vehicle = makeVehicle();
    vehicle.system.traits = { fragile: true };
    rollQueue = [20]; // would beat DIF 14 if a Brawn Test were rolled - it shouldn't be

    await handleVehicleZeroHealthTransition(vehicle);

    expect(vehicle.system.crashed).toBe(false);
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: 'E20.VehicleExploded' }));
  });

  test("Zord: Recall for Repairs also clears an active Warrior Mode (PR CRB, Zord Feature, p.140)", async () => {
    const flagStore = { warriorModeActive: true };
    const zord = makeVehicle({ type: 'zord' });
    zord.getFlag = jest.fn((scope, key) => flagStore[key]);
    zord.unsetFlag = jest.fn((scope, key) => {
      delete flagStore[key];
    });

    await handleVehicleZeroHealthTransition(zord);

    expect(zord.unsetFlag).toHaveBeenCalledWith('essence20', 'warriorModeActive');
  });
});
