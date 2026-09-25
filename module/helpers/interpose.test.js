import { jest } from '@jest/globals';
import { consumeDamageRedirect, findEligibleProtector } from './interpose.mjs';

const INTERPOSE_ID = "Compendium.essence20.gi_joe_crb.Item.srCQjZFTPhm2bK3D";
const INTERPOSE_SOTS_ID = "Compendium.essence20.story_of_the_seasons.Item.rh3eMOKRxZTkOYSo";
const BODY_SHIELD_ID = "Compendium.essence20.gi_joe_crb.Item.CBfLvmIWdbLuucts";
const HEROIC_SACRIFICE_ID = "Compendium.essence20.gi_joe_crb.Item.GqxgLMadhmPYJgKq";
const STAND_BY_ME_ID = "Compendium.essence20.mlp_crb.Item.LrcbTJQdNJVyu23f";
const GOLDEN_GUARDIAN_ID = "Compendium.essence20.across_the_stars.Item.dSMZ5wMdu0Xq0VzX";
const COUNTERSTRIKE_ID = "Compendium.essence20.across_the_stars.Item.8mRJPvxLFVcf0egf";

function mockStoryPoints(value) {
  global.game.settings.get = jest.fn((scope, key) => (key === 'sptStoryPoints' ? value : 'roll'));
}

function makeActor({
  id, disposition = 1, perkIds = [], groundMovement = 30, usedFlags = {}, personalPower = 0,
} = {}) {
  const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
  // A stable token object (constructed once, not recreated per call) - matches real Foundry's
  // own getActiveTokens(), which always returns the same placed TokenDocument reference. The
  // team-buffs.test.js precedent this mirrors gets away with a fresh object per call only
  // because its own "self" placeable deliberately omits `.actor` (relying on that check to
  // exclude self); this fixture needs the token to ALSO be findable in a reverse-direction scan
  // (Heroic Sacrifice's own "is the target within MY Sprint reach" re-check), so it needs a
  // real, stable, actor-bearing token instead.
  const token = { document: { disposition }, center: { distance: 0 } };

  return {
    id,
    name: id,
    items,
    system: { movement: { ground: { total: groundMovement } }, powers: { personal: { value: personalPower } } },
    getActiveTokens: jest.fn(() => [token]),
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? usedFlags[key] : undefined)),
    setFlag: jest.fn(),
    update: jest.fn(),
  };
}

function setScene(targetActor, allyActors, { targetDistance = {} } = {}) {
  const targetToken = targetActor.getActiveTokens()[0];
  targetToken.actor = targetActor;
  const allyTokens = allyActors.map(actor => {
    const token = actor.getActiveTokens()[0];
    const distance = targetDistance[actor.id] ?? 0;
    token.center = { distance };
    token.actor = actor;
    // Distance is symmetric, and the mocked measurePath below only ever reads its first
    // argument's own .distance - so a reverse-direction scan (this ally looking back at the
    // target, e.g. Heroic Sacrifice's own Sprint-reach re-check) needs the TARGET's token to
    // carry this same pairwise distance too. Fine to just overwrite per ally since every test
    // here only ever has one ally in play at a time.
    targetToken.center = { distance };
    return token;
  });

  global.canvas = {
    tokens: { placeables: [targetToken, ...allyTokens] },
    grid: { measurePath: jest.fn(([otherCenter]) => ({ distance: otherCenter.distance ?? 0 })) },
  };
}

const IMPENETRABLE_ARMOR_ID = "Compendium.essence20.gi_joe_crb.Item.vanN7kRYUhgHew7q";

