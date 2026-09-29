import { jest } from '@jest/globals';

const CCX = id => `Compendium.essence20.cobra_codex.Item.${id}`;

beforeAll(() => {
  global.Hooks = { on: jest.fn(), once: jest.fn(), callAll: jest.fn() };
  global.game = {
    i18n: { localize: k => k, format: (k, d) => `${k}:${JSON.stringify(d)}` },
    user: { id: 'u1', targets: new Set(), isGM: true },
    actors: [],
    combat: null,
    settings: { get: () => 0 },
  };
  global.CONFIG = {
    E20: {
      skillToEssence: { persuasion: 'social', science: 'smarts', athletics: 'strength' },
      skills: { persuasion: 'P', science: 'S', athletics: 'A' },
      availabilityDifficulties: { standard: 0, limited: 10 },
    },
    statusEffects: [],
  };
  global.foundry = { utils: { getProperty: (o, p) => p.split('.').reduce((a, k) => a?.[k], o), escapeHTML: s => s }, applications: { api: {} } };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.canvas = null;
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
});

let seq = 0;
function item(type, extra = {}) {
  return {
    id: extra.id ?? `i${seq++}`, name: extra.name ?? type, type,
    flags: { ...(extra.source ? { core: { sourceId: extra.source } } : {}), essence20: { ...(extra.flags ?? {}) } },
    system: extra.system ?? {},
    effects: extra.effects ?? [],
  };
}

function actor(items = [], system = {}, extra = {}) {
  const list = [...items];
  const flags = { essence20: { ...(extra.flags ?? {}) } };
  const a = {
    id: extra.id ?? 'a', uuid: extra.uuid ?? 'Actor.a', name: extra.name ?? 'Tester', type: extra.type ?? 'playerCharacter',
    system: { level: 10, ...system },
    flags,
    statuses: extra.statuses ?? new Set(),
    getFlag: (scope, key) => flags[scope]?.[key],
    items: Object.assign(list, { contents: list, get: id => list.find(i => i.id == id) }),
  };
  list.forEach(i => (i.parent = a));
  return a;
}

describe('gear', () => {
  let gear;
  beforeAll(async () => {
    gear = await import('./gear.mjs');
  });

  test('Adjustable Faceplate adds to Toughness closed, Evasion open, only when worn', () => {
    const armor = item('armor', { id: 'arm', system: { equipped: true } });
    const plate = item('upgrade', { source: CCX('kEJP9jn7Q0LLufmG'), flags: { parentId: 'arm' } });
    const a = actor([armor, plate]);
    expect(gear.faceplateBonus(a).defense).toBe('toughness');
    plate.flags.essence20.gij1Faceplate = 'open';
    expect(gear.faceplateBonus(a).defense).toBe('evasion');
    armor.system.equipped = false;
    expect(gear.faceplateBonus(a)).toBeNull();
  });

  test('Anonymous snags a repeat Outwit from an Inundation holder', () => {
    const target = actor([item('upgrade', { source: CCX('yFikSROr3NzaEoaL') })], {}, { uuid: 'Actor.t' });
    const attacker = actor([item('perk', { source: 'Compendium.essence20.gi_joe_crb.Item.Q09tkHIaVX65lokl' })], {}, {
      flags: { outwittedTargets: { 'Actor-t': true } },
    });
    expect(gear.anonymousSnag(attacker, target, { rolledSkill: 'deception' })?.snag).toBe(true);
    expect(gear.anonymousSnag(attacker, target, { rolledSkill: 'athletics' })).toBeNull();
    expect(gear.anonymousSnag(attacker, actor([], {}, { uuid: 'Actor.x' }), { rolledSkill: 'deception' })).toBeNull();
  });

  test('Ceremonial gives ↑1 to Persuasion only while stamped', () => {
    const a = actor([], {}, { flags: { gij1Ceremonial: { scene: 1 } } });
    expect(gear.ceremonialSource(a, { rolledSkill: 'persuasion' })?.shiftUp).toBe(1);
    expect(gear.ceremonialSource(a, { rolledSkill: 'science' })).toBeNull();
    expect(gear.ceremonialSource(actor(), { rolledSkill: 'persuasion' })).toBeNull();
  });

  test('Uniform penalty starts at 1 for a wearer', () => {
    expect(gear.uniformPenalty(actor([item('upgrade', { source: CCX('VkSI68BkpXLOC5ys') })]))).toBe(1);
    expect(gear.uniformPenalty(actor())).toBe(0);
  });
});

