import { jest } from '@jest/globals';
import {
  clearLevelPicks,
  crossedLevels,
  eligibleLevelPickEntries,
  levelNumbers,
  levelPickChanges,
  levelPickChoices,
  nextPending,
  pendingLevelPicks,
  pickKey,
  updateLevelPicks,
} from "./level-picks.mjs";
import { choicePrerequisites } from "../../rules/prerequisites.mjs";

const PR_GENERAL = ['level4', 'level8', 'level12', 'level16', 'level19'];
const PR_GRID = ['level6', 'level11', 'level16'];

function makeRole({ version = 'powerRangers', general = PR_GENERAL, grid = PR_GRID, isAdditive = false } = {}) {
  return { type: 'role', system: { version, isAdditive, perkLevels: { general }, gridPowerLevels: grid } };
}

/** A stand-in character: items, flags, setFlag, and items that can be deleted. */
function makeActor({ roles = [makeRole()], items = [], pending = [], level = 1, transition = null } = {}) {
  const actor = {
    id: 'a1',
    name: 'Tess',
    system: { level, oldHandTransitionLevel: transition },
    flags: { essence20: { levelPicks: pending } },
    setFlag: jest.fn(async (scope, key, value) => {
      actor.flags[scope][key] = value;
    }),
  };
  const all = [...roles, ...items];
  for (const item of items) {
    item.delete = jest.fn(async () => all.splice(all.indexOf(item), 1));
  }

  actor.items = {
    get contents() {
      return all;
    },
    [Symbol.iterator]: () => all[Symbol.iterator](),
    documentsByType: { role: roles },
  };
  return actor;
}

const keys = picks => picks.map(pick => pick.key);

describe("levelNumbers", () => {
  test("reads level keys and numbers, sorted and unique", () => {
    expect(levelNumbers(['level16', 'level4', 'level1optional', 4, 'nonsense'])).toEqual([1, 4, 16]);
    expect(levelNumbers(undefined)).toEqual([]);
  });
});

describe("crossedLevels", () => {
  test("a level up gains the listed level reached", () => {
    expect(crossedLevels(PR_GENERAL, 3, 4)).toEqual({ gained: [4], lost: [] });
    expect(crossedLevels(PR_GENERAL, 4, 5)).toEqual({ gained: [], lost: [] });
  });

  test("a multi-level jump gains every listed level between", () => {
    expect(crossedLevels(PR_GENERAL, 1, 20)).toEqual({ gained: [4, 8, 12, 16, 19], lost: [] });
    expect(crossedLevels(PR_GENERAL, 4, 12)).toEqual({ gained: [8, 12], lost: [] });
  });

  test("a level down loses the listed levels left behind, not the one landed on", () => {
    expect(crossedLevels(PR_GENERAL, 12, 8)).toEqual({ gained: [], lost: [12] });
    expect(crossedLevels(PR_GENERAL, 20, 3)).toEqual({ gained: [], lost: [4, 8, 12, 16, 19] });
  });

  test("no change, and a Role dropped at a level (previous 0)", () => {
    expect(crossedLevels(PR_GENERAL, 7, 7)).toEqual({ gained: [], lost: [] });
    expect(crossedLevels(PR_GENERAL, 0, 9)).toEqual({ gained: [4, 8], lost: [] });
  });

  test("maxLevel caps the levels counted", () => {
    expect(crossedLevels(PR_GENERAL, 0, 20, { maxLevel: 8 })).toEqual({ gained: [4, 8], lost: [] });
  });
});

