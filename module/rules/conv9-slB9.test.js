import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Slice round 9, part slB9 (tf1, tf2, tf3, fix3-tf, other2): items converted from hand-written code to
 * item rules with the round-9 engine pieces (rollVsEach, pickGrant record + item:pickedSource) and the
 * earlier ones (setTargets with a filter, alliesOfTarget, hit Triggers by outcome, ActionCost, pick legacy).
 * Each item is loaded from its pack source and must do what the removed code did.
 */

const hooks = {};
global.Hooks = { on: (name, fn) => (hooks[name] = [...(hooks[name] ?? []), fn]), once: () => {}, callAll: () => {} };

const timed = [];
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({
  applyTimedCondition: jest.fn(async (actor, status, rounds) => {
    timed.push({ name: actor.name, status, rounds });
  }),
}));
const dealt = [];
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({
  applyDamage: jest.fn(async (actor, amount, type) => {
    dealt.push({ name: actor.name, amount, type });
  }),
}));
const grants = {
  chooseSelect: jest.fn(async () => null),
  findItems: jest.fn(async () => []),
  pickOne: jest.fn(async () => null),
};
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);

const { rebuildIndex } = await import('./index.mjs');
const { ruleRequisitionAccess } = await import('./adapter.mjs');
const { runUse } = await import('./triggers.mjs');
const { costRulesFor } = await import('./actions.mjs');
const { pressRuleButton } = await import('./buttons.mjs');
const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');
const { runPostRoll, registrySnapshot } = await import('../mechanics/item-hooks.mjs');
const { COMBAT_USES } = await import('../items/attacks/show-respect.mjs');
// slB10: Comms Assault's armor-ignoring is an ignoreArmor Defense rule on the Perk (rules/plugins/combat/ignore-armor.mjs).
const { ignoreArmorAdjust } = await import('./plugins/combat/ignore-armor.mjs');
const COMMS_MARK = 'tf1CommsAssault';
const { SUPPORT_USES } = await import('../items/forms/chassis-mimicry-support-perks.mjs');
const { USES: TF3_USES } = await import('../items/rolls/deceptive-warfare.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const BRUTAL = 'dditems/_source/Brutal_Display_11Q2KXJ7qxlddusg.json';
const EXAMPLE = 'dditems/_source/Make_An_Example_mroTcYJKFpAAiqP5.json';
const COMMS = 'dditems/_source/Comms_Assault_pKArYQ259zpdsR7o.json';
const SWITCH = 'dditems/_source/Flexible_Switch_pTHenJt0kG3umsUk.json';
const ONE_BOT = 'tf1sitems/_source/One_Bot_Over_Another_n5dNCOPVTsqLAapp.json';

let nextId = 1;

const getPath = (object, key) => key.split('.').reduce((o, k) => o?.[k], object);

const setPath = (object, key, value) => {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
};

const deletePath = (object, key) => {
  const keys = key.split('.');
  const last = keys.pop().replace(/^-=/, '');
  delete keys.reduce((o, k) => o?.[k], object)?.[last];
};

async function applyUpdate(doc, data) {
  for (const [key, value] of Object.entries(data)) {
    if (key.split('.').pop().startsWith('-=')) {
      deletePath(doc, key);
    } else {
      setPath(doc, key, value);
    }
  }
}

function makeItem(data) {
  const item = {
    flags: {}, system: {}, ...data,
    async update(changes) {
      await applyUpdate(this, changes);
    },
  };
  item.uuid ??= `Item.${item.id}`;
  return item;
}

/** An actor with a token at (x, 0) feet, holding these pack items (and these plain items). */
function makeActor(name, { files = [], items: extra = [], x = 0, disposition = 1, system = {}, statuses = [] } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', documentName: 'Actor', isOwner: true, statuses: new Set(statuses), flags: { essence20: {} },
    system: { level: 5, health: { value: 10, max: 10 }, energon: { normal: { value: 3 } }, ...system },
    async update(data) {
      await applyUpdate(this, data);
    },
    toggleStatusEffect: jest.fn(),
  };
  actor.uuid = `Actor.${actor.id}`;
  const token = { id: `t${actor.id}`, actor, document: { disposition }, center: { x, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  const items = [
    ...files.map(file => {
      const doc = fromPack(file);
      return makeItem({ id: `c${nextId++}`, name: doc.name, type: doc.type, system: doc.system });
    }),
    ...extra.map(data => makeItem(data)),
  ];
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  for (const item of items) {
    item.parent = actor;
  }

  rebuildIndex(actor);
  game.actors.contents.push(actor);
  canvas.tokens.placeables.push(token);
  return actor;
}

function target(...actors) {
  game.user.targets = new Set(actors.map(actor => actor.token));
}

/**
 * The roller's dice: every targeted creature's row, as `outcomes` says (true = a plain success,
 * 'double' = a success by double the DIF, false = a miss), with the post-roll hooks run as dice.mjs does.
 */
function rollsAs(actor, outcomes = {}, during = () => {}) {
  actor._dice = {
    rollSkill: jest.fn(async (dataset) => {
      const targets = [...game.user.targets].map(token => token.actor);
      during(targets, dataset);
      const results = targets.map(other => {
        const outcome = outcomes[other.name] ?? false;
        return { targetUuid: other.uuid, success: !!outcome, multiplier: outcome == 'double' ? 2 : 1, total: 15, difficulty: 10 };
      });
      const hits = targets.map((other, i) => ({ target: other, hit: results[i].success, result: results[i] }));
      await runPostRoll(actor, results, {}, { hits, isCrit: false, rider: { skill: dataset.skill } });
      return { results };
    }),
  };
}

const pay = jest.fn(async () => true);
const itemOf = (actor, name) => actor.items.contents.find(item => item.name == name);
const buttonCards = () => ChatMessage.create.mock.calls.map(([data]) => data).filter(data => data.flags?.essence20?.ruleButton);

beforeEach(() => {
  timed.length = 0;
  dealt.length = 0;
  pay.mockClear();
  global.game = {
    combat: null, combats: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null, contents: [] },
    i18n: { localize: k => k, format: k => k, has: () => false }, settings: { get: () => 1 }, actors: { contents: [] },
  };
  global.CONFIG = { E20: { skillToEssence: { intimidation: 'strength', technology: 'smarts' } } };
  global.canvas = {
    tokens: {
      placeables: [],
      setTargets: jest.fn(ids => {
        game.user.targets = new Set(canvas.tokens.placeables.filter(token => ids.includes(token.id)));
      }),
    },
    grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) },
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.ChatMessage = { create: jest.fn(async data => ({ ...data, update: jest.fn() })), getSpeaker: () => ({}) };
  global.fromUuidSync = uuid => game.actors.contents.find(actor => actor.uuid == uuid) ?? null;
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: {
      ...(global.foundry?.utils ?? {}),
      getProperty: getPath,
      setProperty: setPath,
      deepClone: value => JSON.parse(JSON.stringify(value)),
      escapeHTML: text => String(text),
      randomID: () => `r${nextId++}`,
    },
  };
});

