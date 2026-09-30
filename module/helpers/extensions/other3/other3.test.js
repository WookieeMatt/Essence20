import { jest } from '@jest/globals';

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
      skillToEssence: { might: 'strength', athletics: 'strength', brawn: 'strength', science: 'smarts', alertness: 'smarts', spellcasting: 'any', infiltration: 'speed' },
      skillsByEssence: { strength: ['athletics', 'brawn', 'might'] },
      skillShiftList: ['criticalSuccess', 'autoSuccess', '3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20', 'autoFail', 'fumble'],
      weaponRequirementShiftLadder: ['none', 'd2', 'd4', 'd6', 'd8', 'd10', 'd12', '2d8', '3d6'],
      defenses: { toughness: 'T', evasion: 'E', willpower: 'W', cleverness: 'C' },
    },
    statusEffects: [],
  };
  global.foundry = {
    utils: {
      randomID: () => 'r',
      escapeHTML: s => s,
      getProperty: (o, p) => p.split('.').reduce((a, k) => a?.[k], o),
      setProperty: (o, p, v) => {
        const keys = p.split('.');
        const last = keys.pop();
        const target = keys.reduce((a, k) => (a[k] ??= {}), o);
        target[last] = v;
      },
    },
    applications: { api: {} },
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.canvas = null;
});

const C = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
let seq = 0;
function item(type, extra = {}) {
  return {
    id: extra.id ?? `i${seq++}`, name: extra.name ?? type, type,
    flags: { ...(extra.source ? { core: { sourceId: extra.source } } : {}), essence20: { ...(extra.flags ?? {}) } },
    system: extra.system ?? {},
  };
}

function actor(items = [], system = {}, extra = {}) {
  const list = [...items];
  const a = {
    id: extra.id ?? `a${seq++}`, uuid: extra.uuid ?? `Actor.${seq++}`, name: extra.name ?? 'Tester', type: extra.type ?? 'playerCharacter',
    system: { level: 10, ...system },
    statuses: new Set(extra.statuses ?? []),
    flags: { essence20: { ...(extra.flags ?? {}) } },
    items: Object.assign(list, { contents: list, get: id => list.find(i => i.id == id) }),
  };
  list.forEach(i => (i.parent = a));
  return a;
}

describe('other3 loads', () => {
  test('the entry module registers without throwing', async () => {
    await expect(import('./index.mjs')).resolves.toBeDefined();
    const { registrySnapshot } = await import('../../extensions.mjs');
    const ids = registrySnapshot().uses.map(u => u.id);
    expect(ids).toEqual(expect.arrayContaining(['o3Dabbler', 'o3SelfImprovement', 'o3FollowMe', 'o3GuardianBlast', 'o3MegaDefender', 'o3Scramble', 'o3PerfectPlacement', 'o3Overcharge']));
  });
});

describe('wtnv', () => {
  let w;
  beforeAll(async () => {
    w = await import('./wtnv.mjs');
  });

  test('Dazed sets Evasion to 9 + Speed on top of other bonuses', () => {
    const a = actor([item('hangUp', { source: C('wtnv_citizens_guide', 'byRfPI0ud1wj43Qv') })], {
      essences: { speed: { max: 3 }, smarts: { max: 2 } },
      defenses: { evasion: { base: 10, essence: 'speed', total: 15, string: 'x' }, willpower: { base: 10, essence: 'smarts', total: 12, string: 'y' } },
    });
    w.applyDefenseOverrides(a);
    expect(a.system.defenses.evasion.total).toBe(14);
    expect(a.system.defenses.evasion.string).toContain('- 1 (Dazed)');
    expect(a.system.defenses.willpower.total).toBe(12);
  });

  test('Naive sets Willpower to 9 + Smarts', () => {
    const a = actor([item('hangUp', { source: C('wtnv_citizens_guide', 'gT3jMGYcF8Gbi0O5') })], {
      essences: { smarts: { max: 2 } },
      defenses: { willpower: { base: 10, essence: 'smarts', total: 12, string: '' } },
    });
    w.applyDefenseOverrides(a);
    expect(a.system.defenses.willpower.total).toBe(11);
  });

  test('Gluten-Tolerant refuses the Weird Perk', () => {
    const a = actor([item('hangUp', { source: C('wtnv_citizens_guide', 'dzYRdi2cSlZSHozs') })]);
    expect(w.blocksWeird(a, { flags: { core: { sourceId: C('wtnv_citizens_guide', 'RO0a3eX8MIo5g1Tv') } } })).toBe(true);
    expect(w.blocksWeird(actor(), { flags: { core: { sourceId: C('wtnv_citizens_guide', 'RO0a3eX8MIo5g1Tv') } } })).toBe(false);
  });
});

