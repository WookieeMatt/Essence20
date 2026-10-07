import { jest } from '@jest/globals';

/**
 * Phase 0 of docs/PERK_CHOICE_MIGRATION_PLAN.md: every reader of a Perk's pick goes through rules/choice-read.mjs.
 * For each switched reader: an item holding only the old `system.choice` resolves exactly as before, and (to show the
 * reader really goes through the helper) a pick held as a rules choice / the 6.1 legacy flag resolves the same way.
 *
 * Readers covered elsewhere with legacy-only items, unchanged and still passing: Over the Candlestick's Agile Reflexes
 * (dice.test.js, makeAgileReflexesTarget), Favorite Command's Skill (mechanics/companions/companions.test.js), the
 * movement / skills perk value migration (migration.test.js), Expertise's already-chosen Skills and onPerkDelete
 * (sheet-handlers/perk-handler.test.js).
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

const rollVsMany = jest.fn(async (actor, skill, others) => others.map(other => ({ targetUuid: other.uuid, success: true, multiplier: 1 })));
jest.unstable_mockModule('./mechanics/combat/reaction-engine.mjs', () => ({ rollVsMany }));
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn(), createViaGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex, ruleLabel } = await import('./index.mjs');
const { contextFor, evaluate, interpolate } = await import('./predicate.mjs');
const { ruleDamageType, ruleDieSubstitution, ruleDialogSwitches, ruleRerollGrants } = await import('./adapter.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { ruleResistsAttack } = await import('./plugins/combat/attack-resistance.mjs');
const { ruleDamageImmune } = await import('./plugins/combat/damage-immunity.mjs');
const { holderChoiceOfTag } = await import('./plugins/tags/holder-choice-of-tag.mjs');
const { legacyChoiceUpdates, legacyValue } = await import('./legacy-choices.mjs');
const { getAlreadyChosenExpertiseSkills, onPerkDelete } = await import('../sheet-handlers/perk-handler.mjs');
const { ENERGY_AFFINITY_ID, isEnergyAffinityElementAttack } = await import('../items/attacks/energy-affinity.mjs');
const { hasPhantomFocusOption } = await import('../items/healing/phantom-focus.mjs');
const { TF1, favoriteWeaponOf } = await import('../items/shared/condition-damage-buttons.mjs');
const { migratePerkValue } = await import('../migration.mjs');

const getPath = (object, path) => path.split('.').reduce((at, key) => at?.[key], object);
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

let nextId = 1;
const SOURCE = 'Compendium.essence20.test.Item.chooser0000000';
const SOURCE_ID = 'chooser0000000ab';

/**
 * The three ways one pick can be held: the old field only, the 6.1 legacy flag, a rules choice (with its ChoiceSet).
 * @param {*} value
 */
const HOLDINGS = {
  legacy: value => ({ system: { choice: value } }),
  flag: value => ({ flags: { essence20: { legacyChoice: value } }, system: {} }),
  rules: value => ({ flags: { essence20: { rules: { choices: { pick: value } } } }, system: { rules: [{ type: 'ChoiceSet', key: 'pick', choices: [] }], choice: 'stale' } }),
};
const WAYS = Object.keys(HOLDINGS);

function makeItem(actor, data = {}) {
  const item = {
    id: `i${nextId++}`, type: 'perk', name: 'Chooser', ...data,
    flags: { core: { sourceId: SOURCE }, ...(data.flags ?? {}) },
    system: { rules: [], ...(data.system ?? {}) },
    parent: actor,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
  };
  item.uuid = `${actor?.uuid}.Item.${item.id}`;
  return item;
}

/** A pick-holding item merged with more rules / system data. */
function chooser(way, value, { rules = [], system = {}, flags = {} } = {}) {
  const held = HOLDINGS[way](value);
  return {
    flags: { ...flags, essence20: { ...(flags.essence20 ?? {}), ...(held.flags?.essence20 ?? {}) } },
    system: { ...held.system, ...system, rules: [...(held.system.rules ?? []), ...rules] },
  };
}

/** chooser(), as a copy of another compendium item. */
function sourcedChooser(sourceId, way, value, more) {
  const data = chooser(way, value, more);
  return { ...data, flags: { ...data.flags, core: { sourceId } } };
}

function makeActor(itemData = [], system = {}) {
  const actor = {
    id: `a${nextId++}`, name: 'Hero', type: 'playerCharacter', flags: { essence20: {} }, statuses: new Set(),
    system: { level: 4, skills: {}, health: { value: 5, max: 10 }, ...system },
    update: jest.fn(async () => {}),
    getFlag: () => undefined,
  };
  actor.uuid = `Actor.${actor.id}`;
  const list = itemData.map(data => makeItem(actor, data));
  actor.items = Object.assign(list, { contents: list, get: id => list.find(item => item.id == id) });
  actor.getActiveTokens = () => [];
  rebuildIndex(actor);
  return actor;
}

