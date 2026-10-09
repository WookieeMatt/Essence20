import { jest } from '@jest/globals';

/**
 * Round 17, split2 (docs/rules-batches/slSplit217.md): the engine pieces - rule types DamageImmunity, CardResistance,
 * AddictionSnag, CarryCapacity, ForcedMovementChoice, SkillImmunityOverride, CureNote, BonusEnergon;
 * steps shapeSet, makeKit, clearRoughTerrain, rollInitiative keepHigher; tags target:keptAt, self:elevation,
 * card:flagEquals; SkillSubstitution clearSpecialized; pick from config exceptAt - and the hand-written readers that ask them.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };
const grants = { chooseSelect: jest.fn(async () => null), chooseButtons: jest.fn(async () => null), rollTest: jest.fn(async () => ({ success: true })) };
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { evaluate, contextFor } = await import('./predicate.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { ruleDamageImmune } = await import('./plugins/combat/damage-immunity.mjs');
const { ruleCardResistance, resisted } = await import('./plugins/combat/card-resistance.mjs');
const readers = await import('./plugins/combat/subsystem-readers.mjs');
const { clearRoughTerrain, roughRegionsAt } = await import('./plugins/combat/clear-rough-terrain.mjs');
const { askSubstitution } = await import('./plugins/dialog/dialog-select.mjs');
const { applyDamage } = await import('../mechanics/combat/combat.mjs');
const { resistsForcedMovement } = await import('../mechanics/combat/forced-movement.mjs');
const { carryPercent } = await import('../mechanics/resources/kits.mjs');
const { repairBonusHeld } = await import('../items/resources/repair-progress-bonus-energon.mjs');
const { shapeOf } = await import('../items/forms/pony-shape-shifting.mjs');

let nextId = 1;
const setPath = (object, path, value) => {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
};

function actorWith(rules = [], { system = {}, flags = {}, type = 'playerCharacter', items = [] } = {}) {
  const list = [];
  const actor = {
    id: `a${nextId++}`, name: 'Actor', type, flags: { essence20: { ...flags } }, statuses: new Set(), isOwner: true,
    system: { health: { value: 10, max: 10 }, immunities: {}, skills: {}, ...system },
    update: jest.fn(async function (data) {
      Object.entries(data).forEach(([key, value]) => setPath(this, key, value));
    }),
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    getFlag(scope, key) {
      return this.flags[scope]?.[key];
    },
    async createEmbeddedDocuments(type, datas) {
      const made = datas.map(data => ({ ...data, id: `i${nextId++}`, parent: actor }));
      list.push(...made);
      rebuildIndex(actor);
      return made;
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  const add = data => list.push({ id: `i${nextId++}`, name: data.name ?? 'Item', type: data.type ?? 'perk', flags: data.flags ?? {}, system: data.system ?? {}, parent: actor });
  if (rules.length) {
    add({ name: 'Rules', system: { rules } });
  }

  items.forEach(add);
  actor.items = Object.assign(list, { contents: list, get: id => list.find(item => item.id == id) });
  actor.getActiveTokens = () => [];
  rebuildIndex(actor);
  return actor;
}

beforeEach(() => {
  global.game = { user: { isGM: true, targets: new Set() }, i18n: { localize: key => key, format: (key, data) => `${key} ${JSON.stringify(data ?? {})}`, has: () => false }, settings: { get: () => 1 }, combat: null, actors: [] };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.CONFIG = { E20: { skills: { science: 'E20.SkillScience', alertness: 'E20.SkillAlertness', streetwise: 'E20.SkillStreetwise' }, skillToEssence: { streetwise: 'social' }, weaponTypes: { blunt: 'Blunt', rifle: 'Rifle' } } };
  global.foundry = { data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: { setProperty: setPath, getProperty: (o, p) => p.split('.').reduce((at, k) => at?.[k], o) }, applications: { api: { DialogV2: { confirm: jest.fn(async () => false) } } } };
});

describe('rule types read by hand-written code', () => {
  test('DamageImmunity: listed types or the chosen one; applyDamage reads it, and a hit that ignores Immunity still lands', async () => {
    expect(validateRule({ type: 'DamageImmunity' })).toEqual(['needs damageTypes or choiceOf']);
    const actor = actorWith([{ type: 'DamageImmunity', damageTypes: ['emp'], when: ['self:data:flags.essence20.up'] }], { flags: { up: true } });
    expect(ruleDamageImmune(actor, 'emp')).toBe(true);
    expect(await applyDamage(actor, 5, 'emp')).toBe(0);
    expect(await applyDamage(actor, 5, 'emp', false, { ignoreImmunity: true })).toBe(5);
    actor.flags.essence20.up = false;
    expect(ruleDamageImmune(actor, 'emp')).toBe(false);
    const chooser = actorWith([{ type: 'DamageImmunity', choiceOf: 'Compendium.x.Item.affinity' }], { items: [{ name: 'Affinity', system: { choice: 'cold' }, flags: { core: { sourceId: 'Compendium.x.Item.affinity' } } }] });
    expect(ruleDamageImmune(chooser, 'cold')).toBe(true);
    expect(ruleDamageImmune(chooser, 'fire')).toBe(false);
  });

  test('CardResistance and card:flagEquals', () => {
    const tank = actorWith([{ type: 'CardResistance', when: ['card:flagEquals:isAttack=false', 'card:flagEquals:defenseType=toughness'] }]);
    expect(ruleCardResistance(tank, { flags: { essence20: { isAttack: false, defenseType: 'toughness' } } })).toBe(true);
    expect(ruleCardResistance(tank, { flags: { essence20: { isAttack: 'false', defenseType: 'toughness' } } })).toBe(false);
    expect(ruleCardResistance(tank, null)).toBe(false);
    expect(evaluate(['card:flagEquals:skill=might'], contextFor({ card: { flags: { essence20: { skill: 'might' } } } }))).toBe(true);
    expect(evaluate(['card:flagEquals:skill=might'], contextFor({}))).toBe(null);
    expect(resisted(7)).toBe(4);
  });

  test('AddictionSnag, CarryCapacity (carryPercent), CureNote, SkillImmunityOverride validation', () => {
    expect(readers.ruleAddictionSnag(actorWith([{ type: 'AddictionSnag', when: ['self:data:flags.essence20.on'] }], { flags: { on: true } }))).toBe(true);
    const mule = actorWith([{ type: 'CarryCapacity', multiply: 2 }, { type: 'CarryCapacity', multiply: 1.5 }], { system: { skills: { brawn: { shift: 'd8' } } } });
    expect(readers.ruleCarryMultiplier(mule)).toBe(3);
    expect(carryPercent(mule)).toBe(300);
    expect(validateRule({ type: 'CarryCapacity' })).toEqual(['multiply is required']);
    expect(readers.ruleCureNotes(actorWith([{ type: 'CureNote', text: 'E20.A' }, { type: 'CureNote', text: 'plain' }]))).toBe('E20.A plain');
    expect(validateRule({ type: 'CureNote' })).toEqual(['text is required']);
    expect(validateRule({ type: 'SkillImmunityOverride', cost: {} })).toEqual(['cost needs storyPoints (a number above 0)']);
    expect(readers.skillImmunityOverrideOf(actorWith([{ type: 'SkillImmunityOverride', cost: { storyPoints: 2 } }]))?.storyPoints).toBe(2);
  });

  test('ForcedMovementChoice: resistsForcedMovement asks, staying put the default', async () => {
    const holder = actorWith([{ type: 'ForcedMovementChoice' }]);
    expect(await resistsForcedMovement(holder)).toBe(true);
    expect(ChatMessage.create).toHaveBeenCalled();
    foundry.applications.api.DialogV2.confirm = jest.fn(async () => true);
    expect(await resistsForcedMovement(holder)).toBe(false);
    expect(await resistsForcedMovement(actorWith())).toBe(false);
  });

  test('BonusEnergon: the first such item, until it is marked spent', () => {
    expect(repairBonusHeld(actorWith([{ type: 'BonusEnergon' }]))).toBe(1);
    const spent = actorWith([], { items: [{ name: 'Spent', flags: { essence20: { repairBonusSpent: true } }, system: { rules: [{ type: 'BonusEnergon' }] } }] });
    expect(repairBonusHeld(spent)).toBe(0);
    expect(repairBonusHeld(actorWith())).toBe(0);
  });
});

describe('steps', () => {
  const run = async (actor, steps, item = actor.items.contents[0] ?? null, extra = {}) => {
    const ctx = stepContext({ actor, item, rule: { steps }, ...extra });
    const finished = await runSteps(steps, ctx);
    return { finished, ctx };
  };

  test('shapeSet merges keys into this scene\'s shape', async () => {
    const actor = actorWith([{ type: 'AddictionSnag' }], { flags: { mlpShape: { scene: 1, faceSkill: 'x' } } });
    await run(actor, [{ do: 'shapeSet', set: { spell: 'S', size: '{var.size}' } }], undefined, {});
    expect(shapeOf(actor)).toEqual({ scene: 1, faceSkill: 'x', spell: 'S', size: '' });
    expect(validateRule({ type: 'Use', steps: [{ do: 'shapeSet' }] })[0]).toMatch(/shapeSet needs set/);
  });

  test('makeKit: a kit for a picked Specialization; none - a warning and a stop', async () => {
    const actor = actorWith([{ type: 'AddictionSnag' }], { system: { skills: { science: { specializations: { a: { name: 'Biology' } } } } } });
    grants.chooseSelect.mockImplementationOnce(async (title, prompt, options) => options[0].value);
    const { finished, ctx } = await run(actor, [{ do: 'makeKit', tier: 'standard', skills: ['science'] }]);
    expect(finished).toBe(true);
    expect(ctx.vars.kit).toBe('science (Biology)');
    expect(actor.items.contents.at(-1).flags.essence20.kit).toEqual({ tier: 'standard', skill: 'science', spec: 'Biology', essence: null });
    const none = await run(actorWith([{ type: 'AddictionSnag' }]), [{ do: 'makeKit', skills: ['science'] }]);
    expect(none.finished).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.RulesExtSplit217.NoSpecialization');
    expect(validateRule({ type: 'Use', steps: [{ do: 'makeKit', skills: ['x'], tier: 'mega' }] })[0]).toMatch(/tier must be/);
  });

  test('clearRoughTerrain: only one-square Rough Terrain regions under the point', async () => {
    const square = { id: 'a', behaviors: [{ system: { roughTerrain: true } }], shapes: [{ type: 'rectangle', x: 0, y: 0, width: 100, height: 100 }] };
    const plain = { id: 'b', behaviors: [{ system: {} }], shapes: [{ type: 'rectangle', x: 0, y: 0, width: 100, height: 100 }] };
    const scene = { grid: { size: 100 }, regions: [square, plain], deleteEmbeddedDocuments: jest.fn(async () => {}) };
    expect(roughRegionsAt(scene, { x: 10, y: 10 })).toEqual([square]);
    expect(await clearRoughTerrain(scene, { x: 10, y: 10 })).toBe(1);
    expect(scene.deleteEmbeddedDocuments).toHaveBeenCalledWith('Region', ['a']);
    const actor = actorWith([{ type: 'AddictionSnag' }]);
    expect((await run(actor, [{ do: 'clearRoughTerrain' }])).finished).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.RulesExtSplit217.NeedsToken');
  });

  test('rollInitiative keepHigher', async () => {
    const actor = actorWith([{ type: 'AddictionSnag' }]);
    const combatant = { id: 'c', actor, initiative: 12, isOwner: true, async update(data) {
      Object.assign(this, data);
    } };
    game.combat = { combatants: { contents: [combatant], get: () => combatant, [Symbol.iterator]: () => [combatant][Symbol.iterator]() }, rollInitiative: jest.fn(async () => {
      combatant.initiative = 8;
    }) };
    const low = await run(actor, [{ do: 'rollInitiative', to: 'self', keepHigher: true }]);
    expect(combatant.initiative).toBe(12);
    expect(low.ctx.chat.join(' ')).toMatch(/InitiativeKept/);
    game.combat.rollInitiative = jest.fn(async () => {
      combatant.initiative = 20;
    });
    const high = await run(actor, [{ do: 'rollInitiative', to: 'self', keepHigher: true }]);
    expect(combatant.initiative).toBe(20);
    expect(high.ctx.chat.join(' ')).toMatch(/InitiativeMoved/);
  });

  test('pick from config exceptAt leaves out what the actor already has', async () => {
    const actor = actorWith([{ type: 'AddictionSnag' }], { system: { qualified: { weapons: { blunt: true } } } });
    grants.chooseSelect.mockImplementationOnce(async (title, prompt, options) => {
      expect(options.map(o => o.value)).toEqual(['rifle']);
      return 'rifle';
    });
    actor.items.contents[0].update = jest.fn(async function (data) {
      Object.entries(data).forEach(([key, value]) => setPath(this, key, value));
    });
    await run(actor, [{ do: 'pick', key: 'weapon', from: 'config', path: 'weaponTypes', exceptAt: 'system.qualified.weapons' }]);
    expect(actor.items.contents[0].flags.essence20.rules.choices.weapon).toBe('rifle');
  });
});

describe('tags and SkillSubstitution clearSpecialized', () => {
  test('target:keptAt and self:elevation', () => {
    const other = { uuid: 'Actor.x' };
    expect(evaluate(['target:keptAt:flags.essence20.nemesisUuid'], contextFor({ self: { flags: { essence20: { nemesisUuid: 'Actor.x' } } }, other }))).toBe(true);
    expect(evaluate(['target:keptAt:flags.essence20.nemesisUuid'], contextFor({ self: { flags: { essence20: {} } }, other }))).toBe(false);
    const flier = { getActiveTokens: () => [{ document: { elevation: 15 } }] };
    expect(evaluate(['self:elevation:>0'], contextFor({ self: flier }))).toBe(true);
    expect(evaluate(['self:elevation:<0'], contextFor({ self: flier }))).toBe(false);
    expect(evaluate(['self:elevation:>0'], contextFor({ self: { getActiveTokens: () => [] } }))).toBe(false);
  });

  test('clearSpecialized drops the Specialization when the Skill is swapped', async () => {
    const actor = actorWith([{ type: 'SkillSubstitution', from: 'alertness', mode: 'ask', options: ['streetwise'], clearSpecialized: true }]);
    grants.chooseButtons.mockImplementationOnce(async () => 'streetwise');
    const dataset = { skill: 'alertness', isSpecialized: true };
    await askSubstitution(actor, dataset, null);
    expect(dataset).toEqual({ skill: 'streetwise', essence: 'social', isSpecialized: false });
  });
});