describe('mlp', () => {
  let m;
  beforeAll(async () => {
    m = await import('./mlp.mjs');
  });

  test('skill steps move along the ladder', () => {
    expect(m.stepShift('d2', 1)).toBe('d4');
    expect(m.stepShift('d2', -1)).toBe('d20');
    expect(m.canLower('d20')).toBe(false);
    expect(m.canLower('d2')).toBe(true);
    expect(m.canRaise('d12')).toBe(false);
    expect(m.canRaise('d20')).toBe(true);
  });

  test('Dabbler raises a skill of the same Essence, or Spellcasting', () => {
    const a = actor([], { skills: { athletics: { shift: 'd4' }, brawn: { shift: 'd20' }, science: { shift: 'd20' }, spellcasting: { shift: 'd20' }, might: { shift: 'd12' } } });
    expect(m.dabblerRaiseOptions(a, 'athletics').sort()).toEqual(['brawn', 'spellcasting']);
  });

  test('Self Improvement raises the Essence, its Defenses and the Skill for the scene', () => {
    const a = actor([], {
      essences: { strength: { max: 2, value: 2 } },
      defenses: { toughness: { essence: 'strength', total: 12, string: '' }, evasion: { essence: 'speed', total: 11, string: '' } },
      skills: { might: { shiftUp: 0 } },
    }, { flags: { o3SelfImprovement: { epoch: 1, entries: [{ essence: 'strength', skill: 'might' }] } } });
    m.applySelfImprovement(a);
    expect(a.system.essences.strength.max).toBe(3);
    expect(a.system.defenses.toughness.total).toBe(13);
    expect(a.system.defenses.evasion.total).toBe(11);
    expect(a.system.skills.might.shiftUp).toBe(1);
  });

  test('a stale-scene Self Improvement does nothing', () => {
    const a = actor([], { essences: { strength: { max: 2, value: 2 } } }, { flags: { o3SelfImprovement: { epoch: 0, entries: [{ essence: 'strength' }] } } });
    m.applySelfImprovement(a);
    expect(a.system.essences.strength.max).toBe(2);
  });

  test('Betrayal splits PCs until a heal lands', () => {
    const traitor = actor([], {}, { uuid: 'Actor.traitor' });
    const failed = actor([], {}, { uuid: 'Actor.failed', flags: { o3Betrayal: { assister: 'Actor.traitor', epoch: 1, at: 10 } } });
    const other = actor([], {}, { uuid: 'Actor.other' });
    game.actors = [traitor, failed, other];
    expect(m.isBetrayed(traitor)).toBe(true);
    expect(m.betrayalSplits(other, traitor)).toBe(true);
    expect(m.betrayalSplits(other, failed)).toBe(false);
    other.flags.essence20.o3BetrayalHealed = { assister: 'Actor.traitor', epoch: 1, at: 20 };
    expect(m.isBetrayed(traitor)).toBe(false);
    game.actors = [];
  });
});

describe('hide', () => {
  let h;
  beforeAll(async () => {
    h = await import('./hide.mjs');
  });

  test('Now You Don\'t adds 5 only in Alt Mode', () => {
    const perk = () => item('perk', { source: C('tf_crb', 'iW9TjN9X6SsYm2Ql') });
    expect(h.nowYouDontBonus(actor([perk()], { isTransformed: true }))).toBe(5);
    expect(h.nowYouDontBonus(actor([perk()], { isTransformed: false }))).toBe(0);
  });

  test('observers use the higher of Willpower and Cleverness', () => {
    expect(h.observerDefense({ system: { defenses: { willpower: { total: 12 }, cleverness: { total: 14 } } } })).toBe(14);
  });

  test('Hidden lasts for the scene it was set in', () => {
    expect(h.isHidden(actor([], {}, { flags: { o3Hidden: { epoch: 1 } } }))).toBe(true);
    expect(h.isHidden(actor([], {}, { flags: { o3Hidden: { epoch: 0 } } }))).toBe(false);
  });
});

