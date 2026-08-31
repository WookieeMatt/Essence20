import { jest } from '@jest/globals';
import { _isCritIsFumble, onApplyDamage } from "./chat.mjs";

const JUST_A_GRAZE_ID = "Compendium.essence20.gi_joe_crb.Item.YXL5dCiLZvzDgZzJ";
const FORTITUDE_ID = "Compendium.essence20.gi_joe_crb.Item.19odrVUOsp4dCiOV";
const EXTRA_PLATES_ID = "Compendium.essence20.gi_joe_crb.Item.xr0PvYXRNAg9cU42";
const DIDNT_EVEN_FEEL_IT_ID = "Compendium.essence20.gi_joe_crb.Item.y7hyuXOuARcKgahl";
const RECKLESS_ABANDON_ID = "Compendium.essence20.gi_joe_crb.Item.84d0XTJwKCYMJUgY";
const SUDDEN_DEATH_ID = "Compendium.essence20.gi_joe_crb.Item.bfBFQH3sxny3BfEK";

game.user = { isGM: true };
game.combat = null;
game.actors = { get: jest.fn(() => null) };
foundry.applications.api.DialogV2 = { wait: jest.fn() };

/* onApplyDamage */
describe("onApplyDamage", () => {
  function makeTarget({
    perkIds = [], health = 10, armor = [], attackedFlag = undefined, didntEvenFeelItFlag = undefined,
    recklessAbandonActive = false, threatLevel = undefined,
  } = {}) {
    const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
    items.documentsByType = { armor };

    return {
      name: 'Target',
      items,
      system: { health: { value: health }, immunities: {}, threatLevel },
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

        return undefined;
      }),
      setFlag: jest.fn(),
      _getBaseRolePoints: recklessAbandonActive
        ? () => ({ flags: { core: { sourceId: RECKLESS_ABANDON_ID } }, system: { isActive: true } })
        : jest.fn(() => null),
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

  function makeMessage({ speaker = {} } = {}) {
    return {
      getFlag: jest.fn(() => undefined),
      setFlag: jest.fn(),
      speaker,
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

  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
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
    target.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 1 }));
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

  test("Didn't Even Feel It reduces damage to 0 when the GM confirms, while Reckless Abandon is active", async () => {
    const target = makeTarget({ perkIds: [DIDNT_EVEN_FEEL_IT_ID], recklessAbandonActive: true });
    fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');
    game.combat = { id: 'combat1', round: 1, turn: 0 };

    await onApplyDamage(makeMessage(), makeButton());

    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 10 }); // 0 damage applied
    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'didntEvenFeelItThisEncounter', { combatId: 'combat1' });
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
      didntEvenFeelItFlag: { combatId: 'combat1' },
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
      didntEvenFeelItFlag: { combatId: 'oldCombat' },
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
      expect(attacker.setFlag).toHaveBeenCalledWith('essence20', 'suddenDeathThisEncounter', { combatId: 'combat1' });
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
        perkIds: [SUDDEN_DEATH_ID], level: 20, usedSuddenDeathFlag: { combatId: 'combat1' },
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
        perkIds: [SUDDEN_DEATH_ID], level: 20, usedSuddenDeathFlag: { combatId: 'oldCombat' },
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