describe("findEligibleProtector", () => {
  let originalCanvas;
  let originalCombat;
  let originalActors;

  beforeEach(() => {
    originalCanvas = global.canvas;
    originalCombat = global.game.combat;
    originalActors = global.game.actors;
    global.game.combat = { id: 'combat1', round: 1, turn: 0 };
    mockStoryPoints(3);
  });

  afterEach(() => {
    global.canvas = originalCanvas;
    global.game.combat = originalCombat;
    global.game.actors = originalActors;
  });

  test("redirects to the pilot's own vehicle for Impenetrable Armor", () => {
    const vehicle = { id: 'vehicle1', type: 'vehicle', system: { actors: { 1: { uuid: 'Actor.driver1', vehicleRole: 'driver' } } } };
    const target = makeActor({ id: 'driver1', perkIds: [IMPENETRABLE_ARMOR_ID] });
    target.uuid = 'Actor.driver1';
    target._dice = { _getPilotedVehicle: (actor, role) => (role == 'driver' ? vehicle : null) };
    global.game.actors = [vehicle];
    setScene(target, [], {});

    expect(findEligibleProtector(target)).toEqual({ protector: vehicle, perkId: IMPENETRABLE_ARMOR_ID });
  });

  test("doesn't redirect for Impenetrable Armor without a piloted vehicle", () => {
    const target = makeActor({ id: 'driver1', perkIds: [IMPENETRABLE_ARMOR_ID] });
    target.uuid = 'Actor.driver1';
    target._dice = { _getPilotedVehicle: () => null };
    setScene(target, [], {});

    expect(findEligibleProtector(target)).toBeNull();
  });

  test("doesn't redirect for Impenetrable Armor without the Perk", () => {
    const vehicle = { id: 'vehicle1', type: 'vehicle', system: { actors: { 1: { uuid: 'Actor.driver1', vehicleRole: 'driver' } } } };
    const target = makeActor({ id: 'driver1' });
    target.uuid = 'Actor.driver1';
    target._dice = { _getPilotedVehicle: (actor, role) => (role == 'driver' ? vehicle : null) };
    global.game.actors = [vehicle];
    setScene(target, [], {});

    expect(findEligibleProtector(target)).toBeNull();
  });

  test("finds an adjacent Stand By Me holder when Story Points are available", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [STAND_BY_ME_ID] });
    setScene(target, [ally], { targetDistance: { ally: 5 } });

    expect(findEligibleProtector(target)).toEqual({ protector: ally, perkId: STAND_BY_ME_ID });
  });

  test("skips a Stand By Me holder when no Story Points are available", () => {
    mockStoryPoints(0);
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [STAND_BY_ME_ID] });
    setScene(target, [ally], { targetDistance: { ally: 5 } });

    expect(findEligibleProtector(target)).toBeNull();
  });

  test("prefers a free option (Interpose) over Stand By Me's own Story-Point cost", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [STAND_BY_ME_ID, INTERPOSE_ID] });
    setScene(target, [ally], { targetDistance: { ally: 5 } });

    expect(findEligibleProtector(target)).toEqual({ protector: ally, perkId: INTERPOSE_ID });
  });

  test("finds an adjacent ally with Interpose", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [INTERPOSE_ID] });
    setScene(target, [ally], { targetDistance: { ally: 5 } });

    expect(findEligibleProtector(target)).toEqual({ protector: ally, perkId: INTERPOSE_ID });
  });

  test("ignores a non-adjacent Interpose holder (Interpose has no Sprint-reach fallback)", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [INTERPOSE_ID] });
    setScene(target, [ally], { targetDistance: { ally: 15 } });

    expect(findEligibleProtector(target)).toBeNull();
  });

  test("finds an adjacent Body Shield holder who hasn't used it this turn", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [BODY_SHIELD_ID] });
    setScene(target, [ally], { targetDistance: { ally: 5 } });

    expect(findEligibleProtector(target)).toEqual({ protector: ally, perkId: BODY_SHIELD_ID });
  });

  test("skips a Body Shield holder who already used it this turn", () => {
    const target = makeActor({ id: 'target' });
    const usedFlags = { bodyShieldUsedThisTurn: { combatId: 'combat1', round: 1, turn: 0 } };
    const ally = makeActor({ id: 'ally', perkIds: [BODY_SHIELD_ID], usedFlags });
    setScene(target, [ally], { targetDistance: { ally: 5 } });

    expect(findEligibleProtector(target)).toBeNull();
  });

  test("finds an adjacent ally with Story of the Seasons' own same-named Interpose", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [INTERPOSE_SOTS_ID] });
    setScene(target, [ally], { targetDistance: { ally: 5 } });

    expect(findEligibleProtector(target)).toEqual({ protector: ally, perkId: INTERPOSE_SOTS_ID });
  });

  test("prefers Interpose over Body Shield when one actor holds both", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [BODY_SHIELD_ID, INTERPOSE_ID] });
    setScene(target, [ally], { targetDistance: { ally: 5 } });

    expect(findEligibleProtector(target)).toEqual({ protector: ally, perkId: INTERPOSE_ID });
  });

  test("finds a distant Heroic Sacrifice holder within double their Ground Movement", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [HEROIC_SACRIFICE_ID], groundMovement: 30 });
    setScene(target, [ally], { targetDistance: { ally: 55 } }); // within 60ft Sprint reach

    expect(findEligibleProtector(target)).toEqual({ protector: ally, perkId: HEROIC_SACRIFICE_ID });
  });

  test("rejects a Heroic Sacrifice holder outside their Sprint reach", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [HEROIC_SACRIFICE_ID], groundMovement: 30 });
    setScene(target, [ally], { targetDistance: { ally: 65 } }); // beyond 60ft Sprint reach

    expect(findEligibleProtector(target)).toBeNull();
  });

  test("skips a Heroic Sacrifice holder who already used it this turn", () => {
    const target = makeActor({ id: 'target' });
    const usedFlags = { heroicSacrificeUsedThisTurn: { combatId: 'combat1', round: 1, turn: 0 } };
    const ally = makeActor({ id: 'ally', perkIds: [HEROIC_SACRIFICE_ID], groundMovement: 30, usedFlags });
    setScene(target, [ally], { targetDistance: { ally: 20 } });

    expect(findEligibleProtector(target)).toBeNull();
  });

  test("returns null with no eligible allies at all", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally' });
    setScene(target, [ally], { targetDistance: { ally: 5 } });

    expect(findEligibleProtector(target)).toBeNull();
  });

  test("finds an adjacent Golden Guardian holder with enough Personal Power", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [GOLDEN_GUARDIAN_ID], personalPower: 1 });
    setScene(target, [ally], { targetDistance: { ally: 5 } });

    expect(findEligibleProtector(target)).toEqual({ protector: ally, perkId: GOLDEN_GUARDIAN_ID });
  });

  test("skips a Golden Guardian holder without enough Personal Power", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [GOLDEN_GUARDIAN_ID], personalPower: 0 });
    setScene(target, [ally], { targetDistance: { ally: 5 } });

    expect(findEligibleProtector(target)).toBeNull();
  });

  test("ignores a non-adjacent Golden Guardian holder", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [GOLDEN_GUARDIAN_ID], personalPower: 1 });
    setScene(target, [ally], { targetDistance: { ally: 15 } });

    expect(findEligibleProtector(target)).toBeNull();
  });

  test("prefers a free option (Interpose) over Golden Guardian's own Power cost", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [GOLDEN_GUARDIAN_ID, INTERPOSE_ID], personalPower: 1 });
    setScene(target, [ally], { targetDistance: { ally: 5 } });

    expect(findEligibleProtector(target)).toEqual({ protector: ally, perkId: INTERPOSE_ID });
  });
});

