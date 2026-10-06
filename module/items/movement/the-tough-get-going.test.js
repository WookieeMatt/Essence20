import { jest } from '@jest/globals';
import { activateTheToughGetGoing, isTheToughGetGoingActive } from './the-tough-get-going.mjs';

global.game = { combat: null };

function makeActor() {
  const flagStore = {};
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("activateTheToughGetGoing / isTheToughGetGoingActive", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("active for the round it was granted in", async () => {
    game.combat = { round: 2 };
    const actor = makeActor();
    await activateTheToughGetGoing(actor);

    expect(isTheToughGetGoingActive(actor)).toBe(true);
  });

  test("no longer active once the round advances", async () => {
    game.combat = { round: 2 };
    const actor = makeActor();
    await activateTheToughGetGoing(actor);

    game.combat = { round: 3 };
    expect(isTheToughGetGoingActive(actor)).toBe(false);
  });

  test("stays active outside of combat once granted outside of combat", async () => {
    game.combat = null;
    const actor = makeActor();
    await activateTheToughGetGoing(actor);

    expect(isTheToughGetGoingActive(actor)).toBe(true);
  });

  test("false with nothing granted", () => {
    expect(isTheToughGetGoingActive(makeActor())).toBe(false);
  });
});
