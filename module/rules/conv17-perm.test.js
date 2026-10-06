import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 17, perm (docs/rules-batches/slPerm17.md): Trade School (and Technical Mastery's reach to the coached ally) and the
 * items the survey called "permanent" that convert now. Each item is loaded from its pack source; these check the rules
 * validate and do what the removed code did.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const allies = { list: [] };
const pickAllyTargets = jest.fn(async (actor, candidates) => {
  if (!candidates.length) {
    globalThis.ui.notifications.warn('E20.NoAllies');
    return [];
  }

  return [candidates[0]];
});
jest.unstable_mockModule('./mechanics/combat/nearby-allies.mjs', () => ({
  getNearbyAllyTokens: jest.fn(actor => allies.list.filter(other => other !== actor).map(other => other.token)),
  pickAllyTargets,
}));
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({
  getDefenseValue: (actor, key) => Number(actor.system?.defenses?.[key]?.total) || 0,
}));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { fireTriggers, runUse } = await import('./triggers.mjs');
const { ruleCritD2, ruleDieSubstitution, ruleRollSources, ruleSpecializes } = await import('./adapter.mjs');
const { runPreRoll } = await import('../mechanics/item-hooks.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

export const FILES = {
  tradeSchool: 'qgtgitems/_source/Trade_School_yR5QrBHWNUnbuiG7.json',
  technicalMastery: 'qgtgitems/_source/Technical_Mastery_QKlXoVgNMq7Kv58L.json',
  chronoFile: 'jttitems/_source/Chrono_File_Access_PDOUlIOgO7YoPVvm.json',
};

/** foundry.utils.setProperty, for plain objects (`-=key` deletes). */
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const node = keys.reduce((at, key) => (at[key] ??= {}), object);
  if (last.startsWith('-=')) {
    delete node[last.slice(2)];
  } else {
    node[last] = value;
  }
}

const getPath = (object, path) => path.split('.').reduce((at, key) => at?.[key], object);
const clone = value => JSON.parse(JSON.stringify(value));

let nextId = 1;