beforeEach(() => {
  rollVsMany.mockClear();
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] }, actors: { contents: [] },
    settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false }, time: { worldTime: 0 },
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.foundry = { ...global.foundry, utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, randomID: () => `r${nextId++}` } };
});

describe('{item.choice} interpolation', () => {
  test.each(WAYS)('interpolate (%s)', way => {
    const [item] = makeActor([chooser(way, 'athletics')]).items;
    expect(interpolate('skill:{item.choice}', item)).toBe('skill:athletics');
  });

  test('a legacy item with no pick is still "missing" (null), as before', () => {
    for (const choice of ['', null, undefined]) {
      const [item] = makeActor([{ system: { choice } }]).items;
      expect(interpolate('skill:{item.choice}', item)).toBeNull();
    }

    expect(interpolate('skill:{item.choice}', null)).toBeNull();
  });

  test.each(WAYS)('ruleLabel (%s)', way => {
    const [item] = makeActor([chooser(way, 'fire')]).items;
    expect(ruleLabel({ label: 'Resist {item.choice}' }, item)).toBe('Resist fire');
  });

  test('ruleLabel shows … with no pick, as before', () => {
    const [item] = makeActor([{ system: { choice: '' } }]).items;
    expect(ruleLabel({ label: 'Resist {item.choice}' }, item)).toBe('Resist …');
  });

  test.each(WAYS)('{sourced.<id>.system.choice} (%s)', way => {
    const actor = makeActor([sourcedChooser(`Compendium.essence20.test.Item.${SOURCE_ID}`, way, 'cold')]);
    const holder = makeItem(actor, { flags: {} });
    actor.items.push(holder);
    expect(interpolate(`resist:{sourced.${SOURCE_ID}.system.choice}`, holder)).toBe('resist:cold');
  });

  test('{sourced.<id>.system.choice} with no copy is missing, as before', () => {
    const actor = makeActor([]);
    const holder = makeItem(actor, { flags: {} });
    actor.items.push(holder);
    expect(interpolate(`resist:{sourced.${SOURCE_ID}.system.choice}`, holder)).toBeNull();
  });
});

describe('rule:data:system.choice / item:data:system.choice', () => {
  test.each(WAYS)('rule:data (%s)', way => {
    const actor = makeActor([chooser(way, 'triggerHappy')]);
    const ask = tag => evaluate([tag], contextFor({ self: actor, ruleItem: actor.items[0] }));
    expect(ask('rule:data:system.choice=triggerHappy')).toBe(true);
    expect(ask('rule:data:system.choice=TRIGGERHAPPY')).toBe(true);
    expect(ask('rule:data:system.choice=steadyAim')).toBe(false);
    expect(ask('rule:data:system.choice!=steadyAim')).toBe(true);
    expect(ask('rule:data:system.choice')).toBe(true);
  });

  test('a legacy item with no pick: falsy, unequal, as before', () => {
    const actor = makeActor([{ system: { choice: '' } }]);
    const ask = tag => evaluate([tag], contextFor({ self: actor, ruleItem: actor.items[0] }));
    expect(ask('rule:data:system.choice')).toBe(false);
    expect(ask('rule:data:system.choice=ground')).toBe(false);
    expect(ask('rule:data:system.choice!=ground')).toBe(true);
  });

  test('other rule:data paths read the item as before', () => {
    const actor = makeActor([{ system: { choice: 'x', value: 40 }, flags: { essence20: { perkValueRule: true } } }]);
    const ask = tag => evaluate([tag], contextFor({ self: actor, ruleItem: actor.items[0] }));
    expect(ask('rule:data:system.value>=40')).toBe(true);
    expect(ask('rule:data:flags.essence20.perkValueRule')).toBe(true);
  });

  test('a list pick matches on any entry', () => {
    const actor = makeActor([chooser('rules', ['athletics', 'stealth'])]);
    const ask = tag => evaluate([tag], contextFor({ self: actor, ruleItem: actor.items[0] }));
    expect(ask('rule:data:system.choice=stealth')).toBe(true);
    expect(ask('rule:data:system.choice=brawn')).toBe(false);
    expect(ask('rule:data:system.choice!=brawn')).toBe(true);
  });

  test.each(WAYS)('item:data, asked of another item (Gallantry reading a Fighting Style) (%s)', way => {
    const actor = makeActor([chooser(way, 'triggerHappy')]);
    const ask = tag => evaluate([tag], contextFor({ self: actor, item: actor.items[0] }));
    expect(ask('item:data:system.choice=triggerHappy')).toBe(true);
    expect(ask('item:data:system.choice=other')).toBe(false);
  });
});

