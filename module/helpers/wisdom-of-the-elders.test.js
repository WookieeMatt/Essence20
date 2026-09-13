import { jest } from '@jest/globals';
import {
  activateWisdomOfTheEldersTeleportation, canAffordWisdomOfTheElders, isWisdomOfTheEldersActive,
  toggleWisdomOfTheElders,
} from './wisdom-of-the-elders.mjs';

function makeActor({ power = 0, eltarianTech = 0, flagStore = {} } = {}) {
  const rolePoints = { system: { resource: { value: eltarianTech } }, update: jest.fn() };
  return {
    system: { powers: { personal: { value: power } } },
    update: jest.fn(),
    getFlag: jest.fn(() => flagStore.wisdomOfTheEldersActive),
    setFlag: jest.fn((scope, key, value) => {
      flagStore[key] = value; 
    }),
    _getBaseRolePoints: jest.fn(() => rolePoints),
    __rolePoints: rolePoints,
  };
}

describe("canAffordWisdomOfTheElders", () => {
  test("checks Personal Power for a power-cost option", () => {
    expect(canAffordWisdomOfTheElders(makeActor({ power: 1 }), 'lightshieldArmor')).toBe(true);
    expect(canAffordWisdomOfTheElders(makeActor({ power: 0 }), 'lightshieldArmor')).toBe(false);
  });

  test("checks Eltarian Tech for an eltarianTech-cost option", () => {
    expect(canAffordWisdomOfTheElders(makeActor({ eltarianTech: 1 }), 'teleportation')).toBe(true);
    expect(canAffordWisdomOfTheElders(makeActor({ eltarianTech: 0 }), 'teleportation')).toBe(false);
  });

  test("respects each option's own cost amount", () => {
    expect(canAffordWisdomOfTheElders(makeActor({ eltarianTech: 1 }), 'lightfoilWings')).toBe(false);
    expect(canAffordWisdomOfTheElders(makeActor({ eltarianTech: 2 }), 'lightfoilWings')).toBe(true);
  });
});

describe("toggleWisdomOfTheElders", () => {
  test("switching ON spends Power for a power-cost option", async () => {
    const actor = makeActor({ power: 2 });
    const result = await toggleWisdomOfTheElders(actor, 'lightshieldArmor');

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 });
    expect(isWisdomOfTheEldersActive(actor, 'lightshieldArmor')).toBe(true);
  });

  test("switching ON spends Eltarian Tech for an eltarianTech-cost option", async () => {
    const actor = makeActor({ eltarianTech: 2 });
    const result = await toggleWisdomOfTheElders(actor, 'enhancedReflexes');

    expect(result).toBe(true);
    expect(actor.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
    expect(isWisdomOfTheEldersActive(actor, 'enhancedReflexes')).toBe(true);
  });

  test("returns null and spends nothing when unaffordable", async () => {
    const actor = makeActor({ power: 0 });
    const result = await toggleWisdomOfTheElders(actor, 'lightshieldArmor');

    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
    expect(isWisdomOfTheEldersActive(actor, 'lightshieldArmor')).toBe(false);
  });

  test("switching back OFF is free", async () => {
    const flagStore = { wisdomOfTheEldersActive: { lightshieldArmor: true } };
    const actor = makeActor({ power: 0, flagStore });
    const result = await toggleWisdomOfTheElders(actor, 'lightshieldArmor');

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("doesn't disturb a different option's own active state", async () => {
    const flagStore = { wisdomOfTheEldersActive: { lightshieldArmor: true } };
    const actor = makeActor({ power: 2, eltarianTech: 2, flagStore });
    await toggleWisdomOfTheElders(actor, 'enhancedReflexes');

    expect(isWisdomOfTheEldersActive(actor, 'lightshieldArmor')).toBe(true);
    expect(isWisdomOfTheEldersActive(actor, 'enhancedReflexes')).toBe(true);
  });
});

describe("activateWisdomOfTheEldersTeleportation", () => {
  test("spends 1 Eltarian Tech Point and returns true", async () => {
    const actor = makeActor({ eltarianTech: 1 });
    const activated = await activateWisdomOfTheEldersTeleportation(actor);

    expect(activated).toBe(true);
    expect(actor.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 0 });
  });

  test("returns false and spends nothing when unaffordable", async () => {
    const actor = makeActor({ eltarianTech: 0 });
    const activated = await activateWisdomOfTheEldersTeleportation(actor);

    expect(activated).toBe(false);
    expect(actor.__rolePoints.update).not.toHaveBeenCalled();
  });
});