function makeItem(actor, data) {
  const item = {
    id: `i${nextId++}`, flags: {}, system: {}, parent: actor, isOwner: true, ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  return item;
}

const sourceOfPack = doc => `Compendium.essence20.test.Item.${doc._id}`;

/** An actor holding the pack items `files`. */
export function makeActor(name, files = [], { system = {}, extraItems = [] } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: {
      level: 12, health: { value: 10, max: 10 }, skills: { technology: { shift: 'd2' } },
      defenses: { toughness: { total: 10 }, evasion: { total: 15 }, willpower: { total: 11 }, cleverness: { total: 12 } }, ...system,
    },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    getFlag(scope, key) {
      return getPath(this.flags[scope], key);
    },
    getRollData() {
      return { skills: this.system.skills };
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  for (const file of [files].flat()) {
    const doc = fromPack(file);
    items.push(makeItem(actor, { name: doc.name, type: doc.type, img: doc.img, system: clone(doc.system), flags: { core: { sourceId: sourceOfPack(doc) } } }));
  }

  items.push(...extraItems.map(data => makeItem(actor, data)));
  actor.items = {
    contents: items, get: id => items.find(item => item.id == id), find: fn => items.find(fn), filter: fn => items.filter(fn), some: fn => items.some(fn),
    map: fn => items.map(fn), [Symbol.iterator]: () => items[Symbol.iterator](),
  };
  actor.token = { actor, document: { disposition: 1 }, id: `t${actor.id}`, name };
  actor.getActiveTokens = () => [actor.token];
  rebuildIndex(actor);
  return actor;
}

export function scene(...actors) {
  const docs = new Map(actors.flatMap(actor => [[actor.uuid, actor], ...actor.items.contents.map(item => [item.uuid, item])]));
  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.fromUuid = async uuid => docs.get(uuid) ?? null;
  global.game.actors = { get: id => actors.find(actor => actor.id == id) ?? null, contents: actors, [Symbol.iterator]: () => actors[Symbol.iterator]() };
  allies.list = actors;
}

export const target = (...actors) => {
  global.game.user.targets = new Set(actors.map(actor => actor.token));
  global.game.user.targets.first = () => actors[0]?.token;
};

const pay = jest.fn(async () => true);
const savedGame = global.game;
const savedFromUuid = global.fromUuid;
const savedFromUuidSync = global.fromUuidSync;
const clock = { scene: 1 };

beforeEach(() => {
  pay.mockClear();
  pickAllyTargets.mockClear();
  clock.scene = 1;
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [], activeGM: null },
    actors: { contents: [] },
    // The Scene Clock's epochs (mechanics/resources/scene-clock.mjs reads world settings).
    settings: { get: (scope, key) => (String(key).toLowerCase().includes('scene') ? clock.scene : 1) },
    i18n: { localize: key => key, format: (key, data) => `${key}${data ? ` ${JSON.stringify(data)}` : ''}`, has: () => false },
  };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.CONFIG = {
    ...(global.CONFIG ?? {}),
    E20: { ...(global.CONFIG?.E20 ?? {}), skillShiftList: ['3d6', '2d6', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'], skillToEssence: { technology: 'smarts', might: 'strength' } },
  };
  global.foundry = {
    ...global.foundry,
    applications: { api: { DialogV2: { wait: jest.fn(async () => null), confirm: jest.fn(async () => true) } } },
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, hasProperty: (o, k) => getPath(o, k) !== undefined, deepClone: clone },
  };
});

afterEach(() => {
  global.game = savedGame;
  global.fromUuid = savedFromUuid;
  global.fromUuidSync = savedFromUuidSync;
});

test('every rule this part added validates', () => {
  for (const file of Object.values(FILES)) {
    const rules = fromPack(file).system.rules ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

/* -------------------------------------------- */
/*  Trade School + Technical Mastery             */
/* -------------------------------------------- */

describe('Trade School', () => {
  const tech = (extra = {}) => ({ rolledSkill: 'technology', rolledEssence: 'smarts', dataset: { skill: 'technology' }, ...extra });
  const useOf = actor => actor.items.contents.find(item => item.name == 'Trade School');

  function setUp({ coachTech = { shift: 'd8' }, mastery = false } = {}) {
    const coach = makeActor('Coach', [FILES.tradeSchool, ...(mastery ? [FILES.technicalMastery] : [])], { system: { skills: { technology: coachTech } } });
    const ally = makeActor('Ally');
    scene(coach, ally);
    return { coach, ally };
  }

  test('the Use: once per encounter, coaches the picked ally (a pending mark), nothing without an ally', async () => {
    const { coach, ally } = setUp();
    allies.list = [coach];
    expect(await runUse(useOf(coach), pay)).toBeNull();
    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(coach.flags.essence20.ruleUses).toBeUndefined();
    expect(Object.keys(coach.flags.essence20)).toEqual([]);

    allies.list = [coach, ally];
    expect(await runUse(useOf(coach), pay)).toContain('Trade School');
    expect(ally.flags.essence20.ruleMarks.tradeSchoolPending).toEqual(expect.objectContaining({ by: coach.uuid }));
    // Spent for the encounter: no Use left.
    expect(await runUse(useOf(coach), pay)).toBeNull();
  });

  test('first Technology roll: the coaching starts for the scene, the coach\'s better die, Specialized, the pending mark used up', async () => {
    const { coach, ally } = setUp();
    allies.list = [coach, ally];
    await runUse(useOf(coach), pay);

    // Another Skill leaves it pending.
    await runPreRoll(ally, { skill: 'might' }, null);
    expect(ally.flags.essence20.ruleMarks.tradeSchool).toBeUndefined();

    await runPreRoll(ally, { skill: 'technology' }, null);
    expect(ally.flags.essence20.ruleMarks.tradeSchool).toEqual(expect.objectContaining({ by: coach.uuid, until: 'scene' }));
    expect(ruleDieSubstitution(ally, null, tech(), 'd2').shift).toBe('d8');
    // The ally's own better die is kept (best of the two).
    expect(ruleDieSubstitution(ally, null, tech(), 'd10').shift).toBe('d10');
    expect(ruleDieSubstitution(ally, null, { ...tech(), rolledSkill: 'might' }, 'd2').shift).toBe('d2');
    // The pending grant: Specialized on this roll, and the roll uses it up.
    expect(ruleSpecializes(ally, 'technology', null, {})).toBe(true);
    expect(ruleRollSources(ally, null, tech()).consumes).toContainEqual(expect.objectContaining({ ext: 'rulesMark', actorUuid: ally.uuid, key: 'tradeSchoolPending' }));
    expect(ruleCritD2(ally, null, tech())).toBe(false);

    // Used up: the rest of the scene rolls the coach's die, Specialized only if the coach is.
    await ally.update({ 'flags.essence20.ruleMarks.-=tradeSchoolPending': null });
    rebuildIndex(ally);
    await runPreRoll(ally, { skill: 'technology' }, null);
    expect(ruleDieSubstitution(ally, null, tech(), 'd4').shift).toBe('d8');
    expect(ruleSpecializes(ally, 'technology', null, {})).toBe(false);
    coach.system.skills.technology.isSpecialized = true;
    expect(ruleSpecializes(ally, 'technology', null, {})).toBe(true);
    coach.system.skills.technology = { shift: 'd8', specializations: { a: { name: 'Hacking' } } };
    expect(ruleSpecializes(ally, 'technology', null, {})).toBe(true);
    expect(ruleSpecializes(ally, 'might', null, {})).toBe(false);

    // A new scene ends it.
    clock.scene = 2;
    expect(ruleDieSubstitution(ally, null, tech(), 'd4').shift).toBe('d4');
    expect(ruleSpecializes(ally, 'technology', null, {})).toBe(false);
  });

  test('a pending grant waits across scenes; a live coaching record is not overwritten', async () => {
    const { coach, ally } = setUp();
    const other = makeActor('Other Coach', [FILES.tradeSchool], { system: { skills: { technology: { shift: 'd12' } } } });
    scene(coach, ally, other);
    await runUse(useOf(coach), pay);
    clock.scene = 3;
    await runPreRoll(ally, { skill: 'technology' }, null);
    expect(ally.flags.essence20.ruleMarks.tradeSchool.by).toBe(coach.uuid);

    // Another coach's grant the same scene: the scene's coaching stays with the first coach.
    await runUse(useOf(other), pay);
    await runPreRoll(ally, { skill: 'technology' }, null);
    expect(ally.flags.essence20.ruleMarks.tradeSchool.by).toBe(coach.uuid);
    expect(ruleDieSubstitution(ally, null, tech(), 'd4').shift).toBe('d8');
  });

  test('Technical Mastery: the coached ally may crit on the d2 on the roll the grant is used on', async () => {
    const { coach, ally } = setUp({ mastery: true });
    allies.list = [coach, ally];
    await runUse(useOf(coach), pay);
    await runPreRoll(ally, { skill: 'technology' }, null);
    expect(ruleCritD2(ally, null, tech())).toBe(true);
    expect(ruleCritD2(ally, null, { ...tech(), rolledSkill: 'might' })).toBe(false);
    // The coach's own Technology tests: its direct rule.
    expect(ruleCritD2(coach, null, tech())).toBe(true);
    await ally.update({ 'flags.essence20.ruleMarks.-=tradeSchoolPending': null });
    expect(ruleCritD2(ally, null, tech())).toBe(false);
  });

  test('no beforeRoll Triggers reach an actor with no mark (the gate stays shut)', async () => {
    const lone = makeActor('Lone');
    scene(lone);
    await runPreRoll(lone, { skill: 'technology' }, null);
    expect(lone.flags.essence20.ruleMarks).toBeUndefined();
    expect(await fireTriggers(lone, 'beforeRoll', { roll: tech() })).toBeNull();
  });
});

/* -------------------------------------------- */
/*  Chrono-File Access                           */
/* -------------------------------------------- */

describe('Chrono-File Access', () => {
  const useOf = actor => actor.items.contents.find(item => item.name == 'Chrono-File Access');
  const foe = (extraItems = [], defenses = { toughness: 10, evasion: 12, willpower: 8, cleverness: 14 }) => makeActor('Target', [], {
    system: { defenses: Object.fromEntries(Object.entries(defenses).map(([key, total]) => [key, { total }])) }, extraItems,
  });

  test('no target: a warning, no card', async () => {
    const ranger = makeActor('Ranger', [FILES.chronoFile]);
    scene(ranger);
    await fireTriggers(ranger, 'powerUsed', { roll: { item: useOf(ranger) }, targets: [] });
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.ChronoFileAccessNoTarget');
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });

  test('the highest Defense, the most damaging attack and the Hang-Ups', async () => {
    const ranger = makeActor('Ranger', [FILES.chronoFile]);
    const target = foe([
      { name: 'Weak Punch', type: 'weaponEffect', system: { damageValue: 1 } },
      { name: 'Big Blast', type: 'weaponEffect', system: { damageValue: 5 } },
      { name: 'Also Big', type: 'weaponEffect', system: { damageValue: 5 } },
      { name: 'Stubborn', type: 'hangUp' },
    ]);
    scene(ranger, target);
    await fireTriggers(ranger, 'powerUsed', { roll: { item: useOf(ranger) }, targets: [target] });
    const content = ChatMessage.create.mock.calls[0][0].content;
    expect(content).toContain('E20.ChronoFileAccessResult');
    for (const part of ['&quot;highestDefenseName&quot;:&quot;Cleverness&quot;', '&quot;highestDefenseValue&quot;:14', '&quot;attackName&quot;:&quot;Big Blast&quot;',
      '&quot;attackDamage&quot;:5', '&quot;hangUps&quot;:&quot;Stubborn&quot;', '&quot;target&quot;:&quot;Target&quot;']) {
      expect(content).toContain(part);
    }
  });

  test('none known: no attacks, no Hang-Ups; ties go to the first Defense', async () => {
    const ranger = makeActor('Ranger', [FILES.chronoFile]);
    const target = foe([], { toughness: 12, evasion: 12, willpower: 8, cleverness: 4 });
    scene(ranger, target);
    await fireTriggers(ranger, 'powerUsed', { roll: { item: useOf(ranger) }, targets: [target] });
    const content = ChatMessage.create.mock.calls[0][0].content;
    expect(content).toContain('&quot;attackName&quot;:&quot;E20.ChronoFileAccessNoAttacks&quot;');
    expect(content).toContain('&quot;attackDamage&quot;:0');
    expect(content).toContain('&quot;hangUps&quot;:&quot;E20.ChronoFileAccessNoHangUps&quot;');
    expect(content).toContain('&quot;highestDefenseName&quot;:&quot;Toughness&quot;');
  });

  test('another Power\'s use does not run it', async () => {
    const ranger = makeActor('Ranger', [FILES.chronoFile], { extraItems: [{ name: 'Other Power', type: 'power' }] });
    const target = foe();
    scene(ranger, target);
    await fireTriggers(ranger, 'powerUsed', { roll: { item: ranger.items.contents.find(item => item.name == 'Other Power') }, targets: [target] });
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Betrayal                                     */
/* -------------------------------------------- */

describe('Betrayal', () => {
  const BETRAYAL = 'mlpcrbitems/_source/Betrayal_fhne6x3suULZL040.json';
  let rollSeen;
  let pressRuleButton;
  let setStoryPointHelpers;
  let isBetrayed;
  beforeAll(async () => {
    ({ rollSeen } = await import('./plugins/tags/world-watch.mjs'));
    ({ pressRuleButton } = await import('./buttons.mjs'));
    ({ setStoryPointHelpers } = await import('./steps.mjs'));
    ({ isBetrayed } = await import('../items/social/betrayal.mjs'));
  });

  afterEach(() => setStoryPointHelpers(null));

  const card = () => ChatMessage.create.mock.calls.map(call => call[0]).find(data => data.flags?.essence20?.ruleButton);
  const message = data => ({ flags: data.flags, update: jest.fn(async () => {}) });

  function setUp() {
    const pony = makeActor('Pinkie', [BETRAYAL]);
    const assisted = makeActor('Rarity');
    const friend = makeActor('Applejack');
    scene(pony, assisted, friend);
    return { pony, assisted, friend };
  }

  test('the assisted pony fails: the assister is marked for the scene, with a mend card', async () => {
    const { pony, assisted } = setUp();
    await rollSeen(assisted, [{ success: false }, { success: true }], { lendAssistanceAssisterUuid: pony.uuid }, {});
    expect(isBetrayed(pony)).toBe(true);
    const posted = card();
    expect(posted.content).toContain('E20.O3BetrayalLine');
    expect(posted.content).toContain('&quot;ally&quot;:&quot;Rarity&quot;');
    expect(posted.content).toContain('&quot;name&quot;:&quot;Pinkie&quot;');
    expect(posted.content).toContain('E20.O3BetrayalHeal');
    clock.scene = 2;
    expect(isBetrayed(pony)).toBe(false);
  });

  test('no mark: a success, an unassisted roll, someone else\'s assist', async () => {
    const { pony, assisted, friend } = setUp();
    await rollSeen(assisted, [{ success: true }, { success: false }], { lendAssistanceAssisterUuid: pony.uuid }, {});
    await rollSeen(assisted, [{ success: false }], {}, {});
    await rollSeen(assisted, [{ success: false }], { lendAssistanceAssisterUuid: friend.uuid }, {});
    expect(isBetrayed(pony)).toBe(false);
    expect(card()).toBeUndefined();
  });

  test('mending: another PC spends a Friendship Point; not the betrayer, not without a point, nothing to mend after', async () => {
    const { pony, assisted, friend } = setUp();
    await rollSeen(assisted, [{ success: false }], { lendAssistanceAssisterUuid: pony.uuid }, {});
    const posted = message(card());
    const spendForActor = jest.fn(async () => {});
    const helpers = { canSpendForActor: () => true, spendForActor };

    // The betrayer itself (the GM with nothing selected acts as it).
    setStoryPointHelpers(helpers);
    expect(await pressRuleButton(posted, { id: 'gm', isGM: true, character: null })).toBe(true);
    expect(ui.notifications.warn).toHaveBeenLastCalledWith('E20.O3BetrayalNeedPc');
    expect(isBetrayed(pony)).toBe(true);

    // No Friendship Point.
    setStoryPointHelpers({ canSpendForActor: () => false, spendForActor });
    await pressRuleButton(posted, { id: 'p', isGM: false, character: friend });
    expect(ui.notifications.warn).toHaveBeenLastCalledWith('E20.O3NoFriendshipPoint');
    expect(isBetrayed(pony)).toBe(true);

    setStoryPointHelpers(helpers);
    ChatMessage.create.mockClear();
    await pressRuleButton(posted, { id: 'p', isGM: false, character: friend });
    expect(spendForActor).toHaveBeenCalledWith(friend, 1);
    expect(isBetrayed(pony)).toBe(false);
    const healed = ChatMessage.create.mock.calls[0][0].content;
    expect(healed).toContain('E20.O3BetrayalHealed');
    expect(healed).toContain('&quot;name&quot;:&quot;Applejack&quot;');
    expect(healed).toContain('&quot;other&quot;:&quot;Pinkie&quot;');

    // Again: nothing left to mend.
    await pressRuleButton(posted, { id: 'p', isGM: false, character: friend });
    expect(ui.notifications.info).toHaveBeenLastCalledWith('E20.O3BetrayalNothing');
    expect(spendForActor).toHaveBeenCalledTimes(1);
  });
});
