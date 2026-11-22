import { jest } from '@jest/globals';
import {
  addSorcerousTrait, basicAttackBuild, countsAgainstBudget, focusCost, focusFor, focusGateRules, focusPickerContext, focusPowerData,
  focusRequirementChanges, isFocusGateRule,
  focusProblem, focusReady, focusUseRules, grantedPowerData, hostTakesTrait, isSorcerousFocus, readyFocus, removeFocus,
  requiringPowerData, sorcerousFoci, useFocusFor,
} from './sorcerous-focus.mjs';
import { buildProblem, sorceryCost, sorceryPowerData, traitTargets } from './temper-tempest-sorcery-builder.mjs';
import { validateRule } from '../../rules/types.mjs';
import '../../rules/plugins/index.mjs';
import { contextFor, evaluate } from '../../rules/predicate.mjs';

/** A minimal owned item: update() merges dotted paths into itself. */
function item(type, id, data = {}) {
  const doc = {
    id, _id: id, type, name: data.name ?? id, system: { ...(data.system ?? {}) }, flags: data.flags ?? {},
    update: jest.fn(async update => {
      for (const [path, value] of Object.entries(update)) {
        const parts = path.split('.');
        let at = doc;
        for (const part of parts.slice(0, -1)) {
          at[part] ??= {};
          at = at[part];
        }

        at[parts.at(-1)] = value;
      }
    }),
  };
  return doc;
}

function actorWith(items) {
  const actor = {
    name: 'Rita', system: { powers: { sorcerous: { max: 10, committed: 0 } } },
    items: { contents: items, get: id => items.find(i => i.id == id) },
    deleteEmbeddedDocuments: jest.fn(async (type, ids) => {
      for (const id of ids) {
        items.splice(items.findIndex(i => i.id == id), 1);
      }
    }),
  };
  for (const i of items) {
    i.parent = actor;
  }

  return actor;
}

function focusItem(id, flag = {}, toggles = {}) {
  return item('power', id, { system: { type: 'sorcerous', powerCost: 2 }, flags: { essence20: { sorcerousFocus: { isFocus: true, ...flag }, rules: { toggles } } } });
}