describe('Decepticon Directive roll-against-many Perks', () => {
  test('no Use buttons left in the slice for them', () => {
    const ids = [...COMBAT_USES, ...SUPPORT_USES, ...TF3_USES].map(use => use.id);
    for (const id of ['tf1MakeAnExample', 'tf1BrutalDisplay', 'tf1CommsAssault', 'tf1FlexibleSwitch', 'tf3OneBotOverAnother']) {
      expect(ids).not.toContain(id);
    }

    expect(registrySnapshot().costRules.some(rule => rule.id == 'tf1FlexibleSwitch')).toBe(false);
  });

  test('Brutal Display: the fallen foe\'s standing allies within 100 ft of the holder, Frightened 1 round (10 on double)', async () => {
    const hero = makeActor('Hero', { files: [BRUTAL] });
    const fallen = makeActor('Fallen', { x: 5, disposition: -1, statuses: ['defeated'] });
    makeActor('Near', { x: 40, disposition: -1 });
    makeActor('Brute', { x: 90, disposition: -1 });
    makeActor('Far', { x: 120, disposition: -1 });
    makeActor('Down', { x: 30, disposition: -1, system: { health: { value: 0, max: 10 } } });
    makeActor('Friend', { x: 20, disposition: 1 });
    rollsAs(hero, { Near: true, Brute: 'double' });

    // No Defeated target: nothing is spent or rolled.
    target(makeActor('Standing', { x: 10, disposition: -1 }));
    await runUse(itemOf(hero, 'Brutal Display'), pay);
    expect(hero._dice.rollSkill).not.toHaveBeenCalled();
    expect(hero.system.energon.normal.value).toBe(3);

    target(fallen);
    await runUse(itemOf(hero, 'Brutal Display'), pay);
    expect(hero._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'intimidation', defenseType: 'willpower' }), hero);
    expect(hero.system.energon.normal.value).toBe(2);
    expect(timed.map(t => `${t.name}:${t.status}:${t.rounds}`).sort()).toEqual(['Brute:frightened:10', 'Near:frightened:1']);
    // The roll's mark is gone: a later hit by the holder does nothing.
    expect(hero.flags.essence20.ruleMarks?.tf1BrutalDisplayRoll).toBeUndefined();
  });

  test('Brutal Display: no foe in range costs nothing', async () => {
    const hero = makeActor('Hero', { files: [BRUTAL] });
    const fallen = makeActor('Fallen', { x: 5, disposition: -1, statuses: ['defeated'] });
    rollsAs(hero);
    target(fallen);
    await runUse(itemOf(hero, 'Brutal Display'), pay);
    expect(hero._dice.rollSkill).not.toHaveBeenCalled();
    expect(hero.system.energon.normal.value).toBe(3);
  });

  test('Make An Example: a Free action; foes within 30 ft of the fallen; Stun 1 buttons per hit, Frightened on double', async () => {
    const hero = makeActor('Hero', { files: [EXAMPLE] });
    const fallen = makeActor('Fallen', { x: 50, disposition: -1, system: { health: { value: 0, max: 10 } } });
    makeActor('Grunt', { x: 70, disposition: -1 });
    makeActor('Boss', { x: 30, disposition: -1 });
    makeActor('Missed', { x: 75, disposition: -1 });
    makeActor('Away', { x: 90, disposition: -1 });
    makeActor('Pal', { x: 55, disposition: 1 });
    rollsAs(hero, { Grunt: true, Boss: 'double' });
    target(fallen);
    await runUse(itemOf(hero, 'Make An Example'), pay);
    expect(pay).toHaveBeenCalledWith('free');
    expect(hero._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'intimidation', defenseType: 'willpower' }), hero);
    expect(timed).toEqual([{ name: 'Boss', status: 'frightened', rounds: 1 }]);
    const cards = buttonCards();
    expect(cards.map(card => game.actors.contents.find(a => a.uuid == card.flags.essence20.ruleButton.targets[0]).name).sort()).toEqual(['Boss', 'Grunt']);
    expect(cards[0].flags.essence20.ruleButton.who).toBe('targets');

    // Pressing a card deals the Stun 1 to its creature.
    const card = cards.find(c => c.flags.essence20.ruleButton.targets[0] == game.actors.contents.find(a => a.name == 'Grunt').uuid);
    await pressRuleButton({ ...card, update: jest.fn() });
    expect(dealt).toEqual([{ name: 'Grunt', amount: 1, type: 'stun' }]);
  });

  test('Make An Example: no foes near the fallen - no Free action spent', async () => {
    const hero = makeActor('Hero', { files: [EXAMPLE] });
    const fallen = makeActor('Fallen', { x: 50, disposition: -1, statuses: ['defeated'] });
    makeActor('Away', { x: 90, disposition: -1 });
    rollsAs(hero);
    target(fallen);
    await runUse(itemOf(hero, 'Make An Example'), pay);
    expect(pay).not.toHaveBeenCalled();
    expect(hero._dice.rollSkill).not.toHaveBeenCalled();
  });

  test('Comms Assault: Standard + 1 Energon; non-allies within 100 ft; Toughness without armor; Stunned + EMP 1 per hit', async () => {
    const hero = makeActor('Hero', { files: [COMMS] });
    const foe = makeActor('Foe', { x: 40, disposition: -1, items: [{ id: 'arm', type: 'armor', system: { equipped: true, totalBonusToughness: 2 } }], system: { defenses: { toughness: { armor: 1 } } } });
    makeActor('Bystander', { x: 60, disposition: 0 });
    makeActor('Far', { x: 150, disposition: -1 });
    makeActor('Friend', { x: 20, disposition: 1 });
    makeActor('Wreck', { x: 30, disposition: -1, statuses: ['defeated'] });
    const adjusts = [];
    rollsAs(hero, { Foe: true }, (targets, dataset) => {
      adjusts.push(ignoreArmorAdjust(hero, foe, dataset.defenseType));
      expect(targets.map(t => t.name).sort()).toEqual(['Bystander', 'Foe']);
    });
    await runUse(itemOf(hero, 'Comms Assault'), pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(hero.system.energon.normal.value).toBe(2);
    expect(hero._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'technology', defenseType: 'toughness' }), hero);
    expect(adjusts).toEqual([-3]);
    expect(ignoreArmorAdjust(hero, foe, 'toughness')).toBe(0);
    expect(hero.flags.essence20.ruleMarks?.[COMMS_MARK]).toBeUndefined();
    expect(timed).toEqual([{ name: 'Foe', status: 'stunned', rounds: 1 }]);
    expect(buttonCards().map(card => card.flags.essence20.ruleButton.steps[0])).toEqual([expect.objectContaining({ do: 'damage', amount: 1, damageType: 'emp' })]);
  });
});

