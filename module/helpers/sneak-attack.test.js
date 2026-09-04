import { jest } from '@jest/globals';
import {
  checkPredatorSneakAttackEligibility,
  checkSneakAttackEligibility,
  getPredatorSneakAttackDamage,
  hasPredatorSneakAttack,
  isSneakAttackDamageItem,
  markSneakAttackUsed,
} from './sneak-attack.mjs';

const SNEAK_ATTACK_DAMAGE_ID = "Compendium.essence20.gi_joe_crb.Item.Mrmbqza0XxVpKj6U";
const SNEAK_ATTACK_PERK_ID = "Compendium.essence20.gi_joe_crb.Item.vyOjiJFMtryduiFO";
const PREDATOR_FOCUS_ID = "Compendium.essence20.gi_joe_crb.Item.CCUJG5H6eEYRzdBQ";
const EVERY_TRICK_IN_THE_BOOK_ID = "Compendium.essence20.gi_joe_crb.Item.HKv38GCtVdSV2qMH";

global.game = {
  i18n: {
    localize: (key) => key,
  },
  user: {
    targets: {
      first: jest.fn(() => undefined),
    },
  },
  combat: null,
};

global.canvas = {
  grid: {
    measurePath: jest.fn(() => ({ distance: 0 })),
  },
  tokens: {
    placeables: [],
  },
};

/* isSneakAttackDamageItem */
describe("isSneakAttackDamageItem", () => {
  test("false for a null/undefined item", () => {
    expect(isSneakAttackDamageItem(null)).toBe(false);
    expect(isSneakAttackDamageItem(undefined)).toBe(false);
  });

  test("true when flags.core.sourceId matches the known compendium Item", () => {
    const item = { flags: { core: { sourceId: SNEAK_ATTACK_DAMAGE_ID } } };
    expect(isSneakAttackDamageItem(item)).toBe(true);
  });

  test("true when only _stats.compendiumSource matches (no flags.core.sourceId set)", () => {
    const item = { flags: {}, _stats: { compendiumSource: SNEAK_ATTACK_DAMAGE_ID } };
    expect(isSneakAttackDamageItem(item)).toBe(true);
  });

  test("false for any other Role Points Item (e.g. Power Strike)", () => {
    const item = { flags: { core: { sourceId: "Compendium.essence20.pr_crb.Item.v3tBCzRQx5pqNSHo" } } };
    expect(isSneakAttackDamageItem(item)).toBe(false);
  });
});

