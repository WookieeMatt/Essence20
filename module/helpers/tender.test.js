import { jest } from '@jest/globals';
import { activateTender, getEmpathyChoice, hasTender } from './tender.mjs';

const EMPATHY_MLP_ID = "Compendium.essence20.mlp_crb.Item.7k1UXzSKyoV8EtXZ";
const TENDER_ID = "Compendium.essence20.mlp_crb.Item.xR4z6mV7Ab72TyVs";

function makeActor({ hasTenderPerk = true, empathyChoice = 'survival' } = {}) {
  const items = [];
  if (hasTenderPerk) {
    items.push({ type: 'perk', flags: { core: { sourceId: TENDER_ID } } });
  }

  if (empathyChoice) {
    items.push({
      type: 'perk', flags: { core: { sourceId: EMPATHY_MLP_ID } }, system: { choice: empathyChoice },
    });
  }

  return { items, _dice: { rollSkill: jest.fn() } };
}

describe("hasTender", () => {
  test("true with the Perk", () => {
    expect(hasTender(makeActor({ hasTenderPerk: true }))).toBe(true);
  });

  test("false without the Perk", () => {
    expect(hasTender(makeActor({ hasTenderPerk: false }))).toBe(false);
  });
});

describe("getEmpathyChoice", () => {
  test("returns the chosen skill", () => {
    expect(getEmpathyChoice(makeActor({ empathyChoice: 'science' }))).toBe('science');
  });

  test("returns null without an Empathy choice", () => {
    expect(getEmpathyChoice(makeActor({ empathyChoice: null }))).toBeNull();
  });
});

describe("activateTender", () => {
  test("rolls the actor's own chosen Empathy skill against Willpower, flagged for post-hit processing", async () => {
    const actor = makeActor({ empathyChoice: 'survival' });

    await activateTender(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'survival', essence: 'smarts', defenseType: 'willpower', isTender: true,
      }),
      actor,
    );
  });

  test("does nothing without an Empathy choice made", async () => {
    const actor = makeActor({ empathyChoice: null });

    await activateTender(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});
