import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slD5: Desperate Parry, Counterstrike (DD) and Projectile Deflector moved off the react slice onto
 * Reaction rules (the wielded item selector, setTargets + optional bonusAttack + a one-slot bank, button
 * vars); Honest Compassion onto a Use rule whose gate and question run before the cost; Inner
 * Conservation, Power Efficiency, Dino Charged and Solarix Shard's discount onto resourceSpent Triggers;
 * Repair Progress's bonus point onto an 'added' Trigger (gainResource overMax); Lance of Light's strike
 * onto a Use rule with a range gate before the cost. Each item is loaded from its pack source and must
 * do what the removed code did.
 */

// slB10: Solarix Shard's pack item carries a HitRider rule now (rules/plugins/combat/hit-rider.mjs).
await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { reactionOffers, pressReaction } = await import('./reactions.mjs');
const { cardInfo } = await import('../mechanics/combat/reaction-engine.mjs');
const { validateRule } = await import('./types.mjs');
const { fireItemAdded, fireTriggers, runUse, useAvailable } = await import('./triggers.mjs');
const { bankedSources } = await import('./bank.mjs');
const { recordUse } = await import('./limits.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  desperateParry: 'qgtgitems/_source/Desperate_Parry_ljlMd2MmeF9LEBbz.json',
  counterstrike: 'dditems/_source/Counterstrike_PdmiiOmBYzNfXTeh.json',
  deflector: 'iafav2items/_source/Projectile_Deflector_2eWBm6hbiifmySvX.json',
  honestCompassion: 'mlpcrbitems/_source/Honest_Compassion_Dfjo9U9cAgigD9oA.json',
  innerConservation: 'ttsgitems/_source/Inner_Conservation_NkHKAb5TFc7n7C8k.json',
  powerEfficiency: 'ttsgitems/_source/Power_Efficiency_3fa8lKE6TpQ6lr0P.json',
  dinoCharged: 'bthitems/_source/Dino_Charged_n9ME10p6mfOJnUdE.json',
  repairProgress: 'ccfitems/_source/Repair_Progress__Bonus_Energon_Point_rPbEnrg7Qx2Lm9Vd.json',
  lanceOfLight: 'jttitems/_source/Lance_of_Light_HUdL1MryICmRmWnP.json',
  solarix: 'ttsgitems/_source/Solarix_Shard_jPqr2DuJMSQgiILp.json',
};

