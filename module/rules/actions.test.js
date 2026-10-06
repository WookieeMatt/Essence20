import { rebuildIndex } from './index.mjs';
import { actionMatches, costRulesFor } from './actions.mjs';
import { summarizeRule, validateRule } from './types.mjs';
import { extCostRules, registrySnapshot } from '../helpers/extensions.mjs';

let nextId = 1;

function makeActor(rules) {
  const item = { id: `i${nextId++}`, name: 'Runner', type: 'perk', flags: {}, system: { rules } };
  const actor = { id: `a${nextId++}`, type: 'playerCharacter', statuses: new Set(), flags: {}, system: { level: 4 } };
  actor.items = { contents: [item], get: id => (id == item.id ? item : undefined) };
  item.parent = actor;
  rebuildIndex(actor);
  return { actor, item };
}

beforeEach(() => {
  global.game = { combat: null, user: { targets: new Set() } };
});

test('named actions and kinds', () => {
  expect(actionMatches({ action: 'sprint' }, { key: 'sprint' })).toBe(true);
  expect(actionMatches({ action: 'sprint' }, { key: 'hide' })).toBe(false);
  expect(actionMatches({ action: 'conversion' }, { kind: 'conversion' })).toBe(true);
  expect(actionMatches({ action: 'attack' }, { kind: 'item' })).toBe(false);
});

test('ActionCost rules become cost rules in the action economy\'s shape', () => {
  const { actor, item } = makeActor([
    { type: 'ActionCost', label: 'Fleet', action: 'sprint', to: 'free', limit: { per: 'turn', max: '1 + floor(@level / 4)' } },
    { type: 'ActionCost', action: 'drawWeapon', to: 'none', ask: 'Is it a sidearm?' },
    { type: 'ActionCost', action: 'attack', to: 'move', when: ['item:trait:quick'] },
  ]);
  const [fleet, draw, quick] = costRulesFor(actor);
  expect(fleet).toMatchObject({ id: `rule-${item.id}-0`, label: 'Fleet', limit: { window: 'turn', max: 2 } });
  expect(fleet.has(actor)).toBe(true);
  expect(fleet.matches({ key: 'sprint' })).toBe(true);
  expect(fleet.to('move')).toBe('free');
  expect(draw.ask).toBe('Is it a sidearm?');
  expect(draw.limit).toBeUndefined();
  expect(quick.matches({ kind: 'attack', item: { system: { traits: ['quick'] }, flags: {} } })).toBe(true);
  expect(quick.matches({ kind: 'attack', item: { system: { traits: [] }, flags: {} } })).toBe(false);

  expect(extCostRules(actor).map(rule => rule.id)).toEqual(expect.arrayContaining([`rule-${item.id}-0`]));
  expect(extCostRules()).toBe(registrySnapshot().costRules);
});

test('valid and readable', () => {
  expect(validateRule({ type: 'ActionCost', action: 'sprint', to: 'free', limit: { per: 'turn', max: 1 } })).toEqual([]);
  expect(validateRule({ type: 'ActionCost', action: 'fly', to: 'free' })[0]).toMatch(/action must be one of/);
  expect(validateRule({ type: 'ActionCost', action: 'hide', to: 'free', limit: { per: 'mission' } })).toEqual(['limit.per must be turn, scene, encounter or day']);
  expect(summarizeRule({ type: 'ActionCost', action: 'sprint', to: 'free', limit: { per: 'turn', max: 1 } })).toBe('Sprint costs a Free action, 1/turn');
  expect(summarizeRule({ type: 'ActionCost', action: 'drawWeapon', to: 'none' })).toBe('DrawWeapon costs no action');
});
