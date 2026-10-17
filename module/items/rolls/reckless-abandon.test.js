import { jest } from '@jest/globals';
import { isRecklessAbandonActive } from './reckless-abandon.mjs';

const RECKLESS_ABANDON_ID = "Compendium.essence20.gi_joe_crb.Item.84d0XTJwKCYMJUgY";
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
