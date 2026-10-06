import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slJ13 (docs/rules-batches/slJ13.md): Dino Drive Mode's clean-up reaching unlinked token Zords again (the world sweeps
 * now take in unlinked tokens' actors - rules/triggers.mjs#sweepActors), and Mystical Understanding's Spellcialize moved
 * from dice.mjs onto a DialogSwitch rule on the Perk. Items are loaded from their pack sources and must do what the old
 * code did.
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { applyRuleSwitches, ruleDialogSwitches } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { runSceneAdvanced, runTurnStart } = await import('../mechanics/item-hooks.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const FILES = {
  drive: 'bthitems/_source/Dino_Drive_Mode_fpfH5KgJ3BdWAFtM.json',
  mystical: 'mlpcrbitems/_source/Mystical_Understanding_23NeoRDRxlo0LpyQ.json',
};

let nextId = 1;
const clock = { sceneClockScene: 3, sceneClockEncounter: 3, sceneClockMission: 7 };
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

const worldActors = [];

function makeActor(name, { type = 'zord', world = true, system = {}, effects = [], items: extraItems = [] } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: {} }, effects: [...effects],
    system: { health: { value: 5, max: 10 }, skills: {}, ...system },
    getActiveTokens: () => [],
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }

      rebuildIndex(this);
    },
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
    deleteEmbeddedDocuments: jest.fn(async (kind, ids) => {
      const list = kind == 'ActiveEffect' ? actor.effects : items;
      for (const id of ids) {
        const at = list.findIndex(entry => entry.id == id);
        if (at >= 0) {
          list.splice(at, 1);
        }
      }

      rebuildIndex(actor);
    }),
  };
  actor.uuid = world ? `Actor.${actor.id}` : `Scene.s1.Token.t${nextId++}.Actor.${actor.id}`;
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  for (const data of extraItems) {
    items.push({ id: `i${nextId++}`, flags: {}, system: {}, effects: [], parent: actor, ...data });
  }

  if (world) {
    worldActors.push(actor);
  }

  rebuildIndex(actor);
  return actor;
}

function addPackItem(actor, key) {
  const doc = fromPack(FILES[key]);
  const item = {
    id: `i${nextId++}`, name: doc.name, type: doc.type, img: doc.img, system: JSON.parse(JSON.stringify(doc.system)), flags: {}, effects: [], parent: actor,
    _stats: { compendiumSource: `Compendium.essence20.x.Item.${doc._id}` },
    async update(changes) {
      for (const [k, value] of Object.entries(changes)) {
        setPath(this, k, value);
      }
    },
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

beforeEach(() => {
  worldActors.length = 0;
  global.game = {
    combat: null, user: { id: 'u', isGM: true, isActiveGM: true, targets: new Set() }, users: { activeGM: null, contents: [] },
    settings: { get: (scope, key) => clock[key] ?? 1, set: async () => {} },
    actors: { contents: worldActors, get: id => worldActors.find(actor => actor.id == id), [Symbol.iterator]: () => worldActors[Symbol.iterator]() },
    scenes: { active: null },
    i18n: { localize: k => k, format: k => k, has: () => false },
    messages: { get: () => null },
  };
  global.canvas = undefined;
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: setPath, deepClone: value => JSON.parse(JSON.stringify(value)) },
  };
});

test('every changed item\'s rules validate', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules ?? []) {
      expect([file, rule.label, validateRule(rule)]).toEqual([file, rule.label, []]);
    }
  }
});

/* -------------------------------------------- */
/*  Dino Drive Mode - unlinked token Zords       */
/* -------------------------------------------- */