describe('magical focus (Finster\'s Monster-Matic Cookbook p.274)', () => {
  test('costs 2 points, 1 for one use, +1 for a unique adjustment', () => {
    expect(focusCost({})).toBe(2);
    expect(focusCost({ oneUse: true })).toBe(1);
    expect(focusCost({ unique: true })).toBe(3);
    expect(focusCost({ oneUse: true, unique: true })).toBe(2);
  });

  test('is a Sorcerous Power, never a Role Focus', () => {
    const data = focusPowerData({ name: 'Morpher', host: 'g1', hostName: 'Psycho Morpher', grant: 'power' });
    expect(data.type).toBe('power');
    expect(data.system).toMatchObject({ type: 'sorcerous', powerCost: 2, canActivate: false });
    expect(data.flags.essence20.sorcerousFocus).toMatchObject({ isFocus: true, host: 'g1' });
    // A Role Focus (the `focus` Item type) is not a magical focus, whatever its flags.
    const roleFocus = item('focus', 'rf', { flags: { essence20: { sorcerousFocus: { isFocus: true } } } });
    expect(isSorcerousFocus(roleFocus)).toBe(false);
    const actor = actorWith([roleFocus, focusItem('f1')]);
    expect(sorcerousFoci(actor).map(f => f.id)).toEqual(['f1']);
  });

  test('its Use buttons validate, and a one-use focus has no replacement ritual', () => {
    const rules = focusUseRules({});
    expect(rules.map(r => r.steps.map(s => s.do).join(','))).toEqual(['setToggle,chat', 'spend,readySorcerousFocus,chat', 'setToggle,chat', 'roll']);
    expect(rules[3].steps[0]).toMatchObject({ skill: 'performance', dif: 15 });
    expect(focusUseRules({ oneUse: true })).toHaveLength(3);
    for (const rule of [...rules, ...focusGateRules({ perScene: true, key: 'k' })]) {
      expect(validateRule(rule)).toEqual([]);
    }
  });

  test('is ready unless lost, destroyed, or its weapon / armor is gone or unequipped', () => {
    const sword = item('weapon', 'w1', { system: { equipped: true } });
    const focus = focusItem('f1', { host: 'w1' });
    const actor = actorWith([sword, focus]);
    expect(focusProblem(focus)).toBe(null);
    sword.system.equipped = false;
    expect(focusProblem(focus)).toBe('notWielded');
    sword.system.equipped = true;
    focus.flags.essence20.rules.toggles.lost = true;
    expect(focusProblem(focus)).toBe('lost');
    focus.flags.essence20.rules.toggles.destroyed = true;
    expect(focusProblem(focus)).toBe('destroyed');
    actor.items.contents.splice(0, 1);
    focus.flags.essence20.rules.toggles = {};
    expect(focusProblem(focus)).toBe('hostMissing');
    // A focus that's an object of its own needs no host.
    expect(focusProblem(focusItem('f2'))).toBe(null);
  });

  test('a Power that needs a focus follows it; a Power with no focus is always ready', () => {
    const focus = focusItem('f1', {}, { lost: true });
    const needing = item('power', 'p1', { flags: { essence20: { sorcerousFocus: { requires: 'f1' } } } });
    const plain = item('power', 'p2');
    actorWith([focus, needing, plain]);
    expect(focusFor(needing)).toBe(focus);
    expect(focusReady(needing)).toBe(false);
    expect(focusReady(plain)).toBe(true);
    focus.flags.essence20.rules.toggles.lost = false;
    expect(focusReady(needing)).toBe(true);
    // The rules tag reads the same.
    expect(evaluate(['rule:sorcerousFocusReady'], contextFor({ self: needing.parent, ruleItem: needing }))).toBe(true);
  });

  test('the Power it grants is once per scene, gated, and not counted against the budget', () => {
    const data = grantedPowerData(sorceryPowerData({ base: 'targeting', damageType: 'element', shape: 'none' }), 'f1');
    expect(data.system).toMatchObject({ usesInterval: 'perScene', usesPer: 1 });
    const [gate, used] = data.system.rules;
    expect(gate).toMatchObject({ type: 'PowerGate', when: ['rule:sorcerousFocusReady', 'not:self:limitUsed:sorcerousFocus-f1:scene'] });
    expect(used).toMatchObject({ event: 'powerUsed', limit: { per: 'scene', key: 'sorcerousFocus-f1' } });
    expect(countsAgainstBudget(data)).toBe(false);
    const needing = requiringPowerData(sorceryPowerData({ base: 'mimic', focus: true }), 'f1');
    expect(countsAgainstBudget(needing)).toBe(true);
    expect(needing.system.rules[0].when).toEqual(['rule:sorcerousFocusReady']);
  });

  test('a basic attack is Table 4-1\'s basic attack: 1 Energy damage, Might for melee', () => {
    expect(sorceryPowerData(basicAttackBuild('melee', 'Staff')).system).toMatchObject({ attackSkill: 'might', damageValue: 1, damageType: 'element', powerCost: 1 });
    expect(sorceryPowerData(basicAttackBuild('ranged', 'Staff')).system).toMatchObject({ attackSkill: 'targeting', damageValue: 1 });
  });

  test('a weapon or armor host gains the Sorcerous trait (once); gear does not', async () => {
    const sword = item('weapon', 'w1', { system: { traits: ['sharp'] } });
    expect(await addSorcerousTrait(sword)).toBe(true);
    expect(sword.system.traits).toEqual(['sharp', 'sorcerous']);
    expect(await addSorcerousTrait(sword)).toBe(false);
    expect(hostTakesTrait(item('gear', 'g'))).toBe(false);
    expect(await addSorcerousTrait(item('gear', 'g', { system: {} }))).toBe(false);
  });

  test('summoning or replacing puts it back in hand and re-equips its host', async () => {
    const armor = item('armor', 'a1', { system: { equipped: false } });
    const focus = focusItem('f1', { host: 'a1' }, { lost: true, destroyed: true });
    actorWith([armor, focus]);
    await readyFocus(focus);
    expect(focus.flags.essence20.rules.toggles).toMatchObject({ lost: false, destroyed: true });
    await readyFocus(focus, { destroyed: true });
    expect(focus.flags.essence20.rules.toggles.destroyed).toBe(false);
    expect(armor.system.equipped).toBe(true);
    expect(await readyFocus(item('power', 'x'))).toBe(false);
  });

  test('a one-use focus is used up with its granted Power and the trait it gave; a lasting one is not', async () => {
    const sword = item('weapon', 'w1', { system: { traits: ['sorcerous'] } });
    const focus = focusItem('f1', { host: 'w1', oneUse: true, addedTrait: true });
    const granted = item('power', 'p1', { flags: { essence20: { sorcerousFocus: { requires: 'f1', grantedBy: 'f1' } } } });
    const actor = actorWith([sword, focus, granted]);
    expect(await useFocusFor(granted)).toBe('E20.SorcerousFocusSpentChat');
    expect(actor.items.contents.map(i => i.id)).toEqual(['w1']);
    expect(sword.system.traits).toEqual([]);

    const lasting = focusItem('f2');
    const power = item('power', 'p2', { flags: { essence20: { sorcerousFocus: { requires: 'f2' } } } });
    actorWith([lasting, power]);
    expect(await useFocusFor(power)).toBe(null);
    await removeFocus(item('power', 'nope'));
  });
});

