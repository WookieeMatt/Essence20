import { jest } from '@jest/globals';

// target:markedByMe:<key> answers like markedByMe:<key> (it used to fall through to null).
const { contextFor, evaluateTag } = await import('./predicate.mjs');
await import('./plugins/tags/target-marked-by-me.mjs');

test('target:markedByMe reads the other party\'s mark set by this actor', () => {
  const me = { id: 'me', uuid: 'Actor.me' };
  const foe = { id: 'foe', uuid: 'Actor.foe', flags: { essence20: { ruleMarks: { prey: { by: 'Actor.me' } } } } };
  const other = { id: 'x', uuid: 'Actor.x', flags: {} };
  expect(evaluateTag('target:markedByMe:prey', contextFor({ self: me, other: foe }))).toBe(true);
  expect(evaluateTag('target:markedByMe:prey', contextFor({ self: me, other }))).toBe(false);
  expect(evaluateTag('markedByMe:prey', contextFor({ self: me, other: foe }))).toBe(true);
  expect(jest).toBeDefined();
});
