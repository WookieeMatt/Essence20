import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slD7: round-7 re-check of the react / resource / other1 / other3 slices. Extensive Research (pickGrant with index
 * fields, replace and a worldTime duration), Zap Apple Jam's Use and Edge (choose options gated on counters kept on
 * the jar), Good with Both (equipped-weapon count), Eat the Weak (hasItem:name~ and difDefenseSelf), Disenfranchised
 * (a clicker's button acting for the selected token) and Thick Hide (a granted shield kept equipped, its raised bonus
 * a Defense rule) moved off the slices; Cruel Conflagration's buttons are whispered and used up only when paid; the PR
 * Defender no longer answers its holder's own attack. Each item is loaded from its pack source and must do what the
 * removed code did.
 */

const { rebuildIndex } = await import('./index.mjs');
const { reactionOffers } = await import('./reactions.mjs');
const { cardInfo } = await import('../mechanics/combat/reaction-engine.mjs');
const { validateRule } = await import('./types.mjs');
const { fireTriggers, fireItemAdded, runUse } = await import('./triggers.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { bankedEntries } = await import('./bank.mjs');
const { isExpired } = await import('./expiry.mjs');
const { pressRuleButton } = await import('./buttons.mjs');
const { applyRuleSwitches, ruleDialogSwitches, ruleRollSources, ruleDerived } = await import('./adapter.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  cruelConflagration: 'fmmcitems/_source/Cruel_Conflagration_c22iQeKZY1TmPzFe.json',
  defender: 'prcrbitems/_source/Defender_4kt5qBpgTEgY8cGF.json',
  extensiveResearch: 'mlpcrbitems/_source/Extensive_Research_TwW8c51b3bCL9Rul.json',
  zapAppleJam: 'iajitems/_source/Zap_Apple_Jam_L5B7d8mw0xeOHVkw.json',
  goodWithBoth: 'atsitems/_source/Good_with_Both_bUfVm0jmCcAxu2M3.json',
  eatTheWeak: 'dditems/_source/Eat_the_Weak_hzCEZfTNDsQcOjUB.json',
  disenfranchised: 'ccitems/_source/Disenfranchised_bLBiNpqobnTDH769.json',
  thickHide: 'ccitems/_source/Thick_Hide_yFlxX1ErTOlXXjz7.json',
};
const RIOT_SHIELD = 'Compendium.essence20.cobra_codex.Item.MQuoZeuRPWEyUxFc';

/** foundry.utils.setProperty, for plain objects; a "-=key" part deletes that key. */
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const at = keys.reduce((node, key) => (node[key] ??= {}), object);
  if (last.startsWith('-=')) {
    delete at[last.slice(2)];
  } else {
    at[last] = value;
  }
}

const clone = value => JSON.parse(JSON.stringify(value));

let nextId = 1;

function makeItem(actor, data) {
  return {
    id: `i${nextId++}`, flags: {}, system: {}, parent: actor, isOwner: true, ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
  };
}

