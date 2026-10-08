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

  test('an equipped shield\'s printed Brawn requirement (its requirements text) counts the same way', async () => {
    const { brawnShortfall, brawnRequirementSources, shieldBrawnRequirement } = await import('../defenses/armor-brawn-reinforced-shell.mjs');
    expect(shieldBrawnRequirement({ system: { requirements: 'Brawn d4' } })).toBe('d4');
    expect(shieldBrawnRequirement({ system: { requirements: 'Brawn +d6' } })).toBe('d6');
    expect(shieldBrawnRequirement({ system: { requirements: '' } })).toBeNull();
    expect(shieldBrawnRequirement({ system: { requirements: null } })).toBeNull();
    expect(shieldBrawnRequirement({ system: { requirements: 'Science d4' } })).toBeNull();

    const shield = { id: 's', name: 'Rhino Sentry Shields', type: 'shield', system: { equipped: true, requirements: 'Brawn +d6' }, flags: {} };
    const weak = { system: { skills: { brawn: { shift: 'd4' } } }, items: items([shield]) };
    expect(brawnShortfall(weak, shield)).toBe(1);
    const [source] = brawnRequirementSources(weak, { isAttack: true });
    expect(source).toEqual(expect.objectContaining({ id: 'd1BrawnReq-s', shiftDown: 1 }));
    expect(source.label).toContain('"req":"d6"');
    shield.system.equipped = false;
    expect(brawnRequirementSources(weak, { isAttack: true })).toEqual([]);

    const plain = { id: 'p', name: 'Riot Shield', type: 'shield', system: { equipped: true, requirements: '' }, flags: {} };
    expect(brawnRequirementSources({ system: { skills: { brawn: { shift: 'd20' } } }, items: items([plain]) }, { isAttack: true })).toEqual([]);
  });

  test('a BrawnRequirement rule bends the armor Brawn requirement (Over Brawn, The Heavy, Pack Mule - conv10-slC10)', async () => {
    const { brawnShortfall } = await import('../defenses/armor-brawn-reinforced-shell.mjs');
    const armor = { id: 'a', name: 'Marauder Armor', type: 'armor', system: { equipped: true }, flags: { essence20: { brawnRequirement: 'd8' } } };
    const perk = rule => ({ id: 'p', type: 'perk', flags: {}, system: { rules: [{ type: 'BrawnRequirement', ...rule }] } });
    const withPerk = rule => ({ system: { skills: { brawn: { shift: 'd20' } } }, items: items([armor, perk(rule)]) });
    expect(brawnShortfall(withPerk({ amount: 2 }), armor)).toBe(2);
    expect(brawnShortfall(withPerk({ ignore: true }), armor)).toBe(0);
    // A weapons-only rule (Ordnance Expert) leaves armor alone.
    expect(brawnShortfall(withPerk({ amount: 4, equipment: 'weapon' }), armor)).toBe(4);
  });

  describe("a weapon's Brawn requirement (GI Joe CRB p.117, TF CRB p.97/p.114, PR CRB p.81)", () => {
    const weapon = (shift, extra = {}) => ({
      id: 'w', name: 'M2 Machine Gun', type: 'weapon', flags: {},
      system: { requirements: { skill: 'brawn', shift }, hardpoint: { type: 'external' }, ...extra },
    });
    const effectOf = w => ({ id: 'e', type: 'weaponEffect', flags: { essence20: { parentId: w.id } } });
    const holder = (brawn, list, system = {}) => ({ system: { skills: { brawn: { shift: brawn } }, ...system }, items: items(list) });

    test('↓1 per die size of Brawn short, on attacks with that weapon only', async () => {
      const { weaponBrawnShortfall, weaponBrawnSources } = await import('../defenses/armor-brawn-reinforced-shell.mjs');
      const gun = weapon('d6');
      const effect = effectOf(gun);
      const weak = holder('d2', [gun, effect]);
      expect(weaponBrawnShortfall(weak, gun)).toBe(2);
      expect(weaponBrawnShortfall(holder('d6', [gun]), gun)).toBe(0);
      const [source] = weaponBrawnSources(weak, { isAttack: true, item: effect });
      expect(source).toEqual(expect.objectContaining({ id: 'd1BrawnReqWeapon-w', shiftDown: 2 }));
      expect(source.label).toContain('"req":"d6"');
      expect(weaponBrawnSources(weak, { isAttack: false, item: effect })).toEqual([]);
      expect(weaponBrawnSources(weak, { isAttack: true, item: { type: 'weaponEffect', flags: {} } })).toEqual([]);
    });

    test('only a Brawn requirement counts; none / another Skill is no penalty', async () => {
      const { weaponBrawnRequirement } = await import('../defenses/armor-brawn-reinforced-shell.mjs');
      expect(weaponBrawnRequirement(weapon('none'))).toBeNull();
      expect(weaponBrawnRequirement({ system: { requirements: { skill: 'finesse', shift: 'd4' } } })).toBeNull();
      expect(weaponBrawnRequirement({ system: {} })).toBeNull();
    });

    test("a Transformer reads the Integrated Hardpoint's lowered requirement; anyone else the printed one", async () => {
      const { weaponBrawnRequirement } = await import('../defenses/armor-brawn-reinforced-shell.mjs');
      const integrated = weapon('d4', { hardpoint: { type: 'integrated' }, effectiveBrawnReq: 'd2' });
      expect(weaponBrawnRequirement(integrated, { system: { canTransform: true } })).toBe('d2');
      expect(weaponBrawnRequirement(integrated, { system: { canTransform: false } })).toBe('d4');
      expect(weaponBrawnRequirement(weapon('d4', { hardpoint: { type: 'integrated' }, effectiveBrawnReq: 'none' }), { system: { canTransform: true } })).toBeNull();
    });

    test('"Brawn d4/Huge": a big enough character meets it without the Brawn; a Brawn tag on its own still counts', async () => {
      const { weaponBrawnShortfall, meetsBrawnAlternative } = await import('../defenses/armor-brawn-reinforced-shell.mjs');
      const rocket = weapon('d4', { prerequisites: { when: [{ any: ['self:skill:brawn>=d4', 'self:size>=huge'] }] } });
      expect(weaponBrawnShortfall(holder('d20', [rocket], { size: 'huge' }), rocket)).toBe(0);
      expect(weaponBrawnShortfall(holder('d20', [rocket], { size: 'common' }), rocket)).toBe(2);
      expect(meetsBrawnAlternative(holder('d20', [rocket], { size: 'gigantic' }), rocket)).toBe(true);

      // The Forge of Solus Prime prints a Brawn floor of its own: size never waives it.
      const forge = weapon('d8', { prerequisites: { when: ['self:size>=huge', 'self:skill:brawn>=d8', { any: ['self:skill:brawn>=d10', 'self:size>=towering'] }] } });
      expect(meetsBrawnAlternative(holder('d20', [forge], { size: 'towering' }), forge)).toBe(false);
      expect(weaponBrawnShortfall(holder('d4', [forge], { size: 'towering' }), forge)).toBe(2);
    });

    test('BrawnRequirement rules: The Heavy (both), Ordnance Expert (weapons only), Over Brawn (ignore)', async () => {
      const { weaponBrawnShortfall } = await import('../defenses/armor-brawn-reinforced-shell.mjs');
      const gun = weapon('d8');
      const perk = rule => ({ id: 'p', type: 'perk', flags: {}, system: { rules: [{ type: 'BrawnRequirement', ...rule }] } });
      expect(weaponBrawnShortfall(holder('d20', [gun, perk({ amount: 2 })]), gun)).toBe(2);
      expect(weaponBrawnShortfall(holder('d20', [gun, perk({ amount: 4, equipment: 'weapon' })]), gun)).toBe(0);
      expect(weaponBrawnShortfall(holder('d20', [gun, perk({ amount: 4, equipment: 'armor' })]), gun)).toBe(4);
      expect(weaponBrawnShortfall(holder('d20', [gun, perk({ ignore: true })]), gun)).toBe(0);
    });
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
