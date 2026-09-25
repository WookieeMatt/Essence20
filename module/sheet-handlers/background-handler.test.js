import { jest } from '@jest/globals';
import { _showOriginSkillPrompt, setOriginValues } from './background-handler.mjs';

// setOriginValues' own item-copying/altMode dependencies (createItemCopies, Item.create,
// fromUuid) are exercised elsewhere - these fixtures use an empty origin.system.items and no
// altModes so those branches stay no-ops, keeping the test focused on the skill/essence/
// health/movement update this Origin-drop batch actually changed.
function makeOrigin(overrides = {}) {
  return {
    system: {
      items: {},
      startingHealth: 2,
      baseAerialMovement: 0,
      baseAquaticMovement: 0,
      baseGroundMovement: 25,
      allSkillsGranted: false,
      skills: [],
      ...overrides,
    },
  };
}

function makeActor(skills = {}) {
  return {
    system: {
      level: 1,
      essences: { speed: { max: 1 }, smarts: { max: 2 } },
      skills: {
        driving: { shift: 'd20' },
        infiltration: { shift: 'd20' },
        alertness: { shift: 'd20' },
        culture: { shift: 'd20' },
        science: { shift: 'd20' },
        technology: { shift: 'd20' },
        ...skills,
      },
    },
    update: jest.fn(),
  };
}

describe("setOriginValues (Origin-drop skill/movement/essence grant)", () => {
  test("a single skill string keeps shifting only that one skill (pre-existing behavior)", async () => {
    const actor = makeActor();
    const origin = makeOrigin();
    const dropFunc = jest.fn(async () => [{ _id: "origin1" }]);

    await setOriginValues(actor, origin, "smarts", "alertness", dropFunc);

    expect(actor.update).toHaveBeenCalledWith(expect.objectContaining({
      "system.skills.alertness.shift": "d2",
      "system.essences.smarts.max": 3,
      "system.originSkillsIncrease": "alertness",
    }));
    expect(actor.update.mock.calls[0][0]["system.skills.driving.shift"]).toBeUndefined();
  });

  test("Brainy (pr_crb p.23): an allSkillsGranted Origin shifts EVERY listed skill, not just one", async () => {
    const actor = makeActor();
    const origin = makeOrigin({
      allSkillsGranted: true,
      skills: ["driving", "infiltration", "alertness", "culture", "science", "technology"],
    });
    const dropFunc = jest.fn(async () => [{ _id: "origin1" }]);

    // The full skills list is what _showOriginSkillPrompt now passes through for this kind of
    // Origin (see below) rather than a single player-picked skill.
    await setOriginValues(actor, origin, "speed", [...origin.system.skills], dropFunc);

    const update = actor.update.mock.calls[0][0];
    for (const skill of origin.system.skills) {
      expect(update[`system.skills.${skill}.shift`]).toBe("d2");
    }

    expect(update["system.essences.speed.max"]).toBe(2);
    // No single skill is "the" Origin skill here, so the field Menace/Distracting Offer/etc.
    // dynamically resolve (system.originSkillsIncrease) is left unset rather than pointing at
    // whichever skill happened to be listed first.
    expect(update["system.originSkillsIncrease"]).toBe("");
  });

  test("an allSkillsGranted Origin upshifts a skill the actor already has instead of resetting it", async () => {
    const actor = makeActor({ culture: { shift: 'd6' } });
    const origin = makeOrigin({
      allSkillsGranted: true,
      skills: ["driving", "culture"],
    });
    const dropFunc = jest.fn(async () => [{ _id: "origin1" }]);

    await setOriginValues(actor, origin, "smarts", [...origin.system.skills], dropFunc);

    const update = actor.update.mock.calls[0][0];
    expect(update["system.skills.driving.shift"]).toBe("d2");
    expect(update["system.skills.culture.shift"]).toBe("d8");
  });

  test("Champion (tf_crb p.51): the picked Alt Mode's botModeSize is copied onto system.size", async () => {
    const actor = makeActor();
    const origin = makeOrigin({
      items: {
        altMode1: { uuid: "Compendium.essence20.tf_crb.Item.altMode1", name: "Champion", type: "altMode" },
      },
    });
    const dropFunc = jest.fn(async () => [{ _id: "origin1" }]);

    global.fromUuid = jest.fn(async () => ({ type: "altMode", system: { botModeSize: "large" } }));
    global.Item = { create: jest.fn(async () => ({ type: "altMode", setFlag: jest.fn() })) };

    await setOriginValues(actor, origin, "smarts", "alertness", dropFunc);

    const update = actor.update.mock.calls[actor.update.mock.calls.length - 1][0];
    expect(update["system.size"]).toBe("large");

    delete global.fromUuid;
    delete global.Item;
  });

  test("an Origin with no Alt Mode leaves system.size untouched (non-Transformers Origins)", async () => {
    const actor = makeActor();
    const origin = makeOrigin();
    const dropFunc = jest.fn(async () => [{ _id: "origin1" }]);

    await setOriginValues(actor, origin, "smarts", "alertness", dropFunc);

    const update = actor.update.mock.calls[actor.update.mock.calls.length - 1][0];
    expect(update).not.toHaveProperty("system.size");
  });
});

describe("_showOriginSkillPrompt (Origin-drop skill-selection step)", () => {
  test("an allSkillsGranted Origin skips the single-skill picker and grants its whole list", async () => {
    const actor = makeActor();
    const origin = makeOrigin({
      allSkillsGranted: true,
      skills: ["driving", "infiltration", "alertness", "culture", "science", "technology"],
    });
    const dropFunc = jest.fn(async () => [{ _id: "origin1" }]);

    await _showOriginSkillPrompt(actor, origin, "smarts", dropFunc);

    expect(actor.update).toHaveBeenCalledTimes(1);
    const update = actor.update.mock.calls[0][0];
    for (const skill of origin.system.skills) {
      expect(update[`system.skills.${skill}.shift`]).toBe("d2");
    }

    expect(update["system.essences.smarts.max"]).toBe(3);
  });

  test("errors instead when no Essence was selected, same as before", async () => {
    const actor = makeActor();
    const origin = makeOrigin({ allSkillsGranted: true, skills: ["driving"] });
    const dropFunc = jest.fn();

    await _showOriginSkillPrompt(actor, origin, null, dropFunc);

    expect(actor.update).not.toHaveBeenCalled();
    expect(dropFunc).not.toHaveBeenCalled();
  });
});
