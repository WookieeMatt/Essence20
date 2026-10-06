import { jest } from '@jest/globals';

beforeAll(() => {
  global.Hooks = { on: jest.fn(), once: jest.fn(), callAll: jest.fn() };
  global.game = { i18n: { localize: k => k, format: (k, d) => `${k}:${JSON.stringify(d)}` }, user: { id: 'u1' }, actors: [] };
  global.CONFIG = { E20: {}, statusEffects: [{ id: 'stunned', name: 'Stunned' }] };
  global.foundry = { utils: {}, applications: { api: {} } };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
});

const items = list => {
  const arr = [...list];
  arr.get = id => arr.find(i => i.id == id);
  return arr;
};

describe('equip gate', () => {
  test('suppresses transferred effects on unequipped armor only', async () => {
    const { isSuppressedWhileUnequipped } = await import('../../mechanics/characters/unequipped-armor-effect-gate.mjs');
    const make = (system, type = 'armor') => ({ parent: { transfer: true, parent: { documentName: 'Item', type, system } } });
    expect(isSuppressedWhileUnequipped(make({ equipped: false }))).toBe(true);
    expect(isSuppressedWhileUnequipped(make({ equipped: true }))).toBeUndefined();
    expect(isSuppressedWhileUnequipped(make({ equipped: false, isPowerArmor: true }))).toBeUndefined();
    expect(isSuppressedWhileUnequipped(make({ equipped: false }, 'weapon'))).toBeUndefined();
    expect(isSuppressedWhileUnequipped({ parent: { parent: { documentName: 'Actor' } } })).toBeUndefined();
  });
});

describe('armor rules', () => {
  test('Brawn requirement shortfall per die size', async () => {
    const { brawnShortfall, brawnRequirementSources } = await import('../defenses/armor-brawn-reinforced-shell.mjs');
    const armor = { id: 'a', name: 'Marauder Armor', type: 'armor', system: { equipped: true }, flags: { essence20: { brawnRequirement: 'd4' } } };
    const weak = { system: { skills: { brawn: { shift: 'd20' } } }, items: items([armor]) };
    const ok = { system: { skills: { brawn: { shift: 'd6' } } }, items: items([armor]) };
    expect(brawnShortfall(weak, armor)).toBe(2);
    expect(brawnShortfall(ok, armor)).toBe(0);
    expect(brawnRequirementSources(weak, { rolledEssence: 'strength' })[0].shiftDown).toBe(2);
    expect(brawnRequirementSources(weak, { rolledEssence: 'smarts' })).toEqual([]);
    expect(brawnRequirementSources(weak, { isAttack: true, rolledEssence: 'smarts' }).length).toBe(1);
    armor.system.equipped = false;
    expect(brawnRequirementSources(weak, { isAttack: true })).toEqual([]);
  });

  test('a BrawnRequirement rule bends the armor Brawn requirement (Over Brawn, The Heavy, Pack Mule - conv10-slC10)', async () => {
    const { brawnShortfall } = await import('../defenses/armor-brawn-reinforced-shell.mjs');
    const armor = { id: 'a', name: 'Marauder Armor', type: 'armor', system: { equipped: true }, flags: { essence20: { brawnRequirement: 'd8' } } };
    const perk = rule => ({ id: 'p', type: 'perk', flags: {}, system: { rules: [{ type: 'BrawnRequirement', ...rule }] } });
    const withPerk = rule => ({ system: { skills: { brawn: { shift: 'd20' } } }, items: items([armor, perk(rule)]) });
    expect(brawnShortfall(withPerk({ amount: 2 }), armor)).toBe(2);
    expect(brawnShortfall(withPerk({ ignore: true }), armor)).toBe(0);
  });
});

