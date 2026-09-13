import { jest } from '@jest/globals';
import { isImmuneToCondition } from './condition-immunity.mjs';

const CAUTION_ID = "Compendium.essence20.gi_joe_crb.Item.pJcXVybdqjcWHpJq";
const AMBUSH_MASTER_ID = "Compendium.essence20.gi_joe_crb.Item.UYaPTaAQH5SDXxnz";
const BATTLEFIELD_TITAN_ID = "Compendium.essence20.gi_joe_crb.Item.xsFS0pGQFx1w2qTd";
const SHAPE_SHIFTER_ID = "Compendium.essence20.tf_crb.Item.Um9sT730VGgHPxLh";
const INDOMITABLE_ID = "Compendium.essence20.tf_crb.Item.CXnb6i4d7XhkhFNr";
const DIG_IN_ID = "Compendium.essence20.decepticon_directive.Item.9tIkV50YiO3xqxvi";
const RIGHTEOUS_HEART_ID = "Compendium.essence20.pr_crb.Item.mOgEBZIbiaT07eAq";
const MIND_OF_NO_MIND_ID = "Compendium.essence20.intercontinental_adventures.Item.edU8dyL3poLU6IuM";
const GET_LOW_ID = "Compendium.essence20.technorganic_secrets.Item.rEoZEFQR2puQxpIW";

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

function makeActor(perkIds = []) {
  const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
  return { items };
}

describe("isImmuneToCondition (Caution, Bodyguard Focus, 17th level)", () => {
  test.each(['blinded', 'deafened', 'frightened', 'immobilized', 'restrained', 'stunned'])(
    "true for %s with the Perk", (statusId) => {
      expect(isImmuneToCondition(makeActor([CAUTION_ID]), statusId)).toBe(true);
    },
  );

  test("false for a Condition not covered by Caution", () => {
    expect(isImmuneToCondition(makeActor([CAUTION_ID]), 'prone')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'frightened')).toBe(false);
  });

  test("false for an actor with unrelated Perks", () => {
    expect(isImmuneToCondition(makeActor(["Compendium.essence20.gi_joe_crb.Item.other"]), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Ambush Master, Door-Kicker Focus, 10th level)", () => {
  test.each(['blinded', 'deafened'])("true for %s with the Perk", (statusId) => {
    expect(isImmuneToCondition(makeActor([AMBUSH_MASTER_ID]), statusId)).toBe(true);
  });

  test("false for a Condition not covered by Ambush Master", () => {
    expect(isImmuneToCondition(makeActor([AMBUSH_MASTER_ID]), 'frightened')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'blinded')).toBe(false);
  });
});

describe("isImmuneToCondition (Shape Shifter, Transformers CRB Triple Changer Focus, 6th level)", () => {
  test("true for prone with the Perk", () => {
    expect(isImmuneToCondition(makeActor([SHAPE_SHIFTER_ID]), 'prone')).toBe(true);
  });

  test("false for a Condition not covered by Shape Shifter (the Maneuver half is a damageType, handled elsewhere)", () => {
    expect(isImmuneToCondition(makeActor([SHAPE_SHIFTER_ID]), 'frightened')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'prone')).toBe(false);
  });
});

