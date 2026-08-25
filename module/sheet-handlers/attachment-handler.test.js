import { jest } from '@jest/globals';
import { createEntry, createItemCopies } from './attachment-handler.mjs';
import ChoicesSelector from '../apps/choices-selector.mjs';

// This project runs native ESM under Jest (jest.config.js has no Babel transform), so the
// auto-hoisted jest.mock('./path') form (which relies on a Babel transform to work) isn't
// available here - jest.unstable_mockModule would be the "real" fix, but createItemCopies'
// other transitive dependency (perk-handler.mjs's setPerkValues) turns out to be safe to run
// for real against a plain hasChoice:false fixture (confirmed by reading its source: it only
// does anything beyond a no-op for a few hardcoded compendium ids or hasChoice/
// hasMorphedToughnessBonus perks). The one dependency that can't run for real is
// ChoicesSelector.render() - jest.setup.js's ApplicationV2 stub has no render() at all (this
// suite never needed to actually paint a dialog before) - so it's stubbed directly on the
// class here instead of importing a whole mocking framework for one method.

describe("createEntry", () => {
  test("returns null when the target/dropped type combination isn't attachable", () => {
    expect(createEntry({ type: "gear", system: {} }, { type: "armor" })).toBeNull();
  });

  test("always includes the base uuid/img/name/type/description fields", () => {
    const dropped = { uuid: "Item.abc", img: "icon.svg", name: "Test", type: "perk", system: { description: "desc" } };
    const entry = createEntry(dropped, { type: "influence" });
    expect(entry).toMatchObject({ uuid: "Item.abc", img: "icon.svg", name: "Test", type: "perk", description: "desc" });
  });

  test("armor + upgrade(armor) carries over the upgrade's armor-specific fields", () => {
    const dropped = {
      uuid: "Item.abc", img: "icon.svg", name: "Test", type: "upgrade",
      system: { type: "armor", armorBonus: 2, availability: "standard", benefit: "b", prerequisite: null, source: {}, traits: [] },
    };
    const entry = createEntry(dropped, { type: "armor" });
    expect(entry.armorBonus).toBe(2);
    expect(entry.subtype).toBe("armor");
  });

  test("armor + upgrade(weapon) doesn't match and falls through to null", () => {
    const dropped = { uuid: "Item.abc", img: "icon.svg", name: "Test", type: "upgrade", system: { type: "weapon" } };
    expect(createEntry(dropped, { type: "armor" })).toBeNull();
  });

  test("equipmentPackage accepts armor/gear/shield/weapon and carries their items", () => {
    const dropped = { uuid: "Item.abc", img: "icon.svg", name: "Test", type: "gear", system: { items: { a: {} }, description: "" } };
    const entry = createEntry(dropped, { type: "equipmentPackage" });
    expect(entry.items).toEqual({ a: {} });
  });

  test("focus + perk sets subtype and level 1", () => {
    const dropped = { uuid: "Item.abc", img: "icon.svg", name: "Test", type: "perk", system: { type: "general", description: "" } };
    const entry = createEntry(dropped, { type: "focus" });
    expect(entry.subtype).toBe("general");
    expect(entry.level).toBe(1);
  });

  test("focus + role returns just the base entry", () => {
    const dropped = { uuid: "Item.abc", img: "icon.svg", name: "Test", type: "role", system: { description: "" } };
    const entry = createEntry(dropped, { type: "focus" });
    expect(entry).not.toHaveProperty("level");
  });

  test("influence accepts perk and hangUp", () => {
    const perk = { uuid: "Item.a", img: "i.svg", name: "P", type: "perk", system: { description: "" } };
    const hangUp = { uuid: "Item.b", img: "i.svg", name: "H", type: "hangUp", system: { description: "" } };
    expect(createEntry(perk, { type: "influence" })).not.toBeNull();
    expect(createEntry(hangUp, { type: "influence" })).not.toBeNull();
  });

  test("origin accepts altMode and perk", () => {
    const altMode = { uuid: "Item.a", img: "i.svg", name: "A", type: "altMode", system: { description: "" } };
    const perk = { uuid: "Item.b", img: "i.svg", name: "P", type: "perk", system: { description: "" } };
    expect(createEntry(altMode, { type: "origin" })).not.toBeNull();
    expect(createEntry(perk, { type: "origin" })).not.toBeNull();
  });

  test("perk + perk clears role to null (top-level perk, not a role-granted one)", () => {
    const dropped = { uuid: "Item.abc", img: "icon.svg", name: "Test", type: "perk", system: { description: "" } };
    const entry = createEntry(dropped, { type: "perk" });
    expect(entry.role).toBeNull();
  });

  test("role + perk sets subtype and level 1", () => {
    const dropped = { uuid: "Item.abc", img: "icon.svg", name: "Test", type: "perk", system: { type: "role", description: "" } };
    const entry = createEntry(dropped, { type: "role" });
    expect(entry.subtype).toBe("role");
    expect(entry.level).toBe(1);
  });

  test("role + rolePoints carries over resource/bonus fields", () => {
    const dropped = {
      uuid: "Item.abc", img: "icon.svg", name: "Test", type: "rolePoints",
      system: { bonus: { type: "none" }, isActivatable: false, isActive: false, powerCost: null, resource: { max: 2 }, description: "" },
    };
    const entry = createEntry(dropped, { type: "role" });
    expect(entry.resource).toEqual({ max: 2 });
  });

  test("role + faction returns just the base entry", () => {
    const dropped = { uuid: "Item.abc", img: "icon.svg", name: "Test", type: "faction", system: { description: "" } };
    const entry = createEntry(dropped, { type: "role" });
    expect(entry).not.toBeNull();
  });

  test("shield + weaponEffect carries over combat stats", () => {
    const dropped = {
      uuid: "Item.abc", img: "icon.svg", name: "Test", type: "weaponEffect",
      system: { classification: "c", damageValue: 3, damageType: "energy", numHands: 1, numTargets: 1, radius: 0, range: {}, shiftDown: 0, traits: [], totalReach: 0, description: "" },
    };
    const entry = createEntry(dropped, { type: "shield" });
    expect(entry.damageValue).toBe(3);
  });

  test("weapon + upgrade(weapon) carries the upgrade's weapon-specific fields", () => {
    const dropped = {
      uuid: "Item.abc", img: "icon.svg", name: "Test", type: "upgrade",
      system: { type: "weapon", aimShiftBonus: 1, availability: "standard", benefit: "b", prerequisite: null, source: {}, traits: [], description: "" },
    };
    const entry = createEntry(dropped, { type: "weapon" });
    expect(entry.aimShiftBonus).toBe(1);
  });

  test("weapon + weaponEffect carries over combat stats", () => {
    const dropped = {
      uuid: "Item.abc", img: "icon.svg", name: "Test", type: "weaponEffect",
      system: { classification: "c", damageValue: 4, damageType: "energy", numHands: 1, numTargets: 1, radius: 0, range: {}, shiftDown: 0, traits: [], totalReach: 0, description: "" },
    };
    const entry = createEntry(dropped, { type: "weapon" });
    expect(entry.damageValue).toBe(4);
  });
});

