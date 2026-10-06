import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slD6: Shoot Out and Steady Footing moved off the react slice onto Reaction rules (the compound wielded
 * selector with upgrade-aware item:trait; roll:fumble with the attack's damage type), Cruel Conflagration
 * onto two watch afterRoll Triggers posting buttons (applyCondition keeps its rounds through the GM), and
 * Gravity Optional's tripled jump onto a Roll Options switch plus an afterRoll Trigger that open rolls
 * reach. Each item is loaded from its pack source and must do what the removed code did.
 */

const { rebuildIndex } = await import('./index.mjs');
const { reactionOffers, pressReaction } = await import('./reactions.mjs');
const { cardInfo } = await import('../helpers/extensions/react/core.mjs');
const { validateRule } = await import('./types.mjs');
const { fireTriggers, fireOpenRoll } = await import('./triggers.mjs');
const { bankedSources } = await import('./bank.mjs');
const { recordUse } = await import('./limits.mjs');
const { pressRuleButton } = await import('./buttons.mjs');
const { applyRuleSwitches, ruleDialogSwitches } = await import('./adapter.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  shootOut: 'tfcrbitems/_source/Shoot_Out_GiTU07xFJACmUYt2.json',
  steadyFooting: 'iafav2items/_source/Steady_Footing_U4bVJU5BpT3BTfSx.json',
  cruelConflagration: 'fmmcitems/_source/Cruel_Conflagration_c22iQeKZY1TmPzFe.json',
  gravityOptional: 'wtnvcgitems/_source/Gravity_Optional_F5mrzupd6TG2kj3x.json',
};

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

let nextId = 1;

function makeItem(actor, data) {
  return {
    id: `i${nextId++}`, flags: {}, system: {}, parent: actor, ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
  };
}

/** An actor with a token on the canvas (x feet along, disposition), holding the pack items `files` and any extra item data. */
function makeActor(name, files = [], { x = 0, disposition = 1, type = 'playerCharacter', system = {}, extra = [] } = {}) {
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
  };
  actor.uuid = `Actor.${actor.id}`;
  const items = [];
  for (const file of [files].flat()) {
    const doc = fromPack(file);
    items.push(makeItem(actor, { name: doc.name, type: doc.type, system: doc.system }));
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

/** A weapon (equipped, traits, itemAndUpgradeTraits) with one attack using `skill` in `style`, as items for makeActor's extra. */
function wielded(skill, { equipped = true, traits = [], upgradeTraits = undefined, style = 'projectile', damageType = 'blunt' } = {}) {
  const id = `w${nextId++}`;
  return [
    { id, name: 'Weapon', type: 'weapon', system: { equipped, traits, ...(upgradeTraits ? { itemAndUpgradeTraits: upgradeTraits } : {}) } },
    { name: 'Attack', type: 'weaponEffect', flags: { essence20: { parentId: id } }, system: { classification: { skill, style }, damageType } },
  ];
}

/** A posted check card from `attacker`: rows [[target, DIF]], the total, and card flags. */
function cardFor(attacker, rows, total, { flags = {}, damage = 3, damageType = 'blunt' } = {}) {
  const id = `m${nextId++}`;
  const store = {};
  const content = rows.map(([target]) => (total >= rows[0][1]
    ? `<button data-action="apply-damage" data-key="${target.uuid}:base" data-target-uuid="${target.uuid}" data-damage="${damage}" data-damage-type="${damageType}">` : '')).join('');
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
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token) }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
}

function setCombat(combat) {
  global.game.combat = combat;
  global.game.combats = { get: id => (combat?.id == id ? combat : null) };
}

const allChat = () => global.ChatMessage.create.mock.calls.map(call => call[0]?.content ?? '').join(' ');
const ruleButtons = () => global.ChatMessage.create.mock.calls.map(call => call[0]?.flags?.essence20?.ruleButton).filter(Boolean);
/** The last rule-button card posted, as a pressable message. */
const lastButtonCard = () => {
  const data = global.ChatMessage.create.mock.calls.map(call => call[0]).filter(call => call?.flags?.essence20?.ruleButton).at(-1);
  return { flags: data.flags, isOwner: true, update: jest.fn(async () => {}) };
};

/** DialogV2.wait answers, in order (a `choose` takes the option index as a string). */
function dialogAnswers(...answers) {
  const wait = jest.fn(async () => answers.shift() ?? null);
  global.foundry.applications = { ...global.foundry.applications, api: { ...global.foundry.applications?.api, DialogV2: { wait } } };
  return wait;
}

/** A rollSkill mock: success / crit for every call (null: cancelled). */
const rolls = (success = true, crit = false) => jest.fn(async () => (success === null ? null
  : { success, outcomes: [{ results: [{ success, multiplier: crit ? 2 : 1 }] }] }));