/* checkSneakAttackEligibility */
describe("checkSneakAttackEligibility", () => {
  const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
  const EVERYTHING_A_WEAPON_ID = `${GI_JOE_CRB}hx4KzTl8iQ8Z22eq`;
  const EVERY_TRICK_IN_THE_BOOK_ID = `${GI_JOE_CRB}HKv38GCtVdSV2qMH`;
  const NEVER_HEARD_IT_COMING_ID = `${GI_JOE_CRB}jIUKR6chHdKQO2vr`;
  const IN_MY_SIGHTS_ID = `${GI_JOE_CRB}MD54SjlTYiCTvmBB`;
  const BALLISTIC_ADVANTAGE_ID = `${GI_JOE_CRB}civSjmz83aDYPwvo`;

  const makeWeaponEffect = () => ({
    flags: { essence20: { parentId: 'weapon1' } },
  });

  // actor.items needs to behave like a real Foundry EmbeddedCollection - array-like (.some(),
  // used by helpers/perks.mjs#actorHasPerk) AND .get()-able (used by this file's own weapon
  // lookup) - a plain array with a .get() method attached satisfies both.
  const makeActor = ({ traits = ['silent'], hasToken = true, perkIds = [] } = {}) => {
    const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
    items.get = jest.fn(id => (id == 'weapon1' ? { system: { traits, range: {} } } : null));

    return {
      items,
      getActiveTokens: jest.fn(() => (hasToken ? [{ center: { x: 0, y: 0 }, document: { disposition: 1 } }] : [])),
    };
  };

  const makeTargetToken = () => ({ center: { x: 100, y: 0 }, document: { disposition: -1 } });

  beforeEach(() => {
    game.user.targets.first.mockReturnValue(undefined);
    game.combat = null;
    canvas.tokens.placeables = [];
    canvas.grid.measurePath.mockReturnValue({ distance: 0 });
  });

  test("ineligible when the weapon has no 'silent' trait", () => {
    const actor = makeActor({ traits: ['sharp'] });
    const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
    expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonNotSilent' });
  });

  test("ineligible when there's no targeted token", () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);
    const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
    expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonNoTarget' });
  });

  test("ineligible when the actor has no token on the scene", () => {
    const actor = makeActor({ hasToken: false });
    game.user.targets.first.mockReturnValue(makeTargetToken());
    const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
    expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonNoTarget' });
  });

  test("ineligible when the target is more than 20 feet away", () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(makeTargetToken());
    canvas.grid.measurePath.mockReturnValue({ distance: 25 });
    const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
    expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonOutOfRange' });
  });

  test("ineligible with no Edge and no ally within 20 feet of the target", () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(makeTargetToken());
    canvas.grid.measurePath.mockReturnValue({ distance: 10 });
    canvas.tokens.placeables = [];
    const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), false);
    expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonNoEdgeNoAlly' });
  });

  test("eligible with no Edge, when an ally token is within 20 feet of the target", () => {
    const actor = makeActor();
    const attackerToken = actor.getActiveTokens()[0];
    game.user.targets.first.mockReturnValue(makeTargetToken());
    const allyToken = { center: {}, document: { disposition: attackerToken.document.disposition }, actor: {} };
    canvas.tokens.placeables = [attackerToken, allyToken];
    // First measurePath call is attacker->target (in range), second is ally->target (in range).
    canvas.grid.measurePath.mockReturnValueOnce({ distance: 10 }).mockReturnValueOnce({ distance: 15 });
    const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), false);
    expect(result).toEqual({ eligible: true, reason: 'E20.SneakAttackReasonEligible' });
  });

  test("eligible with Edge on the attack alone, even with no ally nearby", () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(makeTargetToken());
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });
    const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
    expect(result).toEqual({ eligible: true, reason: 'E20.SneakAttackReasonEligible' });
  });

  test("ineligible when already used this round of the current combat", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 2 }));
    game.combat = { id: 'combat1', round: 2 };
    game.user.targets.first.mockReturnValue(makeTargetToken());
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });
    const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
    expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonAlreadyUsed' });
  });

  test("eligible again once a new combat round starts (stale flag from a prior round)", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 1 }));
    game.combat = { id: 'combat1', round: 2 };
    game.user.targets.first.mockReturnValue(makeTargetToken());
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });
    const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
    expect(result.eligible).toBe(true);
  });

  test("eligible again once a new combat encounter starts (stale flag from a prior combat)", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn(() => ({ combatId: 'oldCombat', round: 3 }));
    game.combat = { id: 'newCombat', round: 1 };
    game.user.targets.first.mockReturnValue(makeTargetToken());
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });
    const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
    expect(result.eligible).toBe(true);
  });

  test("the once-per-round condition isn't enforced outside of combat", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 2 }));
    game.combat = null;
    game.user.targets.first.mockReturnValue(makeTargetToken());
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });
    const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
    expect(result.eligible).toBe(true);
  });

  describe("Everything's a Weapon (12th level)", () => {
    test("a non-silent weapon still qualifies", () => {
      const actor = makeActor({ traits: ['sharp'], perkIds: [EVERYTHING_A_WEAPON_ID] });
      game.user.targets.first.mockReturnValue(makeTargetToken());
      canvas.grid.measurePath.mockReturnValue({ distance: 5 });
      const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
      expect(result.eligible).toBe(true);
    });
  });

  describe("Every Trick in the Book (12th level, target-side immunity)", () => {
    test("the target is never a valid Sneak Attack target", () => {
      const actor = makeActor();
      const targetActor = makeActor({ perkIds: [EVERY_TRICK_IN_THE_BOOK_ID] });
      game.user.targets.first.mockReturnValue({ ...makeTargetToken(), actor: targetActor });
      canvas.grid.measurePath.mockReturnValue({ distance: 5 });
      const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
      expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonTargetImmune' });
    });

    test("doesn't affect a target without the Perk", () => {
      const actor = makeActor();
      const targetActor = makeActor();
      game.user.targets.first.mockReturnValue({ ...makeTargetToken(), actor: targetActor });
      canvas.grid.measurePath.mockReturnValue({ distance: 5 });
      const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
      expect(result.eligible).toBe(true);
    });
  });

  describe("Never Heard It Coming (Infiltrator Focus, 10th level)", () => {
    test("extends the range cap to 60 feet", () => {
      const actor = makeActor({ perkIds: [NEVER_HEARD_IT_COMING_ID] });
      game.user.targets.first.mockReturnValue(makeTargetToken());
      canvas.grid.measurePath.mockReturnValue({ distance: 45 });
      const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
      expect(result.eligible).toBe(true);
    });

    test("still caps at 60 feet", () => {
      const actor = makeActor({ perkIds: [NEVER_HEARD_IT_COMING_ID] });
      game.user.targets.first.mockReturnValue(makeTargetToken());
      canvas.grid.measurePath.mockReturnValue({ distance: 65 });
      const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
      expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonOutOfRange' });
    });
  });

  describe("In My Sights (Sniper Focus, 3rd level)", () => {
    test("a sniper-quality (non-silent) weapon qualifies, range = the weaponEffect's own", () => {
      // Correction: system.range lives on the weaponEffect itself, not the parent weapon (whose
      // own schema has no range field at all) - this test used to set range on the parent weapon
      // mock, silently passing while the real code always fell through to the flat 20ft fallback.
      const actor = makeActor({ traits: ['sniper'], perkIds: [IN_MY_SIGHTS_ID] });
      const weaponEffect = { ...makeWeaponEffect(), system: { range: { long: 150 } } };
      game.user.targets.first.mockReturnValue(makeTargetToken());
      canvas.grid.measurePath.mockReturnValue({ distance: 100 });
      const result = checkSneakAttackEligibility(actor, weaponEffect, true);
      expect(result.eligible).toBe(true);
    });

    test("caps at the weaponEffect's own range - even further beyond it is ineligible", () => {
      const actor = makeActor({ traits: ['sniper'], perkIds: [IN_MY_SIGHTS_ID] });
      const weaponEffect = { ...makeWeaponEffect(), system: { range: { long: 150 } } };
      game.user.targets.first.mockReturnValue(makeTargetToken());
      canvas.grid.measurePath.mockReturnValue({ distance: 200 });
      const result = checkSneakAttackEligibility(actor, weaponEffect, true);
      expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonOutOfRange' });
    });

    test("a sniper weapon without the Perk still caps at 20 feet", () => {
      const actor = makeActor({ traits: ['sniper'] });
      game.user.targets.first.mockReturnValue(makeTargetToken());
      canvas.grid.measurePath.mockReturnValue({ distance: 100 });
      const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
      expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonNotSilent' });
    });
  });

  describe("Ballistic Advantage (Sniper Focus, 17th level)", () => {
    test("no range cap at all with a sniper-quality weapon", () => {
      const actor = makeActor({ traits: ['sniper'], perkIds: [BALLISTIC_ADVANTAGE_ID] });
      game.user.targets.first.mockReturnValue(makeTargetToken());
      canvas.grid.measurePath.mockReturnValue({ distance: 500 });
      const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
      expect(result.eligible).toBe(true);
    });

    test("doesn't help a non-sniper weapon", () => {
      const actor = makeActor({ traits: ['silent'], perkIds: [BALLISTIC_ADVANTAGE_ID] });
      game.user.targets.first.mockReturnValue(makeTargetToken());
      canvas.grid.measurePath.mockReturnValue({ distance: 500 });
      const result = checkSneakAttackEligibility(actor, makeWeaponEffect(), true);
      expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonOutOfRange' });
    });
  });
});

