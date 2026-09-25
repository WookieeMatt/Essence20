import { jest } from '@jest/globals';
import { _isCritIsFumble, onApplyDamage } from "./chat.mjs";

const JUST_A_GRAZE_ID = "Compendium.essence20.gi_joe_crb.Item.YXL5dCiLZvzDgZzJ";
const FORTITUDE_ID = "Compendium.essence20.gi_joe_crb.Item.19odrVUOsp4dCiOV";
const EXTRA_PLATES_ID = "Compendium.essence20.gi_joe_crb.Item.xr0PvYXRNAg9cU42";
const DIDNT_EVEN_FEEL_IT_ID = "Compendium.essence20.gi_joe_crb.Item.y7hyuXOuARcKgahl";
const HARD_CORPS_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.IR8Rl7IXn0zKBBXV";
const INVINCIBILITY_THROUGH_INVISIBILITY_ID = "Compendium.essence20.ferocious_fighters.Item.kYYPAxXMpJRMnq6Z";
const RECKLESS_ABANDON_ID = "Compendium.essence20.gi_joe_crb.Item.84d0XTJwKCYMJUgY";
const SUDDEN_DEATH_ID = "Compendium.essence20.gi_joe_crb.Item.bfBFQH3sxny3BfEK";
const IRON_HIDE_ID = "Compendium.essence20.gi_joe_crb.Item.hXtchClOmMDDeWB9";
const INTERPOSE_ID = "Compendium.essence20.gi_joe_crb.Item.srCQjZFTPhm2bK3D";
const BODY_SHIELD_ID = "Compendium.essence20.gi_joe_crb.Item.CBfLvmIWdbLuucts";
const FE_BURN_ID = "Compendium.essence20.beneath_the_helmet.Item.y3RPr4nJWVtCtdil";
const TERROR_ID = "Compendium.essence20.beneath_the_helmet.Item.yBBB0Mi6fr84YcSd";

game.user = { isGM: true };
game.combat = null;
game.actors = { get: jest.fn(() => null), party: game.actors.party };
foundry.applications.api.DialogV2 = { wait: jest.fn() };