describe("isImmuneToCondition (Indomitable, Transformers CRB Wrecker Focus, 17th level)", () => {
  test("true for frightened with the Perk", () => {
    expect(isImmuneToCondition(makeActor([INDOMITABLE_ID]), 'frightened')).toBe(true);
  });

  test("false for a Condition not covered by Indomitable (the Snag-on-Intimidation half is handled in dice.mjs)", () => {
    expect(isImmuneToCondition(makeActor([INDOMITABLE_ID]), 'stunned')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Keep Your Cool, A Jump Through Time General Perk, p.53)", () => {
  const KEEP_YOUR_COOL_ID = "Compendium.essence20.jump_through_time.Item.566NsnD5dccg9uVo";

  test("true for frightened with the Perk", () => {
    expect(isImmuneToCondition(makeActor([KEEP_YOUR_COOL_ID]), 'frightened')).toBe(true);
  });

  test("false for a Condition not covered by Keep Your Cool (the Snag-on-Intimidation half is handled in dice.mjs)", () => {
    expect(isImmuneToCondition(makeActor([KEEP_YOUR_COOL_ID]), 'stunned')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Righteous Heart, PR CRB General Perk, p.98)", () => {
  test("true for frightened with the Perk", () => {
    expect(isImmuneToCondition(makeActor([RIGHTEOUS_HEART_ID]), 'frightened')).toBe(true);
  });

  test("false for a Condition not covered by Righteous Heart (the Resistance-toggle half isn't built)", () => {
    expect(isImmuneToCondition(makeActor([RIGHTEOUS_HEART_ID]), 'stunned')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Mind of No Mind, Factions in Action Vol. 2 Arashikage General Perk, p.9)", () => {
  test("true for frightened with the Perk", () => {
    expect(isImmuneToCondition(makeActor([MIND_OF_NO_MIND_ID]), 'frightened')).toBe(true);
  });

  test("false for a Condition not covered by Mind of No Mind (the Willpower/Alertness halves are handled elsewhere)", () => {
    expect(isImmuneToCondition(makeActor([MIND_OF_NO_MIND_ID]), 'stunned')).toBe(false);
  });

  test("false without the Perk", () => {
    expect(isImmuneToCondition(makeActor(), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Dig In, Decepticon Directive Raider Siegemaster Focus, 10th level) - gated on the toggled stance", () => {
  function makeDigInActor({ perkIds = [], dugIn = false } = {}) {
    const actor = makeActor(perkIds);
    const flagStore = { digInActive: dugIn };
    actor.getFlag = jest.fn((scope, key) => flagStore[key]);
    return actor;
  }

  test("true for prone while holding the Perk AND dug in", () => {
    expect(isImmuneToCondition(makeDigInActor({ perkIds: [DIG_IN_ID], dugIn: true }), 'prone')).toBe(true);
  });

  test("false for prone while holding the Perk but NOT dug in", () => {
    expect(isImmuneToCondition(makeDigInActor({ perkIds: [DIG_IN_ID], dugIn: false }), 'prone')).toBe(false);
  });

  test("false without the Perk, even if the (unrelated) flag happens to be true", () => {
    expect(isImmuneToCondition(makeDigInActor({ dugIn: true }), 'prone')).toBe(false);
  });

  test("false for a Condition not covered by Dig In, even while dug in", () => {
    expect(isImmuneToCondition(makeDigInActor({ perkIds: [DIG_IN_ID], dugIn: true }), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Get Low, Technorganic Secrets Slitherer Origin Benefit, p.43) - gated on Alt Mode", () => {
  function makeGetLowActor({ perkIds = [], isTransformed = false } = {}) {
    const actor = makeActor(perkIds);
    actor.system = { isTransformed };
    return actor;
  }

  test("true for prone while holding the Perk AND in Alt Mode", () => {
    expect(isImmuneToCondition(makeGetLowActor({ perkIds: [GET_LOW_ID], isTransformed: true }), 'prone')).toBe(true);
  });

  test("false for prone while holding the Perk but NOT in Alt Mode", () => {
    expect(isImmuneToCondition(makeGetLowActor({ perkIds: [GET_LOW_ID], isTransformed: false }), 'prone')).toBe(false);
  });

  test("false without the Perk, even in Alt Mode", () => {
    expect(isImmuneToCondition(makeGetLowActor({ isTransformed: true }), 'prone')).toBe(false);
  });

  test("false for a Condition not covered by Get Low, even in Alt Mode", () => {
    expect(isImmuneToCondition(makeGetLowActor({ perkIds: [GET_LOW_ID], isTransformed: true }), 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Bulwark, GI Joe CRB Tank Focus, 17th level) - gated on the toggled stance", () => {
  const BULWARK_ID = "Compendium.essence20.gi_joe_crb.Item.7758n3XWOzhSjdOk";

  function makeBulwarkActor({ perkIds = [], planted = false } = {}) {
    const actor = makeActor(perkIds);
    const flagStore = { bulwarkActive: planted };
    actor.getFlag = jest.fn((scope, key) => flagStore[key]);
    return actor;
  }

  test("true for frightened while holding the Perk AND planted", () => {
    expect(isImmuneToCondition(makeBulwarkActor({ perkIds: [BULWARK_ID], planted: true }), 'frightened')).toBe(true);
  });

  test("false for frightened while holding the Perk but NOT planted", () => {
    expect(isImmuneToCondition(makeBulwarkActor({ perkIds: [BULWARK_ID], planted: false }), 'frightened')).toBe(false);
  });

  test("false without the Perk, even if the (unrelated) flag happens to be true", () => {
    expect(isImmuneToCondition(makeBulwarkActor({ planted: true }), 'frightened')).toBe(false);
  });

  test("false for a Condition not covered by Bulwark, even while planted", () => {
    expect(isImmuneToCondition(makeBulwarkActor({ perkIds: [BULWARK_ID], planted: true }), 'prone')).toBe(false);
  });
});

describe("isImmuneToCondition (Greased Lightning, Knights of Canterlot spell, p.43) - checkFn, not a held Perk", () => {
  function makeGreasedLightningActor({ active = false } = {}) {
    const actor = makeActor();
    const flagStore = { greasedLightningActive: active };
    actor.getFlag = jest.fn((scope, key) => flagStore[key]);
    return actor;
  }

  test.each(['restrained', 'grappled'])("true for %s while the spell is active", (statusId) => {
    expect(isImmuneToCondition(makeGreasedLightningActor({ active: true }), statusId)).toBe(true);
  });

  test("false while inactive, even for a covered Condition", () => {
    expect(isImmuneToCondition(makeGreasedLightningActor({ active: false }), 'restrained')).toBe(false);
  });

  test("false for a Condition not covered by Greased Lightning, even while active", () => {
    expect(isImmuneToCondition(makeGreasedLightningActor({ active: true }), 'prone')).toBe(false);
  });
});

describe("isImmuneToCondition (Calming Words, Enigma of Combination, Counselor Focus, 3rd level) - checkFn, not a held Perk", () => {
  function makeCalmingWordsActor({ active = false } = {}) {
    const actor = makeActor();
    const flagStore = { calmingWordsBuffActive: active };
    actor.getFlag = jest.fn((scope, key) => flagStore[key]);
    return actor;
  }

  test.each(['frightened', 'mesmerized'])("true for %s while the buff is active", (statusId) => {
    expect(isImmuneToCondition(makeCalmingWordsActor({ active: true }), statusId)).toBe(true);
  });

  test("false while inactive, even for a covered Condition", () => {
    expect(isImmuneToCondition(makeCalmingWordsActor({ active: false }), 'frightened')).toBe(false);
  });

  test("false for a Condition not covered by Calming Words, even while active", () => {
    expect(isImmuneToCondition(makeCalmingWordsActor({ active: true }), 'prone')).toBe(false);
  });
});

describe("isImmuneToCondition (Battlefield Titan, Vanguard Focus, 9th level) - aura", () => {
  function makeToken({ actor, disposition = 1 } = {}) {
    return { actor, document: { disposition }, center: {} };
  }

  function makeActorWithToken({ perkIds = [], disposition = 1 } = {}) {
    const actor = makeActor(perkIds);
    const token = makeToken({ actor, disposition });
    actor.getActiveTokens = jest.fn(() => [token]);
    return { actor, token };
  }

  beforeEach(() => {
    canvas.tokens.placeables = [];
    canvas.grid.measurePath.mockReset();
    canvas.grid.measurePath.mockReturnValue({ distance: 0 });
  });

  test.each(['mesmerized', 'frightened'])("the holder is immune to %s themselves", (statusId) => {
    const { actor } = makeActorWithToken({ perkIds: [BATTLEFIELD_TITAN_ID] });
    expect(isImmuneToCondition(actor, statusId)).toBe(true);
  });

  test("an ally within 10 feet of the holder is also immune", () => {
    const { token: titanToken } = makeActorWithToken({ perkIds: [BATTLEFIELD_TITAN_ID] });
    const { actor: allyActor, token: allyToken } = makeActorWithToken();
    canvas.tokens.placeables = [titanToken, allyToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(isImmuneToCondition(allyActor, 'frightened')).toBe(true);
  });

  test("doesn't apply beyond 10 feet", () => {
    const { token: titanToken } = makeActorWithToken({ perkIds: [BATTLEFIELD_TITAN_ID] });
    const { actor: allyActor, token: allyToken } = makeActorWithToken();
    canvas.tokens.placeables = [titanToken, allyToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 15 });

    expect(isImmuneToCondition(allyActor, 'frightened')).toBe(false);
  });

  test("doesn't apply to a hostile token (not an ally)", () => {
    const { token: titanToken } = makeActorWithToken({ perkIds: [BATTLEFIELD_TITAN_ID], disposition: 1 });
    const { actor: enemyActor, token: enemyToken } = makeActorWithToken({ disposition: -1 });
    canvas.tokens.placeables = [titanToken, enemyToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(isImmuneToCondition(enemyActor, 'frightened')).toBe(false);
  });

  test("doesn't cover a Condition outside its own list (e.g. Stunned)", () => {
    const { actor } = makeActorWithToken({ perkIds: [BATTLEFIELD_TITAN_ID] });
    expect(isImmuneToCondition(actor, 'stunned')).toBe(false);
  });

  test("an ally with no nearby Battlefield Titan holder is unaffected", () => {
    const { actor: allyActor, token: allyToken } = makeActorWithToken();
    canvas.tokens.placeables = [allyToken];

    expect(isImmuneToCondition(allyActor, 'frightened')).toBe(false);
  });
});

describe("isImmuneToCondition (Iron Bravado, PR CRB Black Spectrum Modification, p.45) - checkFn, round-scoped flag", () => {
  function makeIronBravadoActor({ active = false } = {}) {
    const actor = makeActor();
    const flagStore = { ironBravadoAttackedThisRound: active };
    actor.getFlag = jest.fn((scope, key) => flagStore[key]);
    return actor;
  }

  test("true for frightened while the post-Attack flag is active", () => {
    expect(isImmuneToCondition(makeIronBravadoActor({ active: true }), 'frightened')).toBe(true);
  });

  test("false while inactive, even for the covered Condition", () => {
    expect(isImmuneToCondition(makeIronBravadoActor({ active: false }), 'frightened')).toBe(false);
  });

  test("false for a Condition not covered by Iron Bravado, even while active", () => {
    expect(isImmuneToCondition(makeIronBravadoActor({ active: true }), 'prone')).toBe(false);
  });
});
