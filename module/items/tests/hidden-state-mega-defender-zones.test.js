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
    await expect(import('../index.mjs')).resolves.toBeDefined();
    const { registrySnapshot } = await import('../../mechanics/item-hooks.mjs');
    const ids = registrySnapshot().uses.map(u => u.id);
    // Dabbler is an item rule (rules/conv10-slE10.test.js).
    expect(ids).not.toContain('o3Dabbler');
    expect(ids).toEqual(expect.arrayContaining(['o3SelfImprovement', 'o3GuardianBlast', 'o3MegaDefender', 'o3Scramble', 'o3PerfectPlacement']));
  });
});

// Gluten-Tolerant's Weird refusal is a Veto rule on the Hang-Up now (rules/conv10-slB10.test.js).

describe('mlp', () => {
  let m;
  beforeAll(async () => {
    m = await import('../social/betrayal-self-improvement.mjs');
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
    h = await import('../../mechanics/actions/hidden-state.mjs');
  });

  // Pop Out / Telltale Sign are rules now (module/rules/conv11-slG11.test.js).
  test('Hidden lasts for the scene it was set in', () => {
    expect(h.isHidden(actor([], {}, { flags: { o3Hidden: { epoch: 1 } } }))).toBe(true);
    expect(h.isHidden(actor([], {}, { flags: { o3Hidden: { epoch: 0 } } }))).toBe(false);
  });
});

describe('pr', () => {
  let p;
  beforeAll(async () => {
    p = await import('../forms/mega-defender.mjs');
  });

  test('Guardian Blast is a Group Skill Test', () => {
    expect(p.guardianTally([{ success: true }, { success: false }], 2).success).toBe(true);
    expect(p.guardianTally([{ success: true }, { success: false }, null], 3).success).toBe(false);
  });

  test('Mega Defender needs the Torozord on the scene, and pairs it with the Ranger', () => {
    const toro = { id: 'z1', uuid: 'Actor.z1', type: 'zord', name: 'Torozord', system: { actions: { free: { max: 3 } } } };
    const ranger = actor([], { actors: { k: { uuid: 'Actor.z1' } }, actions: { free: { max: 1 } } }, { uuid: 'Actor.r1' });
    global.fromUuidSync = uuid => (uuid == 'Actor.z1' ? toro : null);
    global.canvas = { scene: { tokens: [] } };
    expect(p.presentTorozord(ranger)).toBeNull();
    global.canvas.scene.tokens = [{ actorId: 'z1' }];
    expect(p.presentTorozord(ranger)).toBe(toro);

    // The form is active this scene (the scene counter falls back to 1 when unset).
    ranger.flags.essence20.o3MegaDefender = { epoch: 1, prevHealth: 5, torozordUuid: 'Actor.z1' };
    global.game.actors = [ranger, toro];
    expect(p.megaDefenderPartner(ranger)).toBe(toro);
    expect(p.megaDefenderPartner(toro)).toBe(ranger);
    // The pair has the higher Free count: the Ranger is topped up by 2, the Torozord by nothing.
    expect(p.sharedFreeTopUp(ranger, toro)).toBe(2);
    expect(p.sharedFreeTopUp(toro, ranger)).toBe(0);
    delete global.fromUuidSync;
    delete global.canvas;
  });

  test('a shared spend lands on the partner only if their turn is still to come this round', () => {
    const combat = { turn: 1, turns: [{ actor: { id: 'a' } }, { actor: { id: 'b' } }, { actor: { id: 'c' } }] };
    expect(p.turnStillToCome({ id: 'c' }, combat)).toBe(true);
    expect(p.turnStillToCome({ id: 'a' }, combat)).toBe(false);
    expect(p.turnStillToCome({ id: 'x' }, combat)).toBe(false);
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
    t = await import('../attacks/attack-zones-scramble-field.mjs');
  });

  test('Again and Again shifts ↓1 then ↓3', () => {
    expect(t.againShift(1)).toBe(1);
    expect(t.againShift(2)).toBe(3);
  });

  test('Perfect Placement needs the whole token inside the square', () => {
    const zone = { x: 250, y: 250 };
    expect(t.whollyInside({ x: 150, y: 150, width: 100, height: 100 }, zone, 20)).toBe(true);
    expect(t.whollyInside({ x: 450, y: 150, width: 100, height: 100 }, zone, 20)).toBe(false);
  });

  test('a Scrambled target rolls Alertness at ↓2', async () => {
    const { extRollSources } = await import('../../mechanics/item-hooks.mjs');
    const a = actor([], {}, { flags: { o3Scramble: { by: 'Actor.x', mode: 'alertness', epoch: 1 } } });
    const out = extRollSources(a, null, { rolledSkill: 'alertness' });
    expect(out.sources.some(s => s.id == 'ext-o3ScrambleAlertness' && s.shiftDown == 2)).toBe(true);
  });
});

// Metallic Armor Power Up's one Use button: switches the Power on, or ends it while it's on.
test('Metallic Armor Power Up: one Use that switches it on or ends it', async () => {
  const { findExtUse } = await import('../../mechanics/item-hooks.mjs');
  const { O3 } = await import('../shared/turn-stamps-and-sides.mjs');
  await import('../forms/mega-defender.mjs');
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