describe('Sorcerous Power builder: trait builds and the focus cap', () => {
  test('a trait build names a weapon or armor of the actor\'s, and has nothing to activate', () => {
    const sword = item('weapon', 'w1');
    const vest = item('armor', 'a1');
    const actor = actorWith([sword, vest]);
    expect(traitTargets(actor, 'traitAttack')).toEqual([sword]);
    expect(traitTargets(actor, 'traitArmor')).toEqual([vest]);
    expect(buildProblem({ base: 'traitAttack', traitItem: 'a1' }, actor)).toBe('E20.O2SorceryNeedWeapon');
    expect(buildProblem({ base: 'traitArmor', traitItem: 'a1' }, actor)).toBe(null);
    expect(sorceryPowerData({ base: 'traitArmor' }).system.canActivate).toBe(false);
    expect(sorceryPowerData({ base: 'targeting', damageType: 'element' }).system.canActivate).toBe(true);
  });

  test('a Power a focus grants costs at most 3 points', () => {
    const actor = actorWith([]);
    const fireball = { base: 'targeting', damageType: 'fire', shape: 'blast', extraDamage: 1 };
    expect(sorceryCost(fireball)).toBe(4);
    expect(buildProblem(fireball, actor, { maxCost: 3 })).toBe('E20.O2SorceryOverFocusCap');
    expect(buildProblem({ base: 'targeting', damageType: 'element' }, actor, { maxCost: 3 })).toBe(null);
  });
});

describe('the Power sheet\'s "needs a magical focus" (Table 4-1: -1 point, never below 1)', () => {
  const sorcerous = (cost, flags = {}, rules = []) => item('power', 'p1', { system: { type: 'sorcerous', powerCost: cost, rules }, flags: { essence20: flags } });

  test('picking a focus takes 1 off and adds the gate; clearing it puts both back', () => {
    const power = sorcerous(3, {}, [{ type: 'Trigger', event: 'powerUsed', steps: [{ do: 'chat' }] }]);
    const picked = focusRequirementChanges(power, 'f1');
    expect(picked).toMatchObject({ 'system.powerCost': 2, 'flags.essence20.sorcerousFocus.requires': 'f1', 'flags.essence20.sorcerousFocus.discounted': true });
    expect(picked['system.rules']).toHaveLength(3);
    expect(picked['system.rules'].filter(isFocusGateRule)).toHaveLength(2);

    const needing = sorcerous(2, { sorcerousFocus: { requires: 'f1', discounted: true } }, picked['system.rules']);
    const cleared = focusRequirementChanges(needing, '');
    expect(cleared).toMatchObject({ 'system.powerCost': 3, 'flags.essence20.sorcerousFocus.requires': null, 'flags.essence20.sorcerousFocus.discounted': false });
    expect(cleared['system.rules']).toEqual([{ type: 'Trigger', event: 'powerUsed', steps: [{ do: 'chat' }] }]);
  });

  test('a 1-point Power stays at 1, and clearing gives back nothing it never took', () => {
    const picked = focusRequirementChanges(sorcerous(1), 'f1');
    expect(picked).toMatchObject({ 'system.powerCost': 1, 'flags.essence20.sorcerousFocus.discounted': false });
    const cleared = focusRequirementChanges(sorcerous(1, { sorcerousFocus: { requires: 'f1', discounted: false } }), null);
    expect(cleared['system.powerCost']).toBeUndefined();
  });

  test('switching focus only moves the requirement; a builder Power keeps its build record in step', () => {
    const switched = focusRequirementChanges(sorcerous(2, { sorcerousFocus: { requires: 'f1', discounted: true } }), 'f2');
    expect(switched['system.powerCost']).toBeUndefined();
    expect(switched['flags.essence20.sorcerousFocus.requires']).toBe('f2');
    // An older build with "needs a focus" ticked already has the -1 in its cost.
    const built = sorcerous(1, { o2SorceryBuild: { base: 'mimic', focus: true } });
    const kept = focusRequirementChanges(built, 'f1');
    expect(kept['system.powerCost']).toBeUndefined();
    expect(kept).toMatchObject({ 'flags.essence20.o2SorceryBuild.focus': true, 'flags.essence20.o2SorceryBuild.focusId': 'f1' });
  });

  test('nothing for a focus, a Power a focus grants, a Grid Power, or no change', () => {
    expect(focusRequirementChanges(focusItem('f1'), 'f2')).toBeNull();
    expect(focusRequirementChanges(sorcerous(2, { sorcerousFocus: { grantedBy: 'f1', requires: 'f1' } }), null)).toBeNull();
    expect(focusRequirementChanges(item('power', 'g', { system: { type: 'grid', powerCost: 2 } }), 'f1')).toBeNull();
    expect(focusRequirementChanges(sorcerous(2), '')).toBeNull();
  });

  test("the sheet offers the owner's foci", () => {
    const power = sorcerous(2, { sorcerousFocus: { requires: 'f1' } });
    const focus = focusItem('f1');
    focus.name = 'Wand';
    actorWith([power, focus]);
    expect(focusPickerContext(power)).toEqual({ requires: 'f1', options: { f1: 'Wand' } });
    expect(focusPickerContext(sorcerous(2))).toBeNull();
  });
});
