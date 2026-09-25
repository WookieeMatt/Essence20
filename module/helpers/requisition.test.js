import { jest } from '@jest/globals';
import { requisitionSkill, requisitionDif, requisitionAccess, requisitionDrop, rollRequisition } from './requisition.mjs';

describe("requisitionSkill", () => {
  test("weapons use Targeting", () => {
    expect(requisitionSkill({ type: 'weapon', system: {} })).toBe('targeting');
  });

  test("armor granting a Toughness bonus uses Athletics", () => {
    expect(requisitionSkill({ type: 'armor', system: { totalBonusToughness: 2, totalBonusEvasion: 0 } })).toBe('athletics');
  });

  test("armor granting only an Evasion bonus uses Acrobatics", () => {
    expect(requisitionSkill({ type: 'armor', system: { totalBonusToughness: 0, totalBonusEvasion: 1 } })).toBe('acrobatics');
  });

  test("armor granting both bonuses falls to Athletics", () => {
    expect(requisitionSkill({ type: 'armor', system: { totalBonusToughness: 1, totalBonusEvasion: 1 } })).toBe('athletics');
  });

  test("armor with no bonuses defaults to Athletics", () => {
    expect(requisitionSkill({ type: 'armor', system: {} })).toBe('athletics');
  });
});

describe("requisitionDif", () => {
  test("reads the DIF for the combined Availability tier", () => {
    expect(requisitionDif({ system: { totalAvailability: 'restricted' } })).toBe(15);
    expect(requisitionDif({ system: { totalAvailability: 'theoretical' } })).toBe(30);
  });

  test("standard / automatic are DIF 0", () => {
    expect(requisitionDif({ system: { totalAvailability: 'standard' } })).toBe(0);
  });

  test("falls back to the base availability, then to 0", () => {
    expect(requisitionDif({ system: { availability: 'limited' } })).toBe(10);
    expect(requisitionDif({ system: {} })).toBe(0);
  });

  const EARLY_ADOPTER_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.WrRChund2zAcHYfe";

  function makeActor(perkIds = []) {
    return { items: perkIds.map(id => ({ type: 'perk', flags: { core: { sourceId: id } } })) };
  }

  test("Early Adopter reduces a Prototypical/Theoretical requisition DIF by 5", () => {
    const actor = makeActor([EARLY_ADOPTER_ID]);
    expect(requisitionDif({ system: { totalAvailability: 'prototype' } }, actor)).toBe(15);
    expect(requisitionDif({ system: { totalAvailability: 'theoretical' } }, actor)).toBe(25);
  });

  test("Early Adopter doesn't touch a lower Availability tier, or apply without the Perk", () => {
    const actor = makeActor([EARLY_ADOPTER_ID]);
    expect(requisitionDif({ system: { totalAvailability: 'restricted' } }, actor)).toBe(15);
    expect(requisitionDif({ system: { totalAvailability: 'prototype' } }, makeActor())).toBe(20);
  });
});

describe("requisitionAccess", () => {
  const armorActor = (qualified, trained) => ({
    system: { qualified: { armors: qualified }, trained: { armors: trained } },
  });
  const armor = classification => ({ type: 'armor', system: { classification } });

  test("Qualified armor needs no requisition", () => {
    const actor = armorActor({ medium: true }, { medium: true });
    expect(requisitionAccess(actor, armor('medium'))).toBe('qualified');
  });

  test("Trained-but-not-Qualified armor is requisitionable", () => {
    const actor = armorActor({ medium: false }, { medium: true });
    expect(requisitionAccess(actor, armor('medium'))).toBe('trained');
  });

  test("armor the character has neither in is out of reach", () => {
    const actor = armorActor({ heavy: false }, { heavy: false });
    expect(requisitionAccess(actor, armor('heavy'))).toBe('none');
  });

  // The gap this function documents: nothing on a weapon Item says which of
  // CONFIG.E20.weaponTypes it is, so its access cannot be decided from data yet.
  test("a weapon is unknown, because weapons carry no weaponTypes field", () => {
    const actor = armorActor({}, {});
    expect(requisitionAccess(actor, { type: 'weapon', system: { classification: { size: 'medium' } } }))
      .toBe('unknown');
  });

  test("unclassified armor is unknown rather than assumed", () => {
    const actor = armorActor({}, {});
    expect(requisitionAccess(actor, armor('non'))).toBe('unknown');
    expect(requisitionAccess(actor, armor(null))).toBe('unknown');
  });
});

