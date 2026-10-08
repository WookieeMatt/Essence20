import { jest } from '@jest/globals';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { _isCritIsFumble, getRerollContext, hasMatchingSkillDie, keepOriginalD20, onApplyDamage } from "./chat.mjs";

// Sudden Death, Fortitude, Extra Plates, Didn't Even Feel It, Invincibility Through Invisibility and Just a Graze are staged
// applyingDamage Triggers on their pack items (rules/plugins/combat/applying-damage-stages.mjs); their uses count under
// each rule's own limit (flags.essence20.ruleUses.<item id>-<index>, or the rule's limit key).
await import('./rules/plugins/index.mjs');
await import('./mechanics/companions/summons.mjs');
const { setWorldLookups } = await import('./rules/predicate.mjs');
const { rebuildIndex } = await import('./rules/index.mjs');
const { isRecklessAbandonActive } = await import('./items/rolls/reckless-abandon.mjs');
setWorldLookups({ recklessAbandon: isRecklessAbandonActive });

function packRules(uuid) {
  const id = String(uuid).split('.').pop();
  for (const dir of readdirSync('packs')) {
    const src = `packs/${dir}/_source`;
    const file = existsSync(src) ? readdirSync(src).find(name => name.endsWith(`_${id}.json`)) : null;
    if (file) {
      return JSON.parse(readFileSync(`${src}/${file}`, 'utf8')).system.rules ?? [];
    }
  }

  return [];
}

const perkItem = uuid => ({ id: String(uuid).split('.').pop(), type: 'perk', flags: { core: { sourceId: uuid } }, system: { rules: packRules(uuid) } });
const used = (uuid, index = 0) => `ruleUses.${String(uuid).split('.').pop()}-${index}`;

