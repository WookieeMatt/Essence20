import { jest } from '@jest/globals';
import {
  digDeepRollSources, KIND, liveMark, markDigDeepSnag, nextTurnWindow,
} from './dig-deep-skill-snag.mjs';

function makeActor({ id = 'a1', items = [], flags = {}, statuses = [], system = {}, type = 'playerCharacter' } = {}) {
  const actor = {
    id, uuid: `Actor.${id}`, type, items, system, flags: { essence20: { ...flags } },
    statuses: new Set(statuses),
    getActiveTokens: () => [],
    setFlag: jest.fn(async (scope, key, value) => {
      actor.flags.essence20[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete actor.flags.essence20[key];
    }),
    toggleStatusEffect: jest.fn(async () => {}),
  };
  return actor;
}

beforeEach(() => {
  global.game = { actors: [], user: { targets: new Set() }, combat: null, i18n: { has: () => false } };
});

describe("nextTurnWindow", () => {
  test("empty out of combat", () => {
    expect(nextTurnWindow(makeActor())).toEqual({});
  });

  test("a creature still to act this round has its next turn this round", () => {
    const actor = makeActor({ id: 'late' });
    game.combat = { id: 'c', round: 2, turn: 0, turns: [{ actor: { id: 'x' } }, { actor: { id: 'late' } }] };
    expect(nextTurnWindow(actor)).toEqual({ combatId: 'c', untilRound: 2, untilTurn: 1 });
  });

  test("a creature that already acted (or is acting) has its next turn next round", () => {
    const actor = makeActor({ id: 'early' });
    game.combat = { id: 'c', round: 2, turn: 1, turns: [{ actor: { id: 'early' } }, { actor: { id: 'x' } }] };
    expect(nextTurnWindow(actor)).toEqual({ combatId: 'c', untilRound: 3, untilTurn: 0 });
  });
});

describe("Dig Deep", () => {
  test("out of combat: a Snag spent by the next Skill Test", async () => {
    const actor = makeActor();
    await markDigDeepSnag(actor, { name: 'Dig Deep' });
    const mark = liveMark(actor, KIND.digDeep);
    expect(mark).toMatchObject({ once: true, label: 'Dig Deep' });

    const { sources, consumes } = digDeepRollSources(actor, null, { rolledSkill: 'might' });
    expect(sources).toContainEqual({ id: 'fix3DigDeep', label: 'Dig Deep', snag: true });
    expect(consumes).toEqual([{ actorUuid: actor.uuid, kind: KIND.digDeep, by: actor.uuid }]);
  });

  test("in combat: every Skill Test until the end of the holder's next turn", async () => {
    const actor = makeActor({ id: 'me' });
    game.combat = { id: 'c', round: 1, turn: 0, turns: [{ actor: { id: 'me' } }, { actor: { id: 'x' } }] };
    await markDigDeepSnag(actor, { name: 'Dig Deep' });

    const first = digDeepRollSources(actor, null, { rolledSkill: 'might' });
    expect(first.sources.some(s => s.id == 'fix3DigDeep')).toBe(true);
    expect(first.consumes).toEqual([]);

    game.combat.round = 2;
    game.combat.turn = 0;
    expect(liveMark(actor, KIND.digDeep)).not.toBeNull();
    game.combat.turn = 1;
    expect(liveMark(actor, KIND.digDeep)).toBeNull();
  });
});
