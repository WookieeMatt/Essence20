import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Batch slA6 (docs/rules-batches/slA6.md): the zord1 / zord2 / pr1 / pr2 / pr3 slice items re-checked
 * against the round-6 engine pieces. Converted: Primal Rage and Bend Physics' +2 Evasion (a self copy
 * plus a `team`-scoped copy), S.W.A.T. Upgrade's Incarceration Protocols (an exclusive "last hit" mark
 * and a watch Trigger on an enemy's defeat), Morphin Navigator's Grid Power Bloom (updateActor to the
 * Party, capped at @recipient's own maximum), Carapaced's +20 Ground and its pick, and Additional Pair of
 * Limbs' +10 Ground (Movement at stage afterDerived). Each is loaded from its pack source and must do
 * what the removed slice code did.
 */

// Round-10 plug-ins: rule options some of these items now also use (Bend Physics' derivedHook Movement stage).
await import('./plugins/index.mjs');
const { LINK_HOLDERS, rebuildIndex } = await import('./index.mjs');
const { ruleDefenseAdjust, ruleMovementStages, ruleRollSources } = await import('./adapter.mjs');
const { fireTriggers, runUse, useAvailable } = await import('./triggers.mjs');
const { validateRule } = await import('./types.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  primalRage: 'bthitems/_source/Primal_Rage_4gkRa5plNeMNXSmL.json',
  bendPhysics: 'bthitems/_source/Bend_Physics_EITAjh6GBuc2SVSY.json',
  swat: 'atsitems/_source/S_W_A_T__Upgrade_Ce5f5pQTNTSY6xgF.json',
  navigator: 'ttsgitems/_source/Morphin_Navigator_nDx2XD6gD9lM37Bl.json',
  carapacedCommon: 'tsitems/_source/Carapaced__Common__aTevGfLML1dlbErs.json',
  carapacedLarge: 'tsitems/_source/Carapaced__Large__2mSP6mVx0axvOlXf.json',
  limbs: 'dditems/_source/Additional_Pair_of_Limbs_pedTP4vV1qwoBJvn.json',
};
const SOURCE = { bendPhysics: 'Compendium.essence20.beneath_the_helmet.Item.EITAjh6GBuc2SVSY', primalRage: 'Compendium.essence20.beneath_the_helmet.Item.4gkRa5plNeMNXSmL' };

let nextId = 1;

const getPath = (object, key) => key.split('.').reduce((o, k) => o?.[k], object);
function setPath(object, key, value) {
  const deletion = key.match(/^(.*)\.-=(.+)$/);
  if (deletion) {
    delete getPath(object, deletion[1])?.[deletion[2]];
    return;
  }

  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

function asItem(data, actor) {
  const item = {
    id: `i${nextId++}`, flags: {}, system: {}, isOwner: true, ...data, parent: actor,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  return item;
}

function makeActor(type = 'playerCharacter', system = {}, name = 'Ranger') {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { health: { value: 5, max: 10 }, powers: { personal: { value: 0, max: 3 } }, ...system },
    update: jest.fn(async function (data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    }),
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
    getActiveTokens: () => [],
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  game.actors.contents.push(actor);
  return actor;
}

function addPackItem(actor, file, extra = {}) {
  const doc = fromPack(file);
  const item = asItem({
    name: doc.name, type: doc.type, system: { ...doc.system, ...(extra.system ?? {}) }, flags: extra.flags ?? {},
    _stats: { compendiumSource: extra.source ?? `Compendium.essence20.x.Item.${doc._id}` },
  }, actor);
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

function addItem(actor, data) {
  const item = asItem(data, actor);
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

/**
 * A holder whose `team` rules reach the other Player Characters. rules/index.mjs only notes link holders
 * for its LINKED scopes, which leaves out `team` (see "Edits outside my files" in slA6.md) - noted here
 * by hand, the way the index will once `team` is on that list.
 */
function teamHolder(actor) {
  rebuildIndex(actor);
  LINK_HOLDERS.add(actor.id);
  return actor;
}

/** Put actors on a canvas: [actor, x, disposition] each; distance is the x difference. */
function onCanvas(...entries) {
  const placeables = entries.map(([actor, x, disposition]) => {
    const token = { actor, document: { disposition }, center: { x, y: 0 } };
    actor.getActiveTokens = () => [token];
    return token;
  });
  global.canvas = { tokens: { placeables }, grid: { measurePath: ([p, q]) => ({ distance: Math.abs(p.x - q.x) }) } };
}

beforeEach(() => {
  const contents = [];
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null }, settings: { get: () => 1 },
    actors: { contents, get: id => contents.find(actor => actor.id == id), [Symbol.iterator]: () => contents[Symbol.iterator]() },
    i18n: { localize: k => k, format: k => k },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: setPath },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
  LINK_HOLDERS.clear();
  delete global.canvas;
});

test('every rule added in this batch is valid', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

/* -------------------------------------------- */
/*  Primal Rage (pr2/team.mjs)                   */
/* -------------------------------------------- */

describe('Primal Rage: ↑1 on unarmed attacks, for the holder and every other Player Character', () => {
  function attacks(actor) {
    const sword = addItem(actor, { type: 'weapon', name: 'Power Sword' });
    // The printed Unarmed Combat weapon (PR CRB 2nd printing) - attack:unarmed matches it by compendium source
    // (items/shared/unarmed-attacks.mjs), not by name.
    const fists = addItem(actor, { type: 'weapon', name: 'Unarmed Combat', flags: { core: { sourceId: 'Compendium.essence20.pr_crb.Item.5Y0qpK0gnsupCNHX' } } });
    const homemade = addItem(actor, { type: 'weapon', name: 'Unarmed Spikes' });
    return {
      unarmed: addItem(actor, { type: 'weaponEffect', name: 'Punch' }),
      slash: addItem(actor, { type: 'weaponEffect', name: 'Slash', flags: { essence20: { parentId: sword.id } } }),
      jab: addItem(actor, { type: 'weaponEffect', name: 'Jab', flags: { essence20: { parentId: fists.id } } }),
      spike: addItem(actor, { type: 'weaponEffect', name: 'Spike', flags: { essence20: { parentId: homemade.id } } }),
    };
  }

  const rage = (actor, item, isAttack = true) => ruleRollSources(actor, null, { isAttack, item }).sources.filter(source => source.label == 'Primal Rage');

  test('the holder: unarmed attacks (no weapon, or the Unarmed Combat weapon) only', () => {
    const holder = makeActor();
    addPackItem(holder, FILES.primalRage);
    const { unarmed, slash, jab, spike } = attacks(holder);
    expect(rage(holder, unarmed)).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(rage(holder, jab)).toHaveLength(1);
    expect(rage(holder, slash)).toEqual([]);
    // A weapon merely named "Unarmed" is a weapon attack (the old name~unarmed clauses went 2026-10-07).
    expect(rage(holder, spike)).toEqual([]);
    expect(rage(holder, unarmed, false)).toEqual([]);
  });

  test('a teammate gets it from the holder; holding it as well still gives one ↑1', () => {
    const holder = teamHolder(makeActor());
    addPackItem(holder, FILES.primalRage, { source: SOURCE.primalRage });
    teamHolder(holder);
    const mate = makeActor();
    const { unarmed, slash } = attacks(mate);
    expect(rage(mate, unarmed)).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(rage(mate, slash)).toEqual([]);

    addPackItem(mate, FILES.primalRage, { source: SOURCE.primalRage });
    teamHolder(mate);
    expect(rage(mate, unarmed)).toHaveLength(1);
  });

  test('not for an NPC, holding it or not', () => {
    const holder = makeActor();
    addPackItem(holder, FILES.primalRage);
    teamHolder(holder);
    const npc = makeActor('npc');
    addPackItem(npc, FILES.primalRage);
    expect(rage(npc, attacks(npc).unarmed)).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Bend Physics (pr2/team.mjs)                  */
/* -------------------------------------------- */

describe('Bend Physics: +2 Evasion against ranged attacks while Morphed, for the team', () => {
  const ranged = { type: 'weaponEffect', system: { classification: { style: 'projectile' } } };
  const melee = { type: 'weaponEffect', system: { classification: { style: 'melee' } } };

  test('the holder, Morphed: ranged attacks against Evasion only', () => {
    const holder = makeActor('playerCharacter', { isMorphed: true });
    addPackItem(holder, FILES.bendPhysics, { source: SOURCE.bendPhysics });
    expect(ruleDefenseAdjust(null, holder, 'evasion', { item: ranged })).toBe(2);
    expect(ruleDefenseAdjust(null, holder, 'evasion', { item: melee })).toBe(0);
    expect(ruleDefenseAdjust(null, holder, 'toughness', { item: ranged })).toBe(0);
    holder.system.isMorphed = false;
    expect(ruleDefenseAdjust(null, holder, 'evasion', { item: ranged })).toBe(0);
  });

  test('a Morphed teammate gets it once, holding it too or not', () => {
    const holder = makeActor('playerCharacter', { isMorphed: false });
    addPackItem(holder, FILES.bendPhysics, { source: SOURCE.bendPhysics });
    teamHolder(holder);
    const mate = makeActor('playerCharacter', { isMorphed: true });
    expect(ruleDefenseAdjust(null, mate, 'evasion', { item: ranged })).toBe(2);
    mate.system.isMorphed = false;
    expect(ruleDefenseAdjust(null, mate, 'evasion', { item: ranged })).toBe(0);

    mate.system.isMorphed = true;
    addPackItem(mate, FILES.bendPhysics, { source: SOURCE.bendPhysics });
    teamHolder(mate);
    expect(ruleDefenseAdjust(null, mate, 'evasion', { item: ranged })).toBe(2);
  });

  test('no holder anywhere: nothing', () => {
    const alone = makeActor('playerCharacter', { isMorphed: true });
    expect(ruleDefenseAdjust(null, alone, 'evasion', { item: ranged })).toBe(0);
  });
});

/* -------------------------------------------- */
/*  S.W.A.T. Upgrade (pr1/ats.mjs)               */
/* -------------------------------------------- */

describe('S.W.A.T. Upgrade: an enemy Defeated after the Zord last hit it is detained, 6 per scene', () => {
  function setup(count = 2) {
    const zord = makeActor('zord', {}, 'S.W.A.T. Zord');
    addPackItem(zord, FILES.swat);
    const shot = addItem(zord, { type: 'weaponEffect', name: 'Blaster' });
    const foes = Array.from({ length: count }, (_, i) => makeActor('npc', {}, `Foe ${i + 1}`));
    const pal = makeActor('playerCharacter', {}, 'Pal');
    onCanvas([zord, 0, 1], [pal, 10, 1], ...foes.map((foe, i) => [foe, 20 + i * 5, -1]));
    const hit = target => fireTriggers(zord, 'hit', { roll: { item: shot, isAttack: true }, outcome: 'success', targets: [target] });
    return { zord, foes, pal, hit };
  }

  const lines = () => ChatMessage.create.mock.calls.map(([data]) => data.content).join(' ');

  test('the last target hit carries the mark; an earlier one loses it', async () => {
    const { zord, foes: [one, two], hit } = setup();
    await hit(one);
    expect(one.flags.essence20.ruleMarks.swatLastHit.by).toBe(zord.uuid);
    await hit(two);
    expect(one.flags.essence20.ruleMarks.swatLastHit).toBeUndefined();
    expect(two.flags.essence20.ruleMarks.swatLastHit.by).toBe(zord.uuid);
  });

  test('defeating the marked enemy detains it and counts down the cards; others are not detained', async () => {
    const { foes: [one, two], hit } = setup();
    await hit(two);
    ChatMessage.create.mockClear();
    await fireTriggers(one, 'defeated');
    expect(ChatMessage.create).not.toHaveBeenCalled();

    await fireTriggers(two, 'defeated');
    expect(lines()).toContain('Foe 2 is digitally detained (5 containment cards left).');
    expect(two.flags.essence20.ruleMarks.swatLastHit).toBeUndefined();
  });

  test('an ally the Zord last hit is not detained', async () => {
    const { pal, hit } = setup();
    await hit(pal);
    ChatMessage.create.mockClear();
    await fireTriggers(pal, 'defeated');
    expect(lines()).not.toContain('detained');
  });

  test('a seventh detention in the scene finds no card', async () => {
    const { foes, hit } = setup(7);
    for (const foe of foes) {
      await hit(foe);
      await fireTriggers(foe, 'defeated');
    }

    expect(lines()).toContain('Foe 6 is digitally detained (0 containment cards left).');
    expect(lines()).not.toContain('Foe 7 is digitally detained');
  });

  test('only a Zord\'s own hits mark', async () => {
    const pilot = makeActor('playerCharacter');
    addPackItem(pilot, FILES.swat);
    const foe = makeActor('npc');
    await fireTriggers(pilot, 'hit', { roll: { item: addItem(pilot, { type: 'weaponEffect' }), isAttack: true }, outcome: 'success', targets: [foe] });
    expect(foe.flags.essence20.ruleMarks).toBeUndefined();
  });
});

/* -------------------------------------------- */
/*  Morphin Navigator (pr3/ttsg.mjs)             */
/* -------------------------------------------- */

describe('Morphin Navigator: once per mission, 1d2 Personal Power to each Party member up to their maximum', () => {
  function party(...members) {
    const roster = makeActor('party');
    roster.members = members;
    return roster;
  }

  test('each member with a Personal Power maximum gains 1d2, never past it', async () => {
    const ranger = makeActor('playerCharacter', { powers: { personal: { value: 0, max: 3 } } });
    const full = makeActor('playerCharacter', { powers: { personal: { value: 4, max: 5 } } });
    const mundane = makeActor('playerCharacter', { powers: { personal: { value: 0, max: 0 } } });
    party(ranger, full, mundane);
    const navigator = addPackItem(ranger, FILES.navigator);
    jest.spyOn(Math, 'random').mockReturnValue(0.99); // 1d2 -> 2
    const pay = jest.fn(async () => true);
    const line = await runUse(navigator, pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(line).toContain('opens a Grid Power Bloom');
    expect(ranger.system.powers.personal.value).toBe(2);
    expect(full.system.powers.personal.value).toBe(5);
    expect(mundane.update).not.toHaveBeenCalled();
  });

  test('once per mission; an unpaid action uses nothing', async () => {
    const ranger = makeActor();
    party(ranger);
    const navigator = addPackItem(ranger, FILES.navigator);
    const index = navigator.system.rules.findIndex(rule => rule.type == 'Use');
    expect(await runUse(navigator, async () => false)).toBeNull();
    expect(ranger.system.powers.personal.value).toBe(0);
    expect(useAvailable(navigator, navigator.system.rules[index], index)).toBe(true);
    jest.spyOn(Math, 'random').mockReturnValue(0);
    await runUse(navigator, async () => true);
    expect(ranger.system.powers.personal.value).toBe(1);
    expect(useAvailable(navigator, navigator.system.rules[index], index)).toBe(false);
  });

  test('off every Party roster, only the user', async () => {
    const ranger = makeActor();
    const other = makeActor();
    const navigator = addPackItem(ranger, FILES.navigator);
    jest.spyOn(Math, 'random').mockReturnValue(0);
    await runUse(navigator, async () => true);
    expect(ranger.system.powers.personal.value).toBe(1);
    expect(other.update).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Carapaced (zord2/gear-modes.mjs)             */
/* -------------------------------------------- */

describe('Carapaced: +20 Ground in that Alt Mode unless Underground was picked', () => {
  for (const file of [FILES.carapacedCommon, FILES.carapacedLarge]) {
    test(`${file.split('/').pop()}: the Movement, and the pick`, async () => {
      const crab = makeActor('playerCharacter', { isTransformed: true });
      const shell = addPackItem(crab, file, { flags: { essence20: { zord2CarapacedChoice: 'ground' } } });
      crab.system.altModeId = shell.id;
      expect(ruleMovementStages(crab)('afterDerived', 'ground', 40)).toBe(60);
      expect(ruleMovementStages(crab)('afterGravity', 'ground', 40)).toBeNull();
      expect(ruleMovementStages(crab)('afterDerived', 'burrow', 0)).toBeNull();

      // Never picked: the Ground +20 (the old "!= burrow").
      delete shell.flags.essence20.zord2CarapacedChoice;
      expect(ruleMovementStages(crab)('afterDerived', 'ground', 40)).toBe(60);

      const ask = jest.fn(async (step, options) => options.findIndex(option => option.label == '25 feet Underground Movement'));
      const line = await runUse(shell, async () => true, { pick: async (item, available) => available.find(({ rule }) => rule.label == 'Ground or Underground (Carapaced)'), ask });
      expect(line).toContain('25 feet Underground Movement');
      expect(shell.flags.essence20.zord2CarapacedChoice).toBe('burrow');
      expect(ruleMovementStages(crab)('afterDerived', 'ground', 40)).toBeNull();

      // Not in that Alt Mode.
      shell.flags.essence20.zord2CarapacedChoice = 'ground';
      crab.system.isTransformed = false;
      expect(ruleMovementStages(crab)('afterDerived', 'ground', 40)).toBeNull();
    });
  }
});

/* -------------------------------------------- */
/*  Additional Pair of Limbs (zord1/bodies.mjs)  */
/* -------------------------------------------- */

describe('Additional Pair of Limbs: +10 Ground in Alt Mode with the movement mode picked', () => {
  test('Alt Mode and "move" only', () => {
    const bot = makeActor('playerCharacter', { isTransformed: true });
    const limbs = addPackItem(bot, FILES.limbs, { flags: { essence20: { zord1LimbsMode: 'move' } } });
    expect(ruleMovementStages(bot)('afterDerived', 'ground', 40)).toBe(50);
    expect(ruleMovementStages(bot)('afterDerived', 'aerial', 40)).toBeNull();
    limbs.flags.essence20.zord1LimbsMode = 'multi';
    expect(ruleMovementStages(bot)('afterDerived', 'ground', 40)).toBeNull();
    limbs.flags.essence20.zord1LimbsMode = 'move';
    bot.system.isTransformed = false;
    expect(ruleMovementStages(bot)('afterDerived', 'ground', 40)).toBeNull();
  });
});
