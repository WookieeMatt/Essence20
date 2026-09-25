import { actorHasBattleHardened, BATTLE_HARDENED_ID, rollBattleHardenedRefund } from './battle-hardened.mjs';

function makeActor(hasPerk) {
  return {
    items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: BATTLE_HARDENED_ID } } }] : [],
  };
}

describe("actorHasBattleHardened", () => {
  test("true when the actor holds the Perk", () => {
    expect(actorHasBattleHardened(makeActor(true))).toBe(true);
  });

  test("false without it", () => {
    expect(actorHasBattleHardened(makeActor(false))).toBe(false);
  });

  test("true when the actor holds the Decepticon Directive same-named Perk instead", () => {
    const actor = {
      items: [{
        type: 'perk',
        flags: { core: { sourceId: "Compendium.essence20.decepticon_directive.Item.iA8J97GmKb51oumg" } },
      }],
    };
    expect(actorHasBattleHardened(actor)).toBe(true);
  });
});

describe("rollBattleHardenedRefund", () => {
  class FakeRoll {
    constructor() {
      this._total = FakeRoll.nextTotal;
    }
    async evaluate() {
      return this;
    }
    get total() {
      return this._total;
    }
  }

  let originalRoll;
  beforeAll(() => {
    originalRoll = global.Roll;
    global.Roll = FakeRoll;
  });
  afterAll(() => {
    global.Roll = originalRoll;
  });

  test("true on a rolled 4", async () => {
    FakeRoll.nextTotal = 4;
    expect(await rollBattleHardenedRefund()).toBe(true);
  });

  test("false on anything else", async () => {
    FakeRoll.nextTotal = 3;
    expect(await rollBattleHardenedRefund()).toBe(false);
  });
});