describe('choiceOf readers', () => {
  test.each(WAYS)('skill:choiceOf:<uuid> (%s)', way => {
    const actor = makeActor([chooser(way, 'science')]);
    const ask = rolledSkill => evaluate([`skill:choiceOf:${SOURCE}`], contextFor({ self: actor, rolledSkill }));
    expect(ask('science')).toBe(true);
    expect(ask('athletics')).toBe(false);
  });

  test('skill:choiceOf:<uuid> legacy edge cases, as before', () => {
    const none = makeActor([{ system: { choice: '' } }]);
    expect(evaluate([`skill:choiceOf:${SOURCE}`], contextFor({ self: none, rolledSkill: '' }))).toBe(false);
    expect(evaluate([`skill:choiceOf:${SOURCE}`], contextFor({ self: makeActor([]), rolledSkill: 'science' }))).toBe(false);
  });

  test.each(WAYS)('self:choiceOf / target:choiceOf (%s)', way => {
    const actor = makeActor([chooser(way, 'science')]);
    expect(evaluate([`self:choiceOf:${SOURCE}`], contextFor({ self: actor }))).toBe(true);
    expect(evaluate([`target:choiceOf:${SOURCE}`], contextFor({ self: makeActor([]), other: actor }))).toBe(true);
  });

  test('self:choiceOf is false for a copy with no pick, as before', () => {
    for (const choice of ['', null, undefined]) {
      expect(evaluate([`self:choiceOf:${SOURCE}`], contextFor({ self: makeActor([{ system: { choice } }]) }))).toBe(false);
    }

    // 'none' is a stored value like any other.
    expect(evaluate([`self:choiceOf:${SOURCE}`], contextFor({ self: makeActor([{ system: { choice: 'none' } }]) }))).toBe(true);
  });

  test.each(WAYS)('holder:choiceOf (%s)', way => {
    const holder = makeActor([chooser(way, 'persuasion')]);
    expect(holderChoiceOfTag(SOURCE, { holder, rolledSkill: 'persuasion' })).toBe(true);
    expect(holderChoiceOfTag(SOURCE, { holder, rolledSkill: 'athletics' })).toBe(false);
    expect(holderChoiceOfTag(SOURCE, { holder, rolledSkill: undefined })).toBe(false);
    expect(holderChoiceOfTag(SOURCE, { holder: makeActor([]), rolledSkill: 'persuasion' })).toBe(false);
  });

  test.each(WAYS)('AttackResistance choiceOf (%s)', way => {
    const target = makeActor([chooser(way, 'sonic'), { flags: {}, system: { rules: [{ type: 'AttackResistance', choiceOf: SOURCE }] } }]);
    expect(ruleResistsAttack(target, 'sonic')).toBe(true);
    expect(ruleResistsAttack(target, 'fire')).toBe(false);
    const energy = makeActor([chooser(way, 'energy'), { flags: {}, system: { rules: [{ type: 'AttackResistance', choiceOf: SOURCE }] } }]);
    expect(ruleResistsAttack(energy, 'fire')).toBe(true);
  });

  test.each(WAYS)('DamageImmunity choiceOf (%s)', way => {
    const actor = makeActor([chooser(way, 'cold'), { flags: {}, system: { rules: [{ type: 'DamageImmunity', choiceOf: SOURCE }] } }]);
    expect(ruleDamageImmune(actor, 'cold')).toBe(true);
    expect(ruleDamageImmune(actor, 'fire')).toBe(false);
  });

  test.each(WAYS)('rollVsEach skill: "choiceOf:<uuid>" (%s)', async way => {
    const actor = makeActor([chooser(way, 'survival')]);
    const other = makeActor([]);
    const ctx = stepContext({ actor, item: makeItem(actor, { flags: {} }), rule: {}, targets: [other] });
    await runSteps([{ do: 'rollVsEach', skill: `choiceOf:${SOURCE}` }], ctx);
    expect(rollVsMany).toHaveBeenLastCalledWith(actor, 'survival', [other], 'toughness');
  });

  test.each(WAYS)('DialogSwitch useSkill: "choiceOf:<uuid>" (%s)', way => {
    const actor = makeActor([chooser(way, 'survival'), { flags: {}, system: { rules: [{ type: 'DialogSwitch', label: 'Instead', useSkill: `choiceOf:${SOURCE}` }] } }],
      { skills: { survival: { shift: 'd6' }, athletics: { shift: 'd4' } } });
    expect(ruleDialogSwitches(actor, { rolledSkill: 'athletics' }).length).toBe(1);
    // Not on that Skill's own roll.
    expect(ruleDialogSwitches(actor, { rolledSkill: 'survival' }).length).toBe(0);
  });
});