/** An actor with a token on the canvas (x feet along, disposition), holding the pack items `files` and any extra item data. */
function makeActor(name, files = [], { x = 0, disposition = 1, type = 'playerCharacter', system = {}, extra = [] } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: {
      level: 5, health: { value: 10, max: 10 }, powers: { personal: { value: 3, max: 3 } }, skills: {},
      defenses: { toughness: { total: 10 }, evasion: { total: 10 }, willpower: { total: 11 }, cleverness: { total: 14 } }, ...system,
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
      return key.split('.').reduce((at, k) => at?.[k], this.flags[scope]);
    },
    toggleStatusEffect: jest.fn(async function (status, { active = true } = {}) {
      this.statuses[active ? 'add' : 'delete'](status);
    }),
    createEmbeddedDocuments: jest.fn(async function (kind, datas) {
      const made = datas.map(data => makeItem(this, { ...data, flags: data.flags ?? {} }));
      items.push(...made);
      rebuildIndex(this);
      return made;
    }),
    deleteEmbeddedDocuments: jest.fn(async function (kind, ids) {
      for (const id of ids) {
        const at = items.findIndex(item => item.id == id);
        if (at >= 0) {
          items.splice(at, 1);
        }
      }

      rebuildIndex(this);
    }),
  };
  actor.uuid = `Actor.${actor.id}`;
  for (const file of [files].flat()) {
    const doc = fromPack(file);
    items.push(makeItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system) }));
  }

  for (const data of extra) {
    items.push(makeItem(actor, data));
  }

  actor.items = {
    contents: items, get: id => items.find(item => item.id == id), find: fn => items.find(fn), filter: fn => items.filter(fn), some: fn => items.some(fn),
    [Symbol.iterator]: () => items[Symbol.iterator](),
  };
  const token = { actor, document: { disposition }, center: { x, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  rebuildIndex(actor);
  return actor;
}

const itemOf = actor => actor.items.contents[0];

/** A weapon (equipped) with one attack using `skill`, as items for makeActor's extra. */
function wielded(skill, { equipped = true, numHands = 1 } = {}) {
  const id = `w${nextId++}`;
  return [
    { id, name: 'Weapon', type: 'weapon', system: { equipped, traits: [] } },
    { name: 'Attack', type: 'weaponEffect', flags: { essence20: { parentId: id } }, system: { classification: { skill, style: 'melee' }, numHands, damageType: 'blunt' } },
  ];
}

/** A posted check card from `attacker`: rows [[target, DIF]], the total, and card flags. */
function cardFor(attacker, rows, total, { flags = {} } = {}) {
  const id = `m${nextId++}`;
  const store = {};
  const content = rows.map(([target]) => (total >= rows[0][1]
    ? `<button data-action="apply-damage" data-key="${target.uuid}:base" data-target-uuid="${target.uuid}" data-damage="3" data-damage-type="blunt">` : '')).join('');
  const message = {
    id, speaker: { actor: attacker.id }, content,
    flags: { essence20: { checkResults: rows.map(([target, difficulty]) => ({ targetUuid: target.uuid, difficulty, success: total >= difficulty })), isAttack: true, ...flags } },
    rolls: [{ total, formula: '1d20', dice: [{ faces: 20, results: [{ result: total, active: true }] }] }],
    getFlag: (scope, key) => store[key],
    async setFlag(scope, key, value) {
      store[key] = value;
    },
  };
  global.game.messages = { get: messageId => (messageId == id ? message : null) };
  return { message, info: cardInfo(message) };
}

let docs = new Map();

function world(...actors) {
  docs = new Map(actors.map(actor => [actor.uuid, actor]));
  for (const actor of actors) {
    for (const item of actor.items.contents) {
      item.uuid = `${actor.uuid}.Item.${item.id}`;
      docs.set(item.uuid, item);
    }
  }

  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.fromUuid = async uuid => docs.get(uuid) ?? null;
  global.game.actors = { get: id => actors.find(actor => actor.id == id) ?? null, contents: actors, [Symbol.iterator]: () => actors[Symbol.iterator]() };
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token), controlled: [] }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
}

function setCombat(combat) {
  global.game.combat = combat;
  global.game.combats = { get: id => (combat?.id == id ? combat : null) };
}

const createCalls = () => global.ChatMessage.create.mock.calls.map(call => call[0]);
const ruleButtons = () => createCalls().map(data => data?.flags?.essence20?.ruleButton).filter(Boolean);
/** The last rule-button card posted, as a pressable message. */
const lastButtonCard = () => {
  const data = createCalls().filter(call => call?.flags?.essence20?.ruleButton).at(-1);
  return { flags: data.flags, isOwner: true, update: jest.fn(async () => {}) };
};

