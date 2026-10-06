import { jest } from '@jest/globals';

const src = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;

let FLAG, deps, mod, init;

function makeItem(type, pack, id, extra = {}) {
  return { type, name: extra.name ?? id, flags: { core: { sourceId: src(pack, id) }, ...(extra.flags ?? {}) }, system: extra.system ?? {}, id: extra.itemId ?? id };
}

function makeActor(items = [], extra = {}) {
  const flags = { essence20: { ...(extra.flags ?? {}) } };
  const actor = {
    uuid: extra.uuid ?? `Actor.${Math.random()}`,
    id: extra.id ?? 'a',
    name: extra.name ?? 'Pony',
    type: extra.type ?? 'playerCharacter',
    items: Object.assign([...items], { get: id => items.find(item => item.id == id) }),
    flags,
    statuses: new Set(extra.statuses ?? []),
    system: extra.system ?? {},
    setFlag: jest.fn(async (scope, key, value) => {
      flags.essence20[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags.essence20[key];
    }),
    toggleStatusEffect: jest.fn(async (id, { active }) => {
      if (active) {
        actor.statuses.add(id);
      } else {
        actor.statuses.delete(id);
      }
    }),
    getActiveTokens: () => (extra.token ? [extra.token] : []),
  };
  return actor;
}

beforeAll(async () => {
  global.Hooks = { on: jest.fn(), once: jest.fn(), callAll: jest.fn() };
  global.game = {
    i18n: { localize: key => key, format: (key, data) => `${key}:${JSON.stringify(data)}` },
    user: { targets: new Set(), isGM: true, isActiveGM: true },
    users: { activeGM: null },
    actors: [],
    combat: null,
    messages: { contents: [] },
  };
  global.CONFIG = { E20: { skillToEssence: {} }, statusEffects: [] };
  global.foundry = { utils: { randomID: () => 'r' }, applications: { api: {} } };
  global.ChatMessage = { create: jest.fn(async () => ({})), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn() } };
  global.fromUuid = jest.fn(async () => null);
  global.fromUuidSync = jest.fn(() => null);
  ({ FLAG, deps } = await import('../shared/situation-checks.mjs'));
  mod = await import('./situational-perks.mjs');
  init = await import('./situational-initiative.mjs');
});

beforeEach(() => {
  deps.getTerrain = () => null;
  deps.getEnvironment = () => 'normal';
  deps.getSceneEpoch = () => 3;
  deps.nearbyAllies = () => [];
  game.user.targets = new Set();
  game.combat = null;
  global.ChatMessage.create.mockClear();
  mod.resetRecentRolls();
});

const sourcesOf = (actor, target, ctx) => mod.situational2RollSources(actor, target, ctx).sources.map(s => s.id);

describe('roll sources', () => {
  test('Matured-ignored Hang-Ups do nothing', () => {
    const hangUp = makeItem('hangUp', 'quartermasters_guide_to_gear', 'ahWxUG3w6KkfgUDw', { flags: { essence20: { maturedIgnored: true } } });
    const save = { riderSpec: JSON.stringify({ kind: 'save', spec: { title: 'Toxic gas', damage: { value: 1, type: 'poison' } } }) };
    expect(sourcesOf(makeActor([hangUp]), null, { rolledSkill: 'conditioning', dataset: save })).toEqual([]);
  });

  test('item rules that read where the token stands are refreshed on a Region change', () => {
    const rules = when => ({ type: 'perk', flags: {}, system: { rules: [{ type: 'Movement', movement: 'swim', op: 'multiply', value: 2, when }] } });
    expect(mod.hasPositionRules(makeActor([rules(['check:seaOrWetlands'])]))).toBe(true);
    expect(mod.hasPositionRules(makeActor([rules([{ any: ['environment:outside:lowGravity'] }])]))).toBe(true);
    expect(mod.hasPositionRules(makeActor([rules(['not:terrain:set'])]))).toBe(true);
    expect(mod.hasPositionRules(makeActor([rules(['self:morphed'])]))).toBe(false);
    expect(mod.hasPositionRules(makeActor([{ type: 'perk', flags: {}, system: { rules: [{ type: 'RollModifier', edge: true, when: ['terrain:sea'] }] } }]))).toBe(false);
    expect(mod.hasPositionRules(makeActor([makeItem('perk', 'quartermasters_guide_to_gear', 'x')]))).toBe(false);
  });

  test('Forgiving adds nothing here (item rules - rules/conv8-slC8.test.js)', () => {
    const empathy = makeItem('perk', 'mlp_crb', '7k1UXzSKyoV8EtXZ', { system: { choice: 'animalHandling' } });
    const forgiving = makeItem('perk', 'mlp_crb', '985JSL4ANRcKb1EX');
    const actor = makeActor([empathy, forgiving], { uuid: 'Actor.kind' });
    const brute = makeActor([], { uuid: 'Actor.brute' });
    expect(mod.situational2PostRoll).toBeUndefined();
    expect(mod.situational2RollSources(actor, brute, { rolledSkill: 'animalHandling' })).toEqual({ sources: [], consumes: [] });
  });

  test('Competitive: an ally out-rolling you banks a Snag for the scene', async () => {
    const holder = makeActor([makeItem('hangUp', 'mlp_crb', 'Vk2EFSSBfmunP5fk')], { name: 'Rainbow' });
    const ally = makeActor([], { name: 'Applejack' });
    const msg = (actor, total) => ({ speakerActor: actor, flags: { essence20: { skill: 'athletics' } }, rolls: [{ total }] });
    await mod.watchCompetitive(msg(holder, 12), 1000);
    await mod.watchCompetitive(msg(ally, 15), 2000);
    expect(holder.flags.essence20[FLAG.competitive]).toEqual({ epoch: 3 });
    const result = mod.situational2RollSources(holder, null, { rolledSkill: 'brawn' });
    expect(result.sources[0]).toMatchObject({ id: 's2-competitive', snag: true });
    expect(result.consumes[0]).toMatchObject({ ext: 's2Competitive' });
    deps.getSceneEpoch = () => 4;
    expect(sourcesOf(holder, null, { rolledSkill: 'brawn' })).toEqual([]);
  });

  test('Competitive: nothing when the ally rolled lower or a different skill', async () => {
    const holder = makeActor([makeItem('hangUp', 'mlp_crb', 'Vk2EFSSBfmunP5fk')]);
    const ally = makeActor();
    await mod.watchCompetitive({ speakerActor: holder, flags: { essence20: { skill: 'athletics' } }, rolls: [{ total: 12 }] }, 1000);
    await mod.watchCompetitive({ speakerActor: ally, flags: { essence20: { skill: 'athletics' } }, rolls: [{ total: 9 }] }, 1100);
    await mod.watchCompetitive({ speakerActor: ally, flags: { essence20: { skill: 'brawn' } }, rolls: [{ total: 20 }] }, 1200);
    expect(holder.flags.essence20[FLAG.competitive]).toBeUndefined();
  });
});