describe("rollRequisition", () => {
  // rollSkill reports its outcome now (see dice.mjs), so a Requisition can say whether the
  // request was granted - which is what the drop-to-requisition flow grants an item on.
  test("reports granted when the Requisition Test lands", async () => {
    const pool = makePool();
    const member = makeMember();
    member.rollSkill = jest.fn(async () => ({ success: true, outcomes: [] }));

    expect(await rollRequisition(member, { name: "Rocket Launcher", type: 'weapon', system: { totalAvailability: 'restricted' } }, pool)).toEqual({ granted: true });
  });

  test("reports not granted when it is denied, and still spends the attempt", async () => {
    const pool = makePool();
    const member = makeMember();
    member.rollSkill = jest.fn(async () => ({ success: false, outcomes: [] }));

    expect(await rollRequisition(member, { name: "Rocket Launcher", type: 'weapon', system: { totalAvailability: 'restricted' } }, pool)).toEqual({ granted: false });
    expect(pool.update).toHaveBeenCalledWith(expect.objectContaining({
      'system.requisition.attempts': 2,
    }));
  });

  test("backing out of the dialog spends nothing", async () => {
    const pool = makePool();
    const member = makeMember();
    member.rollSkill = jest.fn(async () => ({ cancelled: true }));

    expect(await rollRequisition(member, { name: "Rocket Launcher", type: 'weapon', system: { totalAvailability: 'restricted' } }, pool)).toEqual({ cancelled: true });
    expect(pool.update).not.toHaveBeenCalled();
  });

  function makeMember(name = "Duke") {
    return { name, rollSkill: jest.fn() };
  }

  function makePool(requisition = { attempts: 3, log: [] }) {
    return {
      name: "Strike Team",
      system: { requisition },
      update: jest.fn(async () => {}),
    };
  }

  test("rolls as the member: its requisition skill vs the item DIF, with a requisition flavor tag", async () => {
    const member = makeMember();
    await rollRequisition(member, { name: "Rocket Launcher", type: 'weapon', system: { totalAvailability: 'restricted' } }, makePool());

    expect(member.rollSkill).toHaveBeenCalledWith(expect.objectContaining({
      skill: 'targeting',
      dif: 15,
      shiftUp: 0,
      shiftDown: 0,
      requisitionItemName: "Rocket Launcher",
    }));
  });

  describe("Expert Guidance (Factions in Action Vol. 2, General Perk, p.94)", () => {
    const EXPERT_GUIDANCE_ID = "Compendium.essence20.intercontinental_adventures.Item.oUQUSWSj3JZ1tBR3";

    function makeMemberWithPerk() {
      const member = makeMember();
      member.items = [{ type: 'perk', flags: { core: { sourceId: EXPERT_GUIDANCE_ID } } }];
      return member;
    }

    test("grants ↑2 when requisitioning Theoretical equipment", async () => {
      const member = makeMemberWithPerk();
      await rollRequisition(
        member, { name: "Ray Gun", type: 'weapon', system: { totalAvailability: 'theoretical' } }, makePool(),
      );

      expect(member.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ shiftUp: 2 }));
    });

    test("doesn't apply below Theoretical, or without the Perk", async () => {
      const member = makeMemberWithPerk();
      await rollRequisition(
        member, { name: "Rocket Launcher", type: 'weapon', system: { totalAvailability: 'restricted' } }, makePool(),
      );
      expect(member.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ shiftUp: 0 }));

      const noPerkMember = makeMember();
      await rollRequisition(
        noPerkMember, { name: "Ray Gun", type: 'weapon', system: { totalAvailability: 'theoretical' } }, makePool(),
      );
      expect(noPerkMember.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ shiftUp: 0 }));
    });
  });

  describe("Benefits of Command (GI Joe CRB, Officer base, p.84)", () => {
    function makeMemberWithBenefitsOfCommand(pending = { edge: true }) {
      const member = makeMember();
      member.getFlag = jest.fn((scope, key) => (
        scope == 'essence20' && key == 'pendingBenefitsOfCommand' ? pending : undefined
      ));
      member.unsetFlag = jest.fn();
      return member;
    }

    test("passes edge:true to rollSkill when a banked Edge is pending", async () => {
      const member = makeMemberWithBenefitsOfCommand();
      member.rollSkill = jest.fn(async () => ({ success: true, outcomes: [] }));

      await rollRequisition(member, { name: "Rocket Launcher", type: 'weapon', system: { totalAvailability: 'restricted' } }, makePool());

      expect(member.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ edge: true }));
    });

    test("clears the banked Edge after a completed roll", async () => {
      const member = makeMemberWithBenefitsOfCommand();
      member.rollSkill = jest.fn(async () => ({ success: true, outcomes: [] }));

      await rollRequisition(member, { name: "Rocket Launcher", type: 'weapon', system: { totalAvailability: 'restricted' } }, makePool());

      expect(member.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingBenefitsOfCommand');
    });

    test("doesn't clear the banked Edge when the dialog is cancelled", async () => {
      const member = makeMemberWithBenefitsOfCommand();
      member.rollSkill = jest.fn(async () => ({ cancelled: true }));

      await rollRequisition(member, { name: "Rocket Launcher", type: 'weapon', system: { totalAvailability: 'restricted' } }, makePool());

      expect(member.unsetFlag).not.toHaveBeenCalled();
    });

    test("passes edge:false without a banked Edge", async () => {
      const member = makeMember();
      member.rollSkill = jest.fn(async () => ({ success: true, outcomes: [] }));

      await rollRequisition(member, { name: "Rocket Launcher", type: 'weapon', system: { totalAvailability: 'restricted' } }, makePool());

      expect(member.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ edge: false }));
    });
  });

  test("spends one attempt from the pool and prepends a log entry tagged with the member", async () => {
    const pool = makePool({ attempts: 3, log: [{ memberName: "X", itemName: "Old", availability: "standard", dif: 0, time: 1 }] });
    await rollRequisition(makeMember("Scarlett"), { name: "Ballistic Armor", type: 'armor', system: { totalAvailability: 'limited', totalBonusToughness: 2 } }, pool);

    const update = pool.update.mock.calls[0][0];
    expect(update['system.requisition.attempts']).toBe(2);
    expect(update['system.requisition.log']).toHaveLength(2);
    expect(update['system.requisition.log'][0]).toMatchObject({ memberName: "Scarlett", itemName: "Ballistic Armor", availability: 'limited', dif: 10 });
    expect(update['system.requisition.log'][1].itemName).toBe("Old");
  });

  test("pool attempts never goes below zero", async () => {
    const pool = makePool({ attempts: 0, log: [] });
    await rollRequisition(makeMember(), { name: "Prototype Rifle", type: 'weapon', system: { totalAvailability: 'prototype' } }, pool);

    expect(pool.update.mock.calls[0][0]['system.requisition.attempts']).toBe(0);
  });

  test("caps the log at 30 entries", async () => {
    const log = Array.from({ length: 30 }, (_, i) => ({ memberName: "m", itemName: `e${i}`, availability: 'standard', dif: 0, time: i }));
    const pool = makePool({ attempts: 10, log });
    await rollRequisition(makeMember(), { name: "Newest", type: 'weapon', system: { totalAvailability: 'standard' } }, pool);

    const written = pool.update.mock.calls[0][0]['system.requisition.log'];
    expect(written).toHaveLength(30);
    expect(written[0].itemName).toBe("Newest");
    expect(written[29].itemName).toBe("e28");
  });

  test("tolerates a pool with no requisition data yet", async () => {
    const pool = { name: "Cell", system: {}, update: jest.fn(async () => {}) };
    const member = makeMember();
    await rollRequisition(member, { name: "Blaster", type: 'weapon', system: { totalAvailability: 'limited' } }, pool);

    expect(member.rollSkill).toHaveBeenCalled();
    expect(pool.update.mock.calls[0][0]['system.requisition.attempts']).toBe(0);
  });
});

