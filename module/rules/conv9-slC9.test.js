import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Batch slC9 (docs/rules-batches/slC9.md): the gij1 / gij2 / gij3 / fix3-gij / situational1 / situational2
 * slice items re-checked against the round-9 engine pieces. Converted (gij3):
 * - Pillage: a switch on the Pillage attack for going after a two-handed item (↓1); a hit disarms the target
 *   (one-handed items, or two-handed too with the switch) and the attacker takes the item or lets it fall.
 * - Dreadnok Recruit: a Free action spent at the start of each turn while a Dreadnok (a non-player token named
 *   that way) is on the scene, or the Hang-Up's Use says one is here this scene.
 * Each is loaded from its pack source and must do what the removed slice code did.
 */

// The disarm helper (target-riders.mjs) and the action economy the steps go through. (Mocked paths resolve from
// module/jest.setup.js.)
const disarm = jest.fn();
const spend = jest.fn(async () => ({ blocked: false }));
jest.unstable_mockModule('./helpers/target-riders.mjs', () => ({ disarm }));
jest.unstable_mockModule('./helpers/action-economy.mjs', () => ({ spend }));

const { rebuildIndex } = await import('./index.mjs');
const { fireTriggers, runUse } = await import('./triggers.mjs');
const { applyRuleSwitches, ruleDialogSwitches } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  pillage: 'qgtgitems/_source/Pillage_G7bEjhamqov7tb9w.json',
  dreadnok: 'iafav2items/_source/Dreadnok_Recruit_QIoKmEIelV7it5xE.json',
};
const QGTG = 'Compendium.essence20.quartermasters_guide_to_gear.Item.';

let nextId = 1;
let sceneEpoch = 1;
const byUuid = new Map();

const getPath = (object, key) => key.split('.').reduce((o, k) => o?.[k], object);
function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  const at = keys.reduce((node, k) => (node[k] ??= {}), object);
  if (last.startsWith('-=')) {
    delete at[last.slice(2)];
  } else {
    at[last] = value;
  }
}

function makeItem(data = {}) {
  const item = {
    id: `i${nextId++}`, name: 'Thing', type: 'perk', isOwner: true, system: {}, ...data,
    flags: { essence20: {}, ...(data.flags ?? {}) },
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    toObject() {
      return JSON.parse(JSON.stringify({ _id: this.id, name: this.name, type: this.type, system: this.system, flags: this.flags }));
    },
  };
  item.uuid = `Item.${item.id}`;
  byUuid.set(item.uuid, item);
  return item;
}

const packItem = (file, source) => {
  const doc = fromPack(file);
  return makeItem({ name: doc.name, type: doc.type, system: doc.system, flags: { core: { sourceId: source } } });
};

function makeActor(items = [], { name = 'Hero', type = 'playerCharacter' } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, documentName: 'Actor', isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { level: 6, health: { value: 5, max: 10 } },
    getActiveTokens: () => [],
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    async createEmbeddedDocuments(kind, datas) {
      const made = datas.map(data => {
        const item = makeItem({ ...data, id: undefined });
        item.parent = this;
        return item;
      });
      this.items.contents.push(...made);
      return made;
    },
    async deleteEmbeddedDocuments(kind, ids) {
      this.items.contents = this.items.contents.filter(item => !ids.includes(item.id));
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = {
    contents: items, get: id => actor.items.contents.find(i => i.id == id), find: fn => actor.items.contents.find(fn),
    [Symbol.iterator]: () => actor.items.contents[Symbol.iterator](),
  };
  items.forEach(item => (item.parent = actor));
  rebuildIndex(actor);
  byUuid.set(actor.uuid, actor);
  game.actors.contents.push(actor);
  return actor;
}

beforeEach(() => {
  sceneEpoch = 1;
  byUuid.clear();
  disarm.mockReset();
  spend.mockClear();
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] }, actors: { contents: [] },
    i18n: { localize: k => k, format: k => k },
    settings: { get: () => sceneEpoch, set: async () => {} },
  };
  global.canvas = { tokens: { placeables: [] } };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuidSync = uuid => byUuid.get(uuid) ?? null;
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, escapeHTML: s => s, randomID: () => `r${nextId++}` },
  };
});

