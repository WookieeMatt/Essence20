import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Batch slA7 (docs/rules-batches/slA7.md): the zord1 / zord2 / pr1 / pr2 / pr3 slice items re-checked
 * against the round-7 engine pieces. Converted: Power Flux (a crew-scoped sceneStart Trigger gated on
 * holder:onCanvas), the rest of Additional Pair of Limbs (the two-target ↓1 on roll:targets, the mode
 * Uses and the Prone stand-up Use with its own `when`), and Instructor (pick skill with essence /
 * specializedOnly, pick team, marks on the student and a team-scoped untrained-Snag lift). Each is
 * loaded from its pack source and must do what the removed slice code did.
 */

// The picker the pick steps ask (mechanics/resources/grants.mjs). (Mocked paths resolve from module/jest.setup.js.)
const chooseSelect = jest.fn();
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => ({ chooseSelect, rollTest: jest.fn(), markIntegrated: jest.fn() }));

const { LINK_HOLDERS, rebuildIndex } = await import('./index.mjs');
const { ruleNoUntrainedSnag, ruleRollSources } = await import('./adapter.mjs');
const { fireItemAdded, fireTriggers, runUse, useAvailable } = await import('./triggers.mjs');
const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');
const { validateRule } = await import('./types.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  powerFlux: 'atsitems/_source/Power_Flux_zhfG2gH4IgIjMAzT.json',
  limbs: 'dditems/_source/Additional_Pair_of_Limbs_pedTP4vV1qwoBJvn.json',
  instructor: 'bthitems/_source/Instructor_zitiiHIQ4miPU5pa.json',
};
const INSTRUCTOR = 'Compendium.essence20.beneath_the_helmet.Item.zitiiHIQ4miPU5pa';

let nextId = 1;

const getPath = (object, key) => key.split('.').reduce((o, k) => o?.[k], object);
function setPath(object, key, value) {
  const deletion = (__isForcedDeletion(value) ? key.match(/^(.*)\.([^.]+)$/) : key.match(/^(.*)\.-=(.+)$/));
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
    toggleStatusEffect: jest.fn(async function (status, { active }) {
      if (active) {
        this.statuses.add(status);
      } else {
        this.statuses.delete(status);
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

beforeEach(() => {
  const contents = [];
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null }, settings: { get: () => 1 },
    actors: { contents, get: id => contents.find(actor => actor.id == id), [Symbol.iterator]: () => contents[Symbol.iterator]() },
    i18n: { localize: k => k, format: k => k },
  };
  global.fromUuidSync = uuid => contents.find(actor => actor.uuid == uuid) ?? null;
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: setPath },
  };
  global.CONFIG = { E20: { skills: {}, skillToEssence: { alertness: 'smarts', science: 'smarts', technology: 'smarts', athletics: 'strength' } } };
  chooseSelect.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
  LINK_HOLDERS.clear();
  delete global.canvas;
  delete global.fromUuidSync;
  delete global.CONFIG;
});

const lines = () => ChatMessage.create.mock.calls.map(([data]) => data.content).join(' ');

