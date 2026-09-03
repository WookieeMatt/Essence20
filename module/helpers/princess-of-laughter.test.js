import { jest } from '@jest/globals';

import {
  actorHadMagicalBeforeGrant,
  actorHasPrincessOfLaughter,
  applySpellcastingUpshift,
  isPrincessOfLaughterPerk,
  removeSpellcastingUpshift,
  roleGrantsPrincessOfLaughter,
} from './princess-of-laughter.mjs';

const PRINCESS_OF_LAUGHTER_PERK_ID = "Compendium.essence20.mlp_crb.Item.2LGYTCBeotSC1iln";
const MAGICAL_PERK_ID = "Compendium.essence20.mlp_crb.Item.WhTlZdUORCDpZwO2";

function makePerk(perkId, { viaFlags = true } = {}) {
  return {
    type: 'perk',
    flags: viaFlags ? { core: { sourceId: perkId } } : {},
    _stats: viaFlags ? {} : { compendiumSource: perkId },
  };
}

function makeActor({ items = [], shiftUp = 0, upshiftGranted = false } = {}) {
  const flagStore = { princessOfLaughterSpellcastingUpshift: upshiftGranted };
  return {
    items,
    system: { skills: { spellcasting: { shiftUp } } },
    update: jest.fn(async (changes) => changes),
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flagStore[key];
    }),
  };
}

describe("roleGrantsPrincessOfLaughter", () => {
  test("true when the Role's items map has a Princess of Laughter entry", () => {
    const role = { system: { items: { db52: { uuid: PRINCESS_OF_LAUGHTER_PERK_ID } } } };
    expect(roleGrantsPrincessOfLaughter(role)).toBe(true);
  });

  test("false for a Role with no such entry", () => {
    const role = { system: { items: { a1: { uuid: "Compendium.essence20.pr_crb.Item.other" } } } };
    expect(roleGrantsPrincessOfLaughter(role)).toBe(false);
  });
});

describe("isPrincessOfLaughterPerk", () => {
  test("true via flags.core.sourceId (Role-granted copy)", () => {
    expect(isPrincessOfLaughterPerk(makePerk(PRINCESS_OF_LAUGHTER_PERK_ID, { viaFlags: true }))).toBe(true);
  });

  test("true via _stats.compendiumSource (manually-dropped copy)", () => {
    expect(isPrincessOfLaughterPerk(makePerk(PRINCESS_OF_LAUGHTER_PERK_ID, { viaFlags: false }))).toBe(true);
  });

  test("false for an unrelated perk", () => {
    expect(isPrincessOfLaughterPerk(makePerk("Compendium.essence20.mlp_crb.Item.other"))).toBe(false);
  });
});

describe("actorHadMagicalBeforeGrant / actorHasPrincessOfLaughter", () => {
  test("true when the actor has the matching Perk", () => {
    const actor = makeActor({ items: [makePerk(MAGICAL_PERK_ID)] });
    expect(actorHadMagicalBeforeGrant(actor)).toBe(true);
    expect(actorHasPrincessOfLaughter(actor)).toBe(false);
  });

  test("false when the actor has no such Perk", () => {
    const actor = makeActor({ items: [] });
    expect(actorHadMagicalBeforeGrant(actor)).toBe(false);
  });
});

describe("applySpellcastingUpshift / removeSpellcastingUpshift", () => {
  test("grants +1 shiftUp and sets the idempotency flag", async () => {
    const actor = makeActor({ shiftUp: 0 });
    await applySpellcastingUpshift(actor);
    expect(actor.update).toHaveBeenCalledWith({ "system.skills.spellcasting.shiftUp": 1 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'princessOfLaughterSpellcastingUpshift', true);
  });

  test("does nothing if already granted", async () => {
    const actor = makeActor({ shiftUp: 1, upshiftGranted: true });
    await applySpellcastingUpshift(actor);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("reverses the upshift and clears the flag", async () => {
    const actor = makeActor({ shiftUp: 1, upshiftGranted: true });
    await removeSpellcastingUpshift(actor);
    expect(actor.update).toHaveBeenCalledWith({ "system.skills.spellcasting.shiftUp": 0 });
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'princessOfLaughterSpellcastingUpshift');
  });

  test("does nothing to reverse if it was never granted", async () => {
    const actor = makeActor({ shiftUp: 0, upshiftGranted: false });
    await removeSpellcastingUpshift(actor);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("never drops shiftUp below 0", async () => {
    const actor = makeActor({ shiftUp: 0, upshiftGranted: true });
    await removeSpellcastingUpshift(actor);
    expect(actor.update).toHaveBeenCalledWith({ "system.skills.spellcasting.shiftUp": 0 });
  });
});