const chat = () => ChatMessage.create.mock.calls.map(call => call[0].content).join('\n');

test('the slC9 rules validate', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

/* -------------------------------------------- */
/*  gij3: Pillage                                */
/* -------------------------------------------- */

describe('Pillage: disarm on a hit, then take the item or let it fall', () => {
  const effect = (id = 'Gij3PillageFin01') => makeItem({ name: 'Pillage (Finesse)', type: 'weaponEffect', flags: { core: { sourceId: `${QGTG}${id}` } }, system: { classification: { skill: 'finesse', style: 'melee' } } });
  const weapon = (name, hands = 1) => makeItem({ name, type: 'weapon', system: { equipped: true, hands, derivedHands: hands, traits: [] } });

  // The mocked disarm drops the first held weapon within maxHands, as target-riders.mjs#disarm does.
  beforeEach(() => {
    disarm.mockImplementation(async (actor, target, { maxHands }) => {
      const held = target.items.contents.find(item => item.type == 'weapon' && item.system.equipped !== false && item.system.derivedHands <= maxHands);
      if (held) {
        await held.update({ 'system.equipped': false, 'flags.essence20.disarmed': true });
      }

      return held ?? null;
    });
  });

  const hit = (attacker, target, { item = effect(), switches = [], answer = 0 } = {}) => fireTriggers(attacker, 'hit', {
    roll: { item, switches, isAttack: true, isMelee: true }, outcome: 'success', targets: [target], ask: async () => answer,
  });

  test('the two-handed switch (↓1) is offered on the Pillage attacks only, and only to the Perk\'s holder', async () => {
    const holder = makeActor([packItem(FILES.pillage, `${QGTG}G7bEjhamqov7tb9w`)]);
    for (const id of ['Gij3PillageFin01', 'Gij3PillageMgt01']) {
      const offered = ruleDialogSwitches(holder, { item: effect(id), isAttack: true });
      expect(offered).toHaveLength(1);
      expect(offered[0]).toMatchObject({ type: 'checkbox', value: false, entry: { rule: { key: 'pillageTwoHanded' } } });
      const options = { shiftDown: 0, ext: { [offered[0].name]: true } };
      await applyRuleSwitches(holder, options, { item: effect(id), isAttack: true });
      expect(options.shiftDown).toBe(1);
    }

    const sword = makeItem({ name: 'Sword (Slash)', type: 'weaponEffect', flags: { core: { sourceId: 'Compendium.x.Item.sword' } } });
    expect(ruleDialogSwitches(holder, { item: sword, isAttack: true })).toEqual([]);
    expect(ruleDialogSwitches(makeActor([]), { item: effect(), isAttack: true })).toEqual([]);
  });

  test('a hit knocks a one-handed item loose and, taken, moves it to the attacker', async () => {
    const holder = makeActor([packItem(FILES.pillage, `${QGTG}G7bEjhamqov7tb9w`)]);
    const pistol = weapon('Pistol');
    const foe = makeActor([pistol], { name: 'Foe', type: 'npc' });
    await hit(holder, foe);
    expect(disarm).toHaveBeenCalledTimes(1);
    expect(disarm.mock.calls[0][2]).toMatchObject({ maxHands: 1 });
    expect(foe.items.contents).toEqual([]);
    const taken = holder.items.contents.find(item => item.name == 'Pistol');
    expect(taken).toBeTruthy();
    expect(taken.system.equipped).toBe(false);
  });

  test('let fall: the target keeps it, unequipped', async () => {
    const holder = makeActor([packItem(FILES.pillage, `${QGTG}G7bEjhamqov7tb9w`)]);
    const pistol = weapon('Pistol');
    const foe = makeActor([pistol], { name: 'Foe', type: 'npc' });
    await hit(holder, foe, { answer: 1 });
    expect(foe.items.contents).toEqual([pistol]);
    expect(pistol.system.equipped).toBe(false);
    expect(holder.items.contents.some(item => item.name == 'Pistol')).toBe(false);
    expect(chat()).toContain('lets it fall nearby');
  });

  test('a two-handed item only with the switch ticked', async () => {
    const holder = makeActor([packItem(FILES.pillage, `${QGTG}G7bEjhamqov7tb9w`)]);
    const rifle = weapon('Rifle', 2);
    const foe = makeActor([rifle], { name: 'Foe', type: 'npc' });
    await hit(holder, foe);
    expect(disarm.mock.calls[0][2]).toMatchObject({ maxHands: 1 });
    expect(rifle.system.equipped).toBe(true);
    await hit(holder, foe, { switches: ['pillageTwoHanded'] });
    expect(disarm.mock.calls[1][2]).toMatchObject({ maxHands: 2 });
    expect(foe.items.contents).toEqual([]);
    expect(holder.items.contents.some(item => item.name == 'Rifle')).toBe(true);
  });

  test('nothing for another attack, or with nothing held (no take-or-drop question)', async () => {
    const holder = makeActor([packItem(FILES.pillage, `${QGTG}G7bEjhamqov7tb9w`)]);
    const foe = makeActor([weapon('Pistol')], { name: 'Foe', type: 'npc' });
    const sword = makeItem({ name: 'Sword (Slash)', type: 'weaponEffect', flags: { core: { sourceId: 'Compendium.x.Item.sword' } } });
    await hit(holder, foe, { item: sword });
    expect(disarm).not.toHaveBeenCalled();

    const ask = jest.fn(async () => 0);
    await fireTriggers(holder, 'hit', { roll: { item: effect(), switches: [] }, outcome: 'success', targets: [makeActor([], { name: 'Bare', type: 'npc' })], ask });
    expect(disarm).toHaveBeenCalledTimes(1);
    expect(ask).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  gij3: Dreadnok Recruit                       */
/* -------------------------------------------- */

describe('Dreadnok Recruit: a Free action each turn while a Dreadnok is on the scene', () => {
  const recruit = () => makeActor([packItem(FILES.dreadnok, 'Compendium.essence20.intercontinental_adventures.Item.QIoKmEIelV7it5xE')]);
  const token = actor => ({ actor });

  test('a Dreadnok token on the scene: the Free action is spent at turn start, and it says so', async () => {
    const holder = recruit();
    await fireTriggers(holder, 'turnStart');
    expect(spend).not.toHaveBeenCalled();

    canvas.tokens.placeables = [token(holder), token(makeActor([], { name: 'Dreadnok Thug', type: 'npc' }))];
    await fireTriggers(holder, 'turnStart');
    expect(spend).toHaveBeenCalledWith(holder, 'free', expect.anything());
    expect(chat()).toContain('Free action');
  });

  test('not for a player character named Dreadnok, nor for another creature; the chat still goes out if the action can\'t be paid', async () => {
    const holder = recruit();
    canvas.tokens.placeables = [token(makeActor([], { name: 'Dreadnok Wannabe' })), token(makeActor([], { name: 'Viper', type: 'npc' }))];
    await fireTriggers(holder, 'turnStart');
    expect(spend).not.toHaveBeenCalled();

    canvas.tokens.placeables.push(token(makeActor([], { name: 'Zartan (Dreadnok)', type: 'npc' })));
    spend.mockResolvedValueOnce({ blocked: true });
    await fireTriggers(holder, 'turnStart');
    expect(spend).toHaveBeenCalledTimes(1);
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
  });

  test('the Use marks a Dreadnok present for this scene (offered only while none is marked)', async () => {
    const holder = recruit();
    const hangUp = holder.items.contents[0];
    const card = await runUse(hangUp, async () => true);
    expect(card).toContain('A Dreadnok is watching');
    expect(await runUse(hangUp, async () => true)).toBe(null);
    await fireTriggers(holder, 'turnStart');
    expect(spend).toHaveBeenCalledTimes(1);

    sceneEpoch = 2;
    await fireTriggers(holder, 'turnStart');
    expect(spend).toHaveBeenCalledTimes(1);
    expect(await runUse(hangUp, async () => true)).toContain('A Dreadnok is watching');
  });
});