/* onApplyDamage */
describe("onApplyDamage", () => {
  function makeTarget({
    perkIds = [], health = 10, armor = [], attackedFlag = undefined, didntEvenFeelItFlag = undefined,
    hardCorpsFlag = undefined, recklessAbandonActive = false, threatLevel = undefined,
    disposition = 1, groundMovement = 30, isMorphed = false, terrorAvailable = undefined,
    invincibilityThroughInvisibilityFlag = undefined, isSurprised = false,
  } = {}) {
    const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
    items.documentsByType = { armor };
    // A stable token (not recreated per call) - see interpose.test.js's own identical note on
    // why getNearbyAllyTokens' self-exclusion needs reference equality to hold across calls.
    const token = { document: { disposition, update: jest.fn() }, center: { distance: 0 } };

    let getBaseRolePoints = jest.fn(() => null);
    if (recklessAbandonActive) {
      getBaseRolePoints = () => ({ flags: { core: { sourceId: RECKLESS_ABANDON_ID } }, system: { isActive: true } });
    } else if (terrorAvailable !== undefined) {
      getBaseRolePoints = () => ({ system: { resource: { value: terrorAvailable, max: 10 } }, update: jest.fn() });
    }

    return {
      name: 'Target',
      items,
      system: {
        health: { value: health }, immunities: {}, threatLevel, movement: { ground: { total: groundMovement } },
        isMorphed, image: { morphed: null, unmorphed: null },
      },
      statuses: new Set(isSurprised ? ['surprised'] : []),
      getActiveTokens: jest.fn(() => [token]),
      update: jest.fn(),
      getFlag: jest.fn((scope, key) => {
        if (scope != 'essence20') {
          return undefined;
        }

        if (key == 'extraPlatesLastTurn') {
          return attackedFlag;
        }

        if (key == 'didntEvenFeelItThisEncounter') {
          return didntEvenFeelItFlag;
        }

        if (key == 'hardCorpsUsedThisEncounter') {
          return hardCorpsFlag;
        }

        if (key == 'invincibilityThroughInvisibilityUsedThisEncounter') {
          return invincibilityThroughInvisibilityFlag;
        }

        return undefined;
      }),
      setFlag: jest.fn(),
      unsetFlag: jest.fn(),
      _getBaseRolePoints: getBaseRolePoints,
    };
  }

  function armorItem({ equipped = true, classification = 'heavy' } = {}) {
    return { system: { equipped, classification } };
  }

  function makeButton(overrides = {}) {
    return {
      dataset: {
        targetUuid: 'Actor.target1',
        damage: '5',
        damageType: 'blunt',
        key: 'msg1:base',
        ...overrides,
      },
      disabled: false,
    };
  }

  function makeMessage({ speaker = {}, rolls = undefined } = {}) {
    return {
      getFlag: jest.fn(() => undefined),
      setFlag: jest.fn(),
      speaker,
      rolls,
    };
  }

  function makeAttacker({ perkIds = [], level = 20, usedSuddenDeathFlag = undefined } = {}) {
    const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));

    return {
      name: 'Attacker',
      items,
      system: { level },
      getFlag: jest.fn((scope, key) => (
        scope == 'essence20' && key == 'suddenDeathThisEncounter' ? usedSuddenDeathFlag : undefined
      )),
      setFlag: jest.fn(),
    };
  }

  // Places targetActor and allyActor on a scene distanceFeet apart, sharing a Disposition -
  // the minimal canvas.tokens/canvas.grid fixture findEligibleProtector() (helpers/interpose.mjs)
  // needs, same technique interpose.test.js's own setScene() establishes.
  function setNearbyAlly(targetActor, allyActor, distanceFeet) {
    const targetToken = targetActor.getActiveTokens()[0];
    const allyToken = allyActor.getActiveTokens()[0];
    targetToken.actor = targetActor;
    allyToken.actor = allyActor;
    targetToken.center = { distance: distanceFeet };
    allyToken.center = { distance: distanceFeet };

    global.canvas = {
      tokens: { placeables: [targetToken, allyToken] },
      grid: { measurePath: jest.fn(([otherCenter]) => ({ distance: otherCenter.distance ?? 0 })) },
    };
  }

  let originalCanvas;

  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
    originalCanvas = global.canvas;
    global.canvas = undefined;
  });

  afterEach(() => {
    global.canvas = originalCanvas;
  });

  test("applies damage as normal for a target without Just a Graze", async () => {
    const target = makeTarget();
    fromUuid.mockResolvedValue(target);

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("caps damage to 1 when the GM confirms Just a Graze", async () => {
    const target = makeTarget({ perkIds: [JUST_A_GRAZE_ID] });
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');
    game.combat = { id: 'combat1', round: 1 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 9 }); // only 1 damage applied
    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'justAGrazeLastRound', expect.anything());
    game.combat = null;
  });

  test("applies full damage when the GM cancels the Just a Graze prompt", async () => {
    const target = makeTarget({ perkIds: [JUST_A_GRAZE_ID] });
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    expect(target.setFlag).not.toHaveBeenCalledWith('essence20', 'justAGrazeLastRound', expect.anything());
  });

  test("doesn't prompt when the incoming damage is already 1 or less", async () => {
    const target = makeTarget({ perkIds: [JUST_A_GRAZE_ID] });
    fromUuid.mockResolvedValue(target);

    await onApplyDamage(makeMessage(), makeButton({ damage: '1' }));

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 9 });
  });

  test("doesn't prompt again once already used this round", async () => {
    const target = makeTarget({ perkIds: [JUST_A_GRAZE_ID] });
    target.getFlag = jest.fn((scope, key) => (key == 'justAGrazeLastRound' ? { combatId: 'combat1', round: 1 } : undefined));
    game.combat = { id: 'combat1', round: 1 };
    fromUuid.mockResolvedValue(target);

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    game.combat = null;
  });

  test("non-GM users are refused entirely", async () => {
    game.user.isGM = false;
    const target = makeTarget({ perkIds: [JUST_A_GRAZE_ID] });
    fromUuid.mockResolvedValue(target);

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).not.toHaveBeenCalled();
    game.user.isGM = true;
  });

  test("Interpose redirects the hit to an adjacent ally when the GM confirms", async () => {
    const target = makeTarget();
    const protector = makeTarget({ perkIds: [INTERPOSE_ID], health: 20 });
    protector.name = 'Protector';
    setNearbyAlly(target, protector, 5);
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');

    await onApplyDamage(makeMessage(), makeButton());

    expect(protector.update).toHaveBeenCalledWith({ 'system.health.value': 15 });
    expect(target.update).not.toHaveBeenCalled();
  });

  test("declining the Interpose prompt applies damage to the original target as normal", async () => {
    const target = makeTarget();
    const protector = makeTarget({ perkIds: [INTERPOSE_ID], health: 20 });
    setNearbyAlly(target, protector, 5);
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    expect(protector.update).not.toHaveBeenCalled();
  });

  test("no redirect prompt at all with no eligible protector nearby", async () => {
    const target = makeTarget();
    fromUuid.mockResolvedValue(target);

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
  });

  test("Fe-BURN! halves the damage and deals the other half to a nearby enemy when confirmed", async () => {
    const target = makeTarget({
      perkIds: [FE_BURN_ID, TERROR_ID], isMorphed: true, terrorAvailable: 2, disposition: 1,
    });
    const enemy = makeTarget({ disposition: -1, health: 20 });
    setNearbyAlly(target, enemy, 5);
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');

    await onApplyDamage(makeMessage(), makeButton({ damage: '5' }));

    // 5 damage halved to 2 (floor), the other 3 dealt to the adjacent enemy.
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 8 });
    expect(enemy.update).toHaveBeenCalledWith({ 'system.health.value': 17 });
    // The actor un-Morphed.
    expect(target.update).toHaveBeenCalledWith({ 'system.isMorphed': false });
  });

  test("declining the Fe-BURN! prompt applies the original damage with no retaliation", async () => {
    const target = makeTarget({
      perkIds: [FE_BURN_ID, TERROR_ID], isMorphed: true, terrorAvailable: 2, disposition: 1,
    });
    const enemy = makeTarget({ disposition: -1, health: 20 });
    setNearbyAlly(target, enemy, 5);
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');

    await onApplyDamage(makeMessage(), makeButton({ damage: '5' }));

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    expect(enemy.update).not.toHaveBeenCalled();
    expect(target.update).not.toHaveBeenCalledWith({ 'system.isMorphed': false });
  });

  test("no Fe-BURN! prompt without any accrued Terror", async () => {
    const target = makeTarget({ perkIds: [FE_BURN_ID, TERROR_ID], isMorphed: true, terrorAvailable: 0 });
    fromUuid.mockResolvedValue(target);

    await onApplyDamage(makeMessage(), makeButton({ damage: '5' }));

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
  });

  test("no Fe-BURN! prompt while not Morphed", async () => {
    const target = makeTarget({ perkIds: [FE_BURN_ID, TERROR_ID], isMorphed: false, terrorAvailable: 2 });
    fromUuid.mockResolvedValue(target);

    await onApplyDamage(makeMessage(), makeButton({ damage: '5' }));

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
  });

  test("Body Shield marks its own once-per-turn flag once the GM confirms", async () => {
    const target = makeTarget();
    const protector = makeTarget({ perkIds: [BODY_SHIELD_ID], health: 20 });
    setNearbyAlly(target, protector, 5);
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');
    game.combat = { id: 'combat1', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(protector.update).toHaveBeenCalledWith({ 'system.health.value': 15 });
    expect(protector.setFlag).toHaveBeenCalledWith('essence20', 'bodyShieldUsedThisTurn', expect.anything());
    game.combat = null;
  });

  test("a redirected hit still runs the protector's own damage-reduction Perks (Fortitude)", async () => {
    const target = makeTarget();
    const protector = makeTarget({ perkIds: [INTERPOSE_ID, FORTITUDE_ID], health: 20 });
    setNearbyAlly(target, protector, 5);
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');

    await onApplyDamage(makeMessage(), makeButton());

    expect(protector.update).toHaveBeenCalledWith({ 'system.health.value': 16 }); // 5 damage - 1 Fortitude
  });

  test("Fortitude reduces damage by 1, unconditionally, with no prompt", async () => {
    const target = makeTarget({ perkIds: [FORTITUDE_ID] });
    fromUuid.mockResolvedValue(target);

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 6 }); // 5 damage - 1
  });

  test("Fortitude doesn't reduce damage below 0", async () => {
    const target = makeTarget({ perkIds: [FORTITUDE_ID] });
    fromUuid.mockResolvedValue(target);

    await onApplyDamage(makeMessage(), makeButton({ damage: '0' }));

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });

  test("Fortitude applies before Just a Graze, so a 2-damage hit never prompts", async () => {
    const target = makeTarget({ perkIds: [FORTITUDE_ID, JUST_A_GRAZE_ID] });
    fromUuid.mockResolvedValue(target);

    await onApplyDamage(makeMessage(), makeButton({ damage: '2' }));

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 9 }); // 2 - 1 (Fortitude) = 1
  });

  test("Extra Plates reduces damage by 1 while wearing heavy armor", async () => {
    const target = makeTarget({ perkIds: [EXTRA_PLATES_ID], armor: [armorItem({ classification: 'heavy' })] });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 6 }); // 5 damage - 1
    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'extraPlatesLastTurn', { combatId: 'combat1', round: 1, turn: 0 });
    game.combat = null;
  });

  test("Extra Plates also applies with super heavy (ultraHeavy) armor", async () => {
    const target = makeTarget({ perkIds: [EXTRA_PLATES_ID], armor: [armorItem({ classification: 'ultraHeavy' })] });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
    game.combat = null;
  });

  test("Extra Plates doesn't apply without heavy/super heavy armor equipped", async () => {
    const target = makeTarget({ perkIds: [EXTRA_PLATES_ID], armor: [armorItem({ classification: 'light' })] });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    game.combat = null;
  });

  test("Extra Plates doesn't apply to unequipped heavy armor", async () => {
    const target = makeTarget({
      perkIds: [EXTRA_PLATES_ID], armor: [armorItem({ classification: 'heavy', equipped: false })],
    });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    game.combat = null;
  });

  test("Extra Plates doesn't apply again once already used this turn", async () => {
    const target = makeTarget({
      perkIds: [EXTRA_PLATES_ID],
      armor: [armorItem({ classification: 'heavy' })],
      attackedFlag: { combatId: 'combat1', round: 1, turn: 0 },
    });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    game.combat = null;
  });

  test("Extra Plates applies again once it's a new turn", async () => {
    const target = makeTarget({
      perkIds: [EXTRA_PLATES_ID],
      armor: [armorItem({ classification: 'heavy' })],
      attackedFlag: { combatId: 'combat1', round: 1, turn: 0 },
    });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 1 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
    game.combat = null;
  });

  // Outside of combat there's no "turn" to gate on, so - matching Sneak Attack Damage and Just a
  // Graze's own established once-per-round behavior elsewhere in this codebase - the bonus itself
  // still applies every time; only the once-per-turn *exemption* only ever has teeth in combat.
  test("still applies outside of combat, since there's no turn to gate the once-per-turn limit on", async () => {
    const target = makeTarget({ perkIds: [EXTRA_PLATES_ID], armor: [armorItem({ classification: 'heavy' })] });
    fromUuid.mockResolvedValue(target);

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
  });

  test("Hard Corps ignores the damage and banks the debt when the GM confirms", async () => {
    const target = makeTarget({ perkIds: [HARD_CORPS_ID] });
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');
    game.combat = { id: 'combat1', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 10 }); // 0 damage applied
    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'hardCorpsIgnoredDamage', { combatId: 'combat1', amount: 5 });
    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'hardCorpsUsedThisEncounter', { epoch: 1, window: 'encounter', count: 1 });
    game.combat = null;
  });

  test("Hard Corps applies full damage when the GM cancels the prompt", async () => {
    const target = makeTarget({ perkIds: [HARD_CORPS_ID] });
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    game.combat = { id: 'combat1', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    expect(target.setFlag).not.toHaveBeenCalledWith('essence20', 'hardCorpsIgnoredDamage', expect.anything());
    game.combat = null;
  });

  test("Hard Corps doesn't prompt again once already used this combat", async () => {
    const target = makeTarget({ perkIds: [HARD_CORPS_ID], hardCorpsFlag: { epoch: 1, window: 'encounter', count: 1 } });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    game.combat = null;
  });

  test("Invincibility Through Invisibility ignores the first attack outright, with no GM prompt", async () => {
    const target = makeTarget({ perkIds: [INVINCIBILITY_THROUGH_INVISIBILITY_ID] });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 10 }); // 0 damage applied
    expect(target.setFlag).toHaveBeenCalledWith(
      'essence20', 'invincibilityThroughInvisibilityUsedThisEncounter', { epoch: 1, window: 'encounter', count: 1 },
    );
    game.combat = null;
  });

  test("Invincibility Through Invisibility doesn't apply while Surprised, or once already used this combat", async () => {
    const surprised = makeTarget({ perkIds: [INVINCIBILITY_THROUGH_INVISIBILITY_ID], isSurprised: true });
    fromUuid.mockResolvedValue(surprised);
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    await onApplyDamage(makeMessage(), makeButton());
    expect(surprised.update).toHaveBeenCalledWith({ 'system.health.value': 5 });

    const alreadyUsed = makeTarget({
      perkIds: [INVINCIBILITY_THROUGH_INVISIBILITY_ID],
      invincibilityThroughInvisibilityFlag: { epoch: 1, window: 'encounter', count: 1 },
    });
    fromUuid.mockResolvedValue(alreadyUsed);
    await onApplyDamage(makeMessage(), makeButton());
    expect(alreadyUsed.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    game.combat = null;
  });

  test("Didn't Even Feel It reduces damage to 0 when the GM confirms, while Reckless Abandon is active", async () => {
    const target = makeTarget({ perkIds: [DIDNT_EVEN_FEEL_IT_ID], recklessAbandonActive: true });
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');
    game.combat = { id: 'combat1', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 10 }); // 0 damage applied
    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'didntEvenFeelItThisEncounter', { epoch: 1, window: 'encounter', count: 1 });
    game.combat = null;
  });

  test("Didn't Even Feel It applies full damage when the GM cancels the prompt", async () => {
    const target = makeTarget({ perkIds: [DIDNT_EVEN_FEEL_IT_ID], recklessAbandonActive: true });
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    game.combat = { id: 'combat1', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    expect(target.setFlag).not.toHaveBeenCalledWith('essence20', 'didntEvenFeelItThisEncounter', expect.anything());
    game.combat = null;
  });

  test("Didn't Even Feel It doesn't prompt without Reckless Abandon active", async () => {
    const target = makeTarget({ perkIds: [DIDNT_EVEN_FEEL_IT_ID], recklessAbandonActive: false });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    game.combat = null;
  });

  test("Didn't Even Feel It doesn't prompt again once already used this encounter", async () => {
    const target = makeTarget({
      perkIds: [DIDNT_EVEN_FEEL_IT_ID], recklessAbandonActive: true,
      didntEvenFeelItFlag: { epoch: 1, window: 'encounter', count: 1 },
    });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 3, turn: 1 }; // later round, same encounter

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    game.combat = null;
  });

  test("Didn't Even Feel It is available again in a new encounter", async () => {
    const target = makeTarget({
      perkIds: [DIDNT_EVEN_FEEL_IT_ID], recklessAbandonActive: true,
      // A flag left over from an earlier encounter. What makes it stale is now the Scene Clock's
      // encounter counter having moved on, not a different combat id - see helpers/scene-clock.mjs.
      didntEvenFeelItFlag: { epoch: 0, window: 'encounter', count: 1 },
    });
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');
    game.combat = { id: 'newCombat', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
    game.combat = null;
  });

  test("Didn't Even Feel It takes priority over Just a Graze - one prompt, damage goes to 0", async () => {
    const target = makeTarget({
      perkIds: [DIDNT_EVEN_FEEL_IT_ID, JUST_A_GRAZE_ID], recklessAbandonActive: true,
    });
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');
    game.combat = { id: 'combat1', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalledTimes(1);
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
    game.combat = null;
  });

  describe("secondaryDamage (weaponEffect's second damage component)", () => {
    function makeMessageWithSecondary(secondaryDamage, { key = 'Actor.target1:base' } = {}) {
      const message = makeMessage();
      message.flags = {
        essence20: {
          checkResults: [{ targetUuid: 'Actor.target1', secondaryDamage }],
        },
      };

      return [message, key];
    }

    test("applies the secondary damage alongside the main damage, on the same button", async () => {
      const target = makeTarget({ health: 10 });
      fromUuid.mockResolvedValue(target);
      const [message, key] = makeMessageWithSecondary({ type: 'fire', value: 2, base: 1 });

      await onApplyDamage(message, makeButton({ damage: '5', key }));

      // target.update is a stub here (doesn't mutate target.system.health.value between calls),
      // so each applyDamage() call independently subtracts from the same starting Health of 10.
      expect(target.update).toHaveBeenNthCalledWith(1, { 'system.health.value': 5 });
      expect(target.update).toHaveBeenNthCalledWith(2, { 'system.health.value': 8 });
    });

    test("posts the combined applied amount in the confirmation chat message", async () => {
      const target = makeTarget({ health: 10 });
      fromUuid.mockResolvedValue(target);
      const [message, key] = makeMessageWithSecondary({ type: 'fire', value: 2, base: 1 });

      await onApplyDamage(message, makeButton({ damage: '5', key }));

      expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.stringContaining('5 + 2'),
      }));
    });

    test("does nothing extra when the checkResults entry has no secondary damage", async () => {
      const target = makeTarget({ health: 10 });
      fromUuid.mockResolvedValue(target);
      const [message, key] = makeMessageWithSecondary(null);

      await onApplyDamage(message, makeButton({ damage: '5', key }));

      expect(target.update).toHaveBeenCalledTimes(1);
      expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    });

    test("is dropped along with the main damage when the whole attack is negated (Didn't Even Feel It)", async () => {
      const target = makeTarget({ perkIds: [DIDNT_EVEN_FEEL_IT_ID], health: 10, recklessAbandonActive: true });
      fromUuid.mockResolvedValue(target);
      foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');
      const [message, key] = makeMessageWithSecondary({ type: 'fire', value: 2, base: 1 });

      await onApplyDamage(message, makeButton({ damage: '5', key }));

      // Only the main (now-zeroed) damage is applied - the secondary rider never fires a second
      // applyDamage call once the whole attack is negated.
      expect(target.update).toHaveBeenCalledTimes(1);
      expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
    });
  });

  describe("Sudden Death (Blitzer Focus, 20th level, p.98)", () => {
    beforeEach(() => {
      game.combat = { id: 'combat1', round: 1, turn: 0 };
    });

    afterEach(() => {
      game.combat = null;
      game.actors.get.mockReset();
    });

    test("defeats the target instead of dealing damage when the GM confirms", async () => {
      const target = makeTarget({ threatLevel: 15 });
      const attacker = makeAttacker({ perkIds: [SUDDEN_DEATH_ID], level: 20 });
      fromUuid.mockResolvedValue(target);
      game.actors.get.mockReturnValue(attacker);
      foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');

      await onApplyDamage(
        makeMessage({ speaker: { actor: 'attacker1' } }), makeButton({ isMightMelee: 'true' }),
      );

      expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
      expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
      expect(attacker.setFlag).toHaveBeenCalledWith('essence20', 'suddenDeathThisEncounter', { epoch: 1, window: 'encounter', count: 1 });
    });

    test("applies normal damage instead when the GM cancels", async () => {
      const target = makeTarget({ threatLevel: 15 });
      const attacker = makeAttacker({ perkIds: [SUDDEN_DEATH_ID], level: 20 });
      fromUuid.mockResolvedValue(target);
      game.actors.get.mockReturnValue(attacker);
      foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');

      await onApplyDamage(
        makeMessage({ speaker: { actor: 'attacker1' } }), makeButton({ isMightMelee: 'true' }),
      );

      expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
      expect(attacker.setFlag).not.toHaveBeenCalled();
    });

    test("doesn't prompt for a non-Might-melee attack", async () => {
      const target = makeTarget({ threatLevel: 15 });
      const attacker = makeAttacker({ perkIds: [SUDDEN_DEATH_ID], level: 20 });
      fromUuid.mockResolvedValue(target);
      game.actors.get.mockReturnValue(attacker);

      await onApplyDamage(
        makeMessage({ speaker: { actor: 'attacker1' } }), makeButton({ isMightMelee: 'false' }),
      );

      expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
      expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    });

    test("doesn't prompt without the Perk", async () => {
      const target = makeTarget({ threatLevel: 15 });
      const attacker = makeAttacker({ perkIds: [], level: 20 });
      fromUuid.mockResolvedValue(target);
      game.actors.get.mockReturnValue(attacker);

      await onApplyDamage(
        makeMessage({ speaker: { actor: 'attacker1' } }), makeButton({ isMightMelee: 'true' }),
      );

      expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
      expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    });

    test("doesn't prompt when the target's Threat Level is higher than the attacker's level", async () => {
      const target = makeTarget({ threatLevel: 21 });
      const attacker = makeAttacker({ perkIds: [SUDDEN_DEATH_ID], level: 20 });
      fromUuid.mockResolvedValue(target);
      game.actors.get.mockReturnValue(attacker);

      await onApplyDamage(
        makeMessage({ speaker: { actor: 'attacker1' } }), makeButton({ isMightMelee: 'true' }),
      );

      expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
      expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    });

    test("doesn't prompt against a target with no Threat Level at all (e.g. a PC)", async () => {
      const target = makeTarget(); // threatLevel left undefined
      const attacker = makeAttacker({ perkIds: [SUDDEN_DEATH_ID], level: 20 });
      fromUuid.mockResolvedValue(target);
      game.actors.get.mockReturnValue(attacker);

      await onApplyDamage(
        makeMessage({ speaker: { actor: 'attacker1' } }), makeButton({ isMightMelee: 'true' }),
      );

      expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
      expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    });

    test("doesn't prompt again once already used this combat", async () => {
      const target = makeTarget({ threatLevel: 15 });
      const attacker = makeAttacker({
        perkIds: [SUDDEN_DEATH_ID], level: 20, usedSuddenDeathFlag: { epoch: 1, window: 'encounter', count: 1 },
      });
      fromUuid.mockResolvedValue(target);
      game.actors.get.mockReturnValue(attacker);

      await onApplyDamage(
        makeMessage({ speaker: { actor: 'attacker1' } }), makeButton({ isMightMelee: 'true' }),
      );

      expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
      expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    });

    test("is available again in a new combat, despite a stale flag from an earlier one", async () => {
      const target = makeTarget({ threatLevel: 15 });
      const attacker = makeAttacker({
        perkIds: [SUDDEN_DEATH_ID], level: 20, usedSuddenDeathFlag: { epoch: 0, window: 'encounter', count: 1 },
      });
      fromUuid.mockResolvedValue(target);
      game.actors.get.mockReturnValue(attacker);
      foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');

      await onApplyDamage(
        makeMessage({ speaker: { actor: 'attacker1' } }), makeButton({ isMightMelee: 'true' }),
      );

      expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
      expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
    });
  });

  describe("Imperial Machine Mantle (Power Rangers Adventures, p.90)", () => {
    const MANTLE_ID = "Compendium.essence20.power_rangers_adventures.Item.CjYzIg9gVstsE0wg";

    function mantleItem({ broken = false } = {}) {
      return {
        type: 'upgrade',
        flags: { core: { sourceId: MANTLE_ID } },
        getFlag: jest.fn((scope, key) => (scope == 'essence20' && key == 'imperialMachineMantleBroken' ? broken : undefined)),
        setFlag: jest.fn(),
      };
    }

    function makeCritMessage() {
      // A non-d20 die maxed out is enough for _isCritIsFumble to report isCrit - see its own
      // faces != 20 branch.
      return makeMessage({ rolls: [{ dice: [{ faces: 6, values: [6] }] }] });
    }

    test("breaks an intact Mantle when a Critical Success hits the wearer", async () => {
      const target = makeTarget();
      const mantle = mantleItem();
      target.items.push(mantle);
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeCritMessage(), makeButton());

      expect(mantle.setFlag).toHaveBeenCalledWith('essence20', 'imperialMachineMantleBroken', true);
    });

    test("doesn't break the Mantle on a non-Critical hit", async () => {
      const target = makeTarget();
      const mantle = mantleItem();
      target.items.push(mantle);
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeMessage(), makeButton());

      expect(mantle.setFlag).not.toHaveBeenCalled();
    });

    test("no-ops on a Critical Success against a target with no Mantle", async () => {
      const target = makeTarget();
      fromUuid.mockResolvedValue(target);

      await expect(onApplyDamage(makeCritMessage(), makeButton())).resolves.toBeUndefined();
    });

    test("doesn't re-flag an already-broken Mantle", async () => {
      const target = makeTarget();
      const mantle = mantleItem({ broken: true });
      target.items.push(mantle);
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeCritMessage(), makeButton());

      expect(mantle.setFlag).not.toHaveBeenCalled();
    });
  });

  describe("Iron Hide (GI Joe CRB, Vanguard base, 1st level, p.107)", () => {
    function makeIronHideTarget({ perkIds = [IRON_HIDE_ID], health = 5 } = {}) {
      const target = makeTarget({ perkIds, health });
      target._dice = { rollSkill: jest.fn() };
      return target;
    }

    beforeEach(() => {
      game.users = [{ isGM: true, active: true }];
      game.settings = { get: jest.fn(() => 1) };
      game.socket = { emit: jest.fn() };
    });

    afterEach(() => {
      delete game.users;
      delete game.settings;
      delete game.socket;
    });

    test("prompts, spends a Story Point, and triggers the Brawn DIF 15 roll on confirm", async () => {
      const target = makeIronHideTarget();
      fromUuid.mockResolvedValue(target);
      foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');

      await onApplyDamage(makeMessage(), makeButton({ damage: '5' }));

      expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
      expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', expect.objectContaining({
        action: 'spendStoryPoints', amount: 1,
      }));
      expect(target._dice.rollSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          skill: 'brawn', essence: 'strength', dif: '15', isIronHideAttempt: true, ironHideDamage: 5,
        }),
        target,
      );
      // The damage was already applied before the roll's own outcome is known.
      expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
    });

    test("doesn't spend or roll when the GM cancels the prompt", async () => {
      const target = makeIronHideTarget();
      fromUuid.mockResolvedValue(target);
      foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');

      await onApplyDamage(makeMessage(), makeButton({ damage: '5' }));

      expect(game.socket.emit).not.toHaveBeenCalled();
      expect(target._dice.rollSkill).not.toHaveBeenCalled();
    });

    test("doesn't prompt without the Perk", async () => {
      const target = makeIronHideTarget({ perkIds: [] });
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeMessage(), makeButton({ damage: '5' }));

      expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    });

    test("doesn't prompt when the damage wouldn't actually Defeat the target", async () => {
      const target = makeIronHideTarget({ health: 10 });
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeMessage(), makeButton({ damage: '5' }));

      expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    });

    test("doesn't prompt for a Stun hit", async () => {
      const target = makeIronHideTarget({ health: 20 });
      target.system.stun = { value: 0 };
      target.toggleStatusEffect = jest.fn();
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeMessage(), makeButton({ damage: '5', damageType: 'stun' }));

      expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    });

    test("doesn't prompt with no GM connected or no Story Points available", async () => {
      const target = makeIronHideTarget();
      fromUuid.mockResolvedValue(target);

      game.users = [{ isGM: false, active: true }];
      await onApplyDamage(makeMessage(), makeButton({ damage: '5' }));
      expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();

      game.users = [{ isGM: true, active: true }];
      game.settings.get = jest.fn(() => 0);
      await onApplyDamage(makeMessage(), makeButton({ damage: '5' }));
      expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    });
  });

  describe("CBRN Defender's own Hang-Up (Ferocious Fighters, New Influence, p.76)", () => {
    const CBRN_DEFENDER_HANG_UP_ID = "Compendium.essence20.ferocious_fighters.Item.B6HYPvLAVgCtQk1n";

    function makeHangUpAttacker({ hasHangUp = true } = {}) {
      const items = hasHangUp
        ? [{ type: 'hangUp', flags: { core: { sourceId: CBRN_DEFENDER_HANG_UP_ID } } }]
        : [];
      return {
        name: 'Attacker',
        items,
        system: { level: 1 },
        getFlag: jest.fn(() => undefined),
        setFlag: jest.fn(),
      };
    }

    afterEach(() => {
      game.actors.get.mockReset();
    });

    test("marks the attacker's shiftDown flag when the target's Health drops to 0", async () => {
      const target = makeTarget({ health: 5 });
      const attacker = makeHangUpAttacker();
      fromUuid.mockResolvedValue(target);
      game.actors.get.mockReturnValue(attacker);
      game.combat = { id: 'combat1' };

      await onApplyDamage(makeMessage({ speaker: { actor: 'attacker1' } }), makeButton({ damage: '10' }));

      expect(attacker.setFlag).toHaveBeenCalledWith(
        'essence20', 'cbrnDefenderShiftDownActive', { combatId: 'combat1' },
      );
      game.combat = null;
    });

    test("doesn't mark anything without the Hang-Up, when Health doesn't reach 0, or against an already-Defeated target", async () => {
      const survivingTarget = makeTarget({ health: 10 });
      const attacker = makeHangUpAttacker();
      fromUuid.mockResolvedValue(survivingTarget);
      game.actors.get.mockReturnValue(attacker);
      await onApplyDamage(makeMessage({ speaker: { actor: 'attacker1' } }), makeButton({ damage: '5' }));
      expect(attacker.setFlag).not.toHaveBeenCalled();

      const defeatedTarget = makeTarget({ health: 5 });
      const noHangUpAttacker = makeHangUpAttacker({ hasHangUp: false });
      fromUuid.mockResolvedValue(defeatedTarget);
      game.actors.get.mockReturnValue(noHangUpAttacker);
      await onApplyDamage(makeMessage({ speaker: { actor: 'attacker1' } }), makeButton({ damage: '10' }));
      expect(noHangUpAttacker.setFlag).not.toHaveBeenCalled();

      const alreadyDefeatedTarget = makeTarget({ health: 0 });
      alreadyDefeatedTarget.statuses = new Set(['defeated']);
      const anotherAttacker = makeHangUpAttacker();
      fromUuid.mockResolvedValue(alreadyDefeatedTarget);
      game.actors.get.mockReturnValue(anotherAttacker);
      await onApplyDamage(makeMessage({ speaker: { actor: 'attacker1' } }), makeButton({ damage: '5' }));
      expect(anotherAttacker.setFlag).not.toHaveBeenCalled();
    });
  });

  describe("Defeat of a Vehicle / Recall for Repairs dispatch", () => {
    function makeVehicleTarget({ type = 'vehicle', health = 0 } = {}) {
      const target = makeTarget({ health });
      target.type = type;
      target.system.skills = { brawn: { shift: 'd6', modifier: 0 } };
      target.system.actors = {};
      target.toggleStatusEffect = jest.fn();
      target.getActiveTokens = jest.fn(() => []);
      return target;
    }

    let originalRoll;
    beforeEach(() => {
      originalRoll = global.Roll;
      global.Roll = class {
        async evaluate() {
          this.total = 20; // beats any DIF this subsystem rolls against by default
          return this;
        }
      };
    });
    afterEach(() => {
      global.Roll = originalRoll;
    });

    test("routes a Vehicle's own 0-Health transition to the crash/explode subsystem", async () => {
      const target = makeVehicleTarget({ health: 5 });
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeMessage(), makeButton({ damage: '5', damageType: 'blunt' }));

      expect(target.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: true });
      expect(target.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.crashed': true }));
    });

    test("routes a Zord's own 0-Health transition to Recall for Repairs instead", async () => {
      const target = makeVehicleTarget({ type: 'zord', health: 5 });
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeMessage(), makeButton({ damage: '5', damageType: 'blunt' }));

      expect(target.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });
    });

    test("doesn't trigger for a non-Vehicle/Zord target", async () => {
      const target = makeTarget({ health: 5 });
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeMessage(), makeButton({ damage: '5', damageType: 'blunt' }));

      expect(target.toggleStatusEffect).toBeUndefined();
    });

    test("doesn't trigger on a Stun hit, which never reduces Health", async () => {
      const target = makeVehicleTarget({ health: 5 });
      target.system.stun = { value: 0 };
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeMessage(), makeButton({ damage: '5', damageType: 'stun' }));

      // applyDamage's own pre-existing Stun branch legitimately toggles Defeated once
      // accumulated Stun reaches the target's remaining Health - unrelated to this dispatch,
      // which is what's actually under test here (it never runs the crash/explode subsystem).
      expect(target.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.crashed': true }));
      expect(target.toggleStatusEffect).not.toHaveBeenCalledWith('prone', { active: true });
    });

    test("doesn't re-trigger against an already-Defeated Vehicle", async () => {
      const target = makeVehicleTarget({ health: 0 });
      target.statuses = new Set(['defeated']);
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeMessage(), makeButton({ damage: '5', damageType: 'blunt' }));

      expect(target.toggleStatusEffect).not.toHaveBeenCalled();
    });
  });

  describe("Tough Enough (GI Joe CRB, Tank Focus, 6th level, p.99) - Resistance-after-hit dispatch", () => {
    const TOUGH_ENOUGH_ID = "Compendium.essence20.gi_joe_crb.Item.RoIa80w6EAZR0uFP";

    function makeMessageWithFlags({ isAttack = false, defenseType = 'toughness' } = {}) {
      return {
        ...makeMessage(),
        getFlag: jest.fn((scope, key) => {
          if (scope != 'essence20') {
            return undefined;
          }

          if (key == 'isAttack') {
            return isAttack;
          }

          if (key == 'defenseType') {
            return defenseType;
          }

          return undefined;
        }),
      };
    }

    test("grants Resistance after a non-attack effect against Toughness lands", async () => {
      const target = makeTarget({ perkIds: [TOUGH_ENOUGH_ID] });
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeMessageWithFlags(), makeButton({ damageType: 'fire' }));

      expect(target.update).toHaveBeenCalledWith({ 'system.resistances.fire': true });
    });

    test("doesn't grant Resistance for an ordinary Attack against Toughness", async () => {
      const target = makeTarget({ perkIds: [TOUGH_ENOUGH_ID] });
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeMessageWithFlags({ isAttack: true }), makeButton({ damageType: 'fire' }));

      expect(target.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.resistances.fire': expect.anything() }));
    });

    test("doesn't grant Resistance for a non-attack effect against a different Defense", async () => {
      const target = makeTarget({ perkIds: [TOUGH_ENOUGH_ID] });
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeMessageWithFlags({ defenseType: 'evasion' }), makeButton({ damageType: 'fire' }));

      expect(target.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.resistances.fire': expect.anything() }));
    });

    test("doesn't grant Resistance without the Perk", async () => {
      const target = makeTarget();
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeMessageWithFlags(), makeButton({ damageType: 'fire' }));

      expect(target.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.resistances.fire': expect.anything() }));
    });
  });
});

