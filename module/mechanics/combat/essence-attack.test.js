import { jest } from '@jest/globals';
import {
  applyEssenceAttack, applyEssenceSwap, describeEssenceAttack, essenceKeysOf, ESSENCE_MUTATIONS_FLAG,
  isEssenceDamageType, randomEssence, resolveEssenceTargets,
} from './essence-attack.mjs';
import { applyDamage } from './combat.mjs';

foundry.applications.api.DialogV2 = { wait: jest.fn() };

// An actor whose update() really lands, so point-by-point Essence damage reads the new values.
function makeActor({ strength = 3, speed = 3, smarts = 3, social = 3, immunities = {}, type = 'npc', flags = {} } = {}) {
  const actor = {
    name: 'Target',
    type,
    items: [],
    flags,
    system: {
      health: { value: 10 },
      immunities,
      essences: {
        strength: { max: strength, value: strength },
        speed: { max: speed, value: speed },
        smarts: { max: smarts, value: smarts },
        social: { max: social, value: social },
      },
    },
    getFlag: jest.fn(() => undefined),
    setFlag: jest.fn(),
  };
  actor.update = jest.fn(async (update) => {
    for (const [path, value] of Object.entries(update)) {
      const parts = path.split('.');
      const last = parts.pop();
      const parent = parts.reduce((node, part) => (node[part] ??= {}), actor);
      parent[last] = value;
    }
  });
  return actor;
}

beforeEach(() => {
  foundry.applications.api.DialogV2.wait.mockReset();
});

describe("isEssenceDamageType", () => {
  test("knows the Essence damage types and nothing else", () => {
    expect(isEssenceDamageType('essenceStrength')).toBe(true);
    expect(isEssenceDamageType('essenceStrengthSpeed')).toBe(true);
    expect(isEssenceDamageType('essenceAny')).toBe(true);
    expect(isEssenceDamageType('essenceSwap')).toBe(true);
    expect(isEssenceDamageType('blunt')).toBe(false);
    expect(isEssenceDamageType(null)).toBe(false);
  });
});

describe("essenceKeysOf", () => {
  test("lists the Essences a character keeps as a score", () => {
    expect(essenceKeysOf(makeActor())).toEqual(['strength', 'speed', 'smarts', 'social']);
  });

  test("a machine's flat Essence numbers and a Megaform's borrowed ones don't count", () => {
    expect(essenceKeysOf({ system: { essences: { strength: 3, speed: 2 } } })).toEqual([]);
    expect(essenceKeysOf({ ...makeActor(), type: 'megaform' })).toEqual([]);
  });
});

describe("randomEssence", () => {
  test("picks by the random number, never past the end", () => {
    expect(randomEssence(['strength', 'speed'], () => 0)).toBe('strength');
    expect(randomEssence(['strength', 'speed'], () => 0.99)).toBe('speed');
    expect(randomEssence([], () => 0)).toBeNull();
  });
});

describe("resolveEssenceTargets", () => {
  test("fixed types hit their own Essences", async () => {
    const actor = makeActor();
    expect(await resolveEssenceTargets(actor, 'essenceStrength')).toEqual(['strength']);
    expect(await resolveEssenceTargets(actor, 'essenceStrengthSpeed')).toEqual(['strength', 'speed']);
  });

  test("'any' is random unless the attacker chooses", async () => {
    const actor = makeActor();
    expect(await resolveEssenceTargets(actor, 'essenceAny', { random: () => 0.6 })).toEqual(['smarts']);
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();

    foundry.applications.api.DialogV2.wait.mockResolvedValue('social');
    expect(await resolveEssenceTargets(actor, 'essenceAny', { attackerChooses: true })).toEqual(['social']);
  });

  test("'swap' picks two different Essences", async () => {
    const actor = makeActor();
    expect(await resolveEssenceTargets(actor, 'essenceSwap', { random: () => 0 })).toEqual({ up: 'strength', down: 'speed' });

    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('smarts').mockResolvedValueOnce('strength');
    expect(await resolveEssenceTargets(actor, 'essenceSwap', { attackerChooses: true })).toEqual({ up: 'smarts', down: 'strength' });
    // The second choice never offers the Essence already picked to rise.
    expect(foundry.applications.api.DialogV2.wait.mock.calls[1][0].content).not.toContain('value="smarts"');
  });

  test("a cancelled choice resolves to nothing", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(null);
    expect(await resolveEssenceTargets(makeActor(), 'essenceAny', { attackerChooses: true })).toBeNull();
  });
});

