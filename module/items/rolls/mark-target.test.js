import { jest } from '@jest/globals';
import { checkMarkTarget } from './mark-target.mjs';

global.game = { i18n: { localize: key => key }, user: { targets: { first: jest.fn(() => undefined) } } };

/* checkMarkTarget - reads the per-setter markTarget mark the Perk's Use rule leaves (rules/conv15-banked.test.js). */
const scout = (flags = {}) => ({ id: 'scout', uuid: 'Actor.scout', getFlag: jest.fn((scope, key) => flags[key]) });
const markedBy = (actor, mark = {}) => ({ uuid: 'Actor.target1', flags: { essence20: { ruleMarks: { [`markTarget--${actor.id}`]: { by: actor.uuid, until: null, stamp: null, ...mark } } } } });

describe("checkMarkTarget", () => {
  test("true for a creature carrying the actor's own markTarget mark", () => {
    const actor = scout();
    expect(checkMarkTarget(actor, markedBy(actor))).toBe(true);
  });

  test("false for another Scout's mark, an unmarked target, or no target", () => {
    const actor = scout();
    const other = { id: 'other', uuid: 'Actor.other' };
    expect(checkMarkTarget(actor, markedBy(other))).toBe(false);
    expect(checkMarkTarget(actor, { uuid: 'Actor.someoneElse' })).toBe(false);
    expect(checkMarkTarget(actor, null)).toBe(false);
    expect(checkMarkTarget(actor, { uuid: undefined })).toBe(false);
  });

  test("false once the mark has run out (a scene-long mark from an earlier scene)", () => {
    const actor = scout();
    expect(checkMarkTarget(actor, markedBy(actor, { until: 'scene', stamp: { epoch: 0 } }))).toBe(false);
  });
});

describe("Mark Everybot (Transformers CRB, Scout, 18th level, p.85)", () => {
  test("with its window live, ANY target counts", () => {
    const actor = scout({ markEverybotUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 } });
    expect(checkMarkTarget(actor, { uuid: 'Actor.anyoneAtAll' })).toBe(true);
  });

  test("doesn't apply before Mark Everybot has been used", () => {
    expect(checkMarkTarget(scout(), { uuid: 'Actor.anyoneAtAll' })).toBe(false);
  });
});
