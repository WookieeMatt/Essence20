import { jest } from "@jest/globals";
import {
  areHardpointWeaponsInoperable, canTargetVesselSystem, changeVesselConditionStacks, CLEAR_ALL_STACKS,
  countRepairedConditions, decorateTokenHudVesselConditions, ensureRepairSpecialized, findVesselAboard,
  getActiveVesselConditions, getEffectStacks, getRepairCandidates, getRepairDifficulty, getUnstablePenalty, getVesselConditionStacks,
  handleVesselConditionStacksRequest, hasTechnologySpecialization, imposeVesselConditionOnCrit,
  isStackingVesselCondition, isVesselCondition, isVesselSystemTarget, isZordLike, nextStackCount,
  openVesselRepairDialog, resolveVesselRepair, shouldBlockZordVesselCondition, stackedName,
  syncVesselConditionConsequences,
} from "./vessel-conditions.mjs";

/* A vessel actor whose status ActiveEffects behave like the real thing closely enough for the
   stack counter: toggleStatusEffect creates/deletes one, update() merges flags and name. */
function makeVessel({ type = "vehicle", statuses = {}, isOwner = true, healthMax = 10, system = {} } = {}) {
  const actor = {
    type,
    uuid: "Actor.vessel",
    name: "Astro Megaship",
    isOwner,
    statuses: new Set(),
    effects: [],
    system: { health: { max: healthMax }, ...system },
    getActiveTokens: () => [],
    createEmbeddedDocuments: jest.fn(async (_type, [data]) => {
      addEffect(actor, "immobilized", data._flags);
    }),
  };
  actor.toggleStatusEffect = jest.fn(async (statusId, { active } = {}) => {
    if (active === false || (active === undefined && actor.statuses.has(statusId))) {
      actor.effects = actor.effects.filter(effect => !effect.statuses.has(statusId));
      actor.statuses.delete(statusId);
    } else if (!actor.statuses.has(statusId)) {
      addEffect(actor, statusId);
    }
  });

  for (const [statusId, stacks] of Object.entries(statuses)) {
    addEffect(actor, statusId, stacks > 1 ? { essence20: { stacks } } : {});
  }

  return actor;
}

function addEffect(actor, statusId, flags = {}) {
  const effect = {
    statuses: new Set([statusId]),
    flags: { ...flags },
    name: statusId,
    getFlag: (scope, key) => effect.flags?.[scope]?.[key],
    update: jest.fn(async (data) => {
      if ("flags.essence20.stacks" in data) {
        effect.flags.essence20 = { ...(effect.flags.essence20 ?? {}), stacks: data["flags.essence20.stacks"] };
      }

      effect.name = data.name ?? effect.name;
    }),
    delete: jest.fn(async () => {
      actor.effects = actor.effects.filter(e => e !== effect);
      actor.statuses.delete(statusId);
    }),
  };
  actor.effects.push(effect);
  actor.statuses.add(statusId);
  return effect;
}

beforeEach(() => {
  ChatMessage.create.mockClear();
  ui.notifications.warn.mockClear();
  ui.notifications.info.mockClear();
  global.game.socket = { emit: jest.fn() };
  global.game.user = { id: "u1", isGM: false, isActiveGM: false };
  // fromStatusEffect's stand-in returns something whose updateSource the flag goes through.
  ActiveEffect.fromStatusEffect = jest.fn(async () => {
    const data = { _flags: {} };
    data.updateSource = jest.fn((update) => {
      data._flags = { essence20: { autoImmobilizedFromVessel: !!update["flags.essence20.autoImmobilizedFromVessel"] } };
    });
    return data;
  });
});

describe("classification", () => {
  test("all eight are vessel Conditions; Blanked and Jammed don't stack", () => {
    expect(isVesselCondition("compromised")).toBe(true);
    expect(isVesselCondition("blanked")).toBe(true);
    expect(isVesselCondition("stunned")).toBe(false);
    expect(isStackingVesselCondition("unstable")).toBe(true);
    expect(isStackingVesselCondition("blanked")).toBe(false);
    expect(isStackingVesselCondition("jammed")).toBe(false);
  });

  test("a Zord or Zord Megaform is Zord-like; a Combiner Megaform and a Vehicle aren't", () => {
    expect(isZordLike({ type: "zord" })).toBe(true);
    expect(isZordLike({ type: "megaform", system: { subtype: ["megaformZord"] } })).toBe(true);
    expect(isZordLike({ type: "megaform", system: { subtype: ["megaformCombiner"] } })).toBe(false);
    expect(isZordLike({ type: "vehicle" })).toBe(false);
  });
});