/** foundry.utils.setProperty, for plain objects; a "-=key" part deletes that key. */
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const at = keys.reduce((node, key) => (node[key] ??= {}), object);
  if (last.startsWith('-=') || (globalThis.foundry?.data?.operators?.ForcedDeletion && value instanceof globalThis.foundry.data.operators.ForcedDeletion)) {
    delete at[last.replace(/^-=/, '')];
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
      energon: { normal: { value: 2, max: 2 } },
      essences: { strength: { value: 2, max: 2 }, speed: { value: 2, max: 2 }, smarts: { value: 2, max: 2 }, social: { value: 2, max: 2 } },
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

/** An equipped weapon with one attack (weaponEffect) using `skill`, as items for makeActor's extra. */
function wielded(skill, { equipped = true, traits = [], style = 'melee' } = {}) {
  const id = `w${nextId++}`;
  return [
    { id, name: 'Weapon', type: 'weapon', system: { equipped, traits } },
    { name: 'Attack', type: 'weaponEffect', flags: { essence20: { parentId: id } }, system: { classification: { skill, style } } },
  ];
}

/** A posted check card from `attacker`: rows [[target, DIF]], the total, and card flags. */
function cardFor(attacker, rows, total, { flags = {}, damage = 3, damageType = 'blunt' } = {}) {
  const id = `m${nextId++}`;
  const store = {};
  const content = rows.map(([target]) => `<button data-action="apply-damage" data-key="${target.uuid}:base" data-target-uuid="${target.uuid}" data-damage="${damage}" data-damage-type="${damageType}">`).join('');
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

function target(...actors) {
  global.game.user.targets = new Set(actors.map(actor => actor.token));
}

const allChat = () => global.ChatMessage.create.mock.calls.map(call => call[0]?.content ?? '').join(' ');
const ruleButtons = () => global.ChatMessage.create.mock.calls.map(call => call[0]?.flags?.essence20?.ruleButton).filter(Boolean);

/** DialogV2.wait answers, in order (a `choose` takes the option index as a string; a select its value). */
function dialogAnswers(...answers) {
  const wait = jest.fn(async () => answers.shift() ?? null);
  global.foundry.applications = { ...global.foundry.applications, api: { ...global.foundry.applications?.api, DialogV2: { wait } } };
  return wait;
}

const savedGame = global.game;
const savedFromUuid = global.fromUuid;
const savedFromUuidSync = global.fromUuidSync;
const savedConfig = global.CONFIG;

beforeEach(() => {
  global.game = {
    ...savedGame, combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] },
    settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key },
  };
  global.CONFIG = { ...savedConfig, E20: { ...(savedConfig?.E20 ?? {}), skillToEssence: { ...(savedConfig?.E20?.skillToEssence ?? {}), acrobatics: 'speed', finesse: 'speed' } } };
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

test('every slD5 rule validates', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

/** A rollSkill mock: success / crit for every call. */
const rolls = (success = true, crit = false) => jest.fn(async () => (success === null ? null
  : { success, outcomes: [{ results: [{ success, multiplier: crit ? 2 : 1 }] }] }));

describe('Desperate Parry (Contingency + Reaction)', () => {
  function setup({ weapon = wielded('finesse'), total = 15, melee = true } = {}) {
    const attacker = makeActor('Putty', [], { disposition: -1, x: 5 });
    const holder = makeActor('Kim', FILES.desperateParry, { extra: weapon });
    world(attacker, holder);
    return { attacker, holder, card: () => cardFor(attacker, [[holder, 12]], total, { flags: { isMelee: melee } }) };
  }

  const armed = holder => !!itemOf(holder).flags?.essence20?.rules?.toggles?.armed;

  test('the Use sets the Contingency (a Free action, once per turn); the start of the holder\'s turn clears it', async () => {
    const { holder } = setup();
    setCombat({ id: 'c1', started: true, round: 1, turn: 0, turns: [] });
    const pay = jest.fn(async () => true);
    expect(await runUse(itemOf(holder), pay)).toContain('sets a Contingency');
    expect(pay).toHaveBeenCalledWith('free');
    expect(armed(holder)).toBe(true);
    expect(useAvailable(itemOf(holder), itemOf(holder).system.rules[0], 0)).toBe(false);
    await fireTriggers(holder, 'turnStart');
    expect(armed(holder)).toBe(false);
  });

  test('offered on a melee hit while armed in combat (always outside one) and wielding a weapon', async () => {
    const { holder, card } = setup();
    setCombat({ id: 'c1', started: true, round: 1, turn: 0, turns: [] });
    expect(reactionOffers(card().info)).toEqual([]);
    await runUse(itemOf(holder), jest.fn(async () => true));
    expect(reactionOffers(card().info).map(offer => offer.actor)).toEqual([holder]);
    setCombat(null);
    itemOf(holder).flags.essence20.rules.toggles.armed = false;
    expect(reactionOffers(card().info)).toHaveLength(1);
    // Not a ranged attack, not a miss, not with nothing in hand.
    expect(reactionOffers(setup({ melee: false }).card().info)).toEqual([]);
    expect(reactionOffers(setup({ total: 10 }).card().info)).toEqual([]);
    expect(reactionOffers(setup({ weapon: wielded('finesse', { equipped: false }) }).card().info)).toEqual([]);
  });

  test('asks Acrobatics or Finesse, clears the Contingency, rolls against the total; a success negates the hit and breaks the weapon', async () => {
    const { holder, card } = setup();
    holder._dice = { rollSkill: rolls(true) };
    const wait = dialogAnswers('1');
    const { message, info } = card();
    expect(await pressReaction(info, reactionOffers(info)[0])).toBe(true);
    expect(wait).toHaveBeenCalled();
    expect(holder._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'finesse', dif: '15' }), holder);
    expect(message.getFlag('essence20', 'reactNegated')).toEqual([holder.uuid]);
    const weapon = holder.items.contents.find(item => item.type == 'weapon');
    expect(weapon.system.equipped).toBe(false);
    expect(weapon.flags.essence20.broken).toBe(true);
    expect(armed(holder)).toBe(false);
    expect(allChat()).toContain('parrying weapon breaks');
  });

  test('a failure leaves the hit and the weapon; backing out of the question changes nothing', async () => {
    const { holder, card } = setup();
    holder._dice = { rollSkill: rolls(false) };
    dialogAnswers('0');
    const first = card();
    await pressReaction(first.info, reactionOffers(first.info)[0]);
    expect(holder._dice.rollSkill.mock.calls[0][0].skill).toBe('acrobatics');
    expect(first.message.getFlag('essence20', 'reactNegated')).toBeUndefined();
    expect(holder.items.contents.find(item => item.type == 'weapon').system.equipped).toBe(true);
    dialogAnswers(null);
    const second = card();
    expect(await pressReaction(second.info, reactionOffers(second.info)[0])).toBe(false);
    expect(holder._dice.rollSkill).toHaveBeenCalledTimes(1);
  });
});

