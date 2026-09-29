import { jest } from '@jest/globals';

const src = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;

let S2, FLAG, deps, mod, init;

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
  ({ S2, FLAG, deps } = await import('./common.mjs'));
  mod = await import('./situational2.mjs');
  init = await import('./initiative.mjs');
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
  test('Stumble Through the City: Snag on Persuasion in town, checkbox when terrain unknown', () => {
    const actor = makeActor([makeItem('hangUp', 'knights_of_canterlot', 'sTmqok0MEmOQeboN')]);
    deps.getTerrain = () => 'urban';
    expect(sourcesOf(actor, null, { rolledSkill: 'persuasion' })).toContain('s2-stumble');
    expect(sourcesOf(actor, null, { rolledSkill: 'athletics' })).not.toContain('s2-stumble');
    deps.getTerrain = () => 'woodlands';
    expect(sourcesOf(actor, null, { rolledSkill: 'persuasion' })).not.toContain('s2-stumble');
    deps.getTerrain = () => null;
    expect(mod.situational2Toggles(actor, { rolledSkill: 'deception' }).map(t => t.name)).toContain('s2Stumble');
    const options = { ext: { s2Stumble: true } };
    mod.situational2ApplyDialog(actor, options, { rolledSkill: 'deception' });
    expect(options.snag).toBe(true);
  });

  test('Bookworm: ↓1 facing a Librarian', () => {
    const actor = makeActor([makeItem('hangUp', 'wtnv_citizens_guide', 'p2Qk0B5PWp10ZaqN')]);
    const librarian = makeActor([], { name: 'The Librarian' });
    expect(mod.situational2RollSources(actor, librarian, { rolledSkill: 'alertness' }).sources[0]).toMatchObject({ id: 's2-bookworm', shiftDown: 1 });
    expect(sourcesOf(actor, makeActor([], { name: 'Carlos' }), { rolledSkill: 'alertness' })).toEqual([]);
  });

  test('Matured-ignored Hang-Ups do nothing', () => {
    const hangUp = makeItem('hangUp', 'wtnv_citizens_guide', 'p2Qk0B5PWp10ZaqN', { flags: { essence20: { maturedIgnored: true } } });
    const actor = makeActor([hangUp]);
    expect(sourcesOf(actor, makeActor([], { name: 'Librarian' }), { rolledSkill: 'alertness' })).toEqual([]);
  });

  test('Tracking Outfit: ↑1 in the wild, ↓1 urban, only while worn', () => {
    const outfit = makeItem('gear', 'wtnv_citizens_guide', 'NHhNnkBBM29NpGpL', { system: { equipped: true } });
    const actor = makeActor([outfit]);
    deps.getTerrain = () => 'desert';
    expect(mod.situational2RollSources(actor, null, { rolledSkill: 'survival' }).sources[0]).toMatchObject({ shiftUp: 1 });
    deps.getTerrain = () => 'urban';
    expect(mod.situational2RollSources(actor, null, { rolledSkill: 'culture' }).sources[0]).toMatchObject({ shiftDown: 1 });
    outfit.system.equipped = false;
    expect(sourcesOf(actor, null, { rolledSkill: 'culture' })).toEqual([]);
    outfit.system.equipped = true;
    deps.getTerrain = () => null;
    const toggle = mod.situational2Toggles(actor, { rolledSkill: 'targeting' }).find(t => t.name == 's2Tracking');
    expect(toggle.type).toBe('select');
    const options = { shiftUp: 0, ext: { s2Tracking: 'wild' } };
    mod.situational2ApplyDialog(actor, options, { rolledSkill: 'targeting' });
    expect(options.shiftUp).toBe(1);
  });

  test('Seafarer: Edge swimming underwater; Hang-Up gives poison Edge vs holder on land', () => {
    const actor = makeActor([makeItem('perk', 'quartermasters_guide_to_gear', 'vZjp9ncpzhgLIzSm')]);
    deps.getEnvironment = () => 'underwater';
    expect(sourcesOf(actor, null, { rolledSkill: 'athletics' })).toContain('s2-seafarerSwim');
    deps.getEnvironment = () => 'normal';
    expect(sourcesOf(actor, null, { rolledSkill: 'athletics' })).not.toContain('s2-seafarerSwim');

    const sailor = makeActor([makeItem('hangUp', 'quartermasters_guide_to_gear', 'ahWxUG3w6KkfgUDw')]);
    const poison = { type: 'weaponEffect', name: 'Venom Bite', system: { damageType: 'sharp' }, flags: {} };
    expect(sourcesOf(makeActor(), sailor, { item: poison, isAttack: true })).toContain('s2-seafarerPoison');
    deps.getTerrain = () => 'sea';
    expect(sourcesOf(makeActor(), sailor, { item: poison, isAttack: true })).not.toContain('s2-seafarerPoison');
    deps.getTerrain = () => null;
    const save = { riderSpec: JSON.stringify({ kind: 'save', spec: { title: 'Toxic gas', damage: { value: 1, type: 'poison' } } }) };
    expect(sourcesOf(sailor, null, { rolledSkill: 'conditioning', dataset: save })).toContain('s2-seafarerResist');
  });

  test('Tritium Sights: ↑1 on attacks in complete darkness', () => {
    const weapon = { id: 'w1', type: 'weapon', name: 'Rifle', flags: {}, system: {} };
    const upgrade = makeItem('upgrade', 'quartermasters_guide_to_gear', 'dyNyzaagojOboB3y', { flags: { essence20: { parentId: 'w1' } }, itemId: 'u1' });
    const effect = { type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } }, system: {} };
    const scene = { id: 's', name: 'Night', environment: { darknessLevel: 1 }, tokens: [] };
    const token = { parent: scene };
    const actor = makeActor([weapon, upgrade], { token });
    expect(sourcesOf(actor, null, { item: effect, isAttack: true })).toContain('s2-tritium');
    scene.environment.darknessLevel = 0.3;
    expect(sourcesOf(actor, null, { item: effect, isAttack: true })).not.toContain('s2-tritium');
    expect(mod.situational2Toggles(actor, { item: effect }).map(t => t.name)).toContain('s2Tritium');
  });

  test('Feet Wet: Edge on non-combat tests at sea; Ship Shape adds wetlands; attacks Specialized', () => {
    const feetWet = makeItem('perk', 'quartermasters_guide_to_gear', '7u3xCPPjxJlI7c61');
    const actor = makeActor([feetWet]);
    deps.getTerrain = () => 'sea';
    expect(sourcesOf(actor, null, { rolledSkill: 'alertness' })).toContain('s2-feetWet');
    expect(mod.situational2Specializes(actor, 'targeting', { type: 'weaponEffect' })).toBe(true);
    deps.getTerrain = () => 'wetlands';
    expect(mod.isFeetWetActive(actor)).toBe(false);
    actor.items.push(makeItem('perk', 'quartermasters_guide_to_gear', 'MejI6WIShcA0GdoW'));
    expect(mod.isFeetWetActive(actor)).toBe(true);
    expect(mod.ignoresRoughTerrainS2(actor)).toBe(true);
  });

  test('Forgiving: Edge on Empathy vs a logged aggressor, consumed', async () => {
    const empathy = makeItem('perk', 'mlp_crb', '7k1UXzSKyoV8EtXZ', { system: { choice: 'animalHandling' } });
    const forgiving = makeItem('perk', 'mlp_crb', '985JSL4ANRcKb1EX');
    const actor = makeActor([empathy, forgiving], { uuid: 'Actor.kind' });
    const brute = makeActor([], { uuid: 'Actor.brute' });
    await mod.situational2PostRoll(brute, [], { isAttack: true }, { hits: [{ target: actor }] });
    expect(actor.flags.essence20[FLAG.forgiving]).toEqual(['Actor.brute']);
    const result = mod.situational2RollSources(actor, brute, { rolledSkill: 'animalHandling' });
    expect(result.sources.map(s => s.id)).toContain('s2-forgiving');
    expect(result.consumes[0]).toMatchObject({ ext: 's2Forgiving', aggressor: 'Actor.brute' });
    expect(sourcesOf(actor, makeActor(), { rolledSkill: 'animalHandling' })).not.toContain('s2-forgiving');
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

  test('Stubbornly Loyal: checkbox when turning the holder, not for Deception', () => {
    const loyal = makeActor([makeItem('perk', 'mlp_crb', 'zqsFMIRKaA0Ev62Y')], { name: 'Dash' });
    game.user.targets = new Set([{ actor: loyal }]);
    expect(mod.situational2Toggles(makeActor(), { rolledSkill: 'spellcasting' }).map(t => t.name)).toContain('s2StubbornlyLoyal');
    expect(mod.situational2Toggles(makeActor(), { rolledSkill: 'deception' }).map(t => t.name)).not.toContain('s2StubbornlyLoyal');
  });
});