describe('Flexible Switch', () => {
  const modes = () => [{ id: 'm1', name: 'Jet', type: 'altMode' }, { id: 'm2', name: 'Tank', type: 'altMode' }, { id: 'm3', name: 'Car', type: 'altMode' }];

  test('picks two different owned Alt Modes outside combat; the Free conversion covers only them', async () => {
    const bot = makeActor('Bot', { files: [SWITCH], items: modes(), system: { isTransformed: true, altModeId: 'm3' } });
    const perk = itemOf(bot, 'Flexible Switch');
    const rule = () => costRulesFor(bot).find(entry => entry.label == 'Flexible Switch');
    // No picks yet: any conversion between Alt Modes.
    expect(rule().matches({ kind: 'conversion' })).toBe(true);
    expect(rule().to()).toBe('free');
    expect(rule().ask).toBe('E20.Tf1AskFlexibleSwitch');

    const offered = [];
    grants.chooseSelect.mockImplementation(async (title, prompt, options) => {
      offered.push(options.map(o => o.value));
      return offered.length == 1 ? 'm1' : 'm2';
    });
    await runUse(perk, pay);
    expect(offered).toEqual([['m1', 'm2', 'm3'], ['m2', 'm3']]);
    expect(perk.flags.essence20.rules.choices).toMatchObject({ switchA: 'm1', switchB: 'm2' });
    expect(rule().matches({ kind: 'conversion' })).toBe(false);
    bot.system.altModeId = 'm2';
    expect(rule().matches({ kind: 'conversion' })).toBe(true);
    expect(rule().matches({ kind: 'attack' })).toBe(false);
    bot.system.isTransformed = false;
    expect(rule().matches({ kind: 'conversion' })).toBe(false);
    grants.chooseSelect.mockReset();
  });

  test('not in a combat, not with fewer than two Alt Modes; the old picks carry over', async () => {
    const bot = makeActor('Bot', { files: [SWITCH], items: [modes()[0]] });
    expect(await runUse(itemOf(bot, 'Flexible Switch'), pay)).toBeNull();
    const two = makeActor('Two', { files: [SWITCH], items: modes() });
    game.combat = { started: false, combatants: [] };
    expect(await runUse(itemOf(two, 'Flexible Switch'), pay)).toBeNull();

    const perk = itemOf(two, 'Flexible Switch');
    perk.flags.essence20 = { switchModes: ['m1', 'm3'] };
    expect(legacyChoiceUpdates(two)).toEqual([expect.objectContaining({ 'flags.essence20.rules.choices.switchA': 'm1', 'flags.essence20.rules.choices.switchB': 'm3' })]);
  });
});

