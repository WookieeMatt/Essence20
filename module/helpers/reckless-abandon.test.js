import { jest } from '@jest/globals';
import { applyAegisDefeatCheck, getRecklessAbandonStrengthShiftUp, isRecklessAbandonActive } from './reckless-abandon.mjs';

const RECKLESS_ABANDON_ID = "Compendium.essence20.gi_joe_crb.Item.84d0XTJwKCYMJUgY";
const HARDENED_ID = "Compendium.essence20.gi_joe_crb.Item.f7d5bkyxVpbR4dAe";
const AEGIS_ID = "Compendium.essence20.gi_joe_crb.Item.CKQfEuHDNW6zP0FE";
const OTHER_HEALTH_BONUS_ID = "Compendium.essence20.pr_crb.Item.someOtherHealthBonus";

function makeActor({ rolePoints, armor = [], perkIds = [] } = {}) {
  const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
  items.documentsByType = { armor };

  return {
    items,
    _getBaseRolePoints: jest.fn(() => rolePoints),
  };
}

function makeRolePoints({ sourceId = RECKLESS_ABANDON_ID, isActive = true } = {}) {
  return { flags: { core: { sourceId } }, system: { isActive } };
}

function makeArmor(classification, equipped = true) {
  return { system: { classification, equipped } };
}

/* isRecklessAbandonActive */
describe("isRecklessAbandonActive", () => {
  test("true when the base Role Points item is Reckless Abandon and Active", () => {
    const actor = makeActor({ rolePoints: makeRolePoints() });
    expect(isRecklessAbandonActive(actor)).toBe(true);
  });

  test("false when Reckless Abandon is granted but not Active", () => {
    const actor = makeActor({ rolePoints: makeRolePoints({ isActive: false }) });
    expect(isRecklessAbandonActive(actor)).toBe(false);
  });

  test("false for a different healthBonus Role Points item (e.g. another game line's)", () => {
    const actor = makeActor({ rolePoints: makeRolePoints({ sourceId: OTHER_HEALTH_BONUS_ID }) });
    expect(isRecklessAbandonActive(actor)).toBe(false);
  });

  test("false when the actor has no base Role Points item at all", () => {
    const actor = makeActor({ rolePoints: undefined });
    expect(isRecklessAbandonActive(actor)).toBe(false);
  });
});

/* getRecklessAbandonStrengthShiftUp */
describe("getRecklessAbandonStrengthShiftUp", () => {
  test("0 when Reckless Abandon isn't active", () => {
    const actor = makeActor({ rolePoints: makeRolePoints({ isActive: false }) });
    expect(getRecklessAbandonStrengthShiftUp(actor)).toBe(0);
  });

  test("shiftUp of 2 when active and wearing no armor", () => {
    const actor = makeActor({ rolePoints: makeRolePoints(), armor: [] });
    expect(getRecklessAbandonStrengthShiftUp(actor)).toBe(2);
  });

  test("shiftUp of 2 when active and wearing light armor", () => {
    const actor = makeActor({ rolePoints: makeRolePoints(), armor: [makeArmor('light')] });
    expect(getRecklessAbandonStrengthShiftUp(actor)).toBe(2);
  });

  test("0 when wearing medium armor without Hardened", () => {
    const actor = makeActor({ rolePoints: makeRolePoints(), armor: [makeArmor('medium')] });
    expect(getRecklessAbandonStrengthShiftUp(actor)).toBe(0);
  });

  test("shiftUp of 2 when wearing medium armor with Hardened", () => {
    const actor = makeActor({
      rolePoints: makeRolePoints(), armor: [makeArmor('medium')], perkIds: [HARDENED_ID],
    });
    expect(getRecklessAbandonStrengthShiftUp(actor)).toBe(2);
  });

  test("0 when wearing heavy armor even with Hardened", () => {
    const actor = makeActor({
      rolePoints: makeRolePoints(), armor: [makeArmor('heavy')], perkIds: [HARDENED_ID],
    });
    expect(getRecklessAbandonStrengthShiftUp(actor)).toBe(0);
  });

  test("0 when wearing ultra heavy armor", () => {
    const actor = makeActor({ rolePoints: makeRolePoints(), armor: [makeArmor('ultraHeavy')] });
    expect(getRecklessAbandonStrengthShiftUp(actor)).toBe(0);
  });

  test("an unequipped heavier armor item doesn't block the bonus", () => {
    const actor = makeActor({ rolePoints: makeRolePoints(), armor: [makeArmor('heavy', false)] });
    expect(getRecklessAbandonStrengthShiftUp(actor)).toBe(2);
  });
});

/* applyAegisDefeatCheck */
describe("applyAegisDefeatCheck", () => {
  function makeAegisActor({ hasPerk = true, clamped = true, health = 1 } = {}) {
    const perkIds = hasPerk ? [AEGIS_ID] : [];
    const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
    return {
      items,
      system: { health: { value: health } },
      getFlag: jest.fn((scope, key) => (key == 'aegisClamped' ? clamped : undefined)),
      unsetFlag: jest.fn(),
      toggleStatusEffect: jest.fn(),
    };
  }

  test("applies the real Defeat when still at the clamped Health, with the Perk and flag set", async () => {
    const actor = makeAegisActor({ health: 1 });

    await applyAegisDefeatCheck(actor);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: true });
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'aegisClamped');
  });

  test("doesn't apply Defeat if Health has since recovered above the clamp", async () => {
    const actor = makeAegisActor({ health: 5 });

    await applyAegisDefeatCheck(actor);

    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'aegisClamped');
  });

  test("does nothing without the Perk", async () => {
    const actor = makeAegisActor({ hasPerk: false });

    await applyAegisDefeatCheck(actor);

    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });

  test("does nothing without the clamp flag set", async () => {
    const actor = makeAegisActor({ clamped: false });

    await applyAegisDefeatCheck(actor);

    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });
});
