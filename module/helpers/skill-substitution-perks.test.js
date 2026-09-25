import { jest } from '@jest/globals';
import {
  activateCostGatedSubstitutionPerk, activateSkillSubstitutionPerk, canUseCostGatedSubstitutionPerk,
  canUseSkillSubstitutionPerk, isCostGatedSubstitutionPerk, isSkillSubstitutionPerk, REVERSE_ENGINEER_ID,
} from './skill-substitution-perks.mjs';

const INFILTRATOR_ID = "Compendium.essence20.tf_crb.Item.CHkXJNjrvZUPxV7J";
const CHATTER_FLASHBACK_ID = "Compendium.essence20.mlp_crb.Item.L18ewA90Q1MqaQlC";
const UNRELATED_ID = "Compendium.essence20.mlp_crb.Item.doesNotExist1234";
const ACTING_ID = "Compendium.essence20.mlp_crb.Item.oA8DrnUOOqc1mrd0";
const LAYPONY_TERMS_ID = "Compendium.essence20.mlp_crb.Item.ZD7uEmKIlQbyoFz7";
const THESIS_ID = "Compendium.essence20.tf_crb.Item.4AyMZ0h6YkKv8vbj";
const TECHNOBABBLE_ID = "Compendium.essence20.tf_crb.Item.efrhpDsdXPUKVEWt";

global.game = { i18n: { localize: (k) => k } };
global.ui = { notifications: { warn: jest.fn() } };

function makeActor(flagStore = {}, { hangUpIds = [] } = {}) {
  return {
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flagStore[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    items: hangUpIds.map(hangUpId => ({ type: 'hangUp', flags: { core: { sourceId: hangUpId } } })),
  };
}

function makeRolePointsActor(cheerValue) {
  const rolePoints = {
    name: 'Cheer Points',
    system: { resource: { value: cheerValue } },
    update: jest.fn(async (data) => {
      rolePoints.system.resource.value = data['system.resource.value']; 
    }),
  };
  return { items: { documentsByType: { rolePoints: cheerValue == null ? [] : [rolePoints] } }, _rolePoints: rolePoints };
}

describe("isSkillSubstitutionPerk", () => {
  test("true for a listed perk, false otherwise", () => {
    expect(isSkillSubstitutionPerk(INFILTRATOR_ID)).toBe(true);
    expect(isSkillSubstitutionPerk(UNRELATED_ID)).toBe(false);
  });
});

describe("canUseSkillSubstitutionPerk / activateSkillSubstitutionPerk", () => {
  test("Infiltrator (once per scene) is usable once, then not again", async () => {
    const actor = makeActor();
    expect(canUseSkillSubstitutionPerk(actor, INFILTRATOR_ID)).toBe(true);

    await activateSkillSubstitutionPerk(actor, INFILTRATOR_ID);
    expect(canUseSkillSubstitutionPerk(actor, INFILTRATOR_ID)).toBe(false);
  });

  test("Chatter Flashback (3/scene) is usable 3 times, then not a 4th", async () => {
    const actor = makeActor();
    for (let i = 0; i < 3; i++) {
      expect(canUseSkillSubstitutionPerk(actor, CHATTER_FLASHBACK_ID)).toBe(true);
      await activateSkillSubstitutionPerk(actor, CHATTER_FLASHBACK_ID);
    }

    expect(canUseSkillSubstitutionPerk(actor, CHATTER_FLASHBACK_ID)).toBe(false);
  });

  test("an unrelated sourceId is never usable and activation is a no-op", async () => {
    const actor = makeActor();
    expect(canUseSkillSubstitutionPerk(actor, UNRELATED_ID)).toBe(false);
    await activateSkillSubstitutionPerk(actor, UNRELATED_ID);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("Thesis (1/scene) is usable once, then not again, without Technobabble", async () => {
    const actor = makeActor();
    expect(canUseSkillSubstitutionPerk(actor, THESIS_ID)).toBe(true);

    await activateSkillSubstitutionPerk(actor, THESIS_ID);
    expect(canUseSkillSubstitutionPerk(actor, THESIS_ID)).toBe(false);
  });

  test("Technobabble raises Thesis to 3/scene", async () => {
    const actor = makeActor();
    actor.items = [{ type: 'perk', flags: { core: { sourceId: TECHNOBABBLE_ID } } }];

    for (let i = 0; i < 3; i++) {
      expect(canUseSkillSubstitutionPerk(actor, THESIS_ID)).toBe(true);
      await activateSkillSubstitutionPerk(actor, THESIS_ID);
    }

    expect(canUseSkillSubstitutionPerk(actor, THESIS_ID)).toBe(false);
  });
});

describe("Laypony Terms hook on Reverse Engineer", () => {
  beforeEach(() => {
    global.foundry = { applications: { api: { DialogV2: { confirm: jest.fn() } } } };
  });

  test("does nothing extra without the Hang-Up", async () => {
    const actor = makeActor();
    await activateSkillSubstitutionPerk(actor, REVERSE_ENGINEER_ID);
    expect(foundry.applications.api.DialogV2.confirm).not.toHaveBeenCalled();
  });

  test("prompts, and banks a Snag on 'yes', with the Hang-Up", async () => {
    foundry.applications.api.DialogV2.confirm.mockResolvedValue(true);
    const actor = makeActor({}, { hangUpIds: [LAYPONY_TERMS_ID] });

    await activateSkillSubstitutionPerk(actor, REVERSE_ENGINEER_ID);

    expect(foundry.applications.api.DialogV2.confirm).toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingLayponyTermsSnag', expect.any(Object));
  });

  test("prompts, but banks nothing on 'no'", async () => {
    foundry.applications.api.DialogV2.confirm.mockResolvedValue(false);
    const actor = makeActor({}, { hangUpIds: [LAYPONY_TERMS_ID] });

    await activateSkillSubstitutionPerk(actor, REVERSE_ENGINEER_ID);

    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'pendingLayponyTermsSnag', expect.anything());
  });
});

describe("isCostGatedSubstitutionPerk / canUseCostGatedSubstitutionPerk / activateCostGatedSubstitutionPerk", () => {
  test("true for Acting!, false otherwise", () => {
    expect(isCostGatedSubstitutionPerk(ACTING_ID)).toBe(true);
    expect(isCostGatedSubstitutionPerk(UNRELATED_ID)).toBe(false);
  });

  test("canUse reflects the Cheer Points pool", () => {
    expect(canUseCostGatedSubstitutionPerk(makeRolePointsActor(0))).toBe(false);
    expect(canUseCostGatedSubstitutionPerk(makeRolePointsActor(1))).toBe(true);
  });

  test("spends 1 Cheer Point on activation", async () => {
    const actor = makeRolePointsActor(2);
    const spent = await activateCostGatedSubstitutionPerk(actor);
    expect(spent).toBe(true);
    expect(actor._rolePoints.system.resource.value).toBe(1);
  });

  test("warns and returns false with no Cheer Points", async () => {
    const actor = makeRolePointsActor(0);
    const spent = await activateCostGatedSubstitutionPerk(actor);
    expect(spent).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});