describe('Counterstrike (DD, Reaction)', () => {
  function setup({ total = 6, melee = true } = {}) {
    const attacker = makeActor('Cliffjumper', [], { disposition: -1, x: 5 });
    const other = makeActor('Bumblebee', [], { disposition: -1, x: 5 });
    const holder = makeActor('Thrust', FILES.counterstrike);
    world(attacker, other, holder);
    return { attacker, other, holder, card: () => cardFor(attacker, [[holder, 12]], total, { flags: { isMelee: melee } }) };
  }

  test('offered when a melee attack against the holder misses by 5 or more', () => {
    const { holder, card } = setup();
    expect(reactionOffers(card().info).map(offer => offer.actor)).toEqual([holder]);
    expect(reactionOffers(setup({ total: 8 }).card().info)).toEqual([]);
    expect(reactionOffers(setup({ melee: false }).card().info)).toEqual([]);
    expect(reactionOffers(setup({ total: 13 }).card().info)).toEqual([]);
  });

  test('banks a ↓1 for the next melee attack against that attacker only, one at a time', async () => {
    const { attacker, other, holder, card } = setup();
    const { info } = card();
    expect(await pressReaction(info, reactionOffers(info)[0])).toBe(true);
    expect(attacker.flags.essence20.ruleMarks.counterstrike.by).toBe(holder.uuid);
    const melee = { isAttack: true, isMelee: true };
    expect(bankedSources(holder, attacker, melee).sources).toEqual([expect.objectContaining({ shiftDown: 1 })]);
    expect(bankedSources(holder, other, melee).sources).toEqual([]);
    expect(bankedSources(holder, attacker, { isAttack: true, isMelee: false }).sources).toEqual([]);
    // Pressed again: still one banked bonus.
    const again = card();
    await pressReaction(again.info, reactionOffers(again.info)[0]);
    expect(holder.flags.essence20.ruleBank).toHaveLength(1);
    expect(allChat()).toContain('counter-attacks');
  });

  test('once per round in a running combat', async () => {
    const { holder, card } = setup();
    const combat = { id: 'c1', started: true, round: 2, turn: 0, turns: [] };
    setCombat(combat);
    const rule = itemOf(holder).system.rules[0];
    expect(rule.limit).toEqual({ per: 'round', max: 1 });
    await recordUse(holder, rule, itemOf(holder), 0, combat);
    expect(reactionOffers(card().info)).toEqual([]);
    setCombat({ ...combat, round: 3 });
    expect(reactionOffers(card().info)).toHaveLength(1);
  });
});