describe("stack counter", () => {
  test("getEffectStacks reads the flag, defaulting to 1, and 0 with no effect", () => {
    expect(getEffectStacks(null)).toBe(0);
    expect(getEffectStacks({ flags: {} })).toBe(1);
    expect(getEffectStacks({ flags: { essence20: { stacks: 3 } } })).toBe(3);
    expect(getEffectStacks({ flags: { essence20: { stacks: 0 } } })).toBe(1);
  });

  test("getVesselConditionStacks is 0 without the status", () => {
    const vessel = makeVessel({ statuses: { leaking: 2 } });
    expect(getVesselConditionStacks(vessel, "leaking")).toBe(2);
    expect(getVesselConditionStacks(vessel, "unstable")).toBe(0);
    expect(getVesselConditionStacks(null, "leaking")).toBe(0);
  });

  test("nextStackCount never goes below 0, and stackedName only suffixes above 1", () => {
    expect(nextStackCount(2, 1)).toBe(3);
    expect(nextStackCount(1, -1)).toBe(0);
    expect(nextStackCount(3, CLEAR_ALL_STACKS)).toBe(0);
    expect(nextStackCount(undefined, 1)).toBe(1);
    expect(stackedName("Unstable", 1)).toBe("Unstable");
    expect(stackedName("Unstable", 3)).toBe("Unstable ×3");
  });

  test("adding stacks: first application toggles the status on, the next ones count up and rename", async () => {
    const vessel = makeVessel();
    expect(await changeVesselConditionStacks(vessel, "unstable", 1)).toBe(1);
    expect(vessel.toggleStatusEffect).toHaveBeenCalledWith("unstable", { active: true });
    expect(getVesselConditionStacks(vessel, "unstable")).toBe(1);

    expect(await changeVesselConditionStacks(vessel, "unstable", 1)).toBe(2);
    const effect = vessel.effects.find(e => e.statuses.has("unstable"));
    expect(effect.flags.essence20.stacks).toBe(2);
    expect(effect.name).toBe("E20.StatusUnstable ×2");
  });

  test("removing stacks counts down, renames back at 1, and clears at 0", async () => {
    const vessel = makeVessel({ statuses: { leaking: 2 } });
    expect(await changeVesselConditionStacks(vessel, "leaking", -1)).toBe(1);
    expect(vessel.effects[0].name).toBe("E20.StatusLeaking");
    expect(await changeVesselConditionStacks(vessel, "leaking", -1)).toBe(0);
    expect(vessel.statuses.has("leaking")).toBe(false);
  });

  test("CLEAR_ALL_STACKS removes every stack at once", async () => {
    const vessel = makeVessel({ statuses: { spunOut: 3 } });
    expect(await changeVesselConditionStacks(vessel, "spunOut", CLEAR_ALL_STACKS)).toBe(0);
    expect(vessel.statuses.has("spunOut")).toBe(false);
  });

  test("a non-stacking Condition is just on or off", async () => {
    const vessel = makeVessel({ statuses: { jammed: 1 } });
    expect(await changeVesselConditionStacks(vessel, "jammed", 1)).toBe(1);
    expect(vessel.toggleStatusEffect).not.toHaveBeenCalled();
    expect(await changeVesselConditionStacks(vessel, "jammed", -1)).toBe(0);
  });

  test("ignores non-vessel statuses and missing actors", async () => {
    expect(await changeVesselConditionStacks(makeVessel(), "stunned", 1)).toBe(0);
    expect(await changeVesselConditionStacks(null, "unstable", 1)).toBe(0);
  });

  test("a user who can't edit the vessel relays the change to the GM", async () => {
    const vessel = makeVessel({ isOwner: false });
    expect(await changeVesselConditionStacks(vessel, "blanked", 1)).toBe(1);
    expect(game.socket.emit).toHaveBeenCalledWith("system.essence20", {
      action: "vesselConditionStacks", actorUuid: "Actor.vessel", statusId: "blanked", delta: 1,
    });
    expect(vessel.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("only the active GM acts on a relayed change", async () => {
    const vessel = makeVessel();
    fromUuid.mockResolvedValue(vessel);
    await handleVesselConditionStacksRequest({ actorUuid: "Actor.vessel", statusId: "sputtering", delta: 1 });
    expect(vessel.statuses.has("sputtering")).toBe(false);

    game.user.isActiveGM = true;
    await handleVesselConditionStacksRequest({ actorUuid: "Actor.vessel", statusId: "sputtering", delta: 1 });
    expect(vessel.statuses.has("sputtering")).toBe(true);
  });
});

describe("syncVesselConditionConsequences", () => {
  test("Immobilizes at 2 Sputtering or Spun-Out stacks, and only removes an Immobilized it added", async () => {
    const vessel = makeVessel({ statuses: { sputtering: 2 } });
    await syncVesselConditionConsequences(vessel);
    expect(vessel.statuses.has("immobilized")).toBe(true);

    await changeVesselConditionStacks(vessel, "sputtering", -1);
    expect(vessel.statuses.has("immobilized")).toBe(false);

    const grappled = makeVessel({ statuses: { immobilized: 1 } });
    await syncVesselConditionConsequences(grappled);
    expect(grappled.statuses.has("immobilized")).toBe(true);
  });

  test("one stack of Spun-Out doesn't Immobilize", async () => {
    const vessel = makeVessel({ statuses: { spunOut: 1 } });
    await syncVesselConditionConsequences(vessel);
    expect(vessel.statuses.has("immobilized")).toBe(false);
  });

  test("Defeats a Compromised vessel whose maximum Health has reached 0", async () => {
    const vessel = makeVessel({ statuses: { compromised: 3 }, healthMax: 0 });
    await syncVesselConditionConsequences(vessel);
    expect(vessel.toggleStatusEffect).toHaveBeenCalledWith("defeated", { active: true });

    const sturdy = makeVessel({ statuses: { compromised: 1 }, healthMax: 5 });
    await syncVesselConditionConsequences(sturdy);
    expect(sturdy.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("does nothing for a non-owner", async () => {
    const vessel = makeVessel({ statuses: { sputtering: 2 }, isOwner: false });
    await syncVesselConditionConsequences(vessel);
    expect(vessel.createEmbeddedDocuments).not.toHaveBeenCalled();
  });
});

describe("Zords are Special (p.26)", () => {
  test("blocks a vessel Condition on a Zord unless overridden", () => {
    const zord = { type: "zord" };
    expect(shouldBlockZordVesselCondition(zord, new Set(["leaking"]))).toBe(true);
    expect(shouldBlockZordVesselCondition(zord, new Set(["stunned"]))).toBe(false);
    expect(shouldBlockZordVesselCondition({ type: "vehicle" }, new Set(["leaking"]))).toBe(false);
    expect(shouldBlockZordVesselCondition({ ...zord, _e20ZordVesselOverride: true }, new Set(["leaking"]))).toBe(false);
  });
});

describe("Unstable", () => {
  test("↓1, then ↓2, then inoperable at the third stack", () => {
    expect(getUnstablePenalty(makeVessel())).toBe(0);
    expect(getUnstablePenalty(makeVessel({ statuses: { unstable: 1 } }))).toBe(1);
    expect(getUnstablePenalty(makeVessel({ statuses: { unstable: 2 } }))).toBe(2);
    expect(getUnstablePenalty(makeVessel({ statuses: { unstable: 3 } }))).toBe(2);
    expect(areHardpointWeaponsInoperable(makeVessel({ statuses: { unstable: 2 } }))).toBe(false);
    expect(areHardpointWeaponsInoperable(makeVessel({ statuses: { unstable: 3 } }))).toBe(true);
  });
});

describe("findVesselAboard", () => {
  afterEach(() => {
    global.game.actors = { party: global.game.actors.party };
  });

  test("finds the Vehicle whose crew lists the actor, skipping Zords", () => {
    const zord = { type: "zord", system: { actors: { a: { uuid: "Actor.pc" } } } };
    const ship = { type: "vehicle", system: { actors: { a: { uuid: "Actor.pc", vehicleRole: "passenger" } } } };
    global.game.actors = [zord, ship];
    expect(findVesselAboard({ uuid: "Actor.pc" })).toBe(ship);
    expect(findVesselAboard({ uuid: "Actor.other" })).toBeNull();
    expect(findVesselAboard(null)).toBeNull();
  });

  test("null when the actor collection isn't iterable", () => {
    expect(findVesselAboard({ uuid: "Actor.pc" })).toBeNull();
  });
});

describe("Attacking Space Vessel Systems (p.25)", () => {
  const bigShip = { type: "vehicle", system: { size: "gigantic", traits: { zeroG: true }, movement: { aerial: { base: 0 } } } };
  const weaponEffect = (system = {}) => ({ type: "weaponEffect", system: { damageValue: 2, numTargets: 1, shape: null, ...system } });

  test("isVesselSystemTarget: a Huge+ aerial or zero-G Vehicle", () => {
    expect(isVesselSystemTarget(bigShip)).toBe(true);
    expect(isVesselSystemTarget({ ...bigShip, system: { ...bigShip.system, size: "large" } })).toBe(false);
    expect(isVesselSystemTarget({ type: "vehicle", system: { size: "huge", traits: {}, movement: { aerial: { base: 60 } } } })).toBe(true);
    expect(isVesselSystemTarget({ type: "vehicle", system: { size: "huge", traits: {}, movement: { aerial: { base: 0 } } } })).toBe(false);
    expect(isVesselSystemTarget({ ...bigShip, type: "zord" })).toBe(false);
  });

  test("offered only when every checkable requirement holds", () => {
    const base = { item: weaponEffect(), attackerShift: "d4", targets: [bigShip] };
    expect(canTargetVesselSystem(base)).toBe(true);
    expect(canTargetVesselSystem({ ...base, attackerShift: "d6" })).toBe(true);
    expect(canTargetVesselSystem({ ...base, attackerShift: "d2" })).toBe(false);
    expect(canTargetVesselSystem({ ...base, attackerShift: "d20" })).toBe(false);
    expect(canTargetVesselSystem({ ...base, item: weaponEffect({ damageValue: 1 }) })).toBe(false);
    expect(canTargetVesselSystem({ ...base, item: weaponEffect({ shape: "circle" }) })).toBe(false);
    expect(canTargetVesselSystem({ ...base, item: weaponEffect({ numTargets: 3 }) })).toBe(false);
    expect(canTargetVesselSystem({ ...base, targets: [bigShip, bigShip] })).toBe(false);
    expect(canTargetVesselSystem({ ...base, targets: [] })).toBe(false);
    expect(canTargetVesselSystem({ ...base, item: { type: "spell", system: {} } })).toBe(false);
  });

  test("the Critical Effect imposes the picked Condition on the target", async () => {
    const target = makeVessel();
    foundry.applications.api.DialogV2 = { wait: jest.fn(async () => "decompressed") };
    expect(await imposeVesselConditionOnCrit({ name: "Ranger" }, target)).toBe("decompressed");
    expect(target.statuses.has("decompressed")).toBe(true);
    expect(ChatMessage.create).toHaveBeenCalled();
  });

  test("cancelling the picker imposes nothing", async () => {
    const target = makeVessel();
    foundry.applications.api.DialogV2 = { wait: jest.fn(async () => "cancel") };
    expect(await imposeVesselConditionOnCrit({ name: "Ranger" }, target)).toBeNull();
    expect(target.effects).toHaveLength(0);
  });
});

describe("Repairing a Space Vessel Condition (p.26)", () => {
  test("DIF 12 inside, 15 on a spacewalk, -3 in stable orbit, -5 docked", () => {
    expect(getRepairDifficulty()).toBe(12);
    expect(getRepairDifficulty({ spacewalk: true })).toBe(15);
    expect(getRepairDifficulty({ stableOrbit: true })).toBe(9);
    expect(getRepairDifficulty({ spacewalk: true, docked: true })).toBe(10);
    expect(getRepairDifficulty({ stableOrbit: true, docked: true })).toBe(4);
  });

  test("one Condition per success, plus extra Degrees and a Critical Success", () => {
    expect(countRepairedConditions({ success: false, multiplier: 0 })).toBe(0);
    expect(countRepairedConditions({ success: true, multiplier: 1 })).toBe(1);
    expect(countRepairedConditions({ success: true, multiplier: 2 })).toBe(2);
    expect(countRepairedConditions({ success: true, multiplier: 1, isCrit: true })).toBe(2);
  });

  test("hasTechnologySpecialization reads Technology's Specializations", () => {
    expect(hasTechnologySpecialization({ system: { skills: { technology: { specializations: { spacecraft: {} } } } } })).toBe(true);
    expect(hasTechnologySpecialization({ system: { skills: { technology: { isSpecialized: true } } } })).toBe(true);
    expect(hasTechnologySpecialization({ system: { skills: { technology: { specializations: {} } } } })).toBe(false);
  });

  test("getActiveVesselConditions lists only vessel Conditions the vessel has", () => {
    const vessel = makeVessel({ statuses: { leaking: 1, stunned: 1, jammed: 1 } });
    expect(getActiveVesselConditions(vessel)).toEqual(["jammed", "leaking"]);
  });

  test("a success clears every stack of the chosen Condition", async () => {
    const vessel = makeVessel({ statuses: { decompressed: 2, leaking: 1 } });
    fromUuid.mockResolvedValue(vessel);
    const cleared = await resolveVesselRepair({ name: "Tech" }, { repairVesselUuid: "Actor.vessel", repairVesselCondition: "decompressed" },
      { success: true, multiplier: 1, isCrit: false, isFumble: false });
    expect(cleared).toEqual(["decompressed"]);
    expect(vessel.statuses.has("decompressed")).toBe(false);
    expect(vessel.statuses.has("leaking")).toBe(true);
  });

  test("an extra Degree of Success clears a second, picked Condition", async () => {
    const vessel = makeVessel({ statuses: { decompressed: 1, leaking: 3, unstable: 1 } });
    fromUuid.mockResolvedValue(vessel);
    foundry.applications.api.DialogV2 = { wait: jest.fn(async () => "leaking") };
    const cleared = await resolveVesselRepair({ name: "Tech" }, { repairVesselUuid: "Actor.vessel", repairVesselCondition: "decompressed" },
      { success: true, multiplier: 2, isCrit: false, isFumble: false });
    expect(cleared).toEqual(["decompressed", "leaking"]);
    expect(vessel.statuses.has("unstable")).toBe(true);
  });

  test("a failure clears nothing; a Fumble Compromises the vessel", async () => {
    const vessel = makeVessel({ statuses: { jammed: 1 } });
    fromUuid.mockResolvedValue(vessel);
    const context = { repairVesselUuid: "Actor.vessel", repairVesselCondition: "jammed" };
    expect(await resolveVesselRepair({}, context, { success: false, multiplier: 0 })).toEqual([]);
    expect(vessel.statuses.has("jammed")).toBe(true);

    await resolveVesselRepair({}, context, { success: false, multiplier: 0, isFumble: true });
    expect(vessel.statuses.has("compromised")).toBe(true);
    expect(vessel.statuses.has("jammed")).toBe(true);
  });

  test("a missing vessel does nothing", async () => {
    fromUuid.mockResolvedValue(null);
    expect(await resolveVesselRepair({}, { repairVesselUuid: "x" }, { success: true, multiplier: 1 })).toEqual([]);
  });

  describe("ensureRepairSpecialized", () => {
    const specialized = { system: { skills: { technology: { specializations: { spacecraft: {} } } } } };

    test("passes a Specialized repairer straight through", async () => {
      expect(await ensureRepairSpecialized(specialized)).toBe(true);
    });

    test("refuses with a warning when there's no Story Point to spend", async () => {
      const repairer = { name: "Rookie", type: "playerCharacter", system: { skills: { technology: {} } } };
      game.settings.get.mockImplementation(() => undefined);
      expect(await ensureRepairSpecialized(repairer)).toBe(false);
      expect(ui.notifications.warn).toHaveBeenCalled();
      game.settings.get.mockImplementation(() => 'roll');
    });
  });

  describe("getRepairCandidates", () => {
    const pc = (name, isOwner = true) => ({ name, type: 'playerCharacter', isOwner, _dice: {} });
    let savedCanvas, savedUser;

    beforeEach(() => {
      savedCanvas = global.canvas;
      savedUser = game.user;
    });

    afterEach(() => {
      global.canvas = savedCanvas;
      game.user = savedUser;
    });

    test("offers the actors of the user's selected tokens", () => {
      const selected = pc('Selected');
      global.canvas = { tokens: { controlled: [{ actor: selected }] }, scene: { tokens: [] } };
      game.user = { isGM: false, character: null };
      expect(getRepairCandidates(makeVessel({ system: { actors: {} } }))).toEqual([selected]);
    });

    test("offers a GM every player character on the scene, but never the vessel itself", () => {
      const onScene = pc('On Scene');
      const vessel = makeVessel({ system: { actors: {} } });
      global.canvas = { tokens: { controlled: [] }, scene: { tokens: [{ actor: onScene }, { actor: { type: 'npc', isOwner: true, _dice: {} } }, { actor: vessel }] } };
      game.user = { isGM: true, character: null };
      expect(getRepairCandidates(vessel)).toEqual([onScene]);
    });
  });

  describe("openVesselRepairDialog", () => {
    test("says so when there's nothing to repair", async () => {
      await openVesselRepairDialog(makeVessel());
      expect(ui.notifications.info).toHaveBeenCalled();
    });

    test("warns when no character of this user can repair", async () => {
      const vessel = makeVessel({ statuses: { jammed: 1 }, system: { actors: {} } });
      await openVesselRepairDialog(vessel);
      expect(ui.notifications.warn).toHaveBeenCalled();
    });

    test("rolls Specialized Technology against the chosen DIF, carrying the repair through", async () => {
      const repairer = {
        uuid: "Actor.tech", name: "Tech", isOwner: true,
        system: { skills: { technology: { specializations: { spacecraft: {} } } } },
        _dice: { rollSkill: jest.fn() },
      };
      fromUuidSync.mockReturnValue(repairer);
      const vessel = makeVessel({ statuses: { leaking: 2 }, system: { actors: { a: { uuid: "Actor.tech" } } } });
      foundry.applications.api.DialogV2 = {
        wait: jest.fn(async () => ({ repairerUuid: "Actor.tech", condition: "leaking", spacewalk: true, stableOrbit: true, docked: false })),
      };

      await openVesselRepairDialog(vessel);
      expect(repairer._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({
        skill: "technology", dif: "12", isSpecialized: true, repairVesselUuid: "Actor.vessel", repairVesselCondition: "leaking",
      }), repairer);
    });
  });
});

describe("decorateTokenHudVesselConditions", () => {
  function makeHud(actor, statusIds) {
    const controls = Object.fromEntries(statusIds.map(id => {
      const listeners = {};
      return [id, {
        dataset: {},
        addEventListener: (type, fn) => {
          listeners[type] = fn;
        },
        fire: (type, button = type == "auxclick" ? 2 : 0) =>
          listeners[type]?.({ type, button, preventDefault: jest.fn(), stopImmediatePropagation: jest.fn() }),
      }];
    }));
    const html = { querySelector: (selector) => controls[selector.match(/data-status-id="(\w+)"/)?.[1]] ?? null };
    return { hud: { actor, render: jest.fn() }, html, controls };
  }

  test("shows the stack count and turns clicks on an active stacking Condition into +1/-1", async () => {
    const vessel = makeVessel({ statuses: { unstable: 2 } });
    const { hud, html, controls } = makeHud(vessel, ["unstable", "jammed"]);
    decorateTokenHudVesselConditions(hud, html);
    expect(controls.unstable.dataset.tooltipText).toBe("E20.VesselConditionHudTooltip");

    await controls.unstable.fire("click");
    expect(getVesselConditionStacks(vessel, "unstable")).toBe(3);
    await controls.unstable.fire("auxclick");
    await controls.unstable.fire("auxclick");
    expect(getVesselConditionStacks(vessel, "unstable")).toBe(1);
    // A middle click is neither.
    await controls.unstable.fire("auxclick", 1);
    expect(getVesselConditionStacks(vessel, "unstable")).toBe(1);
  });

  test("leaves an inactive Condition, and a non-stacking one, to core's own toggle", async () => {
    const vessel = makeVessel({ statuses: { jammed: 1 } });
    const { hud, html, controls } = makeHud(vessel, ["unstable", "jammed"]);
    decorateTokenHudVesselConditions(hud, html);
    await controls.unstable.fire("click");
    await controls.jammed.fire("click");
    expect(vessel.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("a player can't give a Zord a vessel Condition; the GM can, on confirmation", async () => {
    const zord = makeVessel({ type: "zord" });
    const { hud, html, controls } = makeHud(zord, ["leaking"]);
    decorateTokenHudVesselConditions(hud, html);
    await controls.leaking.fire("click");
    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(zord.toggleStatusEffect).not.toHaveBeenCalled();

    game.user.isGM = true;
    foundry.applications.api.DialogV2 = { confirm: jest.fn(async () => true) };
    await controls.leaking.fire("click");
    expect(zord.toggleStatusEffect).toHaveBeenCalledWith("leaking", { active: true });
    expect(zord._e20ZordVesselOverride).toBeUndefined();
  });
});
