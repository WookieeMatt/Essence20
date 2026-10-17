import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A Use rule's `charges` (rules/triggers.mjs#chargesOf): counted on the item, spent by a finished run, shown and set on
 * the sheets; out of charges (or out of uses for its limit) the button stays and pressing it warns. Wrist Communicator
 * (PR CRB p.121) is the first.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ blockedWithoutGm: () => false, needsGmRelay: () => false, relayToGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule, summarizeRule } = await import('./types.mjs');
const { chargesOf, itemCharges, runUse, useAvailable, useSpent } = await import('./triggers.mjs');
const { findExtUse } = await import('../mechanics/item-hooks.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WRIST = JSON.parse(readFileSync(join(ROOT, 'packs', 'prcrbitems/_source/Wrist_Communicator_W7nXP8pOQaDJmZbT.json'), 'utf8'));

const getPath = (object, path) => path.split('.').reduce((at, key) => at?.[key], object);
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

function makeActor(rules) {
  const actor = {
    id: 'a1', uuid: 'Actor.a1', name: 'Ranger', type: 'playerCharacter', flags: { essence20: {} }, system: { skills: {} }, statuses: new Set(),
    getFlag(scope, key) {
      return getPath(this.flags[scope], key);
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
  };
  const item = {
    id: 'w1', uuid: 'Actor.a1.Item.w1', name: 'Wrist Communicator', type: 'gear', parent: actor, flags: { essence20: {} }, system: { rules },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
  };
  const items = [item];
  actor.items = { contents: items, get: id => items.find(one => one.id == id), find: fn => items.find(fn), filter: fn => items.filter(fn), some: fn => items.some(fn), [Symbol.iterator]: () => items[Symbol.iterator]() };
  rebuildIndex(actor);
  return { actor, item };
}

const pay = async () => true;
const chatOnly = label => ({ type: 'Use', label, charges: 3, steps: [{ do: 'chat', text: 'Teleported.' }] });

beforeEach(() => {
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] }, actors: { contents: [] }, settings: { get: () => 1 },
    i18n: { localize: key => key, format: (key, data) => `${key} ${JSON.stringify(data)}`, has: () => false },
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
});

test("Wrist Communicator's Use validates and reads as 3 charges", () => {
  const rule = WRIST.system.rules[0];
  expect(rule.charges).toBe(3);
  expect(validateRule(rule)).toEqual([]);
  expect(summarizeRule(rule)).toContain('3 charges (back on a rest)');
});

test('a finished Use spends a charge and says how many are left', async () => {
  const { item } = makeActor([chatOnly('Teleport')]);
  expect(itemCharges(item)).toEqual({ max: 3, used: 0, left: 3 });
  const card = await runUse(item, pay);
  expect(card).toContain('Teleported.');
  expect(card).toContain('E20.Rules.UseChargesLeft {"left":2,"max":3}');
  expect(item.flags.essence20.chargesUsed).toBe(1);
  expect(itemCharges(item).left).toBe(2);
});

test('out of charges: the button stays, pressing it warns and does nothing', async () => {
  const { item } = makeActor([chatOnly('Teleport')]);
  item.flags.essence20.chargesUsed = 3;
  const [{ rule }] = [{ rule: item.system.rules[0] }];
  expect(useAvailable(item, rule, 0)).toBe(false);
  expect(useSpent(item, rule, 0)).toBe('charges');
  expect(findExtUse(item).canUse(item)).toBe(true);
  expect(await runUse(item, pay)).toBeNull();
  expect(ui.notifications.warn).toHaveBeenCalledWith(expect.stringContaining('E20.Rules.UseNoCharges'));
  expect(item.flags.essence20.chargesUsed).toBe(3);
});

test('a cancelled run spends no charge; a charge set by hand (more than the max) reads as none left', async () => {
  const { item } = makeActor([{ type: 'Use', charges: 3, steps: [{ do: 'require', check: ['self:data:system.missing>0'], message: 'no' }] }]);
  await runUse(item, pay);
  expect(item.flags.essence20.chargesUsed ?? 0).toBe(0);
  item.flags.essence20.chargesUsed = 9;
  expect(chargesOf(item, item.system.rules[0])).toEqual({ max: 3, used: 3, left: 0 });
});

test('a Use without charges has none to show; a static condition that fails still hides the button', () => {
  const { item } = makeActor([{ type: 'Use', when: ['self:inCombat'], steps: [{ do: 'chat', text: 'x' }] }]);
  expect(itemCharges(item)).toBeNull();
  const { item: gated } = makeActor([{ type: 'Use', charges: 2, when: ['self:data:system.missing>0'], steps: [{ do: 'chat', text: 'x' }] }]);
  gated.flags.essence20.chargesUsed = 2;
  expect(useSpent(gated, gated.system.rules[0], 0)).toBeNull();
});