describe('perks', () => {
  let perks;
  beforeAll(async () => {
    perks = await import('./perks.mjs');
  });

  test('every Alteration-granting General Perk has a pick-an-Alteration Use, at its own tier', async () => {
    const { findExtUse } = await import('../../extensions.mjs');
    const tiers = {
      wCL3rJOEDZVHVg6g: ['standard', 'cybernetic'], eT4g9EfrFtvjMqWu: ['limited', 'cybernetic'], zGsTAngJ2HRdKPkz: ['restricted', 'cybernetic'],
      zuR9YJ2Wy956VGGy: ['standard', 'genetic'], '7cL4aUwJwqvbhYCz': ['limited', 'genetic'], RcGUjeMpsNDFjwmL: ['restricted', 'genetic'],
    };
    for (const [id, [availability, form]] of Object.entries(tiers)) {
      expect(perks.ALTERATION_PERKS[CCX(id)]).toEqual({ availability, form });
      const perk = item('perk', { source: CCX(id) });
      actor([perk]);
      const use = findExtUse(perk);
      expect(use?.id).toBe(`gij1Setup-${id}`);
      expect(use.canUse(perk)).toBe(true);
      perk.flags.essence20.granted = true;
      expect(use.canUse(perk)).toBe(false);
    }

    // Beast Mode's scene-long copies don't hand out a permanent Alteration.
    const beast = item('perk', { source: CCX('zuR9YJ2Wy956VGGy'), flags: { beastMode: true } });
    actor([beast]);
    expect(findExtUse(beast).canUse(beast)).toBe(false);
  });

  test('Chemist lists ↓1 on Persuasion; Cover Job ↑1 on its skill', () => {
    const a = actor([
      item('hangUp', { source: CCX('cHNytkkeP7iizzgK') }),
      item('perk', { source: CCX('3SiGvDR98s0FQtdf'), flags: { gij1Choice: { skill: 'persuasion', text: 'Lawyer' } } }),
    ]);
    const sources = perks.gij1Sources(a, null, { rolledSkill: 'persuasion' });
    expect(sources.find(s => s.id == 'gij1Chemist').shiftDown).toBe(1);
    expect(sources.some(s => s.id.startsWith('gij1CoverJob') && s.shiftUp == 1)).toBe(true);
    expect(perks.gij1Sources(a, null, { rolledSkill: 'science' })).toHaveLength(0);
  });

  test('toggles: Bootlicker ↑1, Double Life Edge + Specialized, Cover Job out of combat', () => {
    const dl = item('perk', { id: 'dl', source: CCX('Bl14FV81J88Um0Ls'), flags: { gij1Choice: { skill: 'science', text: 'Chemistry' } } });
    const a = actor([item('perk', { source: CCX('drtmA1p3q4y7LMTk') }), dl,
      item('perk', { id: 'cj', source: CCX('3SiGvDR98s0FQtdf'), flags: { gij1Choice: { skill: 'persuasion', text: 'Lawyer' } } })]);
    const names = perks.gij1Toggles(a, { rolledSkill: 'science', rolledEssence: 'smarts' }).map(t => t.name);
    expect(names).toEqual(expect.arrayContaining(['gij1Bootlicker', 'gij1DoubleLife-dl', 'gij1CoverJob-cj']));
    const options = { shiftUp: 0, ext: { gij1Bootlicker: true, 'gij1DoubleLife-dl': true } };
    perks.applyGij1Toggles(a, options);
    expect(options).toMatchObject({ shiftUp: 1, edge: true, isSpecialized: true });
  });

  test('Sea Legs: 30 with no swim, +15 on top of existing swim', () => {
    const legs = item('perk', { source: CCX('mKsSa2HBOimHqS7i') });
    const a = actor([legs], { movement: { swim: { total: 0 } } });
    perks.applySeaLegs(a);
    expect(a.system.movement.swim.total).toBe(30);
    const b = actor([item('perk', { source: CCX('mKsSa2HBOimHqS7i') })], { movement: { swim: { total: 20 } } });
    perks.applySeaLegs(b);
    expect(b.system.movement.swim.total).toBe(35);
  });

  test('Extract Poison qualifies in all poisons; Metier weapons drops the Assassin poison step', () => {
    const a = actor([item('perk', { source: CCX('0kcuvCeRhmneAJTl') })], {
      poisonTraining: 1, qualified: { poisons: {} }, trained: { poisons: {}, weapons: { silent: false } },
    });
    perks.applyTraining(a);
    expect(a.system.qualified.poisons).toEqual({ all: true, standard: true, limited: true });

    const origin = item('origin', { source: CCX('HCIbetyFvjJGuDcV'), effects: [{ disabled: false, changes: [{ key: 'system.poisonTraining' }] }] });
    const metier = item('perk', { source: CCX('EcVOkUJE40sKSg8v'), flags: { gij1Choice: { choice: 'silent' } } });
    const b = actor([origin, metier], { poisonTraining: 1, qualified: { poisons: {} }, trained: { poisons: {}, weapons: { silent: false } } });
    b._preparePoisonTraining = jest.fn();
    perks.applyTraining(b);
    expect(b.system.poisonTraining).toBe(0);
    expect(b._preparePoisonTraining).toHaveBeenCalled();
    expect(b.system.trained.weapons.silent).toBe(true);
  });

  test('Improvise Bomb: grenades and bombs only; Demolition Artist makes it Free', () => {
    const grenade = { name: 'Frag Grenade', system: { traits: ['consumable'], items: { a: { type: 'weaponEffect', classification: { style: 'explosive' } } } } };
    const missile = { name: 'Missile', system: { traits: ['consumable', 'mounted'], items: {} } };
    const rifle = { name: 'Rifle', system: { traits: [], items: {} } };
    expect(perks.isBombEntry(grenade)).toBe(true);
    expect(perks.isBombEntry(missile)).toBe(false);
    expect(perks.isBombEntry(rifle)).toBe(false);
    expect(perks.improviseCost(actor())).toBe('standard');
    expect(perks.improviseCost(actor([item('perk', { source: CCX('QzcZLhyVvdbn09Es') })]))).toBe('free');
  });

  test('Scavenger looks one availability step harder', () => {
    expect(perks.oneStepHarder('standard')).toBe('limited');
    expect(perks.oneStepHarder('restricted')).toBe('prototype');
    expect(perks.oneStepHarder('theoretical')).toBe('theoretical');
  });

  test('Primal Fear mark gives ↑1 against that target only', () => {
    const a = actor([], {}, { flags: { gij1PrimalFear: { targetUuid: 'Actor.t', scene: 1 } } });
    expect(perks.gij1Sources(a, { uuid: 'Actor.t' }, {}).some(s => s.id == 'gij1PrimalFear')).toBe(true);
    expect(perks.gij1Sources(a, { uuid: 'Actor.z' }, {})).toHaveLength(0);
  });

  test('Primal Fear needs the environment of expertise', () => {
    perks.setEnvironmentCheck(() => false);
    expect(perks.canPrimalFear(actor())).toBe(false);
    perks.setEnvironmentCheck(() => true);
    expect(perks.canPrimalFear(actor())).toBe(true);
  });

  test('Feed On Fear heals 1 up to max', async () => {
    const a = actor([], { health: { value: 2, max: 3 } });
    a.update = jest.fn();
    expect(await perks.healOne(a)).toBe(true);
    expect(a.update).toHaveBeenCalledWith({ 'system.health.value': 3 });
    const full = actor([], { health: { value: 3, max: 3 } });
    expect(await perks.healOne(full)).toBe(false);
  });
});

describe('conditions', () => {
  let conditions;
  beforeAll(async () => {
    conditions = await import('./conditions.mjs');
  });

  test('Asleep implies Prone and Unconscious; Defeated implies Prone', () => {
    const sleeper = actor([], {}, { statuses: new Set(['asleep']) });
    conditions.addImpliedStatuses(sleeper);
    expect([...sleeper.statuses].sort()).toEqual(['asleep', 'prone', 'unconscious']);
    const down = actor([], {}, { statuses: new Set(['defeated']) });
    conditions.addImpliedStatuses(down);
    expect(down.statuses.has('prone')).toBe(true);
    expect(down.statuses.has('unconscious')).toBe(false);
  });

  test('damage wakes a sleeper', async () => {
    const a = actor();
    a.effects = [{ statuses: new Set(['asleep']) }];
    a.toggleStatusEffect = jest.fn();
    expect(await conditions.wakeOnDamage(a, 1)).toBe(true);
    expect(a.toggleStatusEffect).toHaveBeenCalledWith('asleep', { active: false });
    expect(await conditions.wakeOnDamage(a, 0)).toBe(false);
  });
});