describe("levelPickChanges", () => {
  test("a Power Rangers Role gives General Perks and Grid Powers", () => {
    const { gained } = levelPickChanges({ baseRole: makeRole(), previousLevel: 5, newLevel: 16 });
    expect(keys(gained)).toEqual([
      'generalPerk-base-8', 'generalPerk-base-12', 'generalPerk-base-16', 'gridPower-base-6', 'gridPower-base-11', 'gridPower-base-16',
    ]);
  });

  test("another line's Role gives no Grid Powers, whatever its (default) gridPowerLevels hold", () => {
    const { gained } = levelPickChanges({ baseRole: makeRole({ version: 'giJoe' }), previousLevel: 1, newLevel: 6 });
    expect(keys(gained)).toEqual(['generalPerk-base-4']);
  });

  test("a level down lists the picks lost", () => {
    const { gained, lost } = levelPickChanges({ baseRole: makeRole(), previousLevel: 11, newLevel: 5 });
    expect(gained).toEqual([]);
    expect(keys(lost)).toEqual(['generalPerk-base-8', 'gridPower-base-6', 'gridPower-base-11']);
  });

  test("an additive Role runs its own track, and the base Role gives no more General Perks", () => {
    const baseRole = makeRole({ version: 'giJoe' });
    const additiveRole = makeRole({ version: 'giJoe', general: ['level4', 'level8', 'level11', 'level15'], isAdditive: true });
    // Old Hand taken at character level 6: its level 4 is character level 9.
    const changes = levelPickChanges({ baseRole, additiveRole, transitionLevel: 6, previousLevel: 6, newLevel: 9 });
    expect(keys(changes.gained)).toEqual(['generalPerk-additive-4']);
    // Character level 8 is base level 8 no longer - nothing from the base Role.
    expect(keys(levelPickChanges({ baseRole, additiveRole, transitionLevel: 6, previousLevel: 6, newLevel: 8 }).gained)).toEqual([]);
  });

  test("no base Role, no picks", () => {
    expect(levelPickChanges({ baseRole: null, previousLevel: 1, newLevel: 20 })).toEqual({ gained: [], lost: [] });
  });
});

describe("nextPending", () => {
  const pick = (kind, level) => ({ key: pickKey(kind, 'base', level), kind, track: 'base', level });

  test("adds what's gained, once, sorted by level", () => {
    const pending = [pick('generalPerk', 8)];
    const result = nextPending(pending, { gained: [pick('gridPower', 6), pick('generalPerk', 8)], lost: [] });
    expect(keys(result)).toEqual(['gridPower-base-6', 'generalPerk-base-8']);
  });

  test("leaves out picks already made, and removes the lost ones", () => {
    const result = nextPending([pick('generalPerk', 4), pick('generalPerk', 8)],
      { gained: [pick('gridPower', 6)], lost: [pick('generalPerk', 8)] }, new Set(['gridPower-base-6']));
    expect(keys(result)).toEqual(['generalPerk-base-4']);
  });

  test("is idempotent", () => {
    const changes = { gained: [pick('generalPerk', 4)], lost: [] };
    const once = nextPending([], changes);
    expect(nextPending(once, changes)).toEqual(once);
  });
});

describe("eligibleLevelPickEntries", () => {
  const entry = (name, type, subtype, extra = {}) => ({
    uuid: `Compendium.essence20.pr_crb.Item.${name.replace(/\W/g, '')}`, name, type, system: { type: subtype, ...extra },
  });
  const entries = [
    entry('Luck', 'perk', 'general'),
    entry('Athletic', 'perk', 'general'),
    entry('Follow Me!', 'perk', 'role'),
    entry('Supercharged Essence', 'perk', 'general', { selectionLimit: 4 }),
    entry('Power Blast', 'power', 'grid'),
    entry('Sorcerous Strike', 'power', 'sorcerous'),
  ];

  test("only the kind's own items, sorted by name", () => {
    expect(eligibleLevelPickEntries(entries, [], 'generalPerk').map(e => e.name)).toEqual(['Athletic', 'Luck', 'Supercharged Essence']);
    expect(eligibleLevelPickEntries(entries, [], 'gridPower').map(e => e.name)).toEqual(['Power Blast']);
    expect(eligibleLevelPickEntries(entries, [], 'nonsense')).toEqual([]);
  });

  test("leaves out what's held, by source or by name (a reprint), unless it can be taken again", () => {
    const owned = [
      { type: 'perk', source: entries[0].uuid, name: 'Luck' },
      { type: 'perk', source: 'Compendium.essence20.gi_joe_crb.Item.x', name: 'Athletic' },
      { type: 'perk', source: entries[3].uuid, name: 'Supercharged Essence (Strength)' },
    ];
    expect(eligibleLevelPickEntries(entries, owned, 'generalPerk').map(e => e.name)).toEqual(['Supercharged Essence']);
  });

  test("an item held as many times as its selectionLimit is left out", () => {
    const limited = [entry('Extra Grid Power', 'power', 'grid', { selectionLimit: 2 })];
    const once = [{ type: 'power', source: limited[0].uuid, name: 'Extra Grid Power' }];
    expect(eligibleLevelPickEntries(limited, once, 'gridPower')).toHaveLength(1);
    expect(eligibleLevelPickEntries(limited, [...once, ...once], 'gridPower')).toHaveLength(0);
  });

  test("an item of another type with the same name doesn't count as held", () => {
    const owned = [{ type: 'power', source: null, name: 'Luck' }];
    expect(eligibleLevelPickEntries(entries, owned, 'generalPerk').map(e => e.name)).toContain('Luck');
  });
});

