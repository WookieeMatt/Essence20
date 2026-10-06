import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex, rulesOfType } from './index.mjs';
import { ruleDamageDealt, ruleMovementStages, ruleRollSources, ruleSpecializes } from './adapter.mjs';
import { fireTriggers, runUse, useAvailable, useRulesOf } from './triggers.mjs';
import { evaluate, contextFor } from './predicate.mjs';
import { legacyChoiceUpdates } from './legacy-choices.mjs';
import { runConsumer } from '../helpers/extensions.mjs';

/**
 * Slice round 5, part slB5 (tf1, tf2, tf3, fix3-tf, other2): items converted from hand-written code to
 * item rules with the round-5 engine pieces (require / beforeCost, updateActor with `to`, table, {@formula}
 * chat text, consumeMark, Movement afterGravity, unstarted-combat endOfNextTurn, pick legacy paths). Each
 * item is loaded from its pack source and must do what the removed code (and its tests) did.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;
let epoch = 1;

const getPath = (object, key) => key.split('.').reduce((o, k) => o?.[k], object);

const setPath = (object, key, value) => {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
};

const deletePath = (object, key) => {
  const keys = key.split('.');
  const last = keys.pop().replace(/^-=/, '');
  delete keys.reduce((o, k) => o?.[k], object)?.[last];
};

async function applyUpdate(doc, data) {
  for (const [key, value] of Object.entries(data)) {
    if (key.split('.').pop().startsWith('-=')) {
      deletePath(doc, key);
    } else {
      setPath(doc, key, value);
    }
  }
}

/** An item object (a pack item's data, or a plain one). */
function makeItem(data) {
  return {
    flags: {}, system: {}, ...data,
    async update(changes) {
      await applyUpdate(this, changes);
    },
  };
}

/** An actor holding these pack items (and any extra item objects). */
function holder(files = [], { system = {}, extra = [], disposition = 1, name = 'Hero', type = 'playerCharacter' } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { level: 3, health: { value: 10, max: 10 }, ...system },
    async update(data) {
      await applyUpdate(this, data);
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    async unsetFlag(scope, key) {
      deletePath(this.flags?.[scope] ?? {}, key);
    },
    toggleStatusEffect: jest.fn(async function (status, { active }) {
      actor.statuses[active ? 'add' : 'delete'](status);
    }),
  };
  actor.uuid = `Actor.${actor.id}`;
  const token = { id: `t${actor.id}`, actor, document: { disposition }, center: { x: 0, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  const items = files.map(file => {
    const doc = fromPack(file);
    return makeItem({ id: `c${nextId++}`, name: doc.name, type: doc.type, system: doc.system });
  });
  items.push(...extra);
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  for (const item of items) {
    item.parent = actor;
  }

  rebuildIndex(actor);
  return actor;
}

/** Put these actors' tokens on the canvas, `feet` apart. */
function onCanvas(feet, ...actors) {
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token), setTargets: jest.fn() }, grid: { measurePath: () => ({ distance: feet }) } };
}

/** Target these actors' tokens. */
function target(...actors) {
  game.user.targets = new Set(actors.map(actor => actor.token));
}

const pay = () => jest.fn(async () => true);
const roller = (result = { success: true, total: 15 }) => ({ rollSkill: jest.fn(async () => result) });
const available = item => useRulesOf(item).some(({ rule, index }) => useAvailable(item, rule, index));