const savedGame = global.game;
const savedFromUuid = global.fromUuid;
const savedFromUuidSync = global.fromUuidSync;
const savedConfig = global.CONFIG;

beforeEach(() => {
  global.game = {
    ...savedGame, combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] },
    settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key },
  };
  global.CONFIG = { ...savedConfig, E20: { ...(savedConfig?.E20 ?? {}), skillToEssence: { ...(savedConfig?.E20?.skillToEssence ?? {}), targeting: 'speed', athletics: 'strength' } } };
  global.ChatMessage = { ...global.ChatMessage, create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...global.foundry,
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o), escapeHTML: text => String(text) },
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

test('every slD6 rule validates', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

describe('Shoot Out (Reaction)', () => {
  function setup({ weapon = wielded('targeting', { traits: ['ballistic'] }), total = 15, melee = false, extra = [] } = {}) {
    const attacker = makeActor('Swindle', [], { disposition: -1, x: 30 });
    const holder = makeActor('Ironhide', FILES.shootOut, { extra: [...weapon, ...extra] });
    world(attacker, holder);
    return { attacker, holder, card: () => cardFor(attacker, [[holder, 12]], total, { flags: { isMelee: melee } }) };
  }

  test('offered against a ranged attack on the holder while a ballistic ranged attack is wielded', () => {
    const { holder, card } = setup();
    expect(reactionOffers(card().info).map(offer => offer.actor)).toEqual([holder]);
    // A miss is offered too (losing turns it into a hit).
    expect(reactionOffers(setup({ total: 8 }).card().info)).toHaveLength(1);
    // Not against a melee attack, not with the gun put away, not with only a ballistic melee attack, not without Ballistic.
    expect(reactionOffers(setup({ melee: true }).card().info)).toEqual([]);
    expect(reactionOffers(setup({ weapon: wielded('targeting', { traits: ['ballistic'], equipped: false }) }).card().info)).toEqual([]);
    expect(reactionOffers(setup({ weapon: wielded('might', { traits: ['ballistic'], style: 'melee' }) }).card().info)).toEqual([]);
    expect(reactionOffers(setup({ weapon: wielded('targeting') }).card().info)).toEqual([]);
  });

  test('a Ballistic trait an attached upgrade adds counts (itemAndUpgradeTraits)', () => {
    const { holder, card } = setup({ weapon: wielded('targeting', { upgradeTraits: ['ballistic'] }) });
    expect(reactionOffers(card().info).map(offer => offer.actor)).toEqual([holder]);
  });

  test('rolls the ballistic attack\'s own Skill against their total + 1; winning negates the hit', async () => {
    // A ballistic melee attack first in the item order: the ranged one's Skill is rolled.
    const { holder, card } = setup({ weapon: [...wielded('might', { traits: ['ballistic'], style: 'melee' }), ...wielded('targeting', { traits: ['ballistic'] })] });
    holder._dice = { rollSkill: rolls(true) };
    const { message, info } = card();
    expect(await pressReaction(info, reactionOffers(info)[0])).toBe(true);
    expect(holder._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'targeting', dif: '16' }), holder);
    expect(message.getFlag('essence20', 'reactNegated')).toEqual([holder.uuid]);
    expect(allChat()).toContain('wins the shoot-out');
  });

  test('losing a missed shot turns it into a hit; winning a missed shot or losing a hit changes nothing', async () => {
    const miss = setup({ total: 8 });
    miss.holder._dice = { rollSkill: rolls(false) };
    const first = miss.card();
    await pressReaction(first.info, reactionOffers(first.info)[0]);
    expect(first.message.getFlag('essence20', 'reactNegated')).toBeUndefined();
    expect(allChat()).toContain('loses the shoot-out');

    global.ChatMessage.create.mockClear();
    const won = setup({ total: 8 });
    won.holder._dice = { rollSkill: rolls(true) };
    const second = won.card();
    await pressReaction(second.info, reactionOffers(second.info)[0]);
    expect(allChat()).not.toContain('shoot-out');

    global.ChatMessage.create.mockClear();
    const lost = setup();
    lost.holder._dice = { rollSkill: rolls(false) };
    const third = lost.card();
    await pressReaction(third.info, reactionOffers(third.info)[0]);
    expect(third.message.getFlag('essence20', 'reactNegated')).toBeUndefined();
    expect(allChat()).not.toContain('shoot-out');
  });

  test('once per turn in a running combat; a cancelled roll uses nothing', async () => {
    const { holder, card } = setup();
    const combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [] };
    setCombat(combat);
    holder._dice = { rollSkill: rolls(null) };
    const first = card();
    expect(await pressReaction(first.info, reactionOffers(first.info)[0])).toBe(false);
    expect(reactionOffers(card().info)).toHaveLength(1);
    const rule = itemOf(holder).system.rules[0];
    expect(rule.limit).toEqual({ per: 'turn', max: 1 });
    await recordUse(holder, rule, itemOf(holder), 0, combat);
    expect(reactionOffers(card().info)).toEqual([]);
    setCombat({ ...combat, turn: 1 });
    expect(reactionOffers(card().info)).toHaveLength(1);
  });
});