describe("consumeDamageRedirect", () => {
  let originalCombat;

  beforeEach(() => {
    originalCombat = global.game.combat;
    global.game.combat = { id: 'combat1', round: 1, turn: 0 };
    global.game.socket = { emit: jest.fn() };
    global.game.users = [{ isGM: true, active: true }];
  });

  afterEach(() => {
    global.game.combat = originalCombat;
  });

  test("spends a Story Point for Stand By Me when a GM is connected", async () => {
    const protector = makeActor({ id: 'protector' });
    await consumeDamageRedirect(protector, STAND_BY_ME_ID);
    expect(global.game.socket.emit).toHaveBeenCalledWith('system.essence20', expect.objectContaining({
      action: 'spendStoryPoints', amount: 1, actorName: 'protector',
    }));
  });

  test("doesn't spend anything for Stand By Me when no GM is connected", async () => {
    global.game.users = [{ isGM: false, active: true }];
    const protector = makeActor({ id: 'protector' });
    await consumeDamageRedirect(protector, STAND_BY_ME_ID);
    expect(global.game.socket.emit).not.toHaveBeenCalled();
  });

  test("marks Body Shield's own once-per-turn flag", async () => {
    const protector = makeActor({ id: 'protector' });
    await consumeDamageRedirect(protector, BODY_SHIELD_ID);
    expect(protector.setFlag).toHaveBeenCalledWith('essence20', 'bodyShieldUsedThisTurn', expect.anything());
  });

  test("marks Heroic Sacrifice's own once-per-turn flag", async () => {
    const protector = makeActor({ id: 'protector' });
    await consumeDamageRedirect(protector, HEROIC_SACRIFICE_ID);
    expect(protector.setFlag).toHaveBeenCalledWith('essence20', 'heroicSacrificeUsedThisTurn', expect.anything());
  });

  test("Interpose has no flag to mark", async () => {
    const protector = makeActor({ id: 'protector' });
    await consumeDamageRedirect(protector, INTERPOSE_ID);
    expect(protector.setFlag).not.toHaveBeenCalled();
  });

  test("spends 1 Personal Power for Golden Guardian", async () => {
    const protector = makeActor({ id: 'protector', personalPower: 2 });
    await consumeDamageRedirect(protector, GOLDEN_GUARDIAN_ID);
    expect(protector.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 });
  });

  test("auto-targets the attacker for Golden Guardian + Counterstrike", async () => {
    const protector = makeActor({ id: 'protector', personalPower: 2, perkIds: [GOLDEN_GUARDIAN_ID, COUNTERSTRIKE_ID] });
    const attacker = makeActor({ id: 'attacker' });
    const attackerToken = { id: 'attackerToken1' };
    attacker.getActiveTokens = jest.fn(() => [attackerToken]);
    global.canvas = { tokens: { setTargets: jest.fn() } };

    await consumeDamageRedirect(protector, GOLDEN_GUARDIAN_ID, attacker);

    expect(canvas.tokens.setTargets).toHaveBeenCalledWith(['attackerToken1']);
  });

  test("doesn't auto-target without Counterstrike", async () => {
    const protector = makeActor({ id: 'protector', personalPower: 2, perkIds: [GOLDEN_GUARDIAN_ID] });
    const attacker = makeActor({ id: 'attacker' });
    attacker.getActiveTokens = jest.fn(() => [{ id: 'attackerToken1' }]);
    global.canvas = { tokens: { setTargets: jest.fn() } };

    await consumeDamageRedirect(protector, GOLDEN_GUARDIAN_ID, attacker);

    expect(canvas.tokens.setTargets).not.toHaveBeenCalled();
  });

  test("doesn't crash when Counterstrike is held but no attacker token exists", async () => {
    const protector = makeActor({ id: 'protector', personalPower: 2, perkIds: [GOLDEN_GUARDIAN_ID, COUNTERSTRIKE_ID] });
    const attacker = makeActor({ id: 'attacker' });
    attacker.getActiveTokens = jest.fn(() => []);
    global.canvas = { tokens: { setTargets: jest.fn() } };

    await consumeDamageRedirect(protector, GOLDEN_GUARDIAN_ID, attacker);

    expect(canvas.tokens.setTargets).not.toHaveBeenCalled();
  });
});