describe('the rule item\'s own pick in rule fields', () => {
  test.each(WAYS)('DamageType to: "choice" (%s)', way => {
    const actor = makeActor([chooser(way, 'blunt', { rules: [{ type: 'DamageType', to: 'choice' }] })]);
    const punch = { type: 'weaponEffect', flags: {}, system: { classification: {} } };
    expect(ruleDamageType(actor, null, { item: punch, switches: [] })).toBe('blunt');
  });

  test('DamageType to: "choice" with no pick gives no type, as before', () => {
    const actor = makeActor([{ system: { choice: '', rules: [{ type: 'DamageType', to: 'choice' }] } }]);
    expect(ruleDamageType(actor, null, { item: { type: 'weaponEffect', flags: {}, system: { classification: {} } }, switches: [] })).toBeNull();
  });

  test.each(WAYS)('DieSubstitution skills: ["choice"] (%s)', way => {
    global.CONFIG = { ...(global.CONFIG ?? {}), E20: { ...(global.CONFIG?.E20 ?? {}), skillShiftList: ['d20', 'd2', 'd4', 'd6', 'd8', 'd10', 'd12'] } };
    const actor = makeActor([chooser(way, 'science', { rules: [{ type: 'DieSubstitution', mode: 'use', skills: ['choice'] }] })],
      { skills: { science: { shift: 'd8' }, athletics: { shift: 'd4' } } });
    expect(ruleDieSubstitution(actor, null, { rolledSkill: 'athletics' }, 'd4').shift).toBe('d8');
  });

  test.each(WAYS)('Reroll on a choiceType skills Perk covers the picked Skill (%s)', way => {
    const actor = makeActor([chooser(way, 'stealth', { rules: [{ type: 'Reroll' }], system: { choiceType: 'skills' } })]);
    expect(ruleRerollGrants(actor).map(config => config.skills)).toEqual([['stealth']]);
  });

  test('Reroll: a list pick covers every Skill; no pick leaves the rule unscoped, as before', () => {
    const multi = makeActor([chooser('rules', ['stealth', 'athletics'], { rules: [{ type: 'Reroll' }], system: { choiceType: 'skills' } })]);
    expect(ruleRerollGrants(multi).map(config => config.skills)).toEqual([['stealth', 'athletics']]);
    const none = makeActor([{ system: { choice: '', choiceType: 'skills', rules: [{ type: 'Reroll' }] } }]);
    expect(ruleRerollGrants(none).map(config => config.skills)).toEqual([undefined]);
    const notSkills = makeActor([{ system: { choice: 'stealth', choiceType: 'senses', rules: [{ type: 'Reroll' }] } }]);
    expect(ruleRerollGrants(notSkills).map(config => config.skills)).toEqual([undefined]);
  });
});