describe('Dino Drive Mode clean-up on unlinked token Zords', () => {
  const driveEffects = () => [
    { id: `e${nextId++}`, name: 'Dino Drive Mode', flags: { essence20: { pr2DinoDriveEffect: true } } },
    { id: `e${nextId++}`, name: 'E20.Pr2DinoDriveSlowName', flags: { essence20: { pr2DinoDriveEffect: true, pr2DinoDriveSlow: true } } },
  ];

  test('a new scene clears an unlinked token Zord\'s effects (and a world Zord\'s, each once) - as the old sweep did', async () => {
    const worldZord = makeActor('Linked Zord', { effects: driveEffects() });
    addPackItem(worldZord, 'drive');
    const tokenZord = makeActor('Token Zord', { world: false, effects: [...driveEffects(), { id: 'other', name: 'Other', flags: {} }] });
    addPackItem(tokenZord, 'drive');
    const linked = { actorLink: true, actor: worldZord };
    const unlinked = { actorLink: false, actor: tokenZord };
    global.canvas = { scene: { tokens: [linked, unlinked] }, tokens: { placeables: [{ actor: worldZord, document: linked }, { actor: tokenZord, document: unlinked }] } };

    await runSceneAdvanced(4);
    expect(worldZord.effects).toEqual([]);
    expect(tokenZord.effects.map(effect => effect.id)).toEqual(['other']);
    // Once each: the linked token's actor is the world actor, not a second one.
    expect(worldZord.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
    expect(tokenZord.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
  });

  test('an unlinked token Zord on the active scene (not the viewed one) is cleared too', async () => {
    const tokenZord = makeActor('Token Zord', { world: false, effects: driveEffects() });
    addPackItem(tokenZord, 'drive');
    global.game.scenes.active = { tokens: [{ actorLink: false, actor: tokenZord }] };
    await runSceneAdvanced(4);
    expect(tokenZord.effects).toEqual([]);
  });

  test('its turn start lifts only the Speed penalty (a combatant\'s token actor)', async () => {
    const tokenZord = makeActor('Token Zord', { world: false, effects: driveEffects() });
    addPackItem(tokenZord, 'drive');
    await runTurnStart(tokenZord, null, {});
    expect(tokenZord.effects.map(effect => effect.name)).toEqual(['Dino Drive Mode']);
  });
});

/* -------------------------------------------- */
/*  Mystical Understanding - Spellcialize        */
/* -------------------------------------------- */

describe('Mystical Understanding - Spellcialize', () => {
  const LABEL = 'Spend 1 Mystical Point (Spellcialize: Specialized)';

  function pony({ hasPerk = true, shift = 'd6', isSpecialized = false, mysticalPoints = 1 } = {}) {
    const points = mysticalPoints == null ? null : {
      id: `rp${nextId++}`, name: 'Mystical Points', type: 'rolePoints', flags: {}, system: { resource: { value: mysticalPoints, max: 5 } },
      update: jest.fn(async function (changes) {
        for (const [key, value] of Object.entries(changes)) {
          setPath(this, key, value);
        }
      }),
    };
    const actor = makeActor('Twilight', { type: 'playerCharacter', system: { skills: { spellcasting: { shift, isSpecialized }, athletics: { shift: 'd20' } } } });
    actor._getBaseRolePoints = () => points;
    if (hasPerk) {
      addPackItem(actor, 'mystical');
    }

    return { actor, points };
  }

  const switchesOf = (actor, ctx = { rolledSkill: 'spellcasting', dataset: { skill: 'spellcasting' } }) => ruleDialogSwitches(actor, ctx).filter(entry => entry.label == LABEL);

  test('offered (unticked) when trained, not already Specialized, and a Mystical Point is left', () => {
    const { actor } = pony();
    const [entry] = switchesOf(actor);
    expect(entry).toEqual(expect.objectContaining({ type: 'checkbox', value: false }));
  });

  test('not offered without the Perk, untrained, already Specialized, without Mystical Points, or on Initiative', () => {
    expect(switchesOf(pony({ hasPerk: false }).actor)).toEqual([]);
    expect(switchesOf(pony({ shift: 'd20' }).actor)).toEqual([]);
    expect(switchesOf(pony({ isSpecialized: true }).actor)).toEqual([]);
    expect(switchesOf(pony({ mysticalPoints: 0 }).actor)).toEqual([]);
    expect(switchesOf(pony({ mysticalPoints: null }).actor)).toEqual([]);
    expect(switchesOf(pony().actor, { rolledSkill: 'spellcasting', dataset: { skill: 'spellcasting', isInitiative: true } })).toEqual([]);
    // Any trained Skill counts, not only Spellcasting.
    const { actor } = pony();
    actor.system.skills.athletics.shift = 'd8';
    expect(switchesOf(actor, { rolledSkill: 'athletics', dataset: { skill: 'athletics' } })).toHaveLength(1);
  });

  test('ticked, the roll is Specialized and one Mystical Point is spent', async () => {
    const { actor, points } = pony({ mysticalPoints: 2 });
    const ctx = { rolledSkill: 'spellcasting', dataset: { skill: 'spellcasting' } };
    const [entry] = switchesOf(actor, ctx);
    const options = { edge: false, snag: false, shiftUp: 0, shiftDown: 0, ext: { [entry.name]: true } };
    await applyRuleSwitches(actor, options, ctx);
    expect(options.isSpecialized).toBe(true);
    expect(options.edge).toBe(false);
    expect(options.shiftUp).toBe(0);
    expect(points.update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
  });

  test('left unticked: not Specialized, nothing spent', async () => {
    const { actor, points } = pony();
    const ctx = { rolledSkill: 'spellcasting', dataset: { skill: 'spellcasting' } };
    const options = { edge: false, snag: false, shiftUp: 0, shiftDown: 0, ext: {} };
    await applyRuleSwitches(actor, options, ctx);
    expect(options.isSpecialized).toBeFalsy();
    expect(points.update).not.toHaveBeenCalled();
  });

  test('the switch is added after the Perk\'s existing rules (their indexes - and picks / uses - unchanged)', () => {
    const rules = fromPack(FILES.mystical).system.rules;
    expect(rules.map(rule => rule.type)).toEqual(['SpellCost', 'Use', 'RollModifier', 'Trigger', 'DialogSwitch']);
  });
});