describe('Steady Footing (Reaction)', () => {
  function setup({ fumble = true, damageType = 'maneuver' } = {}) {
    const weaponId = `w${nextId++}`;
    const attacker = makeActor('Putty', [], {
      disposition: -1, x: 5,
      extra: [
        { id: weaponId, name: 'Grab', type: 'weapon', system: { equipped: true } },
        { name: 'Trip', type: 'weaponEffect', flags: { essence20: { parentId: weaponId } }, system: { classification: { skill: 'might', style: 'melee' }, damageType } },
      ],
    });
    const other = makeActor('Goldar', [], { disposition: -1, x: 5 });
    const holder = makeActor('Hawk', FILES.steadyFooting);
    world(attacker, other, holder);
    const effect = attacker.items.contents[1];
    return { attacker, other, holder, card: () => cardFor(attacker, [[holder, 12]], 4, { flags: { isMelee: true, isFumble: fumble, itemUuid: effect.uuid } }) };
  }

  const counter = holder => holder.items.contents[0].system.rules.findIndex(rule => rule.type == 'Reaction');

  test('offered when a Grapple / Shove / Trip (Maneuver or Grapple damage) against the holder Fumbles', () => {
    const { holder, card } = setup();
    expect(counter(holder)).toBe(1);
    expect(reactionOffers(card().info).map(offer => offer.actor)).toEqual([holder]);
    expect(reactionOffers(setup({ damageType: 'grapple' }).card().info)).toHaveLength(1);
    expect(reactionOffers(setup({ fumble: false }).card().info)).toEqual([]);
    expect(reactionOffers(setup({ damageType: 'blunt' }).card().info)).toEqual([]);
  });

  test('targets the attacker, banks ↑1 for the next Maneuver attack against them only, one at a time', async () => {
    const { attacker, other, holder, card } = setup();
    target();
    const { info } = card();
    expect(await pressReaction(info, reactionOffers(info)[0])).toBe(true);
    expect(attacker.flags.essence20.ruleMarks.steadyFooting.by).toBe(holder.uuid);
    const maneuver = { isAttack: true, item: { type: 'weaponEffect', system: { damageType: 'maneuver' } } };
    expect(bankedSources(holder, attacker, maneuver).sources).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(bankedSources(holder, other, maneuver).sources).toEqual([]);
    expect(bankedSources(holder, attacker, { isAttack: true, item: { type: 'weaponEffect', system: { damageType: 'sharp' } } }).sources).toEqual([]);
    const again = card();
    await pressReaction(again.info, reactionOffers(again.info)[0]);
    expect(holder.flags.essence20.ruleBank).toHaveLength(1);
    expect(allChat()).toContain('strikes back');
  });

  function target(...actors) {
    global.game.user.targets = new Set(actors.map(actor => actor.token));
  }
});