/** DialogV2.wait answers, in order (a `choose` takes the option index as a string). */
function dialogAnswers(...answers) {
  const wait = jest.fn(async () => answers.shift() ?? null);
  global.foundry.applications = { ...global.foundry.applications, api: { ...global.foundry.applications?.api, DialogV2: { wait } } };
  return wait;
}

/** A rollSkill mock: success for every call. */
const rolls = (success = true) => jest.fn(async () => ({ success, outcomes: [{ results: [{ success, multiplier: 1 }] }] }));

/** Run an item's (first available) Use rule; `answer` picks a `choose` option by the start of its label. */
async function use(item, answer = null) {
  const offered = [];
  const ask = jest.fn(async (step, options) => {
    offered.push(options.map(option => option.label));
    const index = options.findIndex(option => option.label.startsWith(answer));
    return index < 0 ? null : index;
  });
  const card = await runUse(item, async () => true, { pick: async (it, available) => available[0], ask });
  return { card, offered, ask };
}

const savedGame = global.game;
const savedFromUuid = global.fromUuid;
const savedFromUuidSync = global.fromUuidSync;
const savedConfig = global.CONFIG;

beforeEach(() => {
  global.game = {
    ...savedGame, combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] },
    settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false }, time: { worldTime: 1000 },
  };
  global.CONFIG = {
    ...savedConfig,
    E20: { ...(savedConfig?.E20 ?? {}), skillToEssence: { ...(savedConfig?.E20?.skillToEssence ?? {}), culture: 'social', deception: 'social', intimidation: 'social', persuasion: 'social' } },
  };
  global.ChatMessage = { ...global.ChatMessage, create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...global.foundry,
    utils: {
      ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o),
      hasProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) !== undefined, escapeHTML: text => String(text),
      deepClone: clone,
    },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
  global.canvas = undefined;
  global.game = savedGame;
  global.CONFIG = savedConfig;
  global.fromUuid = savedFromUuid;
  global.fromUuidSync = savedFromUuidSync;
});

test('every slD7 rule validates', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

describe('Cruel Conflagration: whispered cards, used up only when paid', () => {
  function setup() {
    const roller = makeActor('Bulk', [], { disposition: -1, x: 10 });
    const holder = makeActor('Finster', FILES.cruelConflagration);
    holder.testUserPermission = user => user.id == 'p';
    world(roller, holder);
    global.game.users = { contents: [{ id: 'gm', isGM: true }, { id: 'p', isGM: false }, { id: 'q', isGM: false }] };
    return { roller, holder };
  }

  const failure = roller => fireTriggers(roller, 'afterRoll', { outcome: 'failure', facts: { results: [{ success: false }], isFumble: false } });
  const fumble = roller => fireTriggers(roller, 'afterRoll', { outcome: 'fumble', facts: { results: [{ success: false }], isFumble: true } });

  test('both cards go only to the holder\'s owners and the GM', async () => {
    const { roller } = setup();
    await failure(roller);
    await fumble(roller);
    const cards = createCalls().filter(data => data?.flags?.essence20?.ruleButton);
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.whisper).toEqual(['gm', 'p']);
      expect(card.flags.essence20.ruleButton.usedWhenDone).toBe(true);
    }
  });

  test('without enough Personal Power, or backing out of the Fumble question, the card stays pressable', async () => {
    const { roller, holder } = setup();
    holder.system.powers.personal.value = 0;
    await failure(roller);
    const short = lastButtonCard();
    await pressRuleButton(short);
    expect(short.update).not.toHaveBeenCalled();
    expect(roller.statuses.has('impaired')).toBe(false);

    holder.system.powers.personal.value = 3;
    await fumble(roller);
    const backedOut = lastButtonCard();
    dialogAnswers(null);
    await pressRuleButton(backedOut);
    expect(backedOut.update).not.toHaveBeenCalled();
    expect(holder.system.powers.personal.value).toBe(3);
  });

  test('a paid press uses the card up', async () => {
    const { roller, holder } = setup();
    await failure(roller);
    const card = lastButtonCard();
    await pressRuleButton(card);
    expect(holder.system.powers.personal.value).toBe(2);
    expect(card.update).toHaveBeenCalledWith({ 'flags.essence20.ruleButton.used': true });
  });
});