describe("applyEssenceAttack", () => {
  test("takes each point off the named Essence", async () => {
    const actor = makeActor();
    const result = await applyEssenceAttack(actor, 2, 'essenceStrength');
    expect(actor.system.essences.strength.value).toBe(1);
    expect(actor.system.essences.strength.max).toBe(3);
    expect(result).toEqual(expect.objectContaining({ applied: 2, damaged: { strength: 2 }, zeroed: [] }));
  });

  test("a pair takes the amount from both, and notes an Essence that reaches 0", async () => {
    const actor = makeActor({ strength: 2, speed: 4 });
    const result = await applyEssenceAttack(actor, 2, 'essenceStrengthSpeed');
    expect(actor.system.essences.strength.value).toBe(0);
    expect(actor.system.essences.speed.value).toBe(2);
    expect(result.applied).toBe(4);
    expect(result.zeroed).toEqual(['strength']);
  });

  test("an Essence already at 0 loses nothing more", async () => {
    const actor = makeActor({ strength: 0 });
    const result = await applyEssenceAttack(actor, 1, 'essenceStrength');
    expect(result.applied).toBe(0);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("'any' puts every point on the one Essence", async () => {
    const actor = makeActor();
    const result = await applyEssenceAttack(actor, 2, 'essenceAny', { random: () => 0.3 });
    expect(result.damaged).toEqual({ speed: 2 });
    expect(actor.system.essences.speed.value).toBe(1);
  });

  test("Immunity to the damage type stops it", async () => {
    const actor = makeActor({ immunities: { essenceStrength: true } });
    expect((await applyEssenceAttack(actor, 1, 'essenceStrength')).applied).toBe(0);
    expect((await applyEssenceAttack(actor, 1, 'essenceStrength', { ignoreImmunity: true })).applied).toBe(1);
  });

  test("a cancelled choice is reported so the button can stay live", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(null);
    const actor = makeActor();
    const result = await applyEssenceAttack(actor, 1, 'essenceAny', { attackerChooses: true });
    expect(result.cancelled).toBe(true);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("'swap' raises one Essence and lowers another, once, and logs it", async () => {
    const actor = makeActor();
    const result = await applyEssenceAttack(actor, 2, 'essenceSwap', { random: () => 0 });
    expect(result.swap).toEqual({ up: 'strength', down: 'speed' });
    expect(actor.system.essences.strength).toEqual({ max: 4, value: 4 });
    expect(actor.system.essences.speed).toEqual({ max: 2, value: 2 });
    expect(actor.flags.essence20[ESSENCE_MUTATIONS_FLAG]).toEqual([{ up: 'strength', down: 'speed' }]);
  });
});

describe("applyEssenceSwap", () => {
  test("never takes a score below 0 and keeps earlier changes", async () => {
    const actor = makeActor({ social: 0, flags: { essence20: { [ESSENCE_MUTATIONS_FLAG]: [{ up: 'speed', down: 'smarts' }] } } });
    await applyEssenceSwap(actor, 'smarts', 'social');
    expect(actor.system.essences.social).toEqual({ max: 0, value: 0 });
    expect(actor.system.essences.smarts).toEqual({ max: 4, value: 4 });
    expect(actor.flags.essence20[ESSENCE_MUTATIONS_FLAG]).toHaveLength(2);
  });
});

describe("describeEssenceAttack", () => {
  test("names the damage, any Essence at 0, a swap, or nothing", () => {
    const actor = makeActor();
    expect(describeEssenceAttack(actor, { applied: 1, damaged: { strength: 1 }, zeroed: ['strength'], swap: null }))
      .toBe('E20.EssenceAttackApplied<br>E20.EssenceAttackZero');
    expect(describeEssenceAttack(actor, { applied: 0, damaged: {}, zeroed: [], swap: { up: 'speed', down: 'social' } }))
      .toBe('E20.EssenceSwapApplied');
    expect(describeEssenceAttack(actor, { applied: 0, damaged: {}, zeroed: [], swap: null })).toBe('E20.EssenceAttackNone');
  });
});

describe("combat.mjs#applyDamage with an Essence damage type", () => {
  test("damages the Essence and leaves Health alone", async () => {
    const actor = makeActor();
    const applied = await applyDamage(actor, 1, 'essenceSpeed');
    expect(applied).toBe(1);
    expect(actor.system.essences.speed.value).toBe(2);
    expect(actor.system.health.value).toBe(10);
  });
});
