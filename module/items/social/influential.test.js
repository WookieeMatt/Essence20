import { jest } from '@jest/globals';
import { getInfluentialShiftUp } from './influential.mjs';

const INFLUENTIAL_ID = "Compendium.essence20.gi_joe_crb.Item.TyQoZb2RTZWUwbpu";
const FIELD_ID = "Compendium.essence20.gi_joe_crb.Item.qHLeKSMin2F19O3C";

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

function makeToken({ actor, disposition = 1 } = {}) {
  return { actor, document: { disposition }, center: {} };
}

function makeRoller(disposition = 1) {
  const token = makeToken({ actor: null, disposition });
  const actor = { id: 'roller', getActiveTokens: jest.fn(() => [token]) };
  token.actor = actor;
  return actor;
}

function makeInfluentialAlly({ field = 'science', hasPerk = true } = {}) {
  const items = [];
  if (hasPerk) {
    items.push({ type: 'perk', flags: { core: { sourceId: INFLUENTIAL_ID } } });
  }

  if (field) {
    items.push({ type: 'perk', flags: { core: { sourceId: FIELD_ID } }, system: { choice: field } });
  }

  return { id: 'ally', items };
}

describe("getInfluentialShiftUp", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
    canvas.grid.measurePath.mockReset();
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });
  });

  test("grants +1 when a nearby Influential ally's Field matches the rolled skill", () => {
    const roller = makeRoller();
    const ally = makeInfluentialAlly({ field: 'science' });
    canvas.tokens.placeables = [roller.getActiveTokens()[0], makeToken({ actor: ally })];

    expect(getInfluentialShiftUp(roller, 'science')).toBe(1);
  });

  test("doesn't apply when the ally's Field doesn't match the rolled skill", () => {
    const roller = makeRoller();
    const ally = makeInfluentialAlly({ field: 'technology' });
    canvas.tokens.placeables = [roller.getActiveTokens()[0], makeToken({ actor: ally })];

    expect(getInfluentialShiftUp(roller, 'science')).toBe(0);
  });

  test("doesn't apply without the Influential Perk, even with a matching Field", () => {
    const roller = makeRoller();
    const ally = makeInfluentialAlly({ field: 'science', hasPerk: false });
    canvas.tokens.placeables = [roller.getActiveTokens()[0], makeToken({ actor: ally })];

    expect(getInfluentialShiftUp(roller, 'science')).toBe(0);
  });

  test("doesn't apply beyond 30 feet", () => {
    canvas.grid.measurePath.mockReturnValue({ distance: 31 });
    const roller = makeRoller();
    const ally = makeInfluentialAlly({ field: 'science' });
    canvas.tokens.placeables = [roller.getActiveTokens()[0], makeToken({ actor: ally })];

    expect(getInfluentialShiftUp(roller, 'science')).toBe(0);
  });

  test("doesn't apply to an enemy Influential holder", () => {
    const roller = makeRoller(1);
    const ally = makeInfluentialAlly({ field: 'science' });
    canvas.tokens.placeables = [roller.getActiveTokens()[0], makeToken({ actor: ally, disposition: -1 })];

    expect(getInfluentialShiftUp(roller, 'science')).toBe(0);
  });

  test("doesn't stack beyond +1 with two qualifying allies nearby", () => {
    const roller = makeRoller();
    const ally1 = makeInfluentialAlly({ field: 'science' });
    const ally2 = makeInfluentialAlly({ field: 'science' });
    canvas.tokens.placeables = [
      roller.getActiveTokens()[0], makeToken({ actor: ally1 }), makeToken({ actor: ally2 }),
    ];

    expect(getInfluentialShiftUp(roller, 'science')).toBe(1);
  });

  test("returns 0 without a rolled skill (e.g. a flat DIF check)", () => {
    const roller = makeRoller();
    const ally = makeInfluentialAlly({ field: 'science' });
    canvas.tokens.placeables = [roller.getActiveTokens()[0], makeToken({ actor: ally })];

    expect(getInfluentialShiftUp(roller, null)).toBe(0);
  });

  test("returns 0 with no nearby allies at all", () => {
    const roller = makeRoller();
    canvas.tokens.placeables = [roller.getActiveTokens()[0]];

    expect(getInfluentialShiftUp(roller, 'science')).toBe(0);
  });
});