describe('Projectile Deflector (Reaction)', () => {
  function setup({ style = 'projectile', attackerType = 'npc', total = 15 } = {}) {
    const weaponId = `w${nextId++}`;
    const attacker = makeActor('Viper', [], {
      disposition: -1, x: 30, type: attackerType,
      extra: [
        { id: weaponId, name: 'Rifle', type: 'weapon', system: { equipped: true } },
        { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: weaponId } }, system: { classification: { skill: 'targeting', style } } },
      ],
    });
    const holder = makeActor('Storm Shadow', FILES.deflector);
    world(attacker, holder);
    const shot = attacker.items.contents[1];
    return { attacker, holder, card: () => cardFor(attacker, [[holder, 12]], total, { flags: { itemUuid: shot.uuid }, damage: 4, damageType: 'fire' }) };
  }

  test('offered when a Threat\'s projectile attack hits the holder - not a PC\'s, not another style, not a miss', () => {
    const { holder, card } = setup();
    expect(reactionOffers(card().info).map(offer => offer.actor)).toEqual([holder]);
    expect(reactionOffers(setup({ attackerType: 'playerCharacter' }).card().info)).toEqual([]);
    expect(reactionOffers(setup({ style: 'energy' }).card().info)).toEqual([]);
    expect(reactionOffers(setup({ total: 10 }).card().info)).toEqual([]);
  });

  test('Finesse against the total: a success negates the hit; once per encounter', async () => {
    const { holder, card } = setup();
    holder._dice = { rollSkill: rolls(true) };
    const { message, info } = card();
    expect(await pressReaction(info, reactionOffers(info)[0])).toBe(true);
    expect(holder._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'finesse', dif: '15' }), holder);
    expect(message.getFlag('essence20', 'reactNegated')).toEqual([holder.uuid]);
    expect(ruleButtons()).toEqual([]);
    expect(reactionOffers(card().info)).toEqual([]);
  });

  test('a cancelled roll spends nothing; a failure still uses it', async () => {
    const { holder, card } = setup();
    holder._dice = { rollSkill: rolls(null) };
    const first = card();
    expect(await pressReaction(first.info, reactionOffers(first.info)[0])).toBe(false);
    expect(reactionOffers(card().info)).toHaveLength(1);
    holder._dice = { rollSkill: rolls(false) };
    const second = card();
    await pressReaction(second.info, reactionOffers(second.info)[0]);
    expect(second.message.getFlag('essence20', 'reactNegated')).toBeUndefined();
    expect(reactionOffers(card().info)).toEqual([]);
  });

  test('a Critical Success also posts a GM button dealing the row\'s damage, of its type, to the attacker', async () => {
    const { attacker, holder, card } = setup();
    holder._dice = { rollSkill: rolls(true, true) };
    const { message, info } = card();
    await pressReaction(info, reactionOffers(info)[0]);
    expect(message.getFlag('essence20', 'reactNegated')).toEqual([holder.uuid]);
    const [button] = ruleButtons();
    expect(button).toMatchObject({ who: 'gm', targets: [attacker.uuid], vars: expect.objectContaining({ damage: 4, damageType: 'fire' }) });
    expect(button.steps[0]).toMatchObject({ do: 'damage', to: 'target', amount: '@var.damage', damageType: '{var.damageType}' });
  });
});

