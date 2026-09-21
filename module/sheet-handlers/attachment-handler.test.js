import { jest } from '@jest/globals';
import { createEntry, createItemCopies, deleteAttachmentsForItem, onEquipmentPackageDrop } from './attachment-handler.mjs';
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

describe("onEquipmentPackageDrop", () => {
  let created;

  beforeEach(() => {
    created = [];
    global.fromUuid = jest.fn(async (uuid) => ({ uuid, type: uuid.includes('gear') ? 'gear' : 'weapon', system: { items: {} } }));
    global.Item.create = jest.fn(async (doc) => {
      const made = { type: doc.type, system: doc.system, flags: {} };
      made.setFlag = jest.fn(async (scope, key, value) => {
        made.flags[`${scope}.${key}`] = value;
      });
      created.push(made);
      return made;
    });
  });

  function makePackage(overrides = {}) {
    return {
      name: "Autobot Standard Issue",
      system: {
        packageType: 'standardIssue',
        items: {
          a: { uuid: "Compendium.essence20.tf_crb.Item.blaster" },
          b: { uuid: "Compendium.essence20.tf_crb.Item.gear-repair-kit" },
        },
      },
      ...overrides,
    };
  }

  test("stamps flags.essence20.equipmentPackage on every granted item", async () => {
    const actor = { items: [], system: { level: 1 } };
    await onEquipmentPackageDrop(actor, makePackage());

    expect(created).toHaveLength(2);
    for (const item of created) {
      expect(item.setFlag).toHaveBeenCalledWith('essence20', 'equipmentPackage', {
        name: "Autobot Standard Issue",
        packageType: 'standardIssue',
      });
    }
  });

  test("falls back to a null packageType when the package doesn't set one", async () => {
    const pkg = makePackage();
    delete pkg.system.packageType;
    await onEquipmentPackageDrop({ items: [], system: { level: 1 } }, pkg);

    expect(created[0].setFlag).toHaveBeenCalledWith('essence20', 'equipmentPackage', {
      name: "Autobot Standard Issue",
      packageType: null,
    });
  });
});

describe("deleteAttachmentsForItem", () => {
  // A Role can list the same Perk uuid at several levels. Two shapes come out of that, and
  // they have to be taken apart differently on the way back down:
  //   - a non-stacking Perk gets one copy per entry, each tagged with the entry it came from
  //   - an advances-stacking Perk gets ONE copy that absorbs every later entry
  const EXPERTISE = "Compendium.essence20.gi_joe_crb.Item.F9kOLys1Iu4UOg22";
  const EXTRA_ATTACK = "Compendium.essence20.pr_crb.Item.ExtraAttack000000";

  // Commando: Expertise at 1st and again at 7th (GI Joe CRB p.72).
  const commando = {
    _id: "role1",
    system: {
      items: {
        "9bcd": { uuid: EXPERTISE, type: "perk", name: "Expertise", level: 1 },
        "9bcf": { uuid: EXPERTISE, type: "perk", name: "Expertise", level: 7 },
      },
    },
  };

  const makeCopy = ({ id, sourceId, collectionId, parentId = "role1", canAdvance = false, currentValue = 0, baseValue = 1 }) => ({
    _id: id,
    flags: { core: { sourceId } },
    _stats: {},
    // onPerkDelete runs for real here (it is fired, unawaited, from the branch under test) and
    // ends by recursing into deleteAttachmentsForItem with this same copy - so it needs its own
    // empty items map, or that recursion throws as an unhandled rejection and kills the run.
    system: { items: {}, advances: { canAdvance, currentValue, baseValue, increaseValue: 1 } },
    getFlag: (scope, key) => (key === "parentId" ? parentId : key === "collectionId" ? collectionId : undefined),
    delete: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
  });

  const actorWith = (items) => ({
    system: { level: 6 },
    items: Object.assign([...items], { get: (id) => items.find(i => i._id === id) }),
  });

  test("dropping from 7th to 6th removes only the 7th-level Expertise, not the 1st-level one", async () => {
    const first = makeCopy({ id: "p1", sourceId: EXPERTISE, collectionId: "9bcd" });
    const second = makeCopy({ id: "p2", sourceId: EXPERTISE, collectionId: "9bcf" });
    const actor = actorWith([first, second]);

    await deleteAttachmentsForItem(commando, actor, 7, 6);

    expect(second.delete).toHaveBeenCalled();
    expect(first.delete).not.toHaveBeenCalled();
  });

  test("the 7th-level twin is removable at all - it carries the Role link its pair does", async () => {
    // Regression: onMultiSkillPerkDrop used to create this copy with no parentId and no
    // collectionId, so nothing here could match it and a level reduction left it behind.
    // null, not undefined - a default parameter would quietly put the real parentId back.
    const orphan = makeCopy({ id: "p2", sourceId: EXPERTISE, collectionId: null, parentId: null });
    const actor = actorWith([orphan]);

    await deleteAttachmentsForItem(commando, actor, 7, 6);

    expect(orphan.delete).not.toHaveBeenCalled();   // documents the old, broken shape

    const linked = makeCopy({ id: "p3", sourceId: EXPERTISE, collectionId: "9bcf" });
    await deleteAttachmentsForItem(commando, actorWith([linked]), 7, 6);
    expect(linked.delete).toHaveBeenCalled();
  });

  test("an advances-stacking Perk is still decremented, not deleted", async () => {
    // One copy absorbs every entry, so it is matched by uuid rather than by collectionId -
    // the key it carries is the FIRST entry's, not the one being taken away.
    const role = {
      _id: "role1",
      system: {
        items: {
          aaa: { uuid: EXTRA_ATTACK, type: "perk", name: "Extra Attack", level: 5 },
          bbb: { uuid: EXTRA_ATTACK, type: "perk", name: "Extra Attack", level: 15 },
        },
      },
    };
    const stacked = makeCopy({
      id: "p1", sourceId: EXTRA_ATTACK, collectionId: "aaa", canAdvance: true, currentValue: 2, baseValue: 1,
    });
    const actor = actorWith([stacked]);
    actor.system.level = 14;

    await deleteAttachmentsForItem(role, actor, 15, 14);

    expect(stacked.update).toHaveBeenCalledWith({ "system.advances.currentValue": 1 });
    expect(stacked.delete).not.toHaveBeenCalled();
  });
});
