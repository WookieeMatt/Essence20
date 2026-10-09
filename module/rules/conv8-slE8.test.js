import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slE8: items of the data22 / mlp1 slices converted with the round-8 engine pieces (perSetter marks read by
 * markedByMe, step `when` + setVar, updateActor `max` read per recipient). Each is loaded from its pack source and
 * must do what the removed slice code did.
 */

const { rebuildIndex } = await import('./index.mjs');
const { ruleRollSources } = await import('./adapter.mjs');
const { fireTriggers, runUse, useAvailable } = await import('./triggers.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;
let sceneEpoch = 1;

function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

/** Applies an update the way Foundry would (dotted keys, `-=key` removals). */
function applyUpdate(doc, data) {
  for (const [key, value] of Object.entries(data)) {
    const parts = key.split('.');
    const last = parts.pop();
    if (last.startsWith('-=') || (globalThis.foundry?.data?.operators?.ForcedDeletion && value instanceof globalThis.foundry.data.operators.ForcedDeletion)) {
      const parent = parts.reduce((at, part) => at?.[part], doc);
      if (parent) {
        delete parent[last.replace(/^-=/, '')];
      }
    } else {
      setPath(doc, key, value);
    }
  }
}

function makeActor({ name = 'Hero', type = 'playerCharacter', system = {}, items = [] } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { level: 5, health: { value: 3, max: 10 }, skills: {}, ...system },
    effects: { contents: [] },
    update: jest.fn(async function (data) {
      applyUpdate(this, data);
    }),
    getActiveTokens: () => [],
    getFlag: (scope, key) => `${scope}.${key}`.split('.').reduce((at, part) => at?.[part], actor.flags),
    setFlag: async (scope, key, value) => setPath(actor.flags, `${scope}.${key}`, value),
  };
  actor.uuid = `Actor.${actor.id}`;
  const list = [...items];
  actor.items = { contents: list, get: id => list.find(i => i.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() };
  for (const item of list) {
    item.parent = actor;
  }

  rebuildIndex(actor);
  return actor;
}

/** An owned copy of a pack item (its book source set, as a dropped copy has). */
function packItem(file, extra = {}) {
  const doc = fromPack(file);
  const item = {
    id: extra.id ?? `i${nextId++}`, name: doc.name, type: doc.type,
    flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, ...(extra.flags ?? {}) },
    system: { ...doc.system, ...(extra.system ?? {}) },
  };
  item.update = jest.fn(async data => applyUpdate(item, data));
  return item;
}

let posted;
beforeEach(() => {
  posted = [];
  sceneEpoch = 1;
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null }, settings: { get: () => sceneEpoch },
    actors: { contents: [] },
    i18n: { localize: k => k, format: k => k },
  };
  global.ChatMessage = { create: jest.fn(async data => posted.push(data.content)), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn() } };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) },
  };
});

/** A roll's rule sources against a target, the way target-riders.mjs asks for them. */
const sourcesFor = (actor, target, roll) => ruleRollSources(actor, target, roll).sources;

/** What target-riders.mjs#runPostRoll hands the rules after a roll: a hit or miss on each target. */
async function rolledAgainst(actor, targets, rolledSkill, hit = true) {
  for (const target of targets) {
    await fireTriggers(actor, hit ? 'hit' : 'miss', { roll: { rolledSkill }, outcome: hit ? 'success' : 'failure', targets: [target] });
  }
}

/* -------------------------------------------- */
/*  Fresh Mark (data22)                          */
/* -------------------------------------------- */

const FRESH_MARK = 'mlpcrbitems/_source/Fresh_Mark_LWCNfr3eEU2y9MyP.json';