describe('derived data and defenses', () => {
  const defenses = () => ({ toughness: { total: 10, string: '10' }, cleverness: { total: 10, string: '10' } });

  test('Arctic Expedition clothes: +2 Toughness in the cold, not against creature attacks', () => {
    const actor = makeActor([makeItem('gear', 'mlp_crb', 'pWRpmsOcWIv9trHP', { name: 'Arctic', system: { equipped: true } })],
      { system: { defenses: defenses() } });
    deps.getEnvironment = () => 'extremeCold';
    mod.situational2Derived(actor);
    expect(actor.system.defenses.toughness.total).toBe(12);
    expect(mod.situational2DefenseAdjust(makeActor(), actor, 'toughness')).toBe(-2);
    const warm = makeActor([makeItem('gear', 'mlp_crb', 'pWRpmsOcWIv9trHP', { system: { equipped: true } })], { system: { defenses: defenses() } });
    deps.getEnvironment = () => 'normal';
    mod.situational2Derived(warm);
    expect(warm.system.defenses.toughness.total).toBe(10);
  });

  test('Desert Gear works in desert terrain', () => {
    const actor = makeActor([makeItem('gear', 'wtnv_citizens_guide', 'tv0pOgALa608pw8i', { system: { equipped: true } })], { system: { defenses: defenses() } });
    deps.getTerrain = () => 'desert';
    mod.situational2Derived(actor);
    expect(actor.system.defenses.toughness.total).toBe(12);
  });

  test('Business: +2 Cleverness against StrexCorp agents', () => {
    const actor = makeActor([makeItem('gear', 'wtnv_citizens_guide', '6Vke4qKEaYjjRWQt', { system: { equipped: true } })]);
    expect(mod.situational2DefenseAdjust(makeActor([], { name: 'StrexCorp Agent' }), actor, 'cleverness')).toBe(2);
    expect(mod.situational2DefenseAdjust(makeActor([], { name: 'Cecil' }), actor, 'cleverness')).toBe(0);
    expect(mod.situational2DefenseAdjust(makeActor([], { system: { creatureTags: 'strexcorp' } }), actor, 'cleverness')).toBe(2);
  });

  test("Shark's Fin doubles Ground and Aquatic Movement at sea", () => {
    const actor = makeActor([makeItem('perk', 'quartermasters_guide_to_gear', 'c3tBbGzXDar3DA1E')],
      { system: { movement: { ground: { total: 30 }, swim: { total: 30 }, aerial: { total: 0 } } } });
    deps.getTerrain = () => 'sea';
    mod.situational2Derived(actor);
    expect(actor.system.movement.ground.total).toBe(60);
    expect(actor.system.movement.swim.total).toBe(60);
  });

  test('Ship Shape: an aquatic vehicle driven by the holder moves half again', () => {
    const driver = makeActor([makeItem('perk', 'quartermasters_guide_to_gear', 'MejI6WIShcA0GdoW')], { uuid: 'Actor.driver' });
    global.fromUuidSync.mockImplementation(uuid => (uuid == 'Actor.driver' ? driver : null));
    const boat = makeActor([], {
      type: 'vehicle',
      system: { actors: { d: { uuid: 'Actor.driver', vehicleRole: 'driver' } }, movement: { swim: { base: 50, total: 50 }, ground: { total: 0 } } },
    });
    mod.situational2Derived(boat);
    expect(boat.system.movement.swim.total).toBe(75);
    expect(mod.isFeetWetActive(boat)).toBe(true);
  });

  test('Cartography Suite: Move actions while Surprised on the surveyed scene', () => {
    const scene = { id: 'sc', name: 'Canyon', tokens: [] };
    const actor = makeActor([makeItem('perk', 'enigma_of_combination', 'l2dioJyakPropGEx')], {
      statuses: ['surprised'], token: { parent: scene },
      flags: { [FLAG.survey]: { sceneId: 'sc' } },
      system: { actions: { move: { base: 1, bonus: 0, max: 0 } } },
    });
    mod.situational2Derived(actor);
    expect(actor.system.actions.move.max).toBe(1);
    actor.items.push(makeItem('perk', 'enigma_of_combination', 'CTt9gmibpffGC0N4'));
    expect(mod.ignoresRoughTerrainS2(actor)).toBe(true);
    actor.flags.essence20[FLAG.survey] = { sceneId: 'elsewhere' };
    expect(mod.ignoresRoughTerrainS2(actor)).toBe(false);
  });
});

