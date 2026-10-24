import { jest } from '@jest/globals';
import { PRE_ROLL_HOOK, callPreRollHook } from './pre-roll-hook.mjs';

/** The essence20.preRollOptions hook (pre-roll-hook.mjs): a listener may still change a roll before its dialog. */

function roll(extra = {}) {
  return { actor: { name: 'Hero' }, skill: 'initiative', isInitiative: true, dataset: { shiftUp: 1, shiftDown: 0 }, skillDataset: { edge: false, snag: false }, ...extra };
}

test('listeners get the roll, and addSource both changes it and lists it', () => {
  const hooks = { callAll: jest.fn((name, payload) => payload.addSource({ label: 'Heroic Initiative', shiftUp: 1, edge: true })) };
  const input = roll();
  const payload = callPreRollHook(input, hooks);
  expect(hooks.callAll).toHaveBeenCalledWith(PRE_ROLL_HOOK, expect.objectContaining({ skill: 'initiative', isInitiative: true }));
  expect(input.dataset.shiftUp).toBe(2);
  expect(input.skillDataset.edge).toBe(true);
  expect(input.dataset.combatModifierSources).toEqual([
    { id: expect.stringMatching(/^preRoll-/), label: 'Heroic Initiative', shiftUp: 1, shiftDown: 0, edge: true, snag: false },
  ]);
  expect(payload.sources).toBe(input.dataset.combatModifierSources);
});

test("a Snag source, the roll's own id, junk numbers; existing sources are kept", () => {
  const input = roll({ dataset: { shiftUp: '2', shiftDown: 1, combatModifierSources: [{ id: 'rule-a', label: 'Perk' }] } });
  const hooks = { callAll: (name, payload) => payload.addSource({ id: 'mine', label: 'Rough Night', shiftDown: 2, shiftUp: -3, snag: true }) };
  callPreRollHook(input, hooks);
  expect(input.dataset).toMatchObject({ shiftUp: 2, shiftDown: 3 });
  expect(input.skillDataset.snag).toBe(true);
  expect(input.dataset.combatModifierSources.map(source => source.id)).toEqual(['rule-a', 'mine']);
});

test('a throwing listener is logged, not fatal; no Hooks at all is fine', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const throwing = {
    callAll: () => {
      throw new Error('boom');
    },
  };
  expect(() => callPreRollHook(roll(), throwing)).not.toThrow();
  expect(error).toHaveBeenCalled();
  error.mockRestore();
  expect(callPreRollHook(roll(), null).sources).toEqual([]);
});
