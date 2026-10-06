import { jest } from '@jest/globals';
import {
  perkAccess, tradeSchoolPreRoll, tradeSchoolSpecializes,
} from '../gear/qualification-perks.mjs';
import { doOrDieDie, oldHandLevel } from '../rolls/old-hand-do-or-die.mjs';
import { SESSION_GATED, carryGatedUses, isSessionReset, noteGatedUse, startNewSession } from '../../mechanics/resources/game-sessions.mjs';
import { registrySnapshot } from '../../mechanics/item-hooks.mjs';

foundry.utils.flattenObject = (obj, prefix = '') => Object.entries(obj ?? {}).reduce((out, [key, value]) => {
  const path = prefix ? `${prefix}.${key}` : key;
  if (value && typeof value == 'object' && !Array.isArray(value)) {
    Object.assign(out, foundry.utils.flattenObject(value, path));
  } else {
    out[path] = value;
  }

  return out;
}, {});
foundry.utils.escapeHTML = text => text;

let nextId = 0;
function item(type, source, extra = {}) {
  nextId += 1;
  return {
    id: extra.id ?? `i${nextId}`, type, name: extra.name ?? type, uuid: `Item.i${nextId}`,
    flags: { core: { sourceId: source }, essence20: { ...(extra.flags ?? {}) } },
    system: extra.system ?? {},
    setFlag: jest.fn(async function (scope, key, value) {
      this.flags[scope][key] = value;
    }),
    unsetFlag: jest.fn(async function (scope, key) {
      delete this.flags[scope][key];
    }),
  };
}

function makeActor(items = [], extra = {}) {
  const list = [...items];
  const actor = {
    id: extra.id ?? 'a1', uuid: `Actor.${extra.id ?? 'a1'}`, name: extra.name ?? 'Tester', type: extra.type ?? 'playerCharacter',
    flags: { essence20: { ...(extra.flags ?? {}) } },
    system: { skills: {}, level: 1, ...(extra.system ?? {}) },
    statuses: new Set(extra.statuses ?? []),
    effects: extra.effects ?? [],
    items: Object.assign(list, { contents: list, get: id => list.find(i => i.id == id) }),
    getFlag: (scope, key) => actor.flags[scope]?.[key],
    setFlag: jest.fn(async (scope, key, value) => {
      actor.flags[scope] ??= {};
      actor.flags[scope][key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete actor.flags[scope][key];
    }),
    update: jest.fn(async () => {}),
    isOwner: true,
  };
  for (const entry of list) {
    entry.parent = actor;
  }

  return actor;
}

const weapon = (extra = {}) => item('weapon', extra.source ?? null, extra);

beforeEach(() => {
  game.actors = [];
  game.actors.party = null;
  game.user = { id: 'u1', isGM: true, isActiveGM: true, targets: new Set() };
});

describe('requisition access', () => {
  // Weapon Enthusiast's Limited-type Qualification is a rule on the Perk (rules/conv12-slI12.test.js).
  test('a granted qualified copy is qualified; nothing else is', () => {
    expect(perkAccess(makeActor([]), weapon({ flags: { qualified: true } }))).toBe('qualified');
    expect(perkAccess(makeActor([]), weapon({ name: 'Combat Shotgun', system: { availability: 'limited' } }))).toBeNull();
  });
});

describe('Trade School, Enthusiast Hang-Up', () => {
  test('Trade School lends the coach\'s Technology die for the scene', async () => {
    const coach = makeActor([], { id: 'coach', system: { skills: { technology: { shift: 'd8', isSpecialized: true } } } });
    const ally = makeActor([], { id: 'ally', flags: { pendingTradeSchool: { granterId: 'coach' } } });
    game.actors = [coach, ally];
    const dataset = { skill: 'technology', shift: 'd2' };
    await tradeSchoolPreRoll(ally, dataset);
    expect(dataset.shift).toBe('d8');
    expect(tradeSchoolSpecializes(ally, 'technology')).toBe(true);
    delete ally.flags.essence20.pendingTradeSchool;
    const again = { skill: 'technology', shift: 'd2' };
    await tradeSchoolPreRoll(ally, again);
    expect(again.shift).toBe('d8');
  });

});

describe('Old Hand', () => {
  test('die size by Old Hand level', () => {
    expect(doOrDieDie(makeActor([], { system: { level: 5, oldHandTransitionLevel: 5 } }))).toBe('d2');
    expect(oldHandLevel(makeActor([], { system: { level: 15, oldHandTransitionLevel: 5 } }))).toBe(11);
    expect(doOrDieDie(makeActor([], { system: { level: 15, oldHandTransitionLevel: 5 } }))).toBe('d6');
    expect(doOrDieDie(makeActor([], { system: { level: 20, oldHandTransitionLevel: 5 } }))).toBe('d8');
  });

});

describe('sessions', () => {
  test('recognises the New Session reset', () => {
    expect(isSessionReset({ type: 'party' }, { system: { storyPoints: 4, gmPoints: 4 } })).toBe(true);
    expect(isSessionReset({ type: 'party' }, { system: { storyPoints: 3 } })).toBe(false);
  });

  test('a session-gated use survives the next encounter and clears with the session', async () => {
    // No Perk is gated this way now (Timeline Anomaly is a per-session rule limit) - a stand-in record.
    SESSION_GATED.timelineAnomalyUsedThisEncounter = 'Compendium.x.Item.y';
    const actor = makeActor([item('perk', null)], { flags: { timelineAnomalyUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 } } });
    game.actors = [actor];
    game.settings.set = jest.fn();
    await noteGatedUse(actor, { flags: { essence20: { timelineAnomalyUsedThisEncounter: { epoch: 1 } } } }, {}, 'u1');
    expect(actor.flags.essence20.q2SessionUses).toEqual({ timelineAnomalyUsedThisEncounter: 1 });
    await carryGatedUses(2);
    expect(actor.flags.essence20.timelineAnomalyUsedThisEncounter.epoch).toBe(2);
    await startNewSession();
    expect(actor.flags.essence20.timelineAnomalyUsedThisEncounter).toBeUndefined();
    expect(game.settings.set).toHaveBeenCalled();
    delete SESSION_GATED.timelineAnomalyUsedThisEncounter;
  });
});

test('registers its hooks', () => {
  const registry = registrySnapshot();
  // Its last Use button (Weapon Enthusiast) is an item rule now.
  expect(registry.uses.some(use => use.id == 'q2Qualify')).toBe(false);
  expect(registry.costRules.some(rule => rule.id == 'q2WhisperWarrior')).toBe(false);
});
