import { jest } from '@jest/globals';
import { EXEMPLARY_ID, hasNearbyExemplaryMatch, recordExemplaryRoll } from './exemplary.mjs';

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

function makeActor({ hasPerk = false } = {}) {
  const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: EXEMPLARY_ID } } }] : [];
  return { items, setFlag: jest.fn() };
}

describe("recordExemplaryRoll", () => {
  test("records the rolled skill when the actor holds the Perk", async () => {
    const actor = makeActor({ hasPerk: true });
    await recordExemplaryRoll(actor, 'persuasion');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'exemplaryLastSkill', 'persuasion');
  });

  test("does nothing without the Perk", async () => {
    const actor = makeActor({ hasPerk: false });
    await recordExemplaryRoll(actor, 'persuasion');
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("hasNearbyExemplaryMatch", () => {
  function makeActorToken(disposition = 1) {
    return { document: { disposition }, center: {} };
  }

  function makeAllyToken({ hasPerk = true, lastSkill = 'persuasion', disposition = 1 } = {}) {
    return {
      actor: {
        items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: EXEMPLARY_ID } } }] : [],
        getFlag: jest.fn(() => lastSkill),
      },
      document: { disposition },
      center: {},
    };
  }

  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("true when a nearby ally holds the Perk and last rolled the same skill", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ lastSkill: 'persuasion' })];

    expect(hasNearbyExemplaryMatch(actor, 'persuasion')).toBe(true);
  });

  test("false when the ally's last skill doesn't match", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ lastSkill: 'deception' })];

    expect(hasNearbyExemplaryMatch(actor, 'persuasion')).toBe(false);
  });

  test("false without the Perk on any nearby ally", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ hasPerk: false })];

    expect(hasNearbyExemplaryMatch(actor, 'persuasion')).toBe(false);
  });

  test("false for an enemy holding the Perk, not an ally", () => {
    const actorToken = makeActorToken(1);
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ disposition: -1 })];

    expect(hasNearbyExemplaryMatch(actor, 'persuasion')).toBe(false);
  });
});
