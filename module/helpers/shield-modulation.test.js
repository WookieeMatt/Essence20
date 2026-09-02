import { jest } from '@jest/globals';
import {
  getShieldModulationDamageType, needsShieldModulationChoice, pickShieldModulationDamageType,
  setShieldModulationDamageType,
} from './shield-modulation.mjs';

const PERSONAL_SHIELD_ROLE_POINTS_ID = "Compendium.essence20.gi_joe_crb.Item.84JYgd6kZgY41wge";
const SHIELD_MODULATION_ID = "Compendium.essence20.gi_joe_crb.Item.16ul4Ev6b9gO5CIN";

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor({ hasPerk = true } = {}) {
  const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: SHIELD_MODULATION_ID } } }] : [];
  return { items, getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
}

function makeShieldItem() {
  return { flags: { core: { sourceId: PERSONAL_SHIELD_ROLE_POINTS_ID } } };
}

describe("needsShieldModulationChoice", () => {
  test("true for the Personal Shield item with the Perk", () => {
    expect(needsShieldModulationChoice(makeActor(), makeShieldItem())).toBe(true);
  });

  test("false without the Perk", () => {
    expect(needsShieldModulationChoice(makeActor({ hasPerk: false }), makeShieldItem())).toBe(false);
  });

  test("false for some other Role Points item, even with the Perk", () => {
    const otherItem = { flags: { core: { sourceId: "Compendium.essence20.gi_joe_crb.Item.other" } } };
    expect(needsShieldModulationChoice(makeActor(), otherItem)).toBe(false);
  });
});

describe("pickShieldModulationDamageType", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("returns the chosen damage type", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('poison');
    expect(await pickShieldModulationDamageType()).toBe('poison');
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickShieldModulationDamageType()).toBe(null);
  });
});

describe("setShieldModulationDamageType / getShieldModulationDamageType", () => {
  test("stores and reads back the chosen damage type", async () => {
    const actor = makeActor();

    await setShieldModulationDamageType(actor, 'sonic');

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'shieldModulationDamageType', 'sonic');
  });

  test("reads back a stored value", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn(() => 'sonic');

    expect(getShieldModulationDamageType(actor)).toBe('sonic');
  });

  test("returns null with nothing stored", () => {
    expect(getShieldModulationDamageType(makeActor())).toBe(null);
  });
});