describe("Grid Power prerequisites in the picker", () => {
  // Two Grid Powers in one Power Rangers book: one with a prerequisite (Power Efficiency, Through the Shattered Grid
  // p.26: Level 8+), one without. The picker offers both; the selector marks the unmet one through choicePrerequisites.
  const packId = 'essence20.through_the_shattered_grid';
  const index = [
    { _id: 'eff', name: 'Power Efficiency', type: 'power', system: { type: 'grid', prerequisites: { when: ['self:level>=8'] } } },
    { _id: 'mob', name: 'Mobile Mode', type: 'power', system: { type: 'grid' } },
    { _id: 'prk', name: 'Luck', type: 'perk', system: { type: 'general' } },
  ];
  const uuidOf = entry => `Compendium.${packId}.Item.${entry._id}`;
  let settings;
  let saved;

  beforeEach(() => {
    saved = { game: global.game, CONFIG: global.CONFIG, fromUuidSync: global.fromUuidSync };
    settings = { prerequisiteMode: 'warn', enabledSourcebooks: {} };
    const pack = {
      documentName: 'Item',
      folder: { name: 'Power Rangers' },
      metadata: { id: packId, label: 'Through the Shattered Grid' },
      getIndex: jest.fn(async () => index),
    };
    global.game = { packs: [pack], settings: { get: (scope, key) => settings[key] }, user: { isGM: false } };
    global.CONFIG = { E20: { gameLinePackFolders: { powerRangers: 'Power Rangers' } } };
    global.fromUuidSync = uuid => index.find(entry => uuidOf(entry) == uuid) ?? null;
  });

  afterEach(() => {
    Object.assign(global, saved);
  });

  const pick = { key: 'gridPower-base-6', kind: 'gridPower', track: 'base', level: 6 };

  test("an unmet one is still offered, and marked with what's missing", async () => {
    const actor = makeActor({ level: 6 });
    const choices = await levelPickChoices(actor, pick);
    expect(Object.values(choices).map(choice => choice.label)).toEqual(['Mobile Mode', 'Power Efficiency']);
    // The index has to carry the prerequisites for the selector to read them.
    expect(game.packs[0].getIndex.mock.calls[0][0].fields).toContain('system.prerequisites');

    expect(choicePrerequisites(actor, uuidOf(index[0]))).toEqual({ missing: 'Level 8+', blocked: false });
    expect(choicePrerequisites(actor, uuidOf(index[1]))).toBeNull();
  });

  test("strict mode blocks it for a player, not for the GM; met, it is not marked", () => {
    settings.prerequisiteMode = 'strict';
    const actor = makeActor({ level: 6 });
    expect(choicePrerequisites(actor, uuidOf(index[0]))).toEqual({ missing: 'Level 8+', blocked: true });
    game.user.isGM = true;
    expect(choicePrerequisites(actor, uuidOf(index[0]))).toEqual({ missing: 'Level 8+', blocked: false });
    expect(choicePrerequisites(makeActor({ level: 8 }), uuidOf(index[0]))).toBeNull();
  });

  test("General Perks come from every enabled book, any line; Grid Powers stay in the character's line (2026-10-07)", async () => {
    const joe = {
      documentName: 'Item',
      folder: { name: 'GI Joe' },
      metadata: { id: 'essence20.gi_joe_crb', label: 'GI Joe Core' },
      getIndex: jest.fn(async () => [{ _id: 'acu', name: 'Acute Sense', type: 'perk', system: { type: 'general' } }, { _id: 'gp', name: 'Joe Grid', type: 'power', system: { type: 'grid' } }]),
    };
    game.packs.push(joe);
    const actor = makeActor({ level: 6 });
    const general = await levelPickChoices(actor, { key: 'generalPerk-base-4', kind: 'generalPerk', track: 'base', level: 4 });
    expect(Object.values(general).map(choice => choice.label).sort()).toEqual(['Acute Sense', 'Luck']);
    const grid = await levelPickChoices(actor, pick);
    expect(Object.values(grid).map(choice => choice.label)).not.toContain('Joe Grid');
  });
});