describe("requisitionDrop", () => {
  // The drop flow talks to the player through notifications and localized strings, so both
  // globals have to exist for it to get as far as the decision being tested.
  beforeEach(() => {
    global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
    global.game = { i18n: { format: jest.fn(key => key), localize: jest.fn(key => key) } };
  });

  const member = (overrides = {}) => ({
    name: "Duke",
    system: { qualified: { armors: {} }, trained: { armors: {} } },
    rollSkill: jest.fn(async () => ({ success: true, outcomes: [] })),
    createEmbeddedDocuments: jest.fn(async () => []),
    ...overrides,
  });
  const pool = (attempts = 3) => ({
    name: "Strike Team",
    system: { requisition: { attempts, log: [] } },
    update: jest.fn(async () => {}),
  });
  // limited (DIF 10) by default: standard/automatic is DIF 0, which is an automatic grant with
  // no roll at all, so it would not exercise the paths these tests are about.
  const armor = (classification, availability = 'limited') => ({
    name: "Ballistic Armor", type: 'armor',
    system: { classification, availability, totalAvailability: availability },
    toObject: () => ({ name: "Ballistic Armor", type: 'armor' }),
  });

  test("a Qualified item is taken: no roll, no attempt spent, added to the member", async () => {
    const duke = member({ system: { qualified: { armors: { medium: true } }, trained: { armors: {} } } });
    const squad = pool(3);

    expect(await requisitionDrop(duke, armor('medium'), squad)).toEqual({ granted: true });
    expect(duke.rollSkill).not.toHaveBeenCalled();
    expect(duke.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [expect.objectContaining({ name: "Ballistic Armor" })]);
    expect(squad.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.requisition.attempts': 3 }));
  });

  test("a Trained item is rolled for, and lands on the sheet when granted", async () => {
    const duke = member({ system: { qualified: { armors: {} }, trained: { armors: { medium: true } } } });
    const squad = pool(3);

    expect(await requisitionDrop(duke, armor('medium'), squad)).toEqual({ granted: true });
    expect(duke.rollSkill).toHaveBeenCalled();
    expect(duke.createEmbeddedDocuments).toHaveBeenCalled();
    expect(squad.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.requisition.attempts': 2 }));
  });

  test("a denied request spends the attempt and grants nothing", async () => {
    const duke = member({
      system: { qualified: { armors: {} }, trained: { armors: { medium: true } } },
      rollSkill: jest.fn(async () => ({ success: false, outcomes: [] })),
    });
    const squad = pool(3);

    expect(await requisitionDrop(duke, armor('medium'), squad)).toEqual({ granted: false });
    expect(duke.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(squad.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.requisition.attempts': 2 }));
  });

  test("something the member is neither Trained nor Qualified in is refused outright", async () => {
    const duke = member({ system: { qualified: { armors: { heavy: false } }, trained: { armors: { heavy: false } } } });
    const squad = pool(3);

    expect(await requisitionDrop(duke, armor('heavy'), squad)).toEqual({ refused: 'untrained' });
    expect(duke.rollSkill).not.toHaveBeenCalled();
    expect(squad.update).not.toHaveBeenCalled();
  });

  test("an empty pool blocks a Requisition Test, but never a Qualified take", async () => {
    const trained = member({ system: { qualified: { armors: {} }, trained: { armors: { medium: true } } } });
    expect(await requisitionDrop(trained, armor('medium'), pool(0))).toEqual({ refused: 'noAttempts' });
    expect(trained.rollSkill).not.toHaveBeenCalled();

    const qualified = member({ system: { qualified: { armors: { medium: true } }, trained: { armors: {} } } });
    expect(await requisitionDrop(qualified, armor('medium'), pool(0))).toEqual({ granted: true });
  });

  test("standard availability is DIF 0, so it is granted outright with no roll", async () => {
    const duke = member({ system: { qualified: { armors: {} }, trained: { armors: { medium: true } } } });
    const squad = pool(3);

    expect(await requisitionDrop(duke, armor('medium', 'standard'), squad))
      .toEqual({ granted: true });
    expect(duke.rollSkill).not.toHaveBeenCalled();
    expect(duke.createEmbeddedDocuments).toHaveBeenCalled();
    // The squad still asked for it, so the attempt is spent.
    expect(squad.update).toHaveBeenCalledWith(expect.objectContaining({
      'system.requisition.attempts': 2,
    }));
  });

  test("only weapons and armor can be requisitioned", async () => {
    const duke = member();
    const squad = pool(3);
    const perk = { name: "Brawler", type: 'perk', system: {} };

    expect(await requisitionDrop(duke, perk, squad)).toEqual({ refused: 'type' });
    expect(squad.update).not.toHaveBeenCalled();
  });

  test("backing out of the roll dialog grants nothing and spends nothing", async () => {
    const duke = member({
      system: { qualified: { armors: {} }, trained: { armors: { medium: true } } },
      rollSkill: jest.fn(async () => ({ cancelled: true })),
    });
    const squad = pool(3);

    expect(await requisitionDrop(duke, armor('medium'), squad)).toEqual({ cancelled: true });
    expect(duke.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(squad.update).not.toHaveBeenCalled();
  });
});
