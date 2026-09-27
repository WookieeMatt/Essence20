import { jest } from '@jest/globals';
import {
  declareDecepticonNemesis, isDecepticonNemesis, isNemesisInScene,
} from './nemesis-decepticon.mjs';

global.game = { i18n: { localize: (k) => k }, user: { targets: { first: jest.fn() } } };
global.ui = { notifications: { warn: jest.fn() } };
global.fromUuidSync = jest.fn();

function makeActor({ flag } = {}) {
  return {
    getFlag: jest.fn((scope, key) => (key === 'decepticonNemesisUuid' ? flag : undefined)),
    setFlag: jest.fn(),
  };
}

beforeEach(() => {
  game.user.targets.first.mockReset();
  ui.notifications.warn.mockReset();
  fromUuidSync.mockReset();
});

describe("declareDecepticonNemesis", () => {
  test("banks the targeted actor's uuid", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue({ actor: { uuid: 'Actor.target1' } });

    expect(await declareDecepticonNemesis(actor)).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'decepticonNemesisUuid', 'Actor.target1');
  });

  test("warns and returns false without a target", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);

    expect(await declareDecepticonNemesis(actor)).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("isDecepticonNemesis", () => {
  test("true when the target's uuid matches the banked one", () => {
    const actor = makeActor({ flag: 'Actor.target1' });
    expect(isDecepticonNemesis(actor, { uuid: 'Actor.target1' })).toBe(true);
  });

  test("false when nothing is banked, or the uuids differ", () => {
    expect(isDecepticonNemesis(makeActor(), { uuid: 'Actor.target1' })).toBe(false);
    expect(isDecepticonNemesis(makeActor({ flag: 'Actor.target1' }), { uuid: 'Actor.other' })).toBe(false);
  });
});

describe("isNemesisInScene", () => {
  test("true when the declared nemesis has an active token", () => {
    const actor = makeActor({ flag: 'Actor.target1' });
    fromUuidSync.mockReturnValue({ getActiveTokens: () => [{ id: 'tok1' }] });
    expect(isNemesisInScene(actor)).toBe(true);
  });

  test("false without a declared nemesis", () => {
    expect(isNemesisInScene(makeActor())).toBe(false);
  });

  test("false when the declared nemesis has no token on the scene", () => {
    const actor = makeActor({ flag: 'Actor.target1' });
    fromUuidSync.mockReturnValue({ getActiveTokens: () => [] });
    expect(isNemesisInScene(actor)).toBe(false);
  });
});