describe("updateLevelPicks", () => {
  test("a level up records the picks it gives", async () => {
    const actor = makeActor({ level: 6 });
    const gained = await updateLevelPicks(actor, 3, 6, { open: false });
    expect(keys(gained)).toEqual(['generalPerk-base-4', 'gridPower-base-6']);
    expect(keys(pendingLevelPicks(actor))).toEqual(['generalPerk-base-4', 'gridPower-base-6']);
  });

  test("running it again changes nothing (no duplicate picks)", async () => {
    const actor = makeActor({ level: 6 });
    await updateLevelPicks(actor, 3, 6, { open: false });
    actor.setFlag.mockClear();
    expect(await updateLevelPicks(actor, 3, 6, { open: false })).toEqual([]);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("a level down drops pending picks and removes the item chosen for a lost level", async () => {
    const chosen = { type: 'power', name: 'Power Blast', flags: { essence20: { levelPick: { key: 'gridPower-base-6', track: 'base' } } } };
    const kept = { type: 'power', name: 'Power Shield', flags: {} };
    const actor = makeActor({ items: [chosen, kept], pending: [{ key: 'generalPerk-base-4', kind: 'generalPerk', track: 'base', level: 4 }] });
    await updateLevelPicks(actor, 6, 3, { open: false });
    expect(chosen.delete).toHaveBeenCalled();
    expect(kept.delete).not.toHaveBeenCalled();
    expect(pendingLevelPicks(actor)).toEqual([]);
  });

  test("a pick already made is not asked again on the way up", async () => {
    const chosen = { type: 'perk', name: 'Luck', flags: { essence20: { levelPick: { key: 'generalPerk-base-4', track: 'base' } } } };
    const actor = makeActor({ items: [chosen] });
    await updateLevelPicks(actor, 3, 4, { open: false });
    expect(pendingLevelPicks(actor)).toEqual([]);
  });

  test("no Role, nothing to do", async () => {
    const actor = makeActor({ roles: [] });
    expect(await updateLevelPicks(actor, 1, 20, { open: false })).toEqual([]);
  });
});

describe("clearLevelPicks", () => {
  test("removes that track's pending picks and chosen items only", async () => {
    const base = { type: 'power', name: 'Power Blast', flags: { essence20: { levelPick: { key: 'gridPower-base-6', track: 'base' } } } };
    const additive = { type: 'power', name: 'Other', flags: { essence20: { levelPick: { key: 'generalPerk-additive-4', track: 'additive' } } } };
    const actor = makeActor({
      items: [base, additive],
      pending: [{ key: 'generalPerk-base-8', track: 'base', level: 8 }, { key: 'generalPerk-additive-8', track: 'additive', level: 8 }],
    });
    await clearLevelPicks(actor, 'additive');
    expect(additive.delete).toHaveBeenCalled();
    expect(base.delete).not.toHaveBeenCalled();
    expect(keys(pendingLevelPicks(actor))).toEqual(['generalPerk-base-8']);
  });
});