describe('pr', () => {
  let p;
  beforeAll(async () => {
    p = await import('./pr.mjs');
  });

  test('Follow Me! adds one per follower and drops each by their d4 (min 1)', () => {
    expect(p.followMeResults(13, [1, 3, 3])).toEqual({ leader: 16, followers: [15, 13, 13] });
    expect(p.followMeResults(1, [4])).toEqual({ leader: 2, followers: [1] });
  });

  test('Guardian Blast is a Group Skill Test', () => {
    expect(p.guardianTally([{ success: true }, { success: false }], 2).success).toBe(true);
    expect(p.guardianTally([{ success: true }, { success: false }, null], 3).success).toBe(false);
  });

  test('Mega Defender replaces Strength, Speed, Health, Defenses and Movement', () => {
    const a = actor([], {
      essences: { strength: { max: 3, value: 3 }, speed: { max: 2, value: 2 } },
      health: { max: 6 },
      defenses: { toughness: { total: 14 }, evasion: { total: 12 }, willpower: { total: 11 } },
      movement: { ground: { total: 30 }, aerial: { total: 20 } },
    }, { flags: { o3MegaDefender: { epoch: 1, prevHealth: 4 } } });
    p.applyMegaDefender(a);
    expect(a.system.essences.strength.max).toBe(8);
    expect(a.system.health.max).toBe(8);
    expect(a.system.defenses.toughness.total).toBe(18);
    expect(a.system.defenses.willpower.total).toBe(11);
    expect(a.system.movement.ground.total).toBe(40);
    expect(a.system.movement.aerial.total).toBe(0);
  });

  test('Void Touched trades a point down for one more up, and back', () => {
    const a = actor([], { essences: { strength: { max: 3 }, speed: { max: 2 } } });
    expect(p.voidTouchedUpdate(a, 'strength', 'speed')).toEqual({ 'system.essences.strength.max': 2, 'system.essences.speed.max': 3 });
    expect(p.voidTouchedUpdate(a, 'strength', 'speed', -1)).toEqual({ 'system.essences.strength.max': 4, 'system.essences.speed.max': 1 });
  });

  test('Better Together pairs the chosen ally either way round', () => {
    const b = actor([], {}, { uuid: 'Actor.b' });
    const a = actor([item('perk', { source: C('through_the_shattered_grid', 'tOoyMHVtV6wjvlxd'), flags: { o3Partner: 'Actor.b' } })], {}, { uuid: 'Actor.a' });
    expect(p.isPair(a, b)).toBe(true);
    expect(p.isPair(b, a)).toBe(true);
    expect(p.isPair(a, actor())).toBe(false);
    game.actors = [a, b];
    a.flags.essence20.o3BetterTogether = { with: 'Actor.b', epoch: 1, until: null };
    expect(p.betterTogetherActive(b)).toBe(true);
    game.actors = [];
  });

  test('Minions are tagged NPCs or Putties', async () => {
    expect(await p.isMinion({ type: 'npc', name: 'Putty Patroller', system: {} })).toBe(true);
    expect(await p.isMinion({ type: 'npc', name: 'Goldar', system: { creatureTags: 'minion' } })).toBe(true);
    expect(await p.isMinion({ type: 'npc', name: 'Goldar', system: {} })).toBe(false);
    expect(await p.isMinion({ type: 'playerCharacter', name: 'Jason', system: {} })).toBe(false);
  });
});