const JUST_A_GRAZE_ID = "Compendium.essence20.gi_joe_crb.Item.YXL5dCiLZvzDgZzJ";
const FORTITUDE_ID = "Compendium.essence20.gi_joe_crb.Item.19odrVUOsp4dCiOV";
const EXTRA_PLATES_ID = "Compendium.essence20.gi_joe_crb.Item.xr0PvYXRNAg9cU42";
const DIDNT_EVEN_FEEL_IT_ID = "Compendium.essence20.gi_joe_crb.Item.y7hyuXOuARcKgahl";
// (Hard Corps is a staged applyingDamage Trigger rule on its item - rules/conv16-LeftA.test.js.)
const INVINCIBILITY_THROUGH_INVISIBILITY_ID = "Compendium.essence20.ferocious_fighters.Item.kYYPAxXMpJRMnq6Z";
const RECKLESS_ABANDON_ID = "Compendium.essence20.gi_joe_crb.Item.84d0XTJwKCYMJUgY";
const SUDDEN_DEATH_ID = "Compendium.essence20.gi_joe_crb.Item.bfBFQH3sxny3BfEK";

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
    const items = [...perkIds.map(perkItem), ...armor.map(a => ({ type: 'armor', ...a }))];
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

        if (key == used(EXTRA_PLATES_ID)) {
          return attackedFlag;
        }

        if (key == 'ruleUses.didntEvenFeelIt') {
          return didntEvenFeelItFlag;
        }

        if (key == 'hardCorpsUsedThisEncounter') {
          return hardCorpsFlag;
        }

        if (key == used(INVINCIBILITY_THROUGH_INVISIBILITY_ID)) {
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
    const items = perkIds.map(perkItem);

    return {
      name: 'Attacker',
      items,
      system: { level },
      getFlag: jest.fn((scope, key) => (
        scope == 'essence20' && key == used(SUDDEN_DEATH_ID) ? usedSuddenDeathFlag : undefined
      )),
      setFlag: jest.fn(),
    };
  }

  // Places targetActor and allyActor on a scene distanceFeet apart, sharing a Disposition -
  // the minimal canvas.tokens/canvas.grid fixture the protector lookup (rules/plugins/combat/applying-damage.mjs)
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
    foundry.applications.api.DialogV2.confirm = jest.fn(async (...args) => (await foundry.applications.api.DialogV2.wait(...args)) == 'confirm');
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
    game.combat = { id: 'combat1', round: 1, started: true };

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 9 }); // only 1 damage applied
    expect(target.setFlag).toHaveBeenCalledWith('essence20', used(JUST_A_GRAZE_ID), expect.anything());
    game.combat = null;
  });

  test("applies full damage when the GM cancels the Just a Graze prompt", async () => {
    const target = makeTarget({ perkIds: [JUST_A_GRAZE_ID] });
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    expect(target.setFlag).not.toHaveBeenCalledWith('essence20', used(JUST_A_GRAZE_ID), expect.anything());
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
    target.getFlag = jest.fn((scope, key) => (key == used(JUST_A_GRAZE_ID) ? { combatId: 'combat1', round: 1, turn: 0, count: 1 } : undefined));
    game.combat = { id: 'combat1', round: 1, started: true };
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

  test("an Interpose rule redirects the hit to an adjacent ally when the GM confirms", async () => {
    const target = makeTarget();
    const protector = makeTarget({ health: 20 });
    protector.name = 'Protector';
    // Interpose is its item's own applyingDamage rule (rules/plugins/combat/applying-damage.mjs).
    protector.items.push({ type: 'perk', name: 'Interpose', flags: {}, system: { rules: [{ type: 'Trigger', event: 'applyingDamage', redirect: true, within: 5, priority: 1, steps: [] }] } });
    setNearbyAlly(target, protector, 5);
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.confirm = jest.fn(async () => true);

    await onApplyDamage(makeMessage(), makeButton());

    expect(protector.update).toHaveBeenCalledWith({ 'system.health.value': 15 });
    expect(target.update).not.toHaveBeenCalled();
  });

  test("declining the Interpose prompt applies damage to the original target as normal", async () => {
    const target = makeTarget();
    const protector = makeTarget({ health: 20 });
    // Interpose is its item's own applyingDamage rule (rules/plugins/combat/applying-damage.mjs).
    protector.items.push({ type: 'perk', name: 'Interpose', flags: {}, system: { rules: [{ type: 'Trigger', event: 'applyingDamage', redirect: true, within: 5, priority: 1, steps: [] }] } });
    setNearbyAlly(target, protector, 5);
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.confirm = jest.fn(async () => false);

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

  test("a redirected hit still runs the protector's own damage-reduction Perks (Fortitude)", async () => {
    const target = makeTarget();
    const protector = makeTarget({ perkIds: [FORTITUDE_ID], health: 20 });
    // Interpose is its item's own applyingDamage rule (rules/plugins/combat/applying-damage.mjs).
    protector.items.push({ type: 'perk', name: 'Interpose', flags: {}, system: { rules: [{ type: 'Trigger', event: 'applyingDamage', redirect: true, within: 5, priority: 1, steps: [] }] } });
    setNearbyAlly(target, protector, 5);
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.confirm = jest.fn(async () => true);

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
    game.combat = { id: 'combat1', round: 1, turn: 0, started: true };

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 6 }); // 5 damage - 1
    expect(target.setFlag).toHaveBeenCalledWith('essence20', used(EXTRA_PLATES_ID), { combatId: 'combat1', round: 1, turn: 0, count: 1 });
    game.combat = null;
  });

  test("Extra Plates also applies with super heavy (ultraHeavy) armor", async () => {
    const target = makeTarget({ perkIds: [EXTRA_PLATES_ID], armor: [armorItem({ classification: 'ultraHeavy' })] });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 0, started: true };

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
    game.combat = null;
  });

  test("Extra Plates doesn't apply without heavy/super heavy armor equipped", async () => {
    const target = makeTarget({ perkIds: [EXTRA_PLATES_ID], armor: [armorItem({ classification: 'light' })] });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 0, started: true };

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    game.combat = null;
  });

  test("Extra Plates doesn't apply to unequipped heavy armor", async () => {
    const target = makeTarget({
      perkIds: [EXTRA_PLATES_ID], armor: [armorItem({ classification: 'heavy', equipped: false })],
    });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 0, started: true };

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    game.combat = null;
  });

  test("Extra Plates doesn't apply again once already used this turn", async () => {
    const target = makeTarget({
      perkIds: [EXTRA_PLATES_ID],
      armor: [armorItem({ classification: 'heavy' })],
      attackedFlag: { combatId: 'combat1', round: 1, turn: 0, count: 1 },
    });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 0, started: true };

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    game.combat = null;
  });

  test("Extra Plates applies again once it's a new turn", async () => {
    const target = makeTarget({
      perkIds: [EXTRA_PLATES_ID],
      armor: [armorItem({ classification: 'heavy' })],
      attackedFlag: { combatId: 'combat1', round: 1, turn: 0, count: 1 },
    });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 1, started: true };

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

  test("Invincibility Through Invisibility ignores the first attack outright, with no GM prompt", async () => {
    const target = makeTarget({ perkIds: [INVINCIBILITY_THROUGH_INVISIBILITY_ID] });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 0, started: true };

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 10 }); // 0 damage applied
    expect(target.setFlag).toHaveBeenCalledWith(
      'essence20', used(INVINCIBILITY_THROUGH_INVISIBILITY_ID), { epoch: 1, window: 'encounter', count: 1 },
    );
    game.combat = null;
  });

  test("Invincibility Through Invisibility doesn't apply while Surprised, or once already used this combat", async () => {
    const surprised = makeTarget({ perkIds: [INVINCIBILITY_THROUGH_INVISIBILITY_ID], isSurprised: true });
    fromUuid.mockResolvedValue(surprised);
    game.combat = { id: 'combat1', round: 1, turn: 0, started: true };
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
    game.combat = { id: 'combat1', round: 1, turn: 0, started: true };

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 10 }); // 0 damage applied
    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'ruleUses.didntEvenFeelIt', { epoch: 1, window: 'encounter', count: 1 });
    game.combat = null;
  });

  // Bug fix 2026-10-06: the once-per-encounter use was checked on the holder but marked on the hit actor.
  test("Didn't Even Feel It redirected by Racer Abandon is spent on the driver who holds it, not the vehicle", async () => {
    const RACER_ABANDON_ID = "Compendium.essence20.cobra_codex.Item.rNESO3bo1apEjd6p";
    const driver = makeTarget({ perkIds: [DIDNT_EVEN_FEEL_IT_ID, RACER_ABANDON_ID], recklessAbandonActive: true });
    driver.uuid = 'Actor.driver';
    // Its index notes it holds a rule reaching another actor (renegadeVehicle), as its own prepare would.
    driver.id = 'driver';
    rebuildIndex(driver);
    const vehicle = makeTarget();
    vehicle.type = 'vehicle';
    vehicle.system.actors = { d: { vehicleRole: 'driver', uuid: 'Actor.driver' } };
    const previous = global.fromUuidSync;
    global.fromUuidSync = uuid => (uuid == 'Actor.driver' ? driver : null);
    fromUuid.mockResolvedValue(vehicle);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');
    game.combat = { id: 'combat1', round: 1, turn: 0, started: true };

    try {
      await onApplyDamage(makeMessage(), makeButton());
    } finally {
      global.fromUuidSync = previous;
      game.combat = null;
    }

    expect(vehicle.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
    expect(driver.setFlag).toHaveBeenCalledWith('essence20', 'ruleUses.didntEvenFeelIt', { epoch: 1, window: 'encounter', count: 1 });
    expect(vehicle.setFlag).not.toHaveBeenCalledWith('essence20', 'ruleUses.didntEvenFeelIt', expect.anything());
  });

  test("Didn't Even Feel It applies full damage when the GM cancels the prompt", async () => {
    const target = makeTarget({ perkIds: [DIDNT_EVEN_FEEL_IT_ID], recklessAbandonActive: true });
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    game.combat = { id: 'combat1', round: 1, turn: 0, started: true };

    await onApplyDamage(makeMessage(), makeButton());

    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    expect(target.setFlag).not.toHaveBeenCalledWith('essence20', 'ruleUses.didntEvenFeelIt', expect.anything());
    game.combat = null;
  });

  test("Didn't Even Feel It doesn't prompt without Reckless Abandon active", async () => {
    const target = makeTarget({ perkIds: [DIDNT_EVEN_FEEL_IT_ID], recklessAbandonActive: false });
    fromUuid.mockResolvedValue(target);
    game.combat = { id: 'combat1', round: 1, turn: 0, started: true };

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
    game.combat = { id: 'combat1', round: 3, turn: 1, started: true }; // later round, same encounter

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    game.combat = null;
  });

  test("Didn't Even Feel It is available again in a new encounter", async () => {
    const target = makeTarget({
      perkIds: [DIDNT_EVEN_FEEL_IT_ID], recklessAbandonActive: true,
      // A flag left over from an earlier encounter. What makes it stale is now the Scene Clock's
      // encounter counter having moved on, not a different combat id - see mechanics/resources/scene-clock.mjs.
      didntEvenFeelItFlag: { epoch: 0, window: 'encounter', count: 1 },
    });
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');
    game.combat = { id: 'newCombat', round: 1, turn: 0, started: true };

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
    game.combat = { id: 'combat1', round: 1, turn: 0, started: true };

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

  describe("Essence damage types (mechanics/combat/essence-attack.mjs)", () => {
    function makeEssenceTarget() {
      const target = makeTarget({ perkIds: [FORTITUDE_ID], health: 10 });
      target.system.essences = {
        strength: { max: 3, value: 3 }, speed: { max: 3, value: 3 },
        smarts: { max: 3, value: 3 }, social: { max: 3, value: 3 },
      };
      return target;
    }

    afterEach(() => {
      foundry.applications.api.DialogV2.wait.mockReset();
    });

    test("takes the points off the Essence, skipping Health and its reductions", async () => {
      const target = makeEssenceTarget();
      fromUuid.mockResolvedValue(target);
      const message = makeMessage();
      const button = makeButton({ damage: '2', damageType: 'essenceStrength' });

      await onApplyDamage(message, button);

      // Fortitude's -1 is a Health reduction - both points land.
      expect(target.update).toHaveBeenCalledTimes(2);
      expect(target.update).toHaveBeenCalledWith({ 'system.essences.strength.value': 2 });
      expect(target.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': expect.anything() }));
      expect(button.disabled).toBe(true);
      expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.stringContaining('E20.EssenceAttackApplied'),
      }));
    });

    test("an attack rolled with Science lets the attacker pick the Essence", async () => {
      const target = makeEssenceTarget();
      fromUuid.mockResolvedValue(target);
      foundry.applications.api.DialogV2.wait.mockResolvedValue('social');
      const message = makeMessage();
      message.flags = { essence20: { skill: 'science' } };

      await onApplyDamage(message, makeButton({ damage: '1', damageType: 'essenceAny' }));

      expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
      expect(target.update).toHaveBeenCalledWith({ 'system.essences.social.value': 2 });
    });

    test("closing the attacker's choice leaves the button live", async () => {
      const target = makeEssenceTarget();
      fromUuid.mockResolvedValue(target);
      foundry.applications.api.DialogV2.wait.mockResolvedValue(null);
      const message = makeMessage();
      message.flags = { essence20: { skill: 'science' } };
      const button = makeButton({ damage: '1', damageType: 'essenceSwap' });

      await onApplyDamage(message, button);

      expect(target.update).not.toHaveBeenCalled();
      expect(button.disabled).toBe(false);
      expect(message.setFlag).not.toHaveBeenCalled();
    });

    test("a Health hit's second damage can be Essence damage, and doesn't count as Health lost", async () => {
      const target = makeEssenceTarget();
      fromUuid.mockResolvedValue(target);
      const message = makeMessage();
      message.flags = { essence20: { checkResults: [{ targetUuid: 'Actor.target1', secondaryDamage: { type: 'essenceSpeed', value: 1, base: 1 } }] } };

      await onApplyDamage(message, makeButton({ damage: '3', damageType: 'blunt', key: 'Actor.target1:base' }));

      expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 8 }); // 3 - Fortitude's 1
      expect(target.update).toHaveBeenCalledWith({ 'system.essences.speed.value': 2 });
    });
  });

  describe("Sudden Death (Blitzer Focus, 20th level, p.98)", () => {
    beforeEach(() => {
      game.combat = { id: 'combat1', round: 1, turn: 0, started: true };
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
      expect(attacker.setFlag).toHaveBeenCalledWith('essence20', used(SUDDEN_DEATH_ID), { epoch: 1, window: 'encounter', count: 1 });
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

  // Imperial Machine Mantle falls to pieces through a criticallyHit Trigger on the upgrade (rules/conv15-items1.test.js).
  describe("a Critical Success landing fires the target's criticallyHit Triggers", () => {
    function critItem() {
      return {
        id: 'mantle1', type: 'upgrade', name: 'Mantle', flags: {},
        system: { rules: [{ type: 'Trigger', event: 'criticallyHit', steps: [{ do: 'updateItem', item: 'self', set: { 'flags.essence20.broken': true } }] }] },
        update: jest.fn(async () => {}),
      };
    }

    function makeCritMessage() {
      // A non-d20 die maxed out is enough for _isCritIsFumble to report isCrit - see its own
      // faces != 20 branch.
      return makeMessage({ rolls: [{ dice: [{ faces: 6, values: [6] }] }] });
    }

    test("on a Critical Success", async () => {
      const target = makeTarget();
      const mantle = critItem();
      mantle.parent = target;
      target.items.push(mantle);
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeCritMessage(), makeButton());

      expect(mantle.update).toHaveBeenCalledWith({ 'flags.essence20.broken': true });
    });

    test("not on an ordinary hit", async () => {
      const target = makeTarget();
      const mantle = critItem();
      mantle.parent = target;
      target.items.push(mantle);
      fromUuid.mockResolvedValue(target);

      await onApplyDamage(makeMessage(), makeButton());

      expect(mantle.update).not.toHaveBeenCalled();
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

/* I've Done this Before? - skill-dice-only upshift reroll */
describe("hasMatchingSkillDie / keepOriginalD20", () => {
  const die = (faces, results, number = 1) => ({ faces, number, results: results.map(r => ({ result: r, active: true })) });

  test("ones mode needs a Skill Die (not the d20) showing a 1", () => {
    expect(hasMatchingSkillDie({ dice: [die(20, [1]), die(6, [4])] }, 'ones')).toBe(false);
    expect(hasMatchingSkillDie({ dice: [die(20, [12]), die(6, [1])] }, 'ones')).toBe(true);
    expect(hasMatchingSkillDie({ dice: [die(20, [12]), die(6, [2])] }, 'onesAndTwos')).toBe(true);
    expect(hasMatchingSkillDie({ dice: [die(20, [12])] }, 'all')).toBe(true);
  });

  test("keeps the original d20 results and recomputes the total", () => {
    const original = { dice: [die(20, [17]), die(6, [1])] };
    const d20 = die(20, [3]);
    const d8 = die(8, [5]);
    const rerolled = { dice: [d20, d8], _total: 8, _evaluateTotal: () => d20.results[0].result + d8.results[0].result };
    keepOriginalD20(original, rerolled);
    expect(d20.results[0].result).toBe(17);
    expect(rerolled._total).toBe(22);
  });
});

// Focused Strike, Homing Shots, Exterminator and Clip Check read these; the card never passed them on.
describe("getRerollContext", () => {
  const message = (flags, d20) => ({ flags: { essence20: flags }, rolls: [{ dice: [{ faces: 20, values: [d20], total: d20 }] }] });

  test("passes on the stamped attack flags and whether the roll fumbled", () => {
    const context = getRerollContext(message({ isUnarmedAttack: true, isConsumableOrWreckerRangedAttack: true, smallerTarget: true }, 1));

    expect(context).toMatchObject({ isUnarmedAttack: true, isConsumableOrWreckerRangedAttack: true, smallerTarget: true, isFumble: true });
    expect(getRerollContext(message({}, 12)).isFumble).toBe(false);
  });
});