beforeEach(() => {
  epoch = 1;
  global.game = {
    combat: null, combats: null, user: { id: 'u', isGM: false, targets: new Set() }, users: { activeGM: null },
    i18n: { localize: k => k, format: k => k }, settings: { get: () => epoch }, actors: { contents: [] },
  };
  global.CONFIG = {
    E20: {
      skillToEssence: { science: 'smarts', culture: 'social', athletics: 'strength', technology: 'smarts' },
      skills: { science: 'Science', culture: 'Culture', athletics: 'Athletics' }, essences: { strength: 'S', speed: 'Sp', smarts: 'Sm', social: 'So' },
    },
  };
  global.canvas = undefined;
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.fromUuid = undefined;
  global.fromUuidSync = undefined;
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: {
      ...(global.foundry?.utils ?? {}),
      getProperty: getPath,
      setProperty: setPath,
      hasProperty: (object, key) => getPath(object, key) !== undefined,
      deepClone: value => JSON.parse(JSON.stringify(value)),
      escapeHTML: text => String(text),
      randomID: () => `r${nextId++}`,
    },
    applications: {
      ...(global.foundry?.applications ?? {}),
      api: {
        // The Essence damage helper's imports reach an application class.
        ApplicationV2: class {}, HandlebarsApplicationMixin: Base => class extends Base {},
        DialogV2: { wait: jest.fn(async () => null) },
      },
    },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

/* -------------------------------------------- */
/*  Feedback Field                               */
/* -------------------------------------------- */

describe('Feedback Field', () => {
  const FILE = 'dditems/_source/Feedback_Field_P7dmKCP99DAYqptj.json';

  test('a Move action and 1 Energon raise the field for the scene, posting the Willpower DIF', async () => {
    const actor = holder([FILE], { system: { energon: { normal: { value: 2 } }, defenses: { willpower: { total: 14 } } } });
    const [perk] = actor.items.contents;
    const paid = pay();
    const card = await runUse(perk, paid);
    expect(paid).toHaveBeenCalledWith('move');
    expect(actor.system.energon.normal.value).toBe(1);
    expect(card).toContain('DIF 14');

    // Hidden while the field is up; back with the next scene.
    expect(available(perk)).toBe(false);
    epoch = 2;
    expect(available(perk)).toBe(true);
  });

  test('without an Energon Point it can\'t be used', () => {
    const actor = holder([FILE], { system: { energon: { normal: { value: 0 } } } });
    expect(available(actor.items.contents[0])).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Partnered                                    */
/* -------------------------------------------- */

describe('Partnered', () => {
  const FILE = 'dditems/_source/Partnered_6I4IIvDP3SOCJ5cR.json';

  test('the targeted creature becomes the partner without asking; the Free Lend Assistance follows the pick', async () => {
    const actor = holder([FILE]);
    const [perk] = actor.items.contents;
    const partner = holder([], { name: 'Buddy' });
    const other = holder([], { name: 'Other' });
    target(partner, other);
    const paid = pay();
    await runUse(perk, paid);
    expect(paid).not.toHaveBeenCalled();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    // Only the first target counts.
    expect(perk.flags.essence20.rules.choices.partner).toBe(partner.uuid);

    const cost = rulesOfType(actor, 'ActionCost')[0];
    expect(evaluate(cost.rule.when, contextFor({ self: actor, ruleItem: perk }))).toBe(true);
  });

  test('with nothing targeted, a picker over the allies; no partner, no Free Lend Assistance', async () => {
    const actor = holder([FILE], { disposition: 1 });
    const [perk] = actor.items.contents;
    const cost = rulesOfType(actor, 'ActionCost')[0];
    expect(evaluate(cost.rule.when, contextFor({ self: actor, ruleItem: perk }))).toBe(false);

    const ally = holder([], { name: 'Ally', disposition: 1 });
    const foe = holder([], { name: 'Foe', disposition: -1 });
    onCanvas(500, actor, ally, foe);
    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ content }) => {
      expect(content).toContain('Ally');
      expect(content).not.toContain('Foe');
      return ally.uuid;
    });
    await runUse(perk, pay());
    expect(perk.flags.essence20.rules.choices.partner).toBe(ally.uuid);
  });

  test('an existing character keeps the partner it picked before (legacy pick)', () => {
    const actor = holder([FILE]);
    const [perk] = actor.items.contents;
    perk.flags = { essence20: { partner: { uuid: 'Actor.old', name: 'Old Pal' } } };
    expect(legacyChoiceUpdates(actor)).toEqual([{ _id: perk.id, 'flags.essence20.rules.choices.partner': 'Actor.old' }]);
  });
});

/* -------------------------------------------- */
/*  Broad Understanding / Applied Science        */
/* -------------------------------------------- */

describe('Broad Understanding and Applied Science', () => {
  const BROAD = 'tfcrbitems/_source/Broad_Understanding_7BZXi4zvS6GAhGOY.json';
  const APPLIED = 'tfcrbitems/_source/Applied_Science_qjDBmRlTNvuJxyum.json';
  const MULTIPLICATION = 'tfcrbitems/_source/Multiplication_K3FNcAMjjek1UaJk.json';
  const science = { skills: { science: { specializations: { chem: { name: 'Chemistry' } } } } };
  const sourcesOf = (actor, dataset = {}, skill = 'science') => ruleRollSources(actor, null, { rolledSkill: skill, dataset });

  test('out of combat: Specialized in Science, ↓2 off-Specialization (not on a Specialization roll)', () => {
    const actor = holder([BROAD], { system: science });
    expect(ruleSpecializes(actor, 'science', null, {})).toBe(true);
    expect(sourcesOf(actor).sources).toEqual([expect.objectContaining({ shiftDown: 2 })]);
    expect(sourcesOf(actor, { isSpecialized: true }).sources).toEqual([]);
    expect(sourcesOf(actor, { specializationKey: 'chem' }).sources).toEqual([]);
    expect(sourcesOf(actor, {}, 'athletics').sources).toEqual([]);
    expect(sourcesOf(actor).consumes).toEqual([]);

    // No Science Specialization, no Broad Understanding.
    const plain = holder([BROAD]);
    expect(ruleSpecializes(plain, 'science', null, {})).toBe(false);
    expect(sourcesOf(plain).sources).toEqual([]);
  });

  test('in a combat (started or not) only after Applied Science, which the next Science roll uses up', async () => {
    const actor = holder([BROAD, APPLIED], { system: science });
    const [, applied] = actor.items.contents;
    game.combat = { id: 'c1', started: false };
    expect(ruleSpecializes(actor, 'science', null, {})).toBe(false);
    expect(sourcesOf(actor).sources).toEqual([]);

    const paid = pay();
    await runUse(applied, paid);
    expect(paid).not.toHaveBeenCalled();
    expect(ruleSpecializes(actor, 'science', null, {})).toBe(true);
    const roll = sourcesOf(actor);
    expect(roll.sources).toEqual([expect.objectContaining({ shiftDown: 2 })]);
    expect(roll.consumes).toEqual([{ ext: 'rulesMark', actorUuid: actor.uuid, key: 'appliedScience' }]);
    // A Specialization roll uses it up too.
    expect(sourcesOf(actor, { isSpecialized: true }).consumes).toHaveLength(1);
    // Initiative never does.
    expect(sourcesOf(actor, { isInitiative: true }).consumes).toEqual([]);

    global.fromUuid = async uuid => (uuid == actor.uuid ? actor : null);
    await runConsumer(roll.consumes[0]);
    expect(ruleSpecializes(actor, 'science', null, {})).toBe(false);

    // Out of combat, a waiting Applied Science isn't spent.
    await runUse(applied, pay());
    game.combat = null;
    expect(sourcesOf(actor).consumes).toEqual([]);
  });

  test('Applied Science: once per scene, twice with Multiplication', async () => {
    const plain = holder([APPLIED]);
    await runUse(plain.items.contents[0], pay());
    expect(available(plain.items.contents[0])).toBe(false);
    epoch = 2;
    expect(available(plain.items.contents[0])).toBe(true);

    const multiplied = holder([APPLIED, MULTIPLICATION]);
    const [perk] = multiplied.items.contents;
    multiplied.items.contents[1].flags = { core: { sourceId: 'Compendium.essence20.tf_crb.Item.K3FNcAMjjek1UaJk' } };
    rebuildIndex(multiplied);
    expect(useRulesOf(perk).filter(({ rule, index }) => useAvailable(perk, rule, index))).toHaveLength(1);
    await runUse(perk, pay());
    expect(available(perk)).toBe(true);
    await runUse(perk, pay());
    expect(available(perk)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Determine Probability                        */
/* -------------------------------------------- */

describe('Determine Probability', () => {
  const FILE = 'tfcrbitems/_source/Determine_Probability_RK9cboEVTiJKdjbN.json';

  test('pick a Skill, then a Free action and an ordinary roll of it; backing out costs nothing', async () => {
    const actor = holder([FILE], { system: { skills: { science: { shift: 'd6' }, athletics: { shift: 'd4' } } } });
    const [perk] = actor.items.contents;
    actor._dice = roller();
    const cancelled = pay();
    expect(await runUse(perk, cancelled)).toBeNull();
    expect(cancelled).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();

    foundry.applications.api.DialogV2.wait.mockResolvedValue('athletics');
    const paid = pay();
    await runUse(perk, paid);
    expect(paid).toHaveBeenCalledWith('free');
    const [[dataset]] = actor._dice.rollSkill.mock.calls;
    expect(dataset).toMatchObject({ skill: 'athletics', essence: 'strength' });
    expect(dataset.dif).toBeUndefined();
  });

  test('once per turn in a combat, any number of times out of one', async () => {
    const actor = holder([FILE], { system: { skills: { science: { shift: 'd6' } } } });
    const [perk] = actor.items.contents;
    actor._dice = roller();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('science');
    await runUse(perk, pay());
    await runUse(perk, pay());
    expect(available(perk)).toBe(true);

    game.combat = { id: 'c1', started: true, round: 1, turn: 0 };
    await runUse(perk, pay());
    expect(available(perk)).toBe(false);
    game.combat.turn = 1;
    expect(available(perk)).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Energon Bank                                 */
/* -------------------------------------------- */

describe('Energon Bank', () => {
  const FILE = 'tfcrbitems/_source/Energon_Bank_W87huLqKeOCJJ66L.json';

  test('one of the holder\'s Energon Points goes to the targeted ally within 30 ft, past their maximum', async () => {
    const actor = holder([FILE], { system: { energon: { normal: { value: 2, max: 5 } } } });
    const [perk] = actor.items.contents;
    const ally = holder([], { name: 'Ally', system: { energon: { normal: { value: 3, max: 3 } } } });
    target(ally);
    onCanvas(25, actor, ally);
    const paid = pay();
    await runUse(perk, paid);
    expect(paid).not.toHaveBeenCalled();
    expect(actor.system.energon.normal.value).toBe(1);
    expect(ally.system.energon.normal.value).toBe(4);

    // Off the canvas, no distance to check.
    global.canvas = undefined;
    await runUse(perk, pay());
    expect([actor.system.energon.normal.value, ally.system.energon.normal.value]).toEqual([0, 5]);
    expect(available(perk)).toBe(false);
  });

  test('too far, nobody targeted or a target without Energon: nothing is spent', async () => {
    const actor = holder([FILE], { system: { energon: { normal: { value: 2 } } } });
    const [perk] = actor.items.contents;
    expect(await runUse(perk, pay())).toContain('NeedsTarget');
    const far = holder([], { system: { energon: { normal: { value: 0 } } } });
    target(far);
    onCanvas(35, actor, far);
    expect(await runUse(perk, pay())).toContain('Out of range');
    const human = holder([]);
    target(human);
    onCanvas(5, actor, human);
    expect(await runUse(perk, pay())).toBeNull();
    expect(actor.system.energon.normal.value).toBe(2);
    expect(far.system.energon.normal.value).toBe(0);
  });
});

/* -------------------------------------------- */
/*  Grant His Hunger                             */
/* -------------------------------------------- */

describe('Grant His Hunger', () => {
  const FILE = 'dditems/_source/Grant_His_Hunger_TuXN8c83c1CDiMUD.json';
  const essences = () => ({ strength: { value: 3 }, speed: { value: 3 }, smarts: { value: 3 }, social: { value: 3 } });

  test('a Standard action Culture test against the touched target\'s Cleverness drains 1d2 Energon', async () => {
    const actor = holder([FILE]);
    const [rite] = actor.items.contents;
    const bot = holder([], { name: 'Bot', system: { canTransform: true, energon: { normal: { value: 3 } }, defenses: { cleverness: { total: 13 } } } });
    target(bot);
    onCanvas(5, actor, bot);
    actor._dice = roller({ success: true });
    jest.spyOn(Math, 'random').mockReturnValue(0.9);
    const paid = pay();
    await runUse(rite, paid);
    expect(paid).toHaveBeenCalledWith('standard');
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'culture', dif: '13' }), actor);
    expect(bot.system.energon.normal.value).toBe(1);
    // Never below 0.
    await runUse(rite, pay());
    expect(bot.system.energon.normal.value).toBe(0);
  });

  test('a creature with no Energon takes the damage to a random Essence; a failure does nothing', async () => {
    const actor = holder([FILE]);
    const [rite] = actor.items.contents;
    const human = holder([], { name: 'Human', system: { essences: essences(), energon: { normal: { max: 0 } }, defenses: { cleverness: { total: 12 } } } });
    target(human);
    actor._dice = roller({ success: true });
    // 1d2 = 1, then 1d4 = 3 (smarts).
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.6);
    await runUse(rite, pay());
    expect(Object.values(human.system.essences).map(e => e.value)).toEqual([3, 3, 2, 3]);

    actor._dice = roller({ success: false });
    expect(await runUse(rite, pay())).toContain('The rite fails.');
    expect(Object.values(human.system.essences).map(e => e.value)).toEqual([3, 3, 2, 3]);
  });

  test('a target out of reach stops it before the action is paid', async () => {
    const actor = holder([FILE]);
    const [rite] = actor.items.contents;
    const bot = holder([], { system: { canTransform: true, energon: { normal: { value: 3 } } } });
    target(bot);
    onCanvas(10, actor, bot);
    actor._dice = roller();
    const paid = pay();
    expect(await runUse(rite, paid)).toContain('You must touch the target.');
    expect(paid).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Rotor Blades                                 */
/* -------------------------------------------- */

describe('Rotor Blades', () => {
  const FILE = 'tfcrbitems/_source/Rotor_Blades_jkZQIpL661klm5sP.json';

  test('Alt Mode: Aerial Movement of half the Ground Movement (after derived data), never lowering it', () => {
    const actor = holder([FILE], { system: { canTransform: true, isTransformed: false } });
    actor.system.movement = { ground: { total: 50 }, aerial: { total: 0 } };
    expect(ruleMovementStages(actor)('afterDerived', 'aerial', 0)).toBeNull();
    actor.system.isTransformed = true;
    expect(ruleMovementStages(actor)('afterDerived', 'aerial', 0)).toBe(25);
    expect(ruleMovementStages(actor)('afterDerived', 'aerial', 40)).toBe(40);
    expect(ruleMovementStages(actor)('final', 'aerial', 0)).toBeNull();
    expect(ruleMovementStages(actor)('afterDerived', 'ground', 50)).toBeNull();
  });

  test('+1 damage on hits with its own blades against organic targets', () => {
    const actor = holder([FILE]);
    const [gear] = actor.items.contents;
    const blades = makeItem({ id: 'bw', type: 'weapon', name: 'Rotor Blades', flags: { essence20: { grantedBy: gear.id } } });
    const slash = makeItem({ id: 'be', type: 'weaponEffect', name: 'Slash', flags: { essence20: { parentId: 'bw' } } });
    const other = makeItem({ id: 'oe', type: 'weaponEffect', name: 'Punch', flags: { essence20: {} } });
    for (const item of [blades, slash, other]) {
      item.parent = actor;
      actor.items.contents.push(item);
    }

    rebuildIndex(actor);
    global.fromUuidSync = uuid => ({ slash, other })[uuid] ?? null;
    const hit = (target, itemUuid = 'slash') => {
      const note = jest.fn();
      ruleDamageDealt(actor, target, { damageValue: 2 }, { itemUuid, skill: 'might', style: 'melee' }, { damageBonusNote: note });
      return note.mock.calls.map(call => call[1]);
    };

    const human = holder([], { name: 'Human' });
    expect(hit(human)).toEqual([1]);
    expect(hit(human, 'other')).toEqual([]);
    expect(hit(holder([], { system: { canTransform: true } }))).toEqual([]);
    // Creature tags that aren't organic: robot, mechanical, vehicle, structure, object, cybertronian, drone, zord.
    for (const tag of ['Robot', 'mechanical', 'vehicle', 'structure', 'object', 'cybertronian', 'drone', 'zord']) {
      expect(hit(holder([], { system: { creatureTags: `beast, ${tag}` } }))).toEqual([]);
    }

    expect(hit(holder([], { system: { creatureTags: 'beast' } }))).toEqual([1]);
    expect(hit(holder([], { type: 'vehicle' }))).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Covering Fire                                */
/* -------------------------------------------- */

describe('Covering Fire', () => {
  const FILE = 'tfcrbitems/_source/Covering_Fire_cAm087BkiExKIJrY.json';

  test('a miss in a combat that hasn\'t started yet banks the in-combat Snag (counted from the first round)', async () => {
    const actor = holder([FILE]);
    const foe = holder([], { name: 'Foe' });
    game.combat = { id: 'c1', started: false, round: 0, turn: null, turns: [] };
    await fireTriggers(actor, 'miss', { roll: { isAttack: true, item: { type: 'weaponEffect', system: {} } }, outcome: 'failure', targets: [foe] });
    const [entry] = foe.flags.essence20.ruleBank;
    expect(entry).toMatchObject({ snag: true, until: 'endOfNextTurn', when: ['attack', 'ownTurn'] });
    expect(entry.stamp).toMatchObject({ combatId: 'c1', unstarted: true });

    // No combat at all: one Snag on the next attack, for the scene.
    game.combat = null;
    const other = holder([], { name: 'Other' });
    await fireTriggers(actor, 'miss', { roll: { isAttack: true, item: { type: 'weaponEffect', system: {} } }, outcome: 'failure', targets: [other] });
    expect(other.flags.essence20.ruleBank[0]).toMatchObject({ snag: true, until: 'scene', when: ['attack'] });
  });
});