test('every rule added in this batch is valid', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

/* -------------------------------------------- */
/*  Power Flux (pr1/ats.mjs)                     */
/* -------------------------------------------- */

describe('Power Flux: a new scene tops each crew member\'s Personal Power up by at most 6', () => {
  function setup(type = 'zord') {
    const pilot = makeActor('playerCharacter', { powers: { personal: { value: 1, max: 10 } } }, 'Pilot');
    const low = makeActor('playerCharacter', { powers: { personal: { value: 2, max: 4 } } }, 'Low');
    const full = makeActor('playerCharacter', { powers: { personal: { value: 4, max: 4 } } }, 'Full');
    const mundane = makeActor('npc', { powers: { personal: { value: 0, max: 0 } } }, 'Mundane');
    const crew = [pilot, low, full, mundane];
    const zord = makeActor(type, {
      actors: Object.fromEntries(crew.map((actor, i) => [`c${i}`, { uuid: actor.uuid, vehicleRole: i ? 'passenger' : 'driver' }])),
    }, 'Zord');
    addPackItem(zord, FILES.powerFlux);
    const newScene = async () => {
      for (const actor of game.actors.contents) {
        await fireTriggers(actor, 'sceneStart');
      }
    };

    return { pilot, low, full, mundane, zord, newScene };
  }

  test('with the Zord on the canvas: +6 and +2 (the old [6, 2]); full and Power-less crew untouched', async () => {
    const { pilot, low, full, mundane, zord, newScene } = setup();
    global.canvas = { tokens: { placeables: [{ actor: zord }] } };
    await newScene();
    expect(pilot.system.powers.personal.value).toBe(7);
    expect(low.system.powers.personal.value).toBe(4);
    expect(full.update).not.toHaveBeenCalled();
    expect(mundane.update).not.toHaveBeenCalled();
    expect(zord.update).not.toHaveBeenCalled();
    expect(lines()).toContain('Pilot regains 6 Personal Power');
    expect(lines()).toContain('Low regains 2 Personal Power');
  });

  test('no Zord token in the scene: nothing', async () => {
    const { pilot, low, newScene } = setup();
    global.canvas = { tokens: { placeables: [] } };
    await newScene();
    expect(pilot.update).not.toHaveBeenCalled();
    expect(low.update).not.toHaveBeenCalled();
  });

  test('only a Zord\'s: on a vehicle it does nothing', async () => {
    const { pilot, zord, newScene } = setup('vehicle');
    global.canvas = { tokens: { placeables: [{ actor: zord }] } };
    await newScene();
    expect(pilot.update).not.toHaveBeenCalled();
  });

  test('Power already above its maximum is left alone', async () => {
    const { pilot, zord, newScene } = setup();
    pilot.system.powers.personal.value = 12;
    global.canvas = { tokens: { placeables: [{ actor: zord }] } };
    await newScene();
    expect(pilot.update).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Additional Pair of Limbs (zord1/bodies.mjs)  */
/* -------------------------------------------- */

describe('Additional Pair of Limbs: the two-target ↓1, the mode picks and the Prone stand-up', () => {
  const limbsSources = (actor, roll) => ruleRollSources(actor, null, roll).sources.filter(source => /Additional Pair of Limbs/.test(source.label ?? ''));

  test('↓1 on an unarmed attack at two or more targets, in Alt Mode with Multiple Targets picked', () => {
    const bot = makeActor('playerCharacter', { isTransformed: true });
    const limbs = addPackItem(bot, FILES.limbs, { flags: { essence20: { zord1LimbsMode: 'multi' } } });
    const sword = addItem(bot, { type: 'weapon', name: 'Sword' });
    const punch = addItem(bot, { type: 'weaponEffect', name: 'Punch' });
    const slash = addItem(bot, { type: 'weaponEffect', name: 'Slash', flags: { essence20: { parentId: sword.id } } });
    expect(limbsSources(bot, { isAttack: true, item: punch, targetCount: 2 })).toEqual([expect.objectContaining({ shiftDown: 1 })]);
    expect(limbsSources(bot, { isAttack: true, item: punch, targetCount: 3 })).toHaveLength(1);
    expect(limbsSources(bot, { isAttack: true, item: punch, targetCount: 1 })).toEqual([]);
    expect(limbsSources(bot, { isAttack: true, item: slash, targetCount: 2 })).toEqual([]);
    limbs.flags.essence20.zord1LimbsMode = 'move';
    expect(limbsSources(bot, { isAttack: true, item: punch, targetCount: 2 })).toEqual([]);
    limbs.flags.essence20.zord1LimbsMode = 'multi';
    bot.system.isTransformed = false;
    expect(limbsSources(bot, { isAttack: true, item: punch, targetCount: 2 })).toEqual([]);
  });

  test('the mode Uses write the flag the Movement and ↓1 rules read', async () => {
    const bot = makeActor('playerCharacter', { isTransformed: true });
    const limbs = addPackItem(bot, FILES.limbs);
    const pay = jest.fn(async () => true);
    const pickLabel = label => async (item, available) => available.find(({ rule }) => rule.label == label);
    await runUse(limbs, pay, { pick: pickLabel('Alt Mode: Multiple (2) Targets on unarmed attacks') });
    expect(limbs.flags.essence20.zord1LimbsMode).toBe('multi');
    await runUse(limbs, pay, { pick: pickLabel('Alt Mode: +10 feet Movement') });
    expect(limbs.flags.essence20.zord1LimbsMode).toBe('move');
    expect(pay).not.toHaveBeenCalledWith('free');
  });

  test('stand up is offered only in Bot Mode while Prone, for a Free action', async () => {
    const bot = makeActor('playerCharacter', { isTransformed: false });
    const limbs = addPackItem(bot, FILES.limbs);
    const index = limbs.system.rules.findIndex(rule => rule.label == 'Stand up from Prone');
    const stand = limbs.system.rules[index];
    expect(useAvailable(limbs, stand, index)).toBe(false);
    bot.statuses.add('prone');
    expect(useAvailable(limbs, stand, index)).toBe(true);
    bot.system.isTransformed = true;
    expect(useAvailable(limbs, stand, index)).toBe(false);
    bot.system.isTransformed = false;

    // An unpaid Free action leaves the actor Prone.
    expect(await runUse(limbs, async () => false, { pick: async (item, available) => available.find(({ rule }) => rule === stand) })).toBeNull();
    expect(bot.statuses.has('prone')).toBe(true);

    const pay = jest.fn(async () => true);
    await runUse(limbs, pay, { pick: async (item, available) => available.find(({ rule }) => rule === stand) });
    expect(pay).toHaveBeenCalledWith('free');
    expect(bot.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: false });
    expect(bot.statuses.has('prone')).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Instructor (pr2/team.mjs)                    */
/* -------------------------------------------- */

describe('Instructor: ↑1 on the taught Smarts Skill; students skip its untrained Snag', () => {
  const skills = (specialized = []) => ({
    alertness: {}, science: {}, technology: {}, athletics: { specializations: { a: {} } },
    ...Object.fromEntries(specialized.map(key => [key, { specializations: { s: {} } }])),
  });

  function teacherWith(specialized = ['science']) {
    const teacher = makeActor('playerCharacter', { skills: skills(specialized) }, 'Teacher');
    const perk = addPackItem(teacher, FILES.instructor, { source: INSTRUCTOR });
    return { teacher, perk };
  }

  const instructorUp = (actor, skill) => ruleRollSources(actor, null, { rolledSkill: skill }).sources.filter(source => source.label == 'Instructor');

  test('gained: a Smarts Skill the holder is Specialized in (else any Smarts Skill) is picked', async () => {
    const { teacher, perk } = teacherWith(['science']);
    chooseSelect.mockImplementation(async (title, prompt, options) => options[0].value);
    await fireItemAdded(teacher, perk);
    expect(chooseSelect.mock.calls[0][2].map(o => o.value)).toEqual(['science']);
    expect(perk.flags.essence20.rules.choices.skill).toBe('science');

    const plain = teacherWith([]);
    await fireItemAdded(plain.teacher, plain.perk);
    expect(chooseSelect.mock.calls[1][2].map(o => o.value).sort()).toEqual(['alertness', 'science', 'technology']);
  });

  test('↑1 on the taught Skill only, once', () => {
    const { teacher, perk } = teacherWith();
    expect(instructorUp(teacher, 'science')).toEqual([]);
    perk.flags = { essence20: { rules: { choices: { skill: 'science' } } } };
    rebuildIndex(teacher);
    expect(instructorUp(teacher, 'science')).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(instructorUp(teacher, 'technology')).toEqual([]);
  });

  test('teaching marks the picked teammate; only they skip the untrained Snag, on that Skill', async () => {
    const { teacher, perk } = teacherWith();
    perk.flags = { essence20: { rules: { choices: { skill: 'science' } } } };
    rebuildIndex(teacher);
    const student = makeActor('playerCharacter', {}, 'Student');
    const other = makeActor('playerCharacter', {}, 'Other');
    makeActor('npc', {}, 'Goon');
    chooseSelect.mockImplementation(async () => student.uuid);
    await runUse(perk, async () => true);
    // Only the teammate pick asks (the Skill is already picked); the teacher and NPCs aren't offered.
    expect(chooseSelect).toHaveBeenCalledTimes(1);
    expect(chooseSelect.mock.calls[0][2].map(o => o.value)).toEqual([student.uuid, other.uuid]);
    expect(student.flags.essence20.ruleMarks['instructor-science'].by).toBe(teacher.uuid);
    expect(other.flags.essence20.ruleMarks).toBeUndefined();

    expect(ruleNoUntrainedSnag(student, 'science')).toBe(true);
    expect(ruleNoUntrainedSnag(student, 'technology')).toBe(false);
    expect(ruleNoUntrainedSnag(other, 'science')).toBe(false);
    expect(ruleNoUntrainedSnag(teacher, 'science')).toBe(false);
  });

  test('two teachers of different Skills: each student skips the Snag on their own Skill only', async () => {
    const a = teacherWith();
    a.perk.flags = { essence20: { rules: { choices: { skill: 'science' } } } };
    rebuildIndex(a.teacher);
    const b = teacherWith(['technology']);
    b.perk.flags = { essence20: { rules: { choices: { skill: 'technology' } } } };
    rebuildIndex(b.teacher);
    const x = makeActor('playerCharacter', {}, 'X');
    const y = makeActor('playerCharacter', {}, 'Y');
    chooseSelect.mockImplementation(async () => x.uuid);
    await runUse(a.perk, async () => true);
    chooseSelect.mockImplementation(async () => y.uuid);
    await runUse(b.perk, async () => true);
    expect(ruleNoUntrainedSnag(x, 'science')).toBe(true);
    expect(ruleNoUntrainedSnag(x, 'technology')).toBe(false);
    expect(ruleNoUntrainedSnag(y, 'technology')).toBe(true);
    expect(ruleNoUntrainedSnag(y, 'science')).toBe(false);
  });

  test('a copy picked before the rules version keeps its Skill (legacy)', () => {
    const { teacher, perk } = teacherWith();
    perk.flags = { essence20: { pr2Instructor: { skill: 'technology', students: [] } } };
    expect(legacyChoiceUpdates(teacher)).toEqual([{ _id: perk.id, 'flags.essence20.rules.choices.skill': 'technology' }]);
  });
});
