import { jest } from '@jest/globals';
import { canDeclareRelicKeyEdge, consumeRelicKeyEdge, declareRelicKeyEdge, isRelicKeyEdgeActive } from './relic-key.mjs';

global.game = { combat: null };

const RELIC_KEY_ID = "Compendium.essence20.pr_crb.Item.uSlClAv3oJjf54pa";

function makeFeatureItem(sourceId) {
  return { type: 'feature', flags: { core: { sourceId } } };
}

function makeActor({
  type = 'zord', hasRelicKey = true, usedThisEncounter = false, edgeActive = false,
} = {}) {
  const flagStore = {
    relicKeyUsedThisEncounter: usedThisEncounter ? { combatId: 'combat1' } : undefined,
    relicKeyEdgeActive: edgeActive,
  };
  return {
    type,
    items: hasRelicKey ? [makeFeatureItem(RELIC_KEY_ID)] : [],
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn((scope, key, value) => {
      flagStore[key] = value;
    }),
    unsetFlag: jest.fn((scope, key) => {
      delete flagStore[key];
    }),
  };
}

describe("canDeclareRelicKeyEdge", () => {
  test("true for a Zord holding Relic Key, not yet used this scene, with no active grant", () => {
    expect(canDeclareRelicKeyEdge(makeActor())).toBe(true);
  });

  test("false without the Feature", () => {
    expect(canDeclareRelicKeyEdge(makeActor({ hasRelicKey: false }))).toBe(false);
  });

  test("false for a non-Zord actor even if it somehow holds the Feature", () => {
    expect(canDeclareRelicKeyEdge(makeActor({ type: 'playerCharacter' }))).toBe(false);
  });

  test("false once already used this scene", () => {
    game.combat = { id: 'combat1' };
    expect(canDeclareRelicKeyEdge(makeActor({ usedThisEncounter: true }))).toBe(false);
    game.combat = null;
  });

  test("false while a grant is already active and undeclared", () => {
    expect(canDeclareRelicKeyEdge(makeActor({ edgeActive: true }))).toBe(false);
  });
});

describe("declareRelicKeyEdge / isRelicKeyEdgeActive / consumeRelicKeyEdge", () => {
  beforeEach(() => {
    game.combat = { id: 'combat1' };
  });
  afterEach(() => {
    game.combat = null;
  });

  test("declaring sets the active flag and marks the scene used", async () => {
    const actor = makeActor();
    await declareRelicKeyEdge(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'relicKeyEdgeActive', true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'relicKeyUsedThisEncounter', expect.anything());
    expect(isRelicKeyEdgeActive(actor)).toBe(true);
  });

  test("consuming clears the active flag", async () => {
    const actor = makeActor({ edgeActive: true });
    expect(isRelicKeyEdgeActive(actor)).toBe(true);

    await consumeRelicKeyEdge(actor);

    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'relicKeyEdgeActive');
    expect(isRelicKeyEdgeActive(actor)).toBe(false);
  });

  test("isRelicKeyEdgeActive is false with no declaration", () => {
    expect(isRelicKeyEdgeActive(makeActor())).toBe(false);
  });
});