describe('Defender (PR): not against the holder\'s own attack', () => {
  test('offered when someone else hits the adjacent ally, never on the holder\'s own card', () => {
    const attacker = makeActor('Putty', [], { disposition: -1, x: 5 });
    const ally = makeActor('Red', [], { x: 0 });
    const holder = makeActor('Pink', FILES.defender, { x: 5, system: { skills: { finesse: { shift: 'd6', isSpecialized: true } } }, extra: wielded('finesse') });
    world(attacker, ally, holder);
    expect(reactionOffers(cardFor(attacker, [[ally, 12]], 15, { flags: { isMelee: true } }).info).map(offer => offer.actor)).toEqual([holder]);
    expect(reactionOffers(cardFor(holder, [[ally, 12]], 15, { flags: { isMelee: true } }).info)).toEqual([]);
  });
});

describe('Extensive Research (pickGrant)', () => {
  const ENTRIES = [
    { uuid: 'C.elementary', system: { tier: 'elementary' } },
    { uuid: 'C.superior', system: { tier: 'superior' } },
    { uuid: 'C.virtuoso', system: { tier: 'virtuoso' } },
    { uuid: 'C.untiered', system: {} },
  ];

  function setup(shift = 'd8', extra = []) {
    const pony = makeActor('Twilight', FILES.extensiveResearch, { system: { skills: { spellcasting: { shift } } }, extra });
    world(pony);
    const perk = itemOf(pony);
    const helpers = {
      findItems: jest.fn(async ({ matches }) => ENTRIES.filter(entry => !matches || matches(entry))),
      pickOne: jest.fn(async () => null),
      grantCopy: jest.fn(async (actor, uuid, options) => {
        const [made] = await actor.createEmbeddedDocuments('Item', [{ name: uuid, type: 'spell', flags: { essence20: { grantedBy: options.grantedBy.id, ...options.flags } } }]);
        return made;
      }),
    };
    const run = async () => {
      const ctx = stepContext({ actor: pony, item: perk, rule: perk.system.rules[0], targets: [] });
      ctx.grantHelpers = helpers;
      return runSteps(perk.system.rules[0].steps, ctx);
    };

    return { pony, perk, helpers, run };
  }

  test('offers the spells the Spellcasting die reaches by tier (d4 / d8 / d12), reading system.tier from the index', async () => {
    const offered = async shift => {
      const { helpers, run } = setup(shift);
      await run();
      expect(helpers.findItems.mock.calls[0][0]).toMatchObject({ type: 'spell', fields: ['system.tier'] });
      return (await helpers.findItems.mock.results[0].value).map(entry => entry.uuid);
    };

    expect(await offered('d8')).toEqual(['C.elementary', 'C.superior', 'C.untiered']);
    expect(await offered('d6')).toEqual(['C.elementary', 'C.untiered']);
    expect(await offered('d12')).toEqual(['C.elementary', 'C.superior', 'C.virtuoso', 'C.untiered']);
    expect(await offered('2d8')).toHaveLength(4);
    expect(await offered('d2')).toEqual([]);
  });

  test('one spell at a time: the earlier one goes only once a new pick is made; it lasts a week of game time', async () => {
    const { pony, perk, helpers, run } = setup('d8');
    const old = { name: 'Old Spell', type: 'spell', flags: { essence20: { grantedBy: perk.id } } };
    pony.items.contents.push(makeItem(pony, old));
    expect(await run()).toBe(false);
    expect(pony.items.contents.map(item => item.name)).toContain('Old Spell');

    helpers.pickOne = jest.fn(async () => 'C.superior');
    await run();
    const names = pony.items.contents.map(item => item.name);
    expect(names).not.toContain('Old Spell');
    expect(names).toContain('C.superior');
    const flags = helpers.grantCopy.mock.calls.at(-1)[2].flags;
    expect(flags.rulesExpiry).toEqual({ until: 'worldTime:604800', stamp: { worldTime: 1000 + 604800 } });
    game.time.worldTime = 1000 + 604799;
    expect(isExpired(flags.rulesExpiry)).toBe(false);
    game.time.worldTime = 1000 + 604800;
    expect(isExpired(flags.rulesExpiry)).toBe(true);
  });
});

