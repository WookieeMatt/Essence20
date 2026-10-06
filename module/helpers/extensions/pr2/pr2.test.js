import { jest } from '@jest/globals';

const worldList = [];
function makeItem(data) {
  return {
    id: data.id ?? Math.random().toString(36).slice(2, 10),
    uuid: data.uuid ?? `Item.${Math.random().toString(36).slice(2, 10)}`,
    name: data.name ?? 'Item',
    type: data.type ?? 'perk',
    img: 'x.svg',
    system: data.system ?? {},
    flags: data.flags ?? {},
    setFlag: jest.fn(async function (scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
    }),
    update: jest.fn(async () => {}),
  };
}

function makeActor(data = {}) {
  const items = (data.items ?? []).map(makeItem);
  const actor = {
    uuid: data.uuid ?? `Actor.${Math.random().toString(36).slice(2, 10)}`,
    id: data.id ?? Math.random().toString(36).slice(2, 10),
    name: data.name ?? 'Actor',
    type: data.type ?? 'playerCharacter',
    documentName: 'Actor',
    system: data.system ?? {},
    flags: data.flags ?? {},
    statuses: new Set(data.statuses ?? []),
    isOwner: true,
    items: { contents: items, get: id => items.find(i => i.id == id) },
    effects: { contents: [] },
    getActiveTokens: () => [],
    setFlag: jest.fn(async function (scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
    }),
    unsetFlag: jest.fn(async function (scope, key) {
      delete this.flags[scope]?.[key];
    }),
    getFlag(scope, key) {
      return this.flags?.[scope]?.[key];
    },
    update: jest.fn(async () => {}),
    createEmbeddedDocuments: jest.fn(async (type, docs) => docs.map((d, i) => ({ ...d, id: `new${i}` }))),
    deleteEmbeddedDocuments: jest.fn(async () => {}),
  };
  items.forEach(item => {
    item.parent = actor;
  });
  return actor;
}

const src = uuid => ({ core: { sourceId: uuid } });

let ext;
let common;
let team;
let finster;

beforeAll(async () => {
  global.Hooks = { on: jest.fn(), once: jest.fn(), callAll: jest.fn() };
  global.game = {
    i18n: { localize: k => k, format: k => k },
    user: { id: 'u1', isGM: true },
    users: { activeGM: null },
    actors: { contents: worldList, [Symbol.iterator]: () => worldList[Symbol.iterator]() },
    combat: null,
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.CONFIG = {
    E20: {
      skills: {}, skillToEssence: { science: 'smarts', technology: 'smarts', might: 'strength' },
      skillShiftList: ['criticalSuccess', 'autoSuccess', '3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20', 'autoFail', 'fumble'],
    },
  };
  global.CONST = { ACTIVE_EFFECT_MODES: { ADD: 2 } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.canvas = null;

  ext = await import('../../extensions.mjs');
  common = await import('./common.mjs');
  team = await import('./team.mjs');
  finster = await import('./finster.mjs');
});

beforeEach(() => {
  worldList.length = 0;
  global.game.combat = null;
});

describe('registration', () => {
  test('uses register', () => {
    const uses = ext.registrySnapshot().uses.map(u => u.id);
    // Dino Drive Mode is the Feature's own rules (module/rules/conv12-slH12.test.js).
    expect(uses).not.toContain('pr2DinoDrive');
    expect(uses).not.toContain('pr2Instructor');
  });
});

// Bend Physics (its doubling at the derivedHook stage, its +2 Evasion) is the item's own rules
// (module/rules/conv10-slA10.test.js, conv6-slA6.test.js).

// Primal Rage is the item's own RollModifier rules (module/rules/conv6-slA6.test.js).
describe('Instructor / Graphite Prime', () => {
  // Instructor is the Perk's own rules (module/rules/conv7-slA7.test.js); only students taught before
  // the rules version are read here, from the old flag.
  test('Instructor: a student in the old flag keeps no untrained Snag on that Skill', () => {
    const student = makeActor({ uuid: 'Actor.student' });
    const teacher = makeActor({ items: [{ flags: { ...src(common.PR2.instructor), essence20: { pr2Instructor: { skill: 'science', students: ['Actor.student'] } } } }] });
    worldList.push(teacher, student);
    expect(team.pr2NoUntrainedSnag(student, 'science')).toBe(true);
    expect(team.pr2NoUntrainedSnag(student, 'technology')).toBe(false);
  });
  // Aim Apparatus is the Perk's own added / removed Triggers (module/rules/conv9-slA9.test.js).
});

// Dino Gem Integration / Energem Infusion are their items' own rules now (module/rules/conv5-slA5.test.js), and so is
// Dino Drive Mode (module/rules/conv12-slH12.test.js).

describe("Finster's", () => {
  test('Nemesis Drain clears at the new scene', async () => {
    const hit = makeActor({ flags: { essence20: { nemesisDrainPenaltyActive: true } } });
    worldList.push(hit);
    await finster.clearNemesisDrain();
    expect(hit.flags.essence20.nemesisDrainPenaltyActive).toBeUndefined();
  });
});