describe('Plow', () => {
  test('a Ram gains Multiple Targets and its turn ignores Rough Terrain', async () => {
    const actor = makeActor([makeItem('perk', 'tf_crb', 'y7VBydpKD8O63C3b')]);
    const ram = { type: 'weaponEffect', system: { isRam: true }, flags: {} };
    expect(mod.plowMultipleTargets(actor, ram)).toBe(true);
    expect(mod.plowMultipleTargets(actor, { type: 'weaponEffect', system: {}, flags: {} })).toBe(false);
    game.combat = { id: 'c', round: 2, turn: 1 };
    await mod.situational2PreRoll(actor, {}, ram);
    expect(mod.isPlowRamActive(actor)).toBe(true);
    game.combat = { id: 'c', round: 3, turn: 1 };
    expect(mod.isPlowRamActive(actor)).toBe(false);
  });
});

describe('Uses', () => {
  test('Cartography survey stamps the scene', async () => {
    const scene = { id: 'sc', name: 'Canyon', tokens: [] };
    const actor = makeActor([], { token: { parent: scene } });
    const perk = makeItem('perk', 'enigma_of_combination', 'l2dioJyakPropGEx');
    perk.parent = actor;
    const use = mod.USES.find(u => u.matches(perk));
    await use.run(perk);
    expect(actor.flags.essence20[FLAG.survey]).toMatchObject({ sceneId: 'sc' });
  });

  test('Caltrops posts a crossing button', async () => {
    const gear = makeItem('gear', 'pr_crb', 'LN0w8SB1fHhidIVp');
    const line = await mod.USES.find(u => u.matches(gear)).run(gear);
    expect(line).toContain('data-e20-ext="s2Caltrops"');
  });
});