/* markSneakAttackUsed */
describe("markSneakAttackUsed", () => {
  test("records the current combat's id and round on the actor", async () => {
    const actor = { setFlag: jest.fn() };
    game.combat = { id: 'combat1', round: 3 };
    await markSneakAttackUsed(actor);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'sneakAttackLastRound', { combatId: 'combat1', round: 3 });
  });

  test("no-ops outside of combat", async () => {
    const actor = { setFlag: jest.fn() };
    game.combat = null;
    await markSneakAttackUsed(actor);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

/* hasPredatorSneakAttack */
describe("hasPredatorSneakAttack", () => {
  function makeActorWithParent(parentSourceId) {
    const parent = { _id: 'parent1', flags: { core: { sourceId: parentSourceId } } };
    const perkItem = {
      type: 'perk',
      flags: { core: { sourceId: SNEAK_ATTACK_PERK_ID }, essence20: { parentId: 'parent1' } },
    };
    const items = [perkItem, parent];
    items.get = jest.fn(id => items.find(i => i._id == id));

    return { items };
  }

  test("true when granted by the Predator Focus", () => {
    const actor = makeActorWithParent(PREDATOR_FOCUS_ID);
    expect(hasPredatorSneakAttack(actor)).toBe(true);
  });

  test("false when granted by Commando's own base Role grant instead", () => {
    const actor = makeActorWithParent("Compendium.essence20.gi_joe_crb.Item.M2ZYoyByNLkHtLzw");
    expect(hasPredatorSneakAttack(actor)).toBe(false);
  });

  test("false when the actor has no Sneak Attack Perk at all", () => {
    const items = [];
    items.get = jest.fn(() => undefined);
    expect(hasPredatorSneakAttack({ items })).toBe(false);
  });
});

/* getPredatorSneakAttackDamage */
describe("getPredatorSneakAttackDamage", () => {
  test.each([
    [1, 1], [3, 1], [4, 2], [7, 2], [8, 3], [12, 3], [13, 4],
    [16, 4], [17, 5], [19, 5], [20, 6],
  ])("level %i -> %i", (level, expected) => {
    expect(getPredatorSneakAttackDamage(level)).toBe(expected);
  });
});

/* checkPredatorSneakAttackEligibility */
describe("checkPredatorSneakAttackEligibility", () => {
  const weaponEffect = { flags: { essence20: { parentId: 'weapon1' } } };

  function makeActor({ traits = ['silent'] } = {}) {
    const items = [];
    items.get = jest.fn(id => (id == 'weapon1' ? { system: { traits } } : null));
    return { items };
  }

  beforeEach(() => {
    game.user.targets.first.mockReturnValue(undefined);
    game.combat = null;
  });

  test("not eligible without a silent weapon", () => {
    const result = checkPredatorSneakAttackEligibility(makeActor({ traits: ['sharp'] }), weaponEffect);
    expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonNotSilent' });
  });

  test("not eligible against a target with Every Trick in the Book", () => {
    const targetItems = [{ type: 'perk', flags: { core: { sourceId: EVERY_TRICK_IN_THE_BOOK_ID } } }];
    const targetActor = { items: targetItems };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const result = checkPredatorSneakAttackEligibility(makeActor(), weaponEffect);
    expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonTargetImmune' });
  });

  test("not eligible once already used this round", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 2 }));
    game.combat = { id: 'combat1', round: 2 };

    const result = checkPredatorSneakAttackEligibility(actor, weaponEffect);
    expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonAlreadyUsed' });
  });

  test("never auto-eligible even when every checkable condition passes - environment/awareness can't be detected", () => {
    const result = checkPredatorSneakAttackEligibility(makeActor(), weaponEffect);
    expect(result).toEqual({ eligible: false, reason: 'E20.PredatorSneakAttackReasonManual' });
  });
});