describe('Fresh Mark', () => {
  const edged = (actor, target, roll) => sourcesFor(actor, target, roll).some(source => source.edge && /Fresh Mark/.test(source.label));

  test('Edge on the first Deception against a creature, not after', async () => {
    const actor = makeActor({ items: [packItem(FRESH_MARK)] });
    const target = makeActor({ name: 't1', type: 'npc' });
    expect(edged(actor, target, { rolledSkill: 'deception' })).toBe(true);
    expect(edged(actor, target, { rolledSkill: 'persuasion' })).toBe(false);

    await rolledAgainst(actor, [target], 'deception');
    expect(edged(actor, target, { rolledSkill: 'deception' })).toBe(false);
    expect(edged(actor, makeActor({ name: 't2', type: 'npc' }), { rolledSkill: 'deception' })).toBe(true);
    expect(edged(actor, null, { rolledSkill: 'deception' })).toBe(false);
  });

  test('a miss counts too, every target is remembered, a later scene doesn\'t reset it', async () => {
    const actor = makeActor({ items: [packItem(FRESH_MARK)] });
    const [one, two] = [makeActor({ type: 'npc' }), makeActor({ type: 'npc' })];
    await rolledAgainst(actor, [one, two], 'deception', false);
    sceneEpoch = 5;
    expect(edged(actor, one, { rolledSkill: 'deception' })).toBe(false);
    expect(edged(actor, two, { rolledSkill: 'deception' })).toBe(false);
  });

  test('other Skills don\'t mark; another holder keeps its own memory; Initiative never gets it', async () => {
    const actor = makeActor({ items: [packItem(FRESH_MARK)] });
    const other = makeActor({ items: [packItem(FRESH_MARK)] });
    const target = makeActor({ type: 'npc' });
    await rolledAgainst(actor, [target], 'persuasion');
    expect(edged(actor, target, { rolledSkill: 'deception' })).toBe(true);
    await rolledAgainst(actor, [target], 'deception');
    expect(edged(other, target, { rolledSkill: 'deception' })).toBe(true);
    await rolledAgainst(other, [target], 'deception');
    expect(edged(actor, target, { rolledSkill: 'deception' })).toBe(false);
    expect(edged(makeActor({ items: [packItem(FRESH_MARK)] }), target, { rolledSkill: 'deception', dataset: { isInitiative: true } })).toBe(false);
  });

  test('perks not held do nothing', async () => {
    const actor = makeActor();
    const target = makeActor({ type: 'npc' });
    expect(edged(actor, target, { rolledSkill: 'deception' })).toBe(false);
    await rolledAgainst(actor, [target], 'deception');
    expect(target.update).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Natural Style (data22)                       */
/* -------------------------------------------- */

const NATURAL_STYLE = 'mlpcrbitems/_source/Natural_Style_IgjtNiGBXQinE1GO.json';

describe('Natural Style', () => {
  const upshift = (actor, target, roll) => sourcesFor(actor, target, roll).find(source => /Natural Style/.test(source.label))?.shiftUp ?? 0;

  test('↑1 on social tests with a new acquaintance for that scene only', async () => {
    const actor = makeActor({ items: [packItem(NATURAL_STYLE)] });
    const target = makeActor({ type: 'npc' });
    expect(upshift(actor, target, { rolledSkill: 'persuasion' })).toBe(1);
    expect(upshift(actor, target, { rolledSkill: 'might' })).toBe(0);
    expect(upshift(actor, target, { rolledSkill: 'might', rolledEssence: 'social' })).toBe(1);
    expect(upshift(actor, null, { rolledSkill: 'persuasion' })).toBe(0);

    await rolledAgainst(actor, [target], 'persuasion');
    // Still the same scene: still ↑1.
    expect(upshift(actor, target, { rolledSkill: 'deception' })).toBe(1);
    sceneEpoch = 2;
    expect(upshift(actor, target, { rolledSkill: 'persuasion' })).toBe(0);
    // A second roll in a later scene doesn't restamp the first meeting.
    await rolledAgainst(actor, [target], 'persuasion');
    expect(upshift(actor, target, { rolledSkill: 'persuasion' })).toBe(0);
    // Someone new in the later scene still counts.
    expect(upshift(actor, makeActor({ type: 'npc' }), { rolledSkill: 'streetwise' })).toBe(1);
  });

  test('only a social Skill meets them (a miss counts); Initiative never gets it', async () => {
    const actor = makeActor({ items: [packItem(NATURAL_STYLE)] });
    const target = makeActor({ type: 'npc' });
    await rolledAgainst(actor, [target], 'might');
    sceneEpoch = 2;
    expect(upshift(actor, target, { rolledSkill: 'persuasion' })).toBe(1);
    await rolledAgainst(actor, [target], 'animalHandling', false);
    sceneEpoch = 3;
    expect(upshift(actor, target, { rolledSkill: 'persuasion' })).toBe(0);
    expect(upshift(actor, makeActor({ type: 'npc' }), { rolledSkill: 'persuasion', dataset: { isInitiative: true } })).toBe(0);
  });
});

/* -------------------------------------------- */
/*  Mrs. Doubleshoe's Prize Honey (mlp1)         */
/* -------------------------------------------- */

const HONEY = 'dsoeitems/_source/Mrs__Doubleshoe_s_Prize_Honey_tbBjkVhSSc3Zj9zp.json';

describe('Prize Honey', () => {
  const useOf = item => item.system.rules.findIndex(rule => rule.type == 'Use');

  test('heals the user up to 3 Health with nothing targeted; three uses, then none', async () => {
    const honey = packItem(HONEY);
    const actor = makeActor({ name: 'Applejack', system: { health: { value: 3, max: 10 } }, items: [honey] });
    const message = await runUse(honey, async () => true);
    expect(actor.system.health.value).toBe(6);
    expect(honey.flags.essence20.usesLeft).toBe(2);
    expect(message).toContain('Applejack eats the Prize Honey');

    await runUse(honey, async () => true);
    expect(actor.system.health.value).toBe(9);
    expect(honey.flags.essence20.usesLeft).toBe(1);
    await runUse(honey, async () => true);
    expect(actor.system.health.value).toBe(10);
    expect(honey.flags.essence20.usesLeft).toBe(0);
    expect(useAvailable(honey, honey.system.rules[useOf(honey)], useOf(honey))).toBe(false);
    expect(await runUse(honey, async () => true)).toBeNull();
  });

  test('heals the targeted creature, capped at its maximum (lowering Health above it), counting down a stored count', async () => {
    const honey = packItem(HONEY);
    honey.flags.essence20 = { usesLeft: 2 };
    makeActor({ items: [honey] });
    const friend = makeActor({ name: 'Fluttershy', system: { health: { value: 12, max: 10 } } });
    game.user.targets = new Set([{ actor: friend }]);
    const message = await runUse(honey, async () => true);
    expect(friend.system.health.value).toBe(10);
    expect(honey.flags.essence20.usesLeft).toBe(1);
    expect(message).toContain('Fluttershy eats the Prize Honey');
  });

  test('a target with no Health is left alone (the use still counts)', async () => {
    const honey = packItem(HONEY);
    makeActor({ items: [honey] });
    const party = makeActor({ name: 'Party', type: 'party' });
    delete party.system.health;
    game.user.targets = new Set([{ actor: party }]);
    await runUse(honey, async () => true);
    expect(party.update).not.toHaveBeenCalled();
    expect(honey.flags.essence20.usesLeft).toBe(2);
  });
});