describe('Honest Compassion (Use)', () => {
  function setup({ level = 5, self = {}, friendSystem = null } = {}) {
    const pony = makeActor('Applejack', FILES.honestCompassion, { system: { level, ...self } });
    const friend = friendSystem ? makeActor('Rarity', [], { system: friendSystem }) : null;
    world(...[pony, friend].filter(Boolean));
    return { pony, friend };
  }

  const hurtEssence = () => ({ essences: { strength: { value: 2, max: 2 }, speed: { value: 2, max: 2 }, smarts: { value: 0, max: 2 }, social: { value: 2, max: 2 } } });

  test('no target: heals the pony\'s own Health, without a question, as a Standard action', async () => {
    const { pony } = setup({ self: { health: { value: 7, max: 10 } } });
    const wait = dialogAnswers();
    const pay = jest.fn(async () => true);
    await runUse(itemOf(pony), pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(wait).not.toHaveBeenCalled();
    expect(pony.system.health.value).toBe(8);
  });

  test('a targeted friend with only Essence damage gets 1 Essence back', async () => {
    const { pony, friend } = setup({ friendSystem: hurtEssence() });
    target(friend);
    await runUse(itemOf(pony), jest.fn(async () => true));
    expect(friend.system.essences.smarts.value).toBe(1);
    expect(friend.system.health.value).toBe(10);
  });

  test('both kinds hurt: asks which, before the cost', async () => {
    const { pony, friend } = setup({ friendSystem: { ...hurtEssence(), health: { value: 5, max: 10 } } });
    target(friend);
    const wait = dialogAnswers('health');
    const pay = jest.fn(async () => true);
    await runUse(itemOf(pony), pay);
    expect(wait).toHaveBeenCalled();
    expect(friend.system.health.value).toBe(6);
    expect(friend.system.essences.smarts.value).toBe(0);
    // Backing out of the question costs nothing and uses nothing.
    dialogAnswers(null);
    const unpaid = jest.fn(async () => true);
    expect(useAvailable(itemOf(pony), itemOf(pony).system.rules[0], 0)).toBe(false);
    pony.flags.essence20.ruleUses = {};
    await runUse(itemOf(pony), unpaid);
    expect(unpaid).not.toHaveBeenCalled();
    expect(useAvailable(itemOf(pony), itemOf(pony).system.rules[0], 0)).toBe(true);
  });

  test('nothing to heal: says so and pays nothing', async () => {
    const { pony } = setup();
    const pay = jest.fn(async () => true);
    expect(await runUse(itemOf(pony), pay)).toContain('No Stress to heal');
    expect(pay).not.toHaveBeenCalled();
  });

  test('once per Rest, three times from 11th level', async () => {
    const low = setup({ level: 10, self: { health: { value: 1, max: 10 } } }).pony;
    await runUse(itemOf(low), jest.fn(async () => true));
    expect(useAvailable(itemOf(low), itemOf(low).system.rules[0], 0)).toBe(false);
    const high = setup({ level: 11, self: { health: { value: 1, max: 10 } } }).pony;
    for (let i = 0; i < 3; i++) {
      expect(useAvailable(itemOf(high), itemOf(high).system.rules[0], 0)).toBe(true);
      await runUse(itemOf(high), jest.fn(async () => true));
    }

    expect(useAvailable(itemOf(high), itemOf(high).system.rules[0], 0)).toBe(false);
    expect(high.system.health.value).toBe(4);
  });
});

describe('Personal Power spends (resourceSpent Triggers)', () => {
  const spend = (actor, spent, options = {}) => fireTriggers(actor, 'resourceSpent', { vars: { spent, resource: 'power' }, ...options });

  test('Inner Conservation: once a scene, a spend of 2+ may pay half (rounded up)', async () => {
    const ranger = makeActor('Ranger', FILES.innerConservation, { system: { powers: { personal: { value: 0, max: 6 } } } });
    world(ranger);
    const no = jest.fn(async () => false);
    await spend(ranger, 3, { prompt: no });
    expect(no).toHaveBeenCalled();
    expect(ranger.system.powers.personal.value).toBe(0);
    const yes = jest.fn(async () => true);
    await spend(ranger, 1, { prompt: yes });
    expect(yes).not.toHaveBeenCalled();
    await spend(ranger, 3, { prompt: yes });
    expect(ranger.system.powers.personal.value).toBe(1);
    await spend(ranger, 4, { prompt: yes });
    expect(ranger.system.powers.personal.value).toBe(1);
    expect(yes).toHaveBeenCalledTimes(1);
    const fresh = makeActor('Fresh', FILES.innerConservation, { system: { powers: { personal: { value: 0, max: 6 } } } });
    world(fresh);
    await spend(fresh, 4, { prompt: yes });
    expect(fresh.system.powers.personal.value).toBe(2);
    // Health spent isn't Personal Power.
    const hurt = makeActor('Hurt', FILES.innerConservation);
    await fireTriggers(hurt, 'resourceSpent', { vars: { spent: 4, resource: 'health' }, prompt: yes });
    expect(yes).toHaveBeenCalledTimes(2);
  });

  test('Power Efficiency: a d4 on every spend, 1 back on a 4', async () => {
    const ranger = makeActor('Ranger', FILES.powerEfficiency, { system: { powers: { personal: { value: 1, max: 3 } } } });
    world(ranger);
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await spend(ranger, 1);
    expect(ranger.system.powers.personal.value).toBe(1);
    expect(allChat()).toContain('DiceRolled');
    Math.random.mockReturnValue(0.99);
    await spend(ranger, 1);
    expect(ranger.system.powers.personal.value).toBe(2);
    await fireTriggers(ranger, 'resourceSpent', { vars: { spent: 1, resource: 'energon' } });
    expect(ranger.system.powers.personal.value).toBe(2);
  });

  test('Dino Charged: while Morphed, that much Essence damage from the Essence picked (or none)', async () => {
    const ranger = makeActor('Ranger', FILES.dinoCharged, { system: { isMorphed: true } });
    world(ranger);
    await spend(ranger, 2, { ask: async () => 1 });
    expect(ranger.system.essences.strength.value).toBe(0);
    await spend(ranger, 1, { ask: async () => 0 });
    expect(Object.values(ranger.system.essences).map(e => e.value)).toEqual([0, 2, 2, 2]);
    const ask = jest.fn(async () => 2);
    ranger.system.isMorphed = false;
    await spend(ranger, 1, { ask });
    expect(ask).not.toHaveBeenCalled();
  });

  test('Solarix Shard: the first Personal Power spend each scene costs 1 less', async () => {
    const ranger = makeActor('Ranger', FILES.solarix, { system: { powers: { personal: { value: 0, max: 3 } } } });
    world(ranger);
    await spend(ranger, 2);
    expect(ranger.system.powers.personal.value).toBe(1);
    await spend(ranger, 1);
    expect(ranger.system.powers.personal.value).toBe(1);
  });
});

test('Repair Progress: adding it gives 1 Energon over the maximum', async () => {
  const bot = makeActor('Bot', FILES.repairProgress);
  world(bot);
  await fireItemAdded(bot, itemOf(bot));
  expect(bot.system.energon.normal.value).toBe(3);
  expect(allChat()).toContain('bonus Energon Point');
});

describe('Lance of Light (strike)', () => {
  function setup({ x = 10, active = true } = {}) {
    const ranger = makeActor('Ranger', FILES.lanceOfLight);
    ranger.flags.essence20.lanceOfLightActive = active;
    const foe = makeActor('Foe', [], { disposition: -1, x });
    world(ranger, foe);
    return { ranger, foe };
  }

  const strike = item => ({ rule: item.system.rules.find(rule => rule.type == 'Use'), index: item.system.rules.findIndex(rule => rule.type == 'Use') });
  // The Lance's on / off are Use rules too (round 17, split3): press the Strike.
  const pickStrike = { pick: async (item, available) => available.find(({ rule }) => rule.label.startsWith('Strike')) ?? null };

  test('only while summoned', () => {
    const { ranger } = setup({ active: false });
    const { rule, index } = strike(itemOf(ranger));
    expect(useAvailable(itemOf(ranger), rule, index)).toBe(false);
    ranger.flags.essence20.lanceOfLightActive = true;
    expect(useAvailable(itemOf(ranger), rule, index)).toBe(true);
  });

  test('a Standard action against a target within 10 ft: a button for 1 Energy damage to it', async () => {
    const { ranger, foe } = setup();
    target(foe);
    const pay = jest.fn(async () => true);
    await runUse(itemOf(ranger), pay, pickStrike);
    expect(pay).toHaveBeenCalledWith('standard');
    const [button] = ruleButtons();
    expect(button).toMatchObject({ who: 'targets', targets: [foe.uuid] });
    expect(button.steps).toEqual([{ do: 'damage', to: 'target', amount: 1, damageType: 'element' }]);
  });

  test('too far, or no target: nothing is paid', async () => {
    const far = setup({ x: 15 });
    target(far.foe);
    const pay = jest.fn(async () => true);
    expect(await runUse(itemOf(far.ranger), pay, pickStrike)).toContain('within 10 ft');
    target();
    await runUse(itemOf(far.ranger), pay, pickStrike);
    expect(pay).not.toHaveBeenCalled();
    expect(ruleButtons()).toEqual([]);
  });
});
