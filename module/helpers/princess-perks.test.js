import { jest } from '@jest/globals';

import {
  actorHadMagicalBeforeGrant,
  actorHasPrincessPerk,
  applySpellcastingUpshift,
  isPrincessPerk,
  removeSpellcastingUpshift,
  roleGrantsPrincessPerk,
} from './princess-perks.mjs';

const PRINCESS_OF_GENEROSITY_PERK_ID = "Compendium.essence20.mlp_crb.Item.8s7nIIf0XIpcoqYd";
const PRINCESS_OF_HONESTY_PERK_ID = "Compendium.essence20.mlp_crb.Item.QIJJ9472y6cG82i0";
const PRINCESS_OF_KINDNESS_PERK_ID = "Compendium.essence20.mlp_crb.Item.nspTaeINRMztxFr5";
const PRINCESS_OF_LAUGHTER_PERK_ID = "Compendium.essence20.mlp_crb.Item.2LGYTCBeotSC1iln";
const PRINCESS_OF_LOYALTY_PERK_ID = "Compendium.essence20.mlp_crb.Item.DUBbmWhwiUKmrifW";
const PRINCESS_OF_MAGIC_PERK_ID = "Compendium.essence20.mlp_crb.Item.rz7nBLl6QTQRt3eu";
const MAGICAL_PERK_ID = "Compendium.essence20.mlp_crb.Item.WhTlZdUORCDpZwO2";

function makePerk(perkId, { viaFlags = true } = {}) {
  return {
    type: 'perk',
    flags: viaFlags ? { core: { sourceId: perkId } } : {},
    _stats: viaFlags ? {} : { compendiumSource: perkId },
  };
}

function makeActor({ items = [], shiftUp = 0, upshiftGranted = false } = {}) {
  const flagStore = { princessSpellcastingUpshift: upshiftGranted };
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

describe("roleGrantsPrincessPerk", () => {
  test.each([
    ["Princess of Generosity", PRINCESS_OF_GENEROSITY_PERK_ID],
    ["Princess of Honesty", PRINCESS_OF_HONESTY_PERK_ID],
    ["Princess of Kindness", PRINCESS_OF_KINDNESS_PERK_ID],
    ["Princess of Laughter", PRINCESS_OF_LAUGHTER_PERK_ID],
    ["Princess of Loyalty", PRINCESS_OF_LOYALTY_PERK_ID],
    ["Princess of Magic", PRINCESS_OF_MAGIC_PERK_ID],
  ])("true when the Role's items map has a %s entry", (name, perkId) => {
    const role = { system: { items: { db52: { uuid: perkId } } } };
    expect(roleGrantsPrincessPerk(role)).toBe(true);
  });

  test("false for a Role with no such entry", () => {
    const role = { system: { items: { a1: { uuid: "Compendium.essence20.pr_crb.Item.other" } } } };
    expect(roleGrantsPrincessPerk(role)).toBe(false);
  });
});

describe("isPrincessPerk", () => {
  test.each([
    ["Princess of Generosity", PRINCESS_OF_GENEROSITY_PERK_ID],
    ["Princess of Honesty", PRINCESS_OF_HONESTY_PERK_ID],
    ["Princess of Kindness", PRINCESS_OF_KINDNESS_PERK_ID],
    ["Princess of Laughter", PRINCESS_OF_LAUGHTER_PERK_ID],
    ["Princess of Loyalty", PRINCESS_OF_LOYALTY_PERK_ID],
    ["Princess of Magic", PRINCESS_OF_MAGIC_PERK_ID],
  ])("true via flags.core.sourceId (Role-granted copy) for %s", (name, perkId) => {
    expect(isPrincessPerk(makePerk(perkId, { viaFlags: true }))).toBe(true);
  });

  test("true via _stats.compendiumSource (manually-dropped copy)", () => {
    expect(isPrincessPerk(makePerk(PRINCESS_OF_LOYALTY_PERK_ID, { viaFlags: false }))).toBe(true);
  });

  test("false for an unrelated perk", () => {
    expect(isPrincessPerk(makePerk("Compendium.essence20.mlp_crb.Item.other"))).toBe(false);
  });
});

describe("actorHadMagicalBeforeGrant / actorHasPrincessPerk", () => {
  test("true when the actor has the matching Perk", () => {
    const actor = makeActor({ items: [makePerk(MAGICAL_PERK_ID)] });
    expect(actorHadMagicalBeforeGrant(actor)).toBe(true);
    expect(actorHasPrincessPerk(actor)).toBe(false);
  });

  test("false when the actor has no such Perk", () => {
    const actor = makeActor({ items: [] });
    expect(actorHadMagicalBeforeGrant(actor)).toBe(false);
  });

  test("recognizes any of the three Princess Perks as 'has a Princess Perk'", () => {
    const actor = makeActor({ items: [makePerk(PRINCESS_OF_MAGIC_PERK_ID)] });
    expect(actorHasPrincessPerk(actor)).toBe(true);
  });
});

describe("applySpellcastingUpshift / removeSpellcastingUpshift", () => {
  test("grants +1 shiftUp and sets the idempotency flag", async () => {
    const actor = makeActor({ shiftUp: 0 });
    await applySpellcastingUpshift(actor);
    expect(actor.update).toHaveBeenCalledWith({ "system.skills.spellcasting.shiftUp": 1 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'princessSpellcastingUpshift', true);
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
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'princessSpellcastingUpshift');
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