describe("createItemCopies", () => {
  function perkEntry(overrides = {}) {
    return { type: "perk", uuid: `Compendium.essence20.pr_crb.Item.${overrides.name ?? "x"}`, img: "i.svg", name: "Perk", level: 2, ...overrides };
  }

  function makeOwner() {
    return { system: { level: 5 }, items: [] };
  }

  function makeRole() {
    return { type: "role", _id: "role1" };
  }

  // ChoicesSelector.render() can't run for real under Jest (jest.setup.js's ApplicationV2 stub
  // has no render() at all - this suite never needed to actually paint a dialog before), so it's
  // stubbed directly on the prototype, capturing the instance each call so assertions can
  // inspect what the dialog would have shown without a full mocking framework.
  let capturedDialog = null;

  beforeEach(() => {
    capturedDialog = null;
    ChoicesSelector.prototype.render = jest.fn(function () {
      capturedDialog = this;
      return this;
    });
    global.Item.create = jest.fn(async (doc) => ({
      type: doc.type,
      system: doc.system,
      setFlag: jest.fn(),
      update: jest.fn(),
    }));
    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      type: "perk",
      system: { advances: { canAdvance: false }, hasChoice: false, hasMorphedToughnessBonus: false },
    }));
  });

  test("grants an ungrouped entry unconditionally, same as before choiceGroup existed", async () => {
    const owner = makeOwner();
    const role = makeRole();
    const items = { a: perkEntry({ name: "You Got This!" }) };

    await createItemCopies(items, owner, "perk", role, 0, 5);

    expect(global.Item.create).toHaveBeenCalledTimes(1);
    expect(capturedDialog).toBeNull();
  });

  test("a choiceGroup pair diverts to a dialog instead of granting both", async () => {
    const owner = makeOwner();
    const role = makeRole();
    const items = {
      a: perkEntry({ name: "Whatever We Need", choiceGroup: "black-2" }),
      b: perkEntry({ name: "Iron Bravado", choiceGroup: "black-2" }),
    };

    await createItemCopies(items, owner, "perk", role, 0, 5);

    expect(global.Item.create).not.toHaveBeenCalled();
    expect(capturedDialog).not.toBeNull();
    expect(Object.keys(capturedDialog._choices)).toEqual(["a", "b"]);
    expect(capturedDialog._choices.a.label).toBe("Whatever We Need");
    expect(capturedDialog._choices.b.label).toBe("Iron Bravado");
    expect(capturedDialog._actor).toBe(owner);
    expect(capturedDialog._item).toBe(role);
    expect(capturedDialog._actionType).toBe("rolePerk");
    expect(capturedDialog._prompt).toBe("E20.SelectRolePerk");
    expect(capturedDialog._title).toBe("E20.SelectRolePerkTitle");
  });

  test("entries sharing a level but NOT a choiceGroup are still both granted (existing precedent, e.g. Black Ranger level 2's own simultaneous grants)", async () => {
    const owner = makeOwner();
    const role = makeRole();
    const items = {
      a: perkEntry({ name: "Whatever We Need" }),
      b: perkEntry({ name: "You Got This!" }),
    };

    await createItemCopies(items, owner, "perk", role, 0, 5);

    expect(global.Item.create).toHaveBeenCalledTimes(2);
    expect(capturedDialog).toBeNull();
  });

  test("a choiceGroup with only one entry actually in-window is granted directly, no dialog", async () => {
    const owner = makeOwner();
    const role = makeRole();
    // Only one member of the group is within the level window being processed.
    const items = {
      a: perkEntry({ name: "Iron Bravado", level: 2, choiceGroup: "black-2" }),
      b: perkEntry({ name: "Future Alternate", level: 10, choiceGroup: "black-2" }),
    };

    await createItemCopies(items, owner, "perk", role, 0, 5);

    expect(global.Item.create).toHaveBeenCalledTimes(1);
    expect(capturedDialog).toBeNull();
  });

  test("a choiceGroup entry outside the level window is skipped entirely, same as an ungrouped one would be", async () => {
    const owner = makeOwner();
    const role = makeRole();
    const items = {
      a: perkEntry({ name: "Whatever We Need", level: 2, choiceGroup: "black-2" }),
      b: perkEntry({ name: "Iron Bravado", level: 2, choiceGroup: "black-2" }),
    };

    // Already past level 2 last time this was processed - nothing newly in-window.
    await createItemCopies(items, owner, "perk", role, 2, 5);

    expect(global.Item.create).not.toHaveBeenCalled();
    expect(capturedDialog).toBeNull();
  });
});