describe('Zap Apple Jam (Use + Edge)', () => {
  const DAMAGED = { strength: { max: 4, value: 2 }, speed: { max: 3, value: 3 }, smarts: { max: 2, value: 1 }, social: { max: 3, value: 3 } };

  function setup(quantity = 1) {
    const pony = makeActor('Applejack', FILES.zapAppleJam, { system: { essences: clone(DAMAGED) } });
    world(pony);
    const jar = itemOf(pony);
    jar.system.quantity = quantity;
    return { pony, jar };
  }

  // The jar's own Edge (its RollModifier on the jam / pastry toggles), apart from a banked pastry Edge.
  const edge = actor => (ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources ?? []).some(source => source.edge && source.label.includes('(Edge)'));
  const bankedEdge = actor => (ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources ?? []).some(source => source.edge && source.label.includes('pastry'));

  test('eating a cup heals every point of Essence damage, gives Edge for the scene and leaves 2 cups', async () => {
    const { pony, jar } = setup();
    expect(edge(pony)).toBe(false);
    const { offered } = await use(jar, 'Eat a cup');
    expect(offered[0]).toEqual([expect.stringMatching(/^Eat a cup/), expect.stringMatching(/^Bake/), expect.stringMatching(/^Barter/)]);
    expect(jar.flags.essence20.zapCups).toBe(2);
    expect(Object.values(pony.system.essences).every(e => e.value == e.max)).toBe(true);
    expect(edge(pony)).toBe(true);
  });

  test('a jar of 2 holds 6 cups; baking makes 6 pastries; with the cups gone only a pastry is offered', async () => {
    const { jar } = setup(2);
    await use(jar, 'Bake');
    expect(jar.flags.essence20).toMatchObject({ zapCups: 5, zapPastries: 6 });
    jar.flags.essence20.zapCups = 0;
    const { offered } = await use(jar, 'Eat a pastry');
    expect(offered[0]).toEqual([expect.stringMatching(/^Eat a pastry/)]);
    expect(jar.flags.essence20.zapPastries).toBe(5);
  });

  test('bartering uses a cup; an empty jar offers nothing and posts nothing', async () => {
    const { jar } = setup();
    await use(jar, 'Barter');
    expect(jar.flags.essence20.zapCups).toBe(2);
    jar.flags.essence20.zapCups = 0;
    const { card, ask } = await use(jar, 'Eat');
    expect(ask).not.toHaveBeenCalled();
    expect(card).toBeNull();
  });

  test('a pastry heals 1 Essence: out of combat Edge on the next roll, in a combat Edge for that turn', async () => {
    const { pony, jar } = setup();
    jar.flags.essence20 = { zapPastries: 2 };
    await use(jar, 'Eat a pastry');
    expect(pony.system.essences.strength.value).toBe(3);
    expect(bankedEntries(pony)).toEqual([expect.objectContaining({ edge: true, uses: 1 })]);
    expect(bankedEdge(pony)).toBe(true);
    expect(edge(pony)).toBe(false);

    const combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [{ actor: pony }, { actor: { id: 'x' } }] };
    setCombat(combat);
    await use(jar, 'Eat a pastry');
    expect(edge(pony)).toBe(true);
    combat.turn = 1;
    expect(edge(pony)).toBe(false);
  });
});

