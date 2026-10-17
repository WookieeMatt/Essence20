import { jest } from '@jest/globals';
import { announce } from './public-hooks.mjs';
import { fireOpenRoll, fireTriggers } from '../../rules/triggers.mjs';
import { disembarkZord, postArrival } from '../vehicles/zord-arrival.mjs';

/** The essence20.* hooks other modules listen to (essence20-fx) - docs/ARCHITECTURE.md, "Hooks for modules". */

let callAll;
beforeEach(() => {
  callAll = jest.fn();
  global.Hooks = { ...global.Hooks, callAll };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.canvas = { scene: null };
  game.combat = null;
  game.actors = [];
});

const calls = name => callAll.mock.calls.filter(([hook]) => hook == `essence20.${name}`).map(([, payload]) => payload);

test("announce calls the essence20.<name> hook with the payload", () => {
  const payload = { a: 1 };
  announce('thing', payload);
  expect(callAll).toHaveBeenCalledWith('essence20.thing', payload);
});

test("a listener's error never reaches the game", () => {
  global.Hooks.callAll = () => {
    throw new Error('listener broke');
  };

  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => announce('thing', {})).not.toThrow();
  expect(error).toHaveBeenCalled();
  error.mockRestore();
});

test("every Trigger event is announced once, with its actor, targets and vars - rules or no rules", async () => {
  const actor = { name: 'Red', items: [], system: {} };
  const target = { name: 'Putty' };
  await fireTriggers(actor, 'takesDamage', { damage: { amount: 3 }, targets: [target], vars: { type: 'fire' } });
  const [payload, ...more] = calls('event');
  expect(more).toHaveLength(0);
  expect(payload).toMatchObject({ actor, event: 'takesDamage', damage: { amount: 3 }, targets: [target], vars: { type: 'fire' } });
});

test("a roll with no target is announced too - its Skill, no targets, no outcome", async () => {
  const actor = { name: 'Pony', items: [], system: {} };
  await fireOpenRoll(actor, 14, 'spellcasting');
  expect(calls('rollResolved')).toEqual([expect.objectContaining({ actor, skill: 'spellcasting', isAttack: false, total: 14, targets: [], outcome: null })]);
});

test("a Zord arriving and a Ranger getting out are announced", async () => {
  const ranger = { uuid: 'Actor.r', id: 'r', name: 'Red' };
  const zord = { name: 'Tyranno', uuid: 'Actor.z', isToken: false, getActiveTokens: () => [], getFlag: () => null, flags: {},
    system: { actors: { k1: { uuid: 'Actor.r', vehicleRole: 'driver' } } }, update: jest.fn() };

  await postArrival(zord);
  expect(calls('zordArrived')).toEqual([expect.objectContaining({ zord })]);

  await disembarkZord(zord, ranger);
  expect(calls('zordDisembarked')).toEqual([{ zord, ranger, zordToken: null }]);
});