describe('derived data and defenses', () => {
  const defenses = () => ({ toughness: { total: 10, string: '10' }, cleverness: { total: 10, string: '10' } });

  test('the exposure clothes and Business are item rules now (rules/conv10-slC10.test.js)', () => {
    const actor = makeActor([makeItem('gear', 'mlp_crb', 'pWRpmsOcWIv9trHP', { name: 'Arctic', system: { equipped: true } })],
      { system: { defenses: defenses() } });
    deps.getEnvironment = () => 'extremeCold';
    mod.situational2Derived(actor);
    expect(actor.system.defenses.toughness.total).toBe(10);
    expect(mod.situational2DefenseAdjust).toBeUndefined();
  });
});

describe('Uses', () => {
  test('Caltrops is an item rule now (rules/conv7-slC7.test.js)', () => {
    const gear = makeItem('gear', 'pr_crb', 'LN0w8SB1fHhidIVp');
    expect(mod.USES.find(u => u.matches(gear))).toBeUndefined();
  });
});

describe('initiative', () => {
  test('Bookworm, Amphibious Assault and Tracking Outfit add nothing here (item rules - conv5/conv7)', async () => {
    const actor = makeActor([
      makeItem('perk', 'quartermasters_guide_to_gear', 'X2atZm3eoIBJcwF6'),
      makeItem('gear', 'wtnv_citizens_guide', 'NHhNnkBBM29NpGpL', { system: { equipped: true } }),
      makeItem('hangUp', 'wtnv_citizens_guide', 'p2Qk0B5PWp10ZaqN'),
    ], { token: { parent: { id: 's', name: 'Public Library', tokens: [] } } });
    deps.getEnvironment = () => 'underwater';
    deps.getTerrain = () => 'woodlands';
    const options = { shiftUp: 0, shiftDown: 0 };
    await init.situationalInitiative(actor, options);
    expect(options).toMatchObject({ shiftUp: 0, shiftDown: 0 });
  });

  test('Take in a Scene: DIF from the lowest hostile Infiltration roll', () => {
    const actor = makeActor([], { token: { disposition: 1 } });
    const enemy = makeActor([], { token: { disposition: -1 } });
    const friend = makeActor([], { token: { disposition: 1 } });
    const msg = (who, total) => ({ speakerActor: who, flags: { essence20: { skill: 'infiltration' } }, rolls: [{ total }], timestamp: 1000 });
    expect(init.lowestHostileInfiltration(actor, [msg(enemy, 18), msg(enemy, 13), msg(friend, 5)], 2000)).toBe(13);
    expect(init.lowestHostileInfiltration(actor, [msg(friend, 5)], 2000)).toBeNull();
  });

  test('Take in a Scene without a DIF asks the GM; Misplaced Confidence holds Surprise two rounds', async () => {
    const actor = makeActor([
      makeItem('perk', 'mlp_crb', 'gT6SEHJIK6ob0v7T'),
      makeItem('hangUp', 'mlp_crb', 'LcKUw5rQd19ovk4I'),
    ], { statuses: ['surprised'], uuid: 'Actor.p' });
    actor._dice = { rollSkill: jest.fn(async () => ({})) };
    await init.situationalInitiative(actor, { shiftUp: 0, shiftDown: 0 });
    expect(actor._dice.rollSkill).toHaveBeenCalled();
    expect(global.ChatMessage.create.mock.calls.at(-1)[0].content).toContain('data-e20-ext="s2TakeInScene"');

    game.combat = { id: 'c', round: 1, combatants: [{ actor }] };
    global.fromUuid.mockResolvedValueOnce(actor);
    await init.takeInASceneButton({}, { dataset: { actorUuid: 'Actor.p', noticed: '0' } });
    expect(actor.flags.essence20[FLAG.misplaced]).toEqual({ combatId: 'c', untilRound: 2 });

    actor.statuses.delete('surprised');
    game.combat.round = 2;
    await init.misplacedConfidenceRound(game.combat);
    expect(actor.statuses.has('surprised')).toBe(true);
    game.combat.round = 3;
    await init.misplacedConfidenceRound(game.combat);
    expect(actor.statuses.has('surprised')).toBe(false);
    expect(actor.flags.essence20[FLAG.misplaced]).toBeUndefined();
  });

  test('a noticed Take in a Scene removes Surprise', async () => {
    const actor = makeActor([], { statuses: ['surprised'] });
    await init.resolveTakeInAScene(actor, true);
    expect(actor.statuses.has('surprised')).toBe(false);
  });
});