describe('Good with Both (DialogSwitch)', () => {
  const offHand = (actor, effect) => ruleDialogSwitches(actor, { item: effect, rolledSkill: 'finesse' }).find(entry => entry.label.includes('Off-hand'));

  test('an unticked ↓1 on a one-handed attack while two weapons are equipped', async () => {
    const [weapon, attack] = wielded('finesse');
    const holder = makeActor('Hero', FILES.goodWithBoth, { extra: [weapon, attack, ...wielded('finesse')] });
    world(holder);
    const effect = holder.items.contents.find(item => item.type == 'weaponEffect');
    const entry = offHand(holder, effect);
    expect(entry).toMatchObject({ type: 'checkbox', value: false });
    const options = { ext: { [entry.name]: true }, shiftDown: 0 };
    await applyRuleSwitches(holder, options, { item: effect, rolledSkill: 'finesse' });
    expect(options.shiftDown).toBe(1);
  });

  test('not with one weapon equipped, nor on a two-handed attack', () => {
    const one = makeActor('Hero', FILES.goodWithBoth, { extra: [...wielded('finesse'), ...wielded('finesse', { equipped: false })] });
    expect(offHand(one, one.items.contents.find(item => item.type == 'weaponEffect'))).toBeUndefined();
    const twoHanded = makeActor('Hero', FILES.goodWithBoth, { extra: [...wielded('might', { numHands: 2 }), ...wielded('finesse')] });
    expect(offHand(twoHanded, twoHanded.items.contents.find(item => item.type == 'weaponEffect'))).toBeUndefined();
  });
});

describe('Eat the Weak (Use)', () => {
  const addiction = () => ({ name: 'Addicted (Dark Energon)', type: 'hangUp' });

  function setup({ targetAddicted = true, selfAddicted = false, success = true } = {}) {
    const holder = makeActor('Follower', FILES.eatTheWeak, { extra: selfAddicted ? [addiction()] : [], system: { defenses: { willpower: { total: 9 } } } });
    const victim = makeActor('Junkie', [], { extra: targetAddicted ? [addiction()] : [] });
    holder._dice = { rollSkill: rolls(success) };
    world(holder, victim);
    return { holder, victim };
  }

  const names = actor => actor.items.contents.map(item => item.name);

  test('a Culture test against the target\'s Willpower removes their Addicted (Dark Energon) Hang-Up', async () => {
    const { holder, victim } = setup();
    global.game.user.targets = new Set([victim.token]);
    await use(itemOf(holder));
    expect(holder._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'culture', dif: '11' }), holder);
    expect(names(victim)).not.toContain('Addicted (Dark Energon)');
  });

  test('a failed test leaves it; a target without the Hang-Up isn\'t rolled against', async () => {
    const failed = setup({ success: false });
    global.game.user.targets = new Set([failed.victim.token]);
    await use(itemOf(failed.holder));
    expect(names(failed.victim)).toContain('Addicted (Dark Energon)');

    const clean = setup({ targetAddicted: false, selfAddicted: true });
    global.game.user.targets = new Set([clean.victim.token]);
    const { card } = await use(itemOf(clean.holder));
    expect(clean.holder._dice.rollSkill).not.toHaveBeenCalled();
    expect(card).toContain('no Addicted');
    expect(names(clean.holder)).toContain('Addicted (Dark Energon)');
  });

  test('with no target it works on the holder, against their own Willpower', async () => {
    const { holder } = setup({ targetAddicted: false, selfAddicted: true });
    await use(itemOf(holder));
    expect(holder._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'culture', dif: '9' }), holder);
    expect(names(holder)).not.toContain('Addicted (Dark Energon)');
  });
});