describe('weapon rules', () => {
  test('on-hit status spec and rounds', async () => {
    const { onHitStatusOf, resolveRounds, onHitStatusCard } = await import('../attacks/on-hit-status-drive-by.mjs');
    const item = { flags: { essence20: { onHitStatus: { status: 'stunned', rounds: '2d2' } } } };
    expect(onHitStatusOf(item).status).toBe('stunned');
    expect(onHitStatusOf({ flags: {} })).toBeNull();
    expect(await resolveRounds('3')).toBe(3);
    expect(await resolveRounds('')).toBeNull();
    global.Roll = class {
      async evaluate() {
        return { total: 3 };
      }
    };
    expect(await resolveRounds('2d2')).toBe(3);
    const card = onHitStatusCard({}, item, { name: 'Foe', uuid: 'Actor.x' }, onHitStatusOf(item));
    expect(card).toContain('data-e20-ext="d1OnHitStatus"');
    expect(card).toContain('data-rounds="2d2"');
  });

  test('Drive-By needs 15ft moved on the actor\'s own turn', async () => {
    const { driveByShortfall, noteMovement, feetMovedThisTurn } = await import('../attacks/on-hit-status-drive-by.mjs');
    const actor = { id: 'v1' };
    const combat = { id: 'c', round: 1, turn: 0, started: true, combatant: { actor } };
    const ram = { type: 'weaponEffect', system: { isRam: true }, actor };
    expect(driveByShortfall(ram, {}, combat)).toEqual({ feet: 0 });
    noteMovement(actor, 10, combat);
    expect(driveByShortfall(ram, {}, combat)).toEqual({ feet: 10 });
    noteMovement(actor, 5, combat);
    expect(feetMovedThisTurn(actor, combat)).toBe(15);
    expect(driveByShortfall(ram, {}, combat)).toBeNull();
    expect(driveByShortfall(ram, {}, { ...combat, turn: 1 })).toEqual({ feet: 0 });
    expect(driveByShortfall({ type: 'weaponEffect', system: {}, actor }, {}, combat)).toBeNull();
    expect(driveByShortfall(ram, { rollType: 'info' }, combat)).toBeNull();
    expect(driveByShortfall(ram, {}, { ...combat, started: false })).toBeNull();
  });
});

describe('Dino Thunder', () => {
  const mkItem = (uuid, flags = {}) => {
    const item = { flags: { core: { sourceId: uuid }, essence20: { ...flags } } };
    item.setFlag = jest.fn(async (scope, key, value) => {
      item.flags.essence20[key] = value;
    });
    return item;
  };

  test('powers, Boost pool, and paying', async () => {
    const { DINO, formPowersOf, boostPool, payFormPower, refillBoost, mimicOptions } = await import('../forms/dino-thunder-grid-powers.mjs');
    const form = mkItem(DINO.form, { zord1DinoPower: 'triceraSkin' });
    const extra = mkItem(DINO.extra, { zord1DinoPower: 'tRexSpeed' });
    const boost = mkItem(DINO.boost);
    const actor = { id: 'a', name: 'A', type: 'playerCharacter', items: items([form, extra, boost]), system: { powers: { personal: { value: 1 } } } };
    actor.update = jest.fn(async () => {
      actor.system.powers.personal.value -= 1;
    });
    expect(formPowersOf(actor)).toEqual(['triceraSkin', 'tRexSpeed']);
    expect(boostPool(actor)).toBe(3);
    expect(await payFormPower(actor)).toBe('boost');
    expect(boostPool(actor)).toBe(2);
    expect(await payFormPower(actor, { boostAllowed: false })).toBe('personal');
    expect(actor.system.powers.personal.value).toBe(0);
    await payFormPower(actor);
    await payFormPower(actor);
    expect(await payFormPower(actor)).toBeNull();
    await refillBoost(actor);
    expect(boostPool(actor)).toBe(3);

    const mate = { id: 'b', name: 'B', type: 'playerCharacter', items: items([mkItem(DINO.form, { zord1DinoPower: 'pteraScream' })]) };
    global.game.actors = [actor, mate];
    expect(mimicOptions(actor).map(o => o.key)).toEqual(['triceraSkin', 'tRexSpeed', 'pteraScream']);
  });
});
