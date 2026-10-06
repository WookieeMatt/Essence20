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

let seq = 0;
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
    expect(ids).toEqual(expect.arrayContaining(['o3MegaDefender']));
  });
});

// Gluten-Tolerant's Weird refusal is a Veto rule on the Hang-Up now (rules/conv10-slB10.test.js).

describe('mlp', () => {
  let m;
  beforeAll(async () => {
    m = { ...(await import('../social/betrayal.mjs')) };
  });

  // Self Improvement is the spell's own rules (rules/conv15-items2.test.js).

  // The Hang-Up's rules set the mark and heal it (rules/conv17-perm.test.js); this is the reader.
  test('Betrayal splits PCs while the betrayer carries a live betrayal mark', async () => {
    const { stampFor } = await import('../../rules/expiry.mjs');
    const traitor = actor([], {}, { uuid: 'Actor.traitor', flags: { ruleMarks: { betrayal: { by: 'Actor.traitor', until: 'scene', stamp: stampFor('scene') } } } });
    const failed = actor([], {}, { uuid: 'Actor.failed' });
    const other = actor([], {}, { uuid: 'Actor.other' });
    const npc = actor([], {}, { uuid: 'Actor.npc', type: 'npc' });
    expect(m.isBetrayed(traitor)).toBe(true);
    expect(m.betrayalSplits(other, traitor)).toBe(true);
    expect(m.betrayalSplits(traitor, other)).toBe(true);
    expect(m.betrayalSplits(other, failed)).toBe(false);
    expect(m.betrayalSplits(npc, traitor)).toBe(false);
    traitor.flags.essence20.ruleMarks.betrayal.stamp = { epoch: -5 };
    expect(m.isBetrayed(traitor)).toBe(false);
    delete traitor.flags.essence20.ruleMarks.betrayal;
    expect(m.isBetrayed(traitor)).toBe(false);
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
    p = {
      ...(await import('../forms/mega-defender.mjs')), ...(await import('../../rules/plugins/combat/incoming-hits-and-minions.mjs')),
    };
  });

  // Guardian Blast is its Perk's own rules (rules/conv15-items2.test.js).

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

  // Better Together (Influence and Hang-Up) is its items' own rules (rules/conv15-items2.test.js).

  test('Minions are tagged NPCs or Putties', async () => {
    expect(await p.isMinion({ type: 'npc', name: 'Putty Patroller', system: {} })).toBe(true);
    expect(await p.isMinion({ type: 'npc', name: 'Goldar', system: { creatureTags: 'minion' } })).toBe(true);
    expect(await p.isMinion({ type: 'npc', name: 'Goldar', system: {} })).toBe(false);
    expect(await p.isMinion({ type: 'playerCharacter', name: 'Jason', system: {} })).toBe(false);
  });
});

// (Again and Again and Again's ↓1 / ↓3 follow-ups are its Perk's rules now - rules/conv14-items2.test.js; Perfect Placement
// and the Scramble Field Generator are their items' own rules - rules/conv15-items2.test.js.)

// (Metallic Armor Power Up's Use, upkeep and endings are its Power's rules - rules/conv16-b.test.js.)
