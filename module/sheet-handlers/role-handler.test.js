import { jest } from '@jest/globals';
import { _setFocusValues, _trainingUpdate, onFocusDelete, onFocusDrop, roleValueChange } from "./role-handler.mjs";

describe("roleValueChange", () => {
  test("returns 0 when the level hasn't changed", () => {
    expect(roleValueChange(5, ["3", "7"], 5)).toBe(0);
  });

  test("returns 0 for a fresh actor (no lastProcessedLevel) at level 0", () => {
    expect(roleValueChange(0, ["3", "7"])).toBe(0);
  });

  describe("leveling up", () => {
    test("counts every listed level from scratch when there's no lastProcessedLevel", () => {
      expect(roleValueChange(10, ["3", "7", "12"])).toBe(2);
    });

    test("only counts levels reached since lastProcessedLevel", () => {
      // Already processed up to level 5 (which covers "3"); leveling to 10 should only pick up "7"
      expect(roleValueChange(10, ["3", "7", "12"], 5)).toBe(1);
    });

    test("counts nothing when no listed level has been newly reached", () => {
      expect(roleValueChange(6, ["3", "7", "12"], 4)).toBe(0);
    });

    test("strips non-numeric characters from level labels", () => {
      expect(roleValueChange(10, ["Level3", "Level7"])).toBe(2);
    });
  });

  describe("leveling down", () => {
    test("counts levels above the new level that were already reached as a decrease", () => {
      // lastProcessedLevel is 10, so "12" was never actually reached/granted and isn't undone
      expect(roleValueChange(2, ["3", "7", "12"], 10)).toBe(-2);
    });

    test("only counts levels not already below the previously processed level", () => {
      // Was at level 10 (past "3" and "7"), dropping to level 6 should only undo "7"
      expect(roleValueChange(6, ["3", "7", "12"], 10)).toBe(-1);
    });
  });
});

