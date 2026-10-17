import {
  convertCreatureEssenceWrites, finishCurrentEssences, migrateCreatureEssences, resetScoresFromBase, scoreBoosts, usesScoreBase,
} from './creature-essences.mjs';
import { resolveValue } from '../../rules/formula.mjs';

/**
 * NPC / Companion Essences: a typed base, the worked-out score (max) and the current amount (value) -
 * mechanics/characters/creature-essences.mjs (user decision 2026-10-07).
 */

// The jest stand-in for foundry.utils has no setProperty; this file's module and helper need it.
const setProperty = (obj, path, value) => {
  const keys = path.split('.');
  const last = keys.pop();
  let node = obj;
  for (const key of keys) {
    node = node[key] ??= {};
  }

  node[last] = value;
  return true;
};

let hadSetProperty;
beforeAll(() => {
  hadSetProperty = global.foundry.utils.setProperty;
  global.foundry.utils.setProperty ??= setProperty;
});
afterAll(() => {
  if (!hadSetProperty) {
    delete global.foundry.utils.setProperty;
  }
});

const expand = flat => {
  const out = {};
  for (const [path, value] of Object.entries(flat)) {
    global.foundry.utils.setProperty(out, path, value);
  }

  return out;
};

/** An NPC whose stored Essence is `stored` and whose prepared one is `shown` (after effects). */
function npc(stored, shown = stored) {
  return {
    type: 'npc',
    _source: { system: { essences: { strength: { ...stored } } } },
    system: { essences: { strength: { ...shown } } },
  };
}

test('only NPCs and Companions use it (PCs keep Starting Essences, machines their own base)', () => {
  expect(['npc', 'companion'].map(type => usesScoreBase({ type }))).toEqual([true, true]);
  expect(['playerCharacter', 'zord', 'vehicle', 'megaform'].map(type => usesScoreBase({ type }))).toEqual([false, false, false, false]);
});

describe('migration', () => {
  test('a whole old record takes its score as the base', () => {
    const source = { essences: { strength: { max: 5, value: 4 }, speed: { max: 2, value: 2 } } };
    expect(migrateCreatureEssences(source)).toBe(true);
    expect(source.essences.strength).toEqual({ base: 5, max: 5, value: 4 });
    expect(source.essences.speed.base).toBe(2);
  });

  test('never a partial update, and never a record that already has its base', () => {
    const partial = { essences: { strength: { max: 6, value: 6 } } };
    expect(migrateCreatureEssences(partial, { partial: true })).toBe(false);
    expect(partial.essences.strength.base).toBeUndefined();
    const done = { essences: { strength: { base: 4, max: 5, value: 5 } } };
    migrateCreatureEssences(done);
    expect(done.essences.strength.base).toBe(4);
  });
});

test('each prep starts the score from the base; the current amount follows a boost and keeps damage', () => {
  const system = { essences: { strength: { base: 3, max: 9, value: 2 } } };
  resetScoresFromBase(system);
  expect(system.essences.strength.max).toBe(3);

  // An effect raises the score to 4; one point of damage is stored (2 of a base 3).
  const actor = npc({ base: 3, max: 3, value: 2 }, { base: 3, max: 4, value: 2 });
  expect(scoreBoosts(actor).strength).toBe(1);
  finishCurrentEssences(actor);
  expect(actor.system.essences.strength.value).toBe(3);

  // Undamaged, boosted: full, not "3 of 4".
  const full = npc({ base: 3, max: 3, value: 3 }, { base: 3, max: 4, value: 3 });
  finishCurrentEssences(full);
  expect(full.system.essences.strength.value).toBe(4);
});

describe('writes are stored in base form', () => {
  test('a rule raising the score moves the base (and the current amount) by the same', () => {
    const actor = npc({ base: 3, max: 3, value: 3 }, { base: 3, max: 4, value: 4 });
    const changed = expand({ 'system.essences.strength.max': 5 });
    convertCreatureEssenceWrites(actor, changed);
    expect(changed.system.essences.strength).toMatchObject({ base: 4, value: 4 });
  });

  test('Essence damage, healing and a Rest write the shown amount; the boost comes off before storing', () => {
    const actor = npc({ base: 3, max: 3, value: 3 }, { base: 3, max: 4, value: 4 });
    const damaged = expand({ 'system.essences.strength.value': 2 });
    convertCreatureEssenceWrites(actor, damaged);
    expect(damaged.system.essences.strength.value).toBe(1);

    const rested = expand({ 'system.essences.strength.value': 4 });
    convertCreatureEssenceWrites(actor, rested);
    expect(rested.system.essences.strength.value).toBe(3);
  });

  test('typing a new base on the sheet keeps the damage taken', () => {
    const actor = npc({ base: 3, max: 3, value: 2 });
    const changed = expand({ 'system.essences.strength.base': 5 });
    convertCreatureEssenceWrites(actor, changed);
    expect(changed.system.essences.strength).toEqual({ base: 5, max: 5, value: 4 });
  });

  test('raising the base on the sheet (which also sends the untouched current amount) keeps an undamaged NPC full', () => {
    const actor = npc({ base: 3, max: 3, value: 3 });
    const changed = expand({ 'system.essences.strength.base': 4, 'system.essences.strength.value': 3 });
    convertCreatureEssenceWrites(actor, changed);
    expect(changed.system.essences.strength).toEqual({ base: 4, max: 4, value: 4 });
  });

  test('the sheet sends base and value together: the shown value is converted, the base kept', () => {
    const actor = npc({ base: 3, max: 3, value: 3 }, { base: 3, max: 4, value: 4 });
    const changed = expand({ 'system.essences.strength.base': 3, 'system.essences.strength.value': 4 });
    convertCreatureEssenceWrites(actor, changed);
    expect(changed.system.essences.strength).toEqual({ base: 3, max: 3, value: 3 });
  });
});

describe('@essence in rule formulas', () => {
  const actor = { system: { essences: { strength: { base: 4, max: 5, value: 2 } }, level: 1 } };

  test('is the score (max), not what Essence damage left', () => {
    expect(resolveValue('@essence.strength', { actor })).toBe(5);
  });

  test('@essence.<key>.current is what is left', () => {
    expect(resolveValue('@essence.strength.current', { actor })).toBe(2);
  });

  test("a Zord's Essence (no max) is its value", () => {
    expect(resolveValue('@essence.strength', { actor: { system: { essences: { strength: { base: 6, value: 7 } } } } })).toBe(7);
  });
});