describe('initiative', () => {
  test('Amphibious Assault ↑1 in the water; Tracking Outfit ↑1 in the wild; Bookworm ↓1 in a library', async () => {
    const actor = makeActor([
      makeItem('perk', 'quartermasters_guide_to_gear', 'X2atZm3eoIBJcwF6'),
      makeItem('gear', 'wtnv_citizens_guide', 'NHhNnkBBM29NpGpL', { system: { equipped: true } }),
      makeItem('hangUp', 'wtnv_citizens_guide', 'p2Qk0B5PWp10ZaqN'),
    ], { token: { parent: { id: 's', name: 'Public Library', tokens: [] } } });
    deps.getEnvironment = () => 'underwater';
    deps.getTerrain = () => 'woodlands';
    const options = { shiftUp: 0, shiftDown: 0 };
    await init.situationalInitiative(actor, options);
    expect(options).toMatchObject({ shiftUp: 2, shiftDown: 1 });
  });

  test("Shark's Fin lifts Surprise in the wetlands", async () => {
    const actor = makeActor([makeItem('perk', 'quartermasters_guide_to_gear', 'c3tBbGzXDar3DA1E')],
      { statuses: ['surprised'], system: { movement: { ground: { total: 60 } } } });
    deps.getTerrain = () => 'wetlands';
    await init.situationalInitiative(actor, { shiftUp: 0, shiftDown: 0 });
    expect(actor.statuses.has('surprised')).toBe(false);
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

test('ids line up with the slice', () => {
  expect(S2.caltrops).toBe('LN0w8SB1fHhidIVp');
});