describe('Disenfranchised (Use + clicker button)', () => {
  function setup() {
    const holder = makeActor('Loner', FILES.disenfranchised);
    const helper = makeActor('Officer', []);
    const other = makeActor('Medic', []);
    helper._dice = { rollSkill: rolls(true) };
    other._dice = { rollSkill: rolls(false) };
    world(holder, helper, other);
    return { holder, helper, other };
  }

  test('posts a repeatable button anyone may press, naming the Willpower to beat', async () => {
    const { holder } = setup();
    const { card } = await use(itemOf(holder));
    expect(card).toContain('Willpower 11');
    expect(ruleButtons()).toEqual([expect.objectContaining({ who: 'anyone', runAs: 'clicker', once: false })]);
  });

  test('the presser rolls their chosen Skill against the holder\'s Willpower as their selected token, else their character', async () => {
    const { holder, helper, other } = setup();
    await use(itemOf(holder));
    const card = lastButtonCard();
    global.game.user = { id: 'p', isGM: false, targets: new Set(), character: other };
    global.canvas.tokens.controlled = [helper.token];
    dialogAnswers('2');
    expect(await pressRuleButton(card, global.game.user)).toBe(true);
    expect(helper._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'persuasion', dif: '11' }), helper);
    expect(card.update).not.toHaveBeenCalled();

    global.canvas.tokens.controlled = [];
    dialogAnswers('0');
    await pressRuleButton(card, global.game.user);
    expect(other._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'deception', dif: '11' }), other);
  });
});

describe('Thick Hide (granted riot shield)', () => {
  const alteration = () => ({ name: 'Alteration', type: 'alteration' });

  function setup(alterations = 3) {
    const holder = makeActor('Mutant', FILES.thickHide, { extra: Array.from({ length: alterations }, alteration), system: { defenses: { evasion: { total: 10, string: '10' } } } });
    world(holder);
    docs.set(RIOT_SHIELD, {
      toObject: () => ({ name: 'Riot Shield', type: 'shield', flags: {}, system: { equipped: false, active: false, activeEffect: { option1: { defense: 'evasion', value: 2 } }, items: {} } }),
    });
    return { holder, perk: itemOf(holder) };
  }

  const shieldOf = actor => actor.items.contents.find(item => item.type == 'shield');

  test('adding the Perk grants an equipped riot shield named for it; the Use only brings back a missing one', async () => {
    const { holder, perk } = setup();
    await fireItemAdded(holder, perk);
    const shield = shieldOf(holder);
    expect(shield).toMatchObject({ name: 'Thick Hide', system: { equipped: true } });
    expect(shield.flags.essence20.grantedBy).toBe(perk.id);
    expect((await use(perk)).card).toBeNull();
    await holder.deleteEmbeddedDocuments('Item', [shield.id]);
    await use(perk);
    expect(shieldOf(holder)).toMatchObject({ name: 'Thick Hide', system: { equipped: true } });
  });

  test('raised, the shield is worth one Evasion per Alteration instead of +2', async () => {
    const { holder, perk } = setup(5);
    await fireItemAdded(holder, perk);
    const shield = shieldOf(holder);
    ruleDerived(holder);
    expect(holder.system.defenses.evasion.total).toBe(10);
    shield.system.active = true;
    rebuildIndex(holder);
    ruleDerived(holder);
    expect(holder.system.defenses.evasion.total).toBe(13);
  });

  test('unequipping it puts it straight back; another shield is left alone', async () => {
    const { holder, perk } = setup();
    await fireItemAdded(holder, perk);
    const shield = shieldOf(holder);
    shield.system.equipped = false;
    await fireTriggers(holder, 'unequipped', { roll: { item: shield }, skipItem: shield });
    expect(shield.system.equipped).toBe(true);
    const plain = makeItem(holder, { name: 'Buckler', type: 'shield', system: { equipped: false } });
    holder.items.contents.push(plain);
    await fireTriggers(holder, 'unequipped', { roll: { item: plain }, skipItem: plain });
    expect(plain.system.equipped).toBe(false);
  });
});