describe('Cruel Conflagration (watch afterRoll Triggers)', () => {
  function setup({ x = 10 } = {}) {
    const roller = makeActor('Bulk', [], { disposition: -1, x });
    const holder = makeActor('Finster', FILES.cruelConflagration);
    world(roller, holder);
    return { roller, holder };
  }

  const failure = roller => fireTriggers(roller, 'afterRoll', { outcome: 'failure', facts: { results: [{ success: false }], isFumble: false } });
  const fumble = roller => fireTriggers(roller, 'afterRoll', { outcome: 'fumble', facts: { results: [{ success: false }], isFumble: true } });

  test('a failure within 15 ft posts the Impaired button; a Fumble the damage one; farther, a success or a Fumble that succeeded, nothing', async () => {
    const { roller } = setup();
    await failure(roller);
    expect(ruleButtons()).toEqual([expect.objectContaining({ who: 'owner', targets: [roller.uuid], label: expect.stringContaining('Impaired') })]);
    global.ChatMessage.create.mockClear();
    await fumble(roller);
    expect(ruleButtons()).toEqual([expect.objectContaining({ targets: [roller.uuid] })]);
    expect(ruleButtons()[0].steps[0].do).toBe('choose');
    global.ChatMessage.create.mockClear();
    await fireTriggers(roller, 'afterRoll', { outcome: 'fumble', facts: { results: [{ success: true }], isFumble: true } });
    await fireTriggers(roller, 'afterRoll', { outcome: 'success', facts: { results: [{ success: true }] } });
    await failure(setup({ x: 20 }).roller);
    expect(ruleButtons()).toEqual([]);
  });

  test('the Impaired button costs 1 Personal Power and makes the roller Impaired for a round', async () => {
    const { roller, holder } = setup();
    setCombat({ id: 'c1', started: true, round: 1, turn: 0, turns: [] });
    await failure(roller);
    const effect = { statuses: new Set(['impaired']), update: jest.fn(async () => {}) };
    roller.effects = { find: fn => [effect].find(fn) };
    expect(await pressRuleButton(lastButtonCard())).toBe(true);
    expect(holder.system.powers.personal.value).toBe(2);
    expect(roller.statuses.has('impaired')).toBe(true);
    expect(effect.update).toHaveBeenCalledWith(expect.objectContaining({ 'duration.rounds': 1 }));
  });

  test('a player\'s press on an enemy goes through the GM with the round kept', async () => {
    const { roller, holder } = setup();
    roller.isOwner = false;
    global.game.user = { id: 'p', isGM: false, targets: new Set() };
    global.game.users = { contents: [], activeGM: { id: 'gm' } };
    await failure(roller);
    await pressRuleButton(lastButtonCard(), global.game.user);
    expect(holder.system.powers.personal.value).toBe(2);
    const op = global.ChatMessage.create.mock.calls.map(call => call[0]?.flags?.essence20?.reactOp).find(Boolean);
    expect(op).toEqual({ kind: 'status', uuid: roller.uuid, status: 'impaired', rounds: 1 });
  });

  test('after a Fumble: 1 Personal Power for a GM damage button, or 2 for the damage and Impaired', async () => {
    const { roller, holder } = setup();
    await fumble(roller);
    const card = lastButtonCard();
    dialogAnswers('0');
    await pressRuleButton(card);
    expect(holder.system.powers.personal.value).toBe(2);
    expect(roller.statuses.has('impaired')).toBe(false);
    const damage = ruleButtons().at(-1);
    expect(damage).toMatchObject({ who: 'gm', targets: [roller.uuid], steps: [{ do: 'damage', to: 'target', amount: 2, damageType: 'psychic' }] });

    await fumble(roller);
    dialogAnswers('1');
    await pressRuleButton(lastButtonCard());
    expect(holder.system.powers.personal.value).toBe(0);
    expect(roller.statuses.has('impaired')).toBe(true);
    expect(ruleButtons().at(-1)).toMatchObject({ who: 'gm', steps: [{ do: 'damage', amount: 2 }] });
  });

  test('not enough Personal Power: nothing happens', async () => {
    const { roller, holder } = setup();
    holder.system.powers.personal.value = 0;
    await failure(roller);
    await pressRuleButton(lastButtonCard());
    expect(roller.statuses.has('impaired')).toBe(false);
  });
});

describe('Gravity Optional (jump)', () => {
  function setup() {
    const citizen = makeActor('Carlos', FILES.gravityOptional);
    world(citizen);
    return citizen;
  }

  const jumpSwitch = (actor, skill) => ruleDialogSwitches(actor, { rolledSkill: skill }).find(entry => entry.label.includes('Jump'));

  async function tick(actor) {
    const entry = jumpSwitch(actor, 'athletics');
    await applyRuleSwitches(actor, { ext: { [entry.name]: true } }, { rolledSkill: 'athletics' });
  }

  test('offered on Athletics only, starting unticked', () => {
    const citizen = setup();
    expect(jumpSwitch(citizen, 'athletics')).toMatchObject({ type: 'checkbox', value: false });
    expect(jumpSwitch(citizen, 'might')).toBeUndefined();
  });

  test('ticked, the roll\'s result is posted tripled - a roll with nothing to compare against, or one against a DIF', async () => {
    const citizen = setup();
    await tick(citizen);
    await fireOpenRoll(citizen, 7, 'athletics');
    expect(allChat()).toContain('jump result 7 is tripled to 21');
    // Once: the next Athletics roll isn't a jump unless ticked again.
    global.ChatMessage.create.mockClear();
    await fireOpenRoll(citizen, 9, 'athletics');
    expect(allChat()).not.toContain('tripled');
    await tick(citizen);
    await fireTriggers(citizen, 'afterRoll', { roll: { rolledSkill: 'athletics' }, outcome: 'failure', facts: { results: [{ success: false, total: 12 }] }, vars: { total: 12 } });
    expect(allChat()).toContain('jump result 12 is tripled to 36');
  });

  test('unticked, nothing is posted', async () => {
    const citizen = setup();
    await fireOpenRoll(citizen, 7, 'athletics');
    expect(allChat()).not.toContain('tripled');
  });
});