describe('JS readers', () => {
  test.each(WAYS)('Energy Affinity\'s Element (%s)', way => {
    const actor = makeActor([sourcedChooser(ENERGY_AFFINITY_ID, way, 'fire')]);
    actor.getFlag = () => undefined;
    const fire = { type: 'weaponEffect', system: { damageType: 'fire', classification: { style: 'ranged' } } };
    const cold = { type: 'weaponEffect', system: { damageType: 'cold', classification: { style: 'ranged' } } };
    expect(isEnergyAffinityElementAttack(actor, fire)).toBe(true);
    expect(isEnergyAffinityElementAttack(actor, cold)).toBe(false);
  });

  test.each(WAYS)('Phantom Focus option (%s)', way => {
    const id = 'Compendium.essence20.across_the_stars.Item.aXGMEoVsYSttOSHn';
    const actor = makeActor([sourcedChooser(id, way, 'phaseDefense')]);
    expect(hasPhantomFocusOption(actor, 'phaseDefense')).toBe(true);
    expect(hasPhantomFocusOption(actor, 'healingLight')).toBe(false);
  });

  test.each(WAYS)('Favorite Weapon (%s)', way => {
    const actor = makeActor([]);
    const blaster = makeItem(actor, { type: 'weapon', flags: {} });
    actor.items.push(blaster);
    // Its Use rule keeps the weapon's id; a uuid's last part reads the same.
    actor.items.push(makeItem(actor, sourcedChooser(TF1.favoriteWeapon, way, `Actor.x.Item.${blaster.id}`)));
    expect(favoriteWeaponOf(actor)).toBe(blaster);
  });

  test('Favorite Weapon with no pick: null, as before', () => {
    const actor = makeActor([{ flags: { core: { sourceId: TF1.favoriteWeapon } }, system: { choice: '' } }]);
    expect(favoriteWeaponOf(actor)).toBeNull();
  });

  test('getAlreadyChosenExpertiseSkills: legacy picks as before; rules / list picks too', () => {
    const unique = { rules: [{ type: 'UniqueChoice' }] };
    const actor = makeActor([{ system: { choice: 'athletics' } }, { system: { choice: null } }, chooser('rules', ['stealth', 'brawn'])]);
    const perk = { flags: { core: { sourceId: SOURCE } }, system: { choice: null, ...unique } };
    expect(getAlreadyChosenExpertiseSkills(actor, perk)).toEqual(['athletics', 'stealth', 'brawn']);
  });

  test('onPerkDelete undoes the old picker\'s baked value only (never a rules choice)', async () => {
    const actor = makeActor([], { senses: { sight: { acute: true } }, environments: ['forest', 'urban'], movement: { ground: { bonus: 10 } } });
    actor._source = { system: { movement: { ground: { bonus: 10 } } } };
    const perk = (choiceType, held) => ({ _stats: {}, flags: held.flags ?? {}, system: { choiceType, value: 10, ...held.system } });
    await onPerkDelete(actor, perk('senses', HOLDINGS.legacy('sight')));
    expect(actor.update).toHaveBeenLastCalledWith({ 'system.senses.sight.acute': false });
    await onPerkDelete(actor, perk('environments', HOLDINGS.flag('urban')));
    expect(actor.update).toHaveBeenLastCalledWith({ 'system.environments': ['forest'] });
    await onPerkDelete(actor, perk('movement', HOLDINGS.legacy('ground')));
    expect(actor.update).toHaveBeenLastCalledWith({ 'system.movement.ground.bonus': 0 });
    actor.update.mockClear();
    // A converted copy (pick only in the rules choices; system.choice cleared) baked nothing, so nothing comes off.
    await onPerkDelete(actor, perk('movement', { ...HOLDINGS.rules('ground'), system: { ...HOLDINGS.rules('ground').system, choice: '' } }));
    expect(actor.update).not.toHaveBeenCalled();
  });

  test('migratePerkValue takes the baked value off the old pick (legacy and 6.1 flag)', async () => {
    for (const way of ['legacy', 'flag']) {
      const held = HOLDINGS[way]('ground');
      const item = { type: 'perk', flags: held.flags ?? {}, system: { ...held.system, choiceType: 'movement', value: 10, rules: [] } };
      const { actorUpdate } = await migratePerkValue(item, { actorSystem: { movement: { ground: { bonus: 30 } } } });
      expect(actorUpdate).toEqual({ 'system.movement.ground.bonus': 20 });
    }
  });
});

describe('legacy-choices', () => {
  const INFLUENCE = 'Compendium.essence20.tf_crb.Item.gcqyJw1sXxi2wy8e';

  test('TF CRB Influence "skill::name" from system.choice, as before, and from the 6.1 flag', () => {
    for (const way of ['legacy', 'flag']) {
      const actor = makeActor([sourcedChooser(INFLUENCE, way, 'persuasion::Senate')]);
      expect(legacyChoiceUpdates(actor)).toEqual([{ _id: actor.items[0].id, 'flags.essence20.rules.choices.skill': 'persuasion', 'flags.essence20.rules.choices.spec': 'Senate' }]);
    }
  });

  test('a `legacy: "system.choice"` ChoiceSet copies the old field, as before, and the 6.1 flag', () => {
    const rules = [{ type: 'ChoiceSet', key: 'element', legacy: 'system.choice', choices: [] }];
    for (const way of ['legacy', 'flag']) {
      const held = HOLDINGS[way]('fire');
      const actor = makeActor([{ flags: held.flags ?? {}, system: { ...held.system, rules } }]);
      expect(legacyChoiceUpdates(actor)).toEqual([{ _id: actor.items[0].id, 'flags.essence20.rules.choices.element': 'fire' }]);
    }

    expect(legacyValue('system.choice', { system: { choice: '' } })).toBeNull();
    expect(legacyValue('system.other', { system: { other: 'x' } })).toBe('x');
  });
});