describe('tf', () => {
  let t;
  beforeAll(async () => {
    t = await import('./tf.mjs');
  });

  test('Holographic Sights hands back a multi-target penalty', () => {
    const weapon = item('weapon', { id: 'w1' });
    const effect = item('weaponEffect', { flags: { parentId: 'w1' }, system: { numTargets: 2, shiftDown: 1, classification: { skill: 'targeting' } } });
    const sights = item('upgrade', { source: C('quartermasters_guide_to_gear', 'aapIJuPKyMaGjb4U'), flags: { parentId: 'w1' } });
    const a = actor([weapon, effect, sights]);
    expect(t.holographicShift(a, effect)).toBe(1);
    const single = item('weaponEffect', { flags: { parentId: 'w1' }, system: { numTargets: 1, shiftDown: 1, classification: { skill: 'targeting' } } });
    expect(t.holographicShift(a, single)).toBe(0);
  });

  test('EM Protective Lining counts only on worn armor or in alt mode', () => {
    const armor = item('armor', { id: 'ar', system: { equipped: true } });
    const lining = item('upgrade', { source: C('enigma_of_combination', 'SIGEfpjEe1H06dVM'), flags: { parentId: 'ar' } });
    expect(t.isLined(actor([armor, lining]))).toBe(true);
    armor.system.equipped = false;
    expect(t.isLined(actor([armor, lining]))).toBe(false);
  });

  test('requirements drop two dice, never below d2', () => {
    expect(t.lowerRequirement('d6')).toBe('d2');
    expect(t.lowerRequirement('d8')).toBe('d4');
    expect(t.lowerRequirement('d4')).toBe('d2');
    expect(t.lowerRequirement('none')).toBe('none');
  });

  test('Pistol Whip and Specialty Flexibility generate their alternates', () => {
    const gun = item('weapon', { id: 'g', name: 'Blaster', system: { traits: ['ballistic'], hardpoint: { type: 'external' } } });
    const lrr = item('weapon', { id: 'l', name: 'Long Range Rifle', system: { traits: ['ballistic'], hardpoint: { type: 'integrated' } } });
    const a = actor([gun, lrr,
      item('perk', { source: C('tf_crb', 'fiSowblyLmO9dN8F') }), item('perk', { source: C('tf_crb', '2XuM8xyiRhMdNBMg') })]);
    const keys = t.desiredO3Effects(a).map(w => w.key);
    expect(keys).toEqual(expect.arrayContaining(['g:pistolWhipStun', 'g:pistolWhipBlunt', 'g:pistolWhipManeuver', 'l:sfStun', 'l:sfIntimidate', 'l:sfManeuver']));
    expect(keys).not.toContain('l:pistolWhipStun');
  });

  test('Again and Again shifts ↓1 then ↓3', () => {
    expect(t.againShift(1)).toBe(1);
    expect(t.againShift(2)).toBe(3);
  });

  test('Overcharge rounds up to 5 feet', () => {
    expect(t.overchargeFeet(17)).toBe(20);
    expect(t.overchargeFeet(20)).toBe(20);
  });

  test('Perfect Placement needs the whole token inside the square', () => {
    const zone = { x: 250, y: 250 };
    expect(t.whollyInside({ x: 150, y: 150, width: 100, height: 100 }, zone, 20)).toBe(true);
    expect(t.whollyInside({ x: 450, y: 150, width: 100, height: 100 }, zone, 20)).toBe(false);
  });

  test('Precise Chronometrics caps at Smarts', () => {
    expect(t.chronoValid({ a: 4, b: 4 }, 8)).toBe(true);
    expect(t.chronoValid({ a: 5, b: 4 }, 8)).toBe(false);
    expect(t.chronoValid({ a: 0 }, 8)).toBe(false);
  });

  test('a Scrambled target rolls Alertness at ↓2', async () => {
    const { extRollSources } = await import('../../extensions.mjs');
    const a = actor([], {}, { flags: { o3Scramble: { by: 'Actor.x', mode: 'alertness', epoch: 1 } } });
    const out = extRollSources(a, null, { rolledSkill: 'alertness' });
    expect(out.sources.some(s => s.id == 'ext-o3ScrambleAlertness' && s.shiftDown == 2)).toBe(true);
  });
});

// Metallic Armor Power Up's one Use button: switches the Power on, or ends it while it's on.
test('Metallic Armor Power Up: one Use that switches it on or ends it', async () => {
  const { findExtUse } = await import('../../extensions.mjs');
  const { O3 } = await import('./shared.mjs');
  await import('./pr.mjs');
  const actor = { flags: { essence20: {} } };
  const power = { type: 'power', system: { canActivate: true }, flags: { core: { sourceId: O3.metallicArmor } }, parent: actor };
  const use = findExtUse(power);
  expect(use?.id).toBe('o3MetallicArmorEnd');
  expect(use.canUse(power)).toBe(true);

  actor.flags.essence20.metallicArmorActive = true;
  power.system.canActivate = false;
  expect(use.canUse(power)).toBe(true);

  actor.flags.essence20.metallicArmorActive = false;
  expect(use.canUse(power)).toBe(false);
});
