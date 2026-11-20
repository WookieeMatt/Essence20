import { jest } from '@jest/globals';
import { setCustomLines } from './custom-game-lines.mjs';
import { SYNCED_SWITCHES, onLineRulesChanged, switchChanges, switchesFor } from './line-resync.mjs';

const pc = (role, system = {}, items = []) => ({
  id: 'a1', type: 'playerCharacter',
  system: { canMorph: false, canSpellcast: false, canQualify: false, canTransform: false, ...system },
  items: [...(role ? [{ type: 'role', system: role }] : []), ...items],
});

afterEach(() => {
  setCustomLines([]);
  delete globalThis.game;
});

test('a character with no Role has no switches; flags its type lacks are left out', () => {
  expect(switchesFor(pc(null), '')).toBeNull();
  const npc = { system: { canMorph: false }, items: [{ type: 'role', system: { version: 'powerRangers' } }] };
  expect(switchesFor(npc, '')).toEqual({ canMorph: true });
});

test("the base Role's switches, under the world's line", () => {
  const joe = pc({ version: 'giJoe' });
  expect(switchesFor(joe, '')).toEqual({ canMorph: false, canSpellcast: false, canQualify: true, canTransform: false });
  expect(switchesFor(joe, 'powerRangers')).toEqual({ canMorph: true, canSpellcast: false, canQualify: false, canTransform: false });
  const withOldHand = pc({ version: 'giJoe' }, {}, [{ type: 'role', system: { version: 'powerRangers', isAdditive: true } }]);
  expect(switchesFor(withOldHand, '').canQualify).toBe(true);
});

test('only flags whose switch changed are updated, and only where they differ', () => {
  const joe = pc({ version: 'giJoe' }, { canQualify: true, canMorph: true });
  // G.I. Joe -> Power Rangers: Qualifications go, Morph comes - already ticked by hand, so no update for it.
  expect(switchChanges(joe, switchesFor(joe, 'giJoe'), switchesFor(joe, 'powerRangers'))).toEqual({ 'system.canQualify': false });
  // A switch that didn't change leaves a hand-ticked flag alone.
  expect(switchChanges(joe, switchesFor(joe, 'giJoe'), switchesFor(joe, 'transformers'))).toEqual({ 'system.canQualify': false });
  expect(switchChanges(joe, null, switchesFor(joe, 'giJoe'))).toEqual({});
});

test('transforming switched off stays on while the character holds an Alt Mode', () => {
  setCustomLines([{ label: 'GoBots', family: 'transformers', rules: { canTransform: true } }]);
  const bot = pc({ version: 'transformers' }, { canTransform: true }, [{ type: 'altMode' }]);
  const plain = pc({ version: 'transformers' }, { canTransform: true });
  expect(switchChanges(bot, switchesFor(bot, 'gobots'), switchesFor(bot, 'transformers'))).toEqual({});
  expect(switchChanges(plain, switchesFor(plain, 'gobots'), switchesFor(plain, 'transformers'))).toEqual({ 'system.canTransform': false });
  expect(switchChanges(plain, switchesFor(plain, 'transformers'), switchesFor(plain, 'gobots'))).toEqual({});
});

test('a line change: the active GM updates characters against the last snapshot; other clients only remember', async () => {
  let line = 'giJoe';
  const joe = pc({ version: 'giJoe' }, { canQualify: true });
  joe.update = jest.fn(async changes => Object.assign(joe.system, { canQualify: changes['system.canQualify'] ?? joe.system.canQualify, canMorph: changes['system.canMorph'] ?? joe.system.canMorph }));
  const actors = [joe];
  actors.get = id => actors.find(actor => actor.id == id);
  const world = isSelf => {
    globalThis.game = { actors, users: { activeGM: { isSelf } }, settings: { get: (scope, key) => (key == 'gameLine' ? line : null) } };
  };

  world(true);
  expect(await onLineRulesChanged()).toBe(0); // the first look only remembers
  line = 'powerRangers';
  expect(await onLineRulesChanged()).toBe(1);
  expect(joe.update).toHaveBeenCalledWith({ 'system.canMorph': true, 'system.canQualify': false });
  world(false);
  line = 'giJoe';
  expect(await onLineRulesChanged()).toBe(0);
  expect(joe.update).toHaveBeenCalledTimes(1);
  expect(SYNCED_SWITCHES).toContain('canTransform');
});