describe("_trainingUpdate - the Role armor/weapon/upgrade training flags onRoleDrop/onRoleDelete write", () => {
  function makeActor() {
    return { update: jest.fn(async (data) => data) };
  }

  test("sets a trained flag true for every prof a Role lists (armors.trained, drop)", async () => {
    const actor = makeActor();
    const role = { system: { armors: { trained: ["light", "medium"] } } };

    await _trainingUpdate(actor, 'armors', 'trained', true, role);

    expect(actor.update).toHaveBeenCalledWith({ "system.trained.armors.light": true });
    expect(actor.update).toHaveBeenCalledWith({ "system.trained.armors.medium": true });
  });

  test("clears a trained flag on the symmetric delete pass", async () => {
    const actor = makeActor();
    const role = { system: { weapons: { qualified: ["ballistic"] } } };

    await _trainingUpdate(actor, 'weapons', 'qualified', false, role);

    expect(actor.update).toHaveBeenCalledWith({ "system.qualified.weapons.ballistic": false });
  });

  test("reads from system.upgrades.<itemType> instead when useUpgradesAccessor is set (armor upgrade training)", async () => {
    const actor = makeActor();
    const role = { system: { upgrades: { armors: { trained: ["limited"] } } } };

    await _trainingUpdate(actor, 'armors', 'trained', true, role, true);

    expect(actor.update).toHaveBeenCalledWith({ "system.trained.upgrades.armors.limited": true });
  });

  test("no-ops for a Role that lists no profs of that kind", async () => {
    const actor = makeActor();
    const role = { system: { armors: { trained: [] } } };

    await _trainingUpdate(actor, 'armors', 'trained', true, role);

    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("onFocusDrop - a Focus granting no Essence Increase (WTNV Citizen's Guide Foci)", () => {
  const ROLE_ID = "Compendium.essence20.wtnv_citizens_guide.Item.role1";

  function makeFocus({ essences = [] } = {}) {
    return {
      system: {
        essences, essenceLevels: [], items: {},
      },
    };
  }

  function makeActor() {
    const roleItem = { _id: 'role1', type: 'role', _stats: { compendiumSource: ROLE_ID } };
    const items = {
      documentsByType: { focus: [], role: [roleItem] },
    };

    return {
      system: { level: 1, focusEssence: null, essences: { strength: { max: 10, value: 3 } } },
      items,
      update: jest.fn(async (data) => Object.assign({}, data)),
      getFlag: jest.fn(),
    };
  }

  beforeEach(() => {
    global.Item = { create: jest.fn(async (doc) => ({ type: doc.type, system: doc.system, setFlag: jest.fn() })) };
    global.ui.notifications.error.mockClear();
  });

  test("completes the drop without setting system.focusEssence or touching any Essence", async () => {
    const focus = makeFocus({ essences: [] });
    focus.system.items = {};
    const attachedRoleEntry = { type: 'role', uuid: ROLE_ID };
    focus.system.items = { a: attachedRoleEntry };
    const actor = makeActor();
    const newFocus = { system: { essences: [], essenceLevels: [], items: {} } };
    const dropFunc = jest.fn(async () => [newFocus]);

    const result = await onFocusDrop(actor, focus, dropFunc);

    expect(dropFunc).toHaveBeenCalled();
    expect(global.ui.notifications.error).not.toHaveBeenCalled();
    // _setFocusValues is reached and completes normally - createItemCopies() just has nothing to
    // grant (an empty items collection), so it resolves to its own default `false`.
    expect(result).toBe(false);
    // No focusEssence update - the actor's own system.focusEssence stays null.
    expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.focusEssence': expect.anything() }));
  });
});

describe("_setFocusValues - skips Essence math entirely without a focusEssence", () => {
  test("doesn't touch actor.update for the Essence when focusEssence is unset", async () => {
    const actor = {
      system: { level: 1, focusEssence: null, essences: {} },
      update: jest.fn(),
    };
    const focus = { system: { essenceLevels: [], items: {} } };

    await _setFocusValues(focus, actor);

    expect(actor.update).not.toHaveBeenCalled();
  });

  test("still does the Essence math normally when focusEssence IS set", async () => {
    const actor = {
      system: { level: 5, focusEssence: 'strength', essences: { strength: { max: 10, value: 3 } } },
      update: jest.fn(),
    };
    const focus = { system: { essenceLevels: ["3"], items: {} } };

    await _setFocusValues(focus, actor);

    expect(actor.update).toHaveBeenCalledWith({
      'system.essences.strength.max': 11,
      'system.essences.strength.value': 4,
    });
  });
});

describe("_setFocusValues - grants every Item type the Focus's own grant map lists", () => {
  // TF CRB Sharpshooter's own grant map: a mix of "perk" entries and its own Role reference
  // entry (type "role", never itself a grant - see onFocusDrop's Role-mismatch check). A real
  // Focus like this used to only ever grant the "perk" entries, since createItemCopies() was
  // always called with a hardcoded "perk" type.
  function makeFocus(entries) {
    return { system: { essenceLevels: [], items: entries } };
  }

  function makeActor() {
    return {
      system: { level: 1, focusEssence: null, essences: {} },
      items: [],
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    global.Item = {
      create: jest.fn(async (doc) => ({
        type: doc.type, system: doc.system, setFlag: jest.fn(), update: jest.fn(),
      })),
    };
    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      type: uuid.includes('weapon') ? 'weapon' : 'perk',
      system: { advances: { canAdvance: false }, hasChoice: false, hasMorphedToughnessBonus: false },
    }));
  });

  test("grants a non-perk entry (e.g. a weapon) alongside a perk entry", async () => {
    const actor = makeActor();
    const focus = makeFocus({
      role1: { type: 'role', uuid: 'Compendium.essence20.tf_crb.Item.role1', name: 'Gunner' },
      perk1: { type: 'perk', uuid: 'Compendium.essence20.tf_crb.Item.perk1', name: 'Long Shot' },
      wep1: { type: 'weapon', uuid: 'Compendium.essence20.tf_crb.Item.weapon1', name: 'Long Range Rifle' },
    });

    const copyWasCreated = await _setFocusValues(focus, actor);

    expect(global.Item.create).toHaveBeenCalledTimes(2);
    expect(global.Item.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'perk' }), { parent: actor },
    );
    expect(global.Item.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'weapon' }), { parent: actor },
    );
    expect(copyWasCreated).toBe(true);
  });

  test("never grants the Focus's own Role reference entry", async () => {
    const actor = makeActor();
    const focus = makeFocus({
      role1: { type: 'role', uuid: 'Compendium.essence20.tf_crb.Item.role1', name: 'Gunner' },
    });

    await _setFocusValues(focus, actor);

    expect(global.Item.create).not.toHaveBeenCalled();
  });
});

describe("onFocusDelete - skips Essence math entirely without a focusEssence", () => {
  test("doesn't touch actor.update for the Essence when focusEssence is unset (still cleans up attachments)", async () => {
    const actor = {
      system: { focusEssence: null, essences: {} },
      update: jest.fn(),
      getFlag: jest.fn(),
      items: [],
    };
    const focus = { system: { essenceLevels: [] } };

    await onFocusDelete(actor, focus);

    expect(actor.update).not.toHaveBeenCalled();
  });
});
