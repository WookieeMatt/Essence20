import { jest } from '@jest/globals';

/**
 * Round 17, split1 (docs/rules-batches/slSplit117.md): the engine pieces this part added - link scope formedBy,
 * @tokensHolding, DialogSwitch setDie, Defense ignoreArmor lookup and AttackResistance choiceOf / fromMark /
 * consumeMark.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { ruleScaledDamage } = await import('./adapter.mjs');
const { resolveValue } = await import('./formula.mjs');
const { formersOf } = await import('./plugins/zords/formed-by-scope.mjs');
const { tokensHolding } = await import('./plugins/tags/tokens-holding-ref.mjs');
const { ruleSetDie } = await import('./plugins/dialog/switch-set-die.mjs');
const { ruleLookupArmorPoints } = await import('./plugins/combat/lookup-armor-points.mjs');
const { ignoreArmorAdjust } = await import('./plugins/combat/ignore-armor.mjs');
const { ruleResistsAttack } = await import('./plugins/combat/attack-resistance.mjs');

let nextId = 1;

function makeActor(name, rules = [], { type = 'playerCharacter', x = 0, flags = {}, system = {}, items: extra = [] } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, flags: { essence20: { ...flags } }, statuses: new Set(),
    system: { essences: { smarts: { value: 3 } }, defenses: { toughness: { total: 14, armor: 4 } }, ...system },
    update: jest.fn(async function (data) {
      for (const [key, value] of Object.entries(data)) {
        const parts = key.split('.');
        const last = parts.pop();
        const node = parts.reduce((at, part) => (at[part] ??= {}), this);
        if (last.startsWith('-=')) {
          delete node[last.slice(2)];
        } else {
          node[last] = value;
        }
      }
    }),
  };
  actor.uuid = `Actor.${actor.id}`;
  const items = [
    ...(rules.length ? [{ id: `i${nextId++}`, name: `${name}'s item`, type: 'perk', system: { rules }, flags: {} }] : []),
    ...extra.map(data => ({ id: `i${nextId++}`, flags: {}, system: {}, ...data })),
  ];
  for (const item of items) {
    item.parent = actor;
  }

  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  const token = { actor, center: { x, y: 0 }, document: { disposition: 1 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  rebuildIndex(actor);
  return actor;
}

beforeEach(() => {
  global.game = { combat: null, user: { targets: new Set() }, actors: { contents: [] }, i18n: { localize: key => key } };
  global.canvas = undefined;
});

describe('link scope formedBy', () => {
  test('reaches the Megaform whose zord2DefenderTorozord flag names the holder, nothing else', () => {
    const former = makeActor('Ranger', [{ type: 'DamageModifier', label: 'Former bonus', direction: 'dealt', scaled: true, amount: 2, scope: 'formedBy' }]);
    const formed = makeActor('Megaform', [], { type: 'megaform', flags: { zord2DefenderTorozord: former.uuid } });
    const zord = makeActor('Zord', [], { type: 'zord', flags: { zord2DefenderTorozord: former.uuid } });
    global.fromUuidSync = uuid => (uuid == former.uuid ? former : null);
    expect(formersOf(formed)).toEqual([former]);
    expect(formersOf(zord)).toEqual([]);
    const effect = { type: 'weaponEffect', system: { classification: { style: 'melee' } }, flags: {} };
    expect(ruleScaledDamage(formed, null, { item: effect })).toEqual(expect.objectContaining({ amount: 2, sources: ['Former bonus'] }));
    // A formedBy rule doesn't reach its own holder.
    expect(ruleScaledDamage(former, null, { item: effect }).amount).toBe(0);
  });

  test('validates on the rule types a linked scope can carry', () => {
    expect(validateRule({ type: 'DamageModifier', direction: 'dealt', amount: 1, scope: 'formedBy' })).toEqual([]);
    expect(validateRule({ type: 'RollModifier', upshift: 1, scope: 'formedBy' })).toEqual([]);
  });
});

describe('@tokensHolding.<id>.<ft>', () => {
  test('other tokens (any side) within range, centre to centre, holding that compendium entry', () => {
    const holding = { name: 'Thing', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.x.Item.abcdefghijklmnop' } } };
    const me = makeActor('Me', [], { x: 0 });
    const near = makeActor('Near', [], { x: 4, items: [holding] });
    const far = makeActor('Far', [], { x: 6, items: [holding] });
    const plain = makeActor('Plain', [], { x: 1 });
    global.canvas = { tokens: { placeables: [me.token, near.token, far.token, plain.token] }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
    expect(tokensHolding(me, 'abcdefghijklmnop', 5)).toBe(1);
    expect(tokensHolding(me, 'abcdefghijklmnop', 10)).toBe(2);
    expect(resolveValue('min(1, @tokensHolding.abcdefghijklmnop.10)', { actor: me })).toBe(1);
    // My own token never counts, nor does anything off the canvas.
    expect(tokensHolding(near, 'abcdefghijklmnop', 0)).toBe(0);
    global.canvas = undefined;
    expect(tokensHolding(me, 'abcdefghijklmnop', 10)).toBe(0);
  });
});

describe('DialogSwitch setDie', () => {
  test('a ticked switch names the die; unticked or absent, nothing', () => {
    const rules = [{ type: 'DialogSwitch', label: 'Flat d6', setDie: 'd6' }];
    expect(validateRule(rules[0])).toEqual([]);
    expect(validateRule({ type: 'DialogSwitch', label: 'Bad', setDie: 'd7' })).toEqual(['setDie must be a die (d2 ... d20)']);
    const actor = makeActor('Roller', rules);
    const id = `rule-${actor.items.contents[0].id}-0`;
    expect(ruleSetDie(actor, { ext: { [id]: true } })).toBe('d6');
    expect(ruleSetDie(actor, { ext: { [id]: false } })).toBeNull();
    expect(ruleSetDie(makeActor('Plain'), { ext: {} })).toBeNull();
  });
});

describe('Defense ignoreArmor lookup', () => {
  const lookup = { type: 'Defense', defense: 'toughness', mode: 'ignoreArmor', outgoing: true, lookup: true, points: '@actor.system.essences.smarts.value', when: ['roll:switch:k'] };

  test('the biggest lookup rule\'s points for that Defense while its when holds; ignoreArmorAdjust leaves it alone', () => {
    expect(validateRule(lookup)).toEqual([]);
    expect(validateRule({ ...lookup, points: undefined })).toEqual(['lookup goes with mode ignoreArmor and points']);
    const attacker = makeActor('Attacker', [lookup, { ...lookup, points: 1 }]);
    const defender = makeActor('Defender');
    expect(ruleLookupArmorPoints(attacker, defender, 'toughness', { switches: ['k'] })).toBe(3);
    expect(ruleLookupArmorPoints(attacker, defender, 'toughness', { switches: [] })).toBe(0);
    expect(ruleLookupArmorPoints(attacker, defender, 'evasion', { switches: ['k'] })).toBe(0);
    expect(ignoreArmorAdjust(attacker, defender, 'toughness', { switches: ['k'] })).toBe(0);
    // A plain ignoreArmor rule is still the per-attack adjustment it was.
    const plain = makeActor('Plain', [{ ...lookup, lookup: undefined, points: 2 }]);
    expect(ignoreArmorAdjust(plain, defender, 'toughness', { switches: ['k'] })).toBe(-2);
    expect(ruleLookupArmorPoints(plain, defender, 'toughness', { switches: ['k'] })).toBe(0);
  });
});

describe('AttackResistance choiceOf / fromMark / consumeMark', () => {
  test('validation', () => {
    expect(validateRule({ type: 'AttackResistance', choiceOf: 'Compendium.x' })).toEqual([]);
    expect(validateRule({ type: 'AttackResistance', fromMark: 'k', consumeMark: true })).toEqual([]);
    expect(validateRule({ type: 'AttackResistance' })).toEqual(['needs damageTypes, choiceOf or fromMark']);
    expect(validateRule({ type: 'AttackResistance', damageTypes: ['fire'], consumeMark: true })).toEqual(['consumeMark goes with fromMark']);
  });

  test('choiceOf: the chosen type on that item; "energy" is every Energy type', () => {
    const chooser = choice => ({ name: 'Chooser', type: 'perk', system: { choice }, flags: { core: { sourceId: 'Compendium.x.Item.chooser' } } });
    const actor = makeActor('Holder', [{ type: 'AttackResistance', choiceOf: 'Compendium.x.Item.chooser' }], { items: [chooser('sonic')] });
    expect(ruleResistsAttack(actor, 'sonic')).toBe(true);
    expect(ruleResistsAttack(actor, 'fire')).toBe(false);
    const energy = makeActor('Holder', [{ type: 'AttackResistance', choiceOf: 'Compendium.x.Item.chooser' }], { items: [chooser('energy')] });
    expect(['element', 'acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic'].every(type => ruleResistsAttack(energy, type))).toBe(true);
    expect(ruleResistsAttack(energy, 'psychic')).toBe(false);
    expect(ruleResistsAttack(makeActor('Holder', [{ type: 'AttackResistance', choiceOf: 'Compendium.x.Item.chooser' }]), 'sonic')).toBe(false);
  });

  test('fromMark: the mark\'s text; consumeMark takes it off once read, even beside another resisting rule', () => {
    const actor = makeActor('Holder', [
      { type: 'AttackResistance', damageTypes: ['fire'] },
      { type: 'AttackResistance', fromMark: 'banked', consumeMark: true },
    ], { flags: { ruleMarks: { banked: { text: 'fire', until: null } } } });
    expect(ruleResistsAttack(actor, 'cold')).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
    expect(ruleResistsAttack(actor, 'fire')).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'flags.essence20.ruleMarks.-=banked': null });
    const kept = makeActor('Holder', [{ type: 'AttackResistance', fromMark: 'banked' }], { flags: { ruleMarks: { banked: { text: 'fire' } } } });
    expect(ruleResistsAttack(kept, 'fire')).toBe(true);
    expect(ruleResistsAttack(kept, 'fire')).toBe(true);
    expect(kept.update).not.toHaveBeenCalled();
  });
});