/* _isCritIsFumble */
describe("_isCritIsFumble", () => {
  test("non-crit, non-fumble", () => {
    const dice = [
      {
        faces: 20,
        values: [10],
      },
    ];
    expect(_isCritIsFumble(dice)).toEqual([false, false]);
  });

  test("crit, non-fumble", () => {
    const dice = [
      {
        faces: 4,
        values: [4],
      },
    ];
    expect(_isCritIsFumble(dice)).toEqual([true, false]);
  });
  
  test("non-crit, fumble", () => {
    const dice = [
      {
        faces: 20,
        values: [1],
      },
    ];
    expect(_isCritIsFumble(dice)).toEqual([false, true]);
  });

  test("crit, fumble", () => {
    const dice = [
      {
        faces: 20,
        values: [1],
      },
      {
        faces: 4,
        values: [4],
      },
    ];
    expect(_isCritIsFumble(dice)).toEqual([true, true]);
  });

  test("d20 and d2 don't crit", () => {
    const dice = [
      {
        faces: 20,
        values: [20],
      },
      {
        faces: 2,
        values: [2],
      },
    ];
    expect(_isCritIsFumble(dice)).toEqual([false, false]);
  });

  test("no dice", () => {
    const dice = [];
    expect(_isCritIsFumble(dice)).toEqual([false, false]);
  });
});