describe('One Bot Over Another', () => {
  const entry = (name, attacks) => ({ uuid: `Compendium.x.Item.${name}`, name, system: { items: Object.fromEntries(attacks.map((a, i) => [`e${i}`, { type: 'weaponEffect', ...a }])) } });
  const axe = entry('Axe', [{ classification: { style: 'melee' } }]);
  const spear = entry('Spear', [{ classification: { style: 'thrown' }, range: { reachMultiplier: 2 } }]);
  const rifle = entry('Rifle', [{ classification: { style: 'ballistic' } }]);
  const bare = entry('Bare', [{ classification: {} }]);

  test('a Limited melee and a Limited projectile weapon, or a Restricted one, Qualified at Requisition', async () => {
    const bot = makeActor('Bot', { files: [ONE_BOT] });
    const perk = itemOf(bot, 'One Bot Over Another');
    const asked = [];
    grants.findItems.mockImplementation(async ({ availabilities, matches }) => {
      asked.push({ availabilities, picks: [axe, spear, rifle, bare].filter(e => !matches || matches(e)).map(e => e.name) });
      return [axe, spear, rifle, bare].filter(e => !matches || matches(e));
    });
    grants.pickOne.mockImplementation(async (title, rows) => rows.at(-1)?.uuid ?? null);

    await runUse(perk, pay, { ask: async () => 0 });
    expect(asked).toEqual([{ availabilities: ['limited'], picks: ['Axe', 'Spear'] }, { availabilities: ['limited'], picks: ['Spear', 'Rifle'] }]);
    expect(perk.flags.essence20.rules.choices.chosen.map(c => c.name)).toEqual(['Spear', 'Rifle']);
    const access = item => ruleRequisitionAccess(bot, item);
    expect(access({ type: 'weapon', name: 'Rifle', flags: { core: { sourceId: rifle.uuid } }, system: {} })).toBe('qualified');
    expect(access({ type: 'weapon', name: 'Other', flags: { core: { sourceId: 'Compendium.x.Item.Spear' } }, system: {} })).toBe('qualified');
    expect(access({ type: 'weapon', name: 'Axe', flags: { core: { sourceId: axe.uuid } }, system: {} })).toBeNull();

    // Taking the Restricted weapon instead replaces both picks.
    asked.length = 0;
    await runUse(perk, pay, { ask: async () => 1 });
    expect(asked).toEqual([{ availabilities: ['restricted'], picks: ['Axe', 'Spear', 'Rifle', 'Bare'] }]);
    expect(perk.flags.essence20.rules.choices.chosen.map(c => c.name)).toEqual(['Bare']);
    expect(access({ type: 'weapon', name: 'Rifle', flags: { core: { sourceId: rifle.uuid } }, system: {} })).toBeNull();
    grants.findItems.mockReset();
    grants.pickOne.mockReset();
  });

  test('a pick made before the update carries over', () => {
    const bot = makeActor('Bot', { files: [ONE_BOT] });
    const perk = itemOf(bot, 'One Bot Over Another');
    const old = [{ uuid: 'Compendium.x.Item.Axe', name: 'Axe' }];
    perk.flags.essence20 = { tf3Chosen: old };
    expect(legacyChoiceUpdates(bot)).toEqual([expect.objectContaining({ 'flags.essence20.rules.choices.chosen': old })]);
  });
});
