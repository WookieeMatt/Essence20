import { applySkillEffectBonus, getToggleableSkillEffects } from './skill-effects.mjs';

/* getToggleableSkillEffects */
describe("getToggleableSkillEffects", () => {
  function makeEffect({ id, name, disabled, changes }) {
    return { id, name, disabled, changes };
  }

  function makeActor(effects, { withAllApplicableEffects = true } = {}) {
    const actor = { effects };
    if (withAllApplicableEffects) {
      actor.allApplicableEffects = function* () {
        yield* effects;
      };
    }

    return actor;
  }

  test("includes a disabled effect with a change matching this skill", () => {
    const effect = makeEffect({
      id: "eff1",
      name: "Always Alert",
      disabled: true,
      changes: [{ key: "system.skills.initiative.edge", mode: 5, value: "true" }],
    });
    const actor = makeActor([effect]);

    const result = getToggleableSkillEffects(actor, "initiative");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "eff1", name: "Always Alert" });
    expect(result[0].changes).toHaveLength(1);
  });

  test("excludes an effect that isn't disabled", () => {
    const effect = makeEffect({
      id: "eff1",
      name: "Always Alert",
      disabled: false,
      changes: [{ key: "system.skills.initiative.edge", mode: 5, value: "true" }],
    });
    const actor = makeActor([effect]);

    expect(getToggleableSkillEffects(actor, "initiative")).toEqual([]);
  });

  test("excludes an effect whose changes target a different skill", () => {
    const effect = makeEffect({
      id: "eff1",
      name: "Always Alert",
      disabled: true,
      changes: [{ key: "system.skills.alertness.edge", mode: 5, value: "true" }],
    });
    const actor = makeActor([effect]);

    expect(getToggleableSkillEffects(actor, "initiative")).toEqual([]);
  });

  test("excludes an effect whose only change targets a non-roll-scoped field", () => {
    const effect = makeEffect({
      id: "eff1",
      name: "Weird Effect",
      disabled: true,
      changes: [{ key: "system.skills.initiative.isChosen", mode: 5, value: "true" }],
    });
    const actor = makeActor([effect]);

    expect(getToggleableSkillEffects(actor, "initiative")).toEqual([]);
  });

  test("only returns the changes relevant to this skill from a multi-change effect", () => {
    const effect = makeEffect({
      id: "eff1",
      name: "Jack of All Trades",
      disabled: true,
      changes: [
        { key: "system.skills.initiative.edge", mode: 5, value: "true" },
        { key: "system.skills.athletics.modifier", mode: 2, value: "2" },
      ],
    });
    const actor = makeActor([effect]);

    const result = getToggleableSkillEffects(actor, "initiative");
    expect(result).toHaveLength(1);
    expect(result[0].changes).toEqual([
      { key: "system.skills.initiative.edge", mode: 5, value: "true", scope: "skill", field: "edge" },
    ]);
  });

  test("includes a disabled effect scoped to the skill's own Essence (e.g. Speed for Targeting)", () => {
    const effect = makeEffect({
      id: "eff1",
      name: "Fleet of Foot",
      disabled: true,
      changes: [{ key: "system.essenceShifts.speed.edge", mode: 5, value: "true" }],
    });
    const actor = makeActor([effect]);

    const result = getToggleableSkillEffects(actor, "targeting", "speed");
    expect(result).toHaveLength(1);
    expect(result[0].changes).toEqual([
      { key: "system.essenceShifts.speed.edge", mode: 5, value: "true", scope: "essence", field: "edge" },
    ]);
  });

  test("excludes an Essence-scoped effect for a different Essence than the one being rolled", () => {
    const effect = makeEffect({
      id: "eff1",
      name: "Iron Will",
      disabled: true,
      changes: [{ key: "system.essenceShifts.strength.edge", mode: 5, value: "true" }],
    });
    const actor = makeActor([effect]);

    expect(getToggleableSkillEffects(actor, "targeting", "speed")).toEqual([]);
  });

  test("includes a disabled effect scoped to \"any\" Essence regardless of the skill's own Essence", () => {
    const effect = makeEffect({
      id: "eff1",
      name: "Universally Lucky",
      disabled: true,
      changes: [{ key: "system.essenceShifts.any.edge", mode: 5, value: "true" }],
    });
    const actor = makeActor([effect]);

    expect(getToggleableSkillEffects(actor, "targeting", "speed")).toHaveLength(1);
  });

  test("excludes an effect whose only change targets an essence-shift field with no roll meaning", () => {
    const effect = makeEffect({
      id: "eff1",
      name: "Weird Effect",
      disabled: true,
      changes: [{ key: "system.essenceShifts.speed.foo", mode: 5, value: "true" }],
    });
    const actor = makeActor([effect]);

    expect(getToggleableSkillEffects(actor, "targeting", "speed")).toEqual([]);
  });

  test("falls back to actor.effects when allApplicableEffects isn't available", () => {
    const effect = makeEffect({
      id: "eff1",
      name: "Always Alert",
      disabled: true,
      changes: [{ key: "system.skills.initiative.edge", mode: 5, value: "true" }],
    });
    const actor = makeActor([effect], { withAllApplicableEffects: false });

    expect(getToggleableSkillEffects(actor, "initiative")).toHaveLength(1);
  });

  test("returns an empty array when there are no effects at all", () => {
    expect(getToggleableSkillEffects(makeActor([]), "initiative")).toEqual([]);
  });
});

/* applySkillEffectBonus */
describe("applySkillEffectBonus", () => {
  function makeActor(skills) {
    return { system: { skills } };
  }

  test("OVERRIDE edge=true is OR'd into skillRollOptions.edge", () => {
    const actor = makeActor({ targeting: { edge: false } });
    const changes = [{ key: "system.skills.targeting.edge", mode: 5, value: "true", field: "edge" }];
    const skillRollOptions = { edge: false, snag: false, shiftUp: 0, shiftDown: 0 };

    applySkillEffectBonus(actor, changes, skillRollOptions, "d8");
    expect(skillRollOptions.edge).toBe(true);
  });

  test("never turns an already-true field false", () => {
    const actor = makeActor({ targeting: { edge: false } });
    // A (contrived) change that would resolve to false shouldn't undo an edge the roll already has.
    const changes = [{ key: "system.skills.targeting.edge", mode: 5, value: "false", field: "edge" }];
    const skillRollOptions = { edge: true, snag: false, shiftUp: 0, shiftDown: 0 };

    applySkillEffectBonus(actor, changes, skillRollOptions, "d8");
    expect(skillRollOptions.edge).toBe(true);
  });

  test("Edge and Snag cancel out when a toggle grants one while the other is already set", () => {
    const actor = makeActor({ targeting: { snag: false } });
    const changes = [{ key: "system.skills.targeting.snag", mode: 5, value: "true", field: "snag" }];
    const skillRollOptions = { edge: true, snag: false, shiftUp: 0, shiftDown: 0 };

    applySkillEffectBonus(actor, changes, skillRollOptions, "d8");
    expect(skillRollOptions.edge).toBe(false);
    expect(skillRollOptions.snag).toBe(false);
  });

  test("ADD modifier accumulates onto skillEffectModifierBonus", () => {
    const actor = makeActor({ targeting: { modifier: 0 } });
    const changes = [{ key: "system.skills.targeting.modifier", mode: 2, value: "2", field: "modifier" }];
    const skillRollOptions = { edge: false, snag: false, shiftUp: 0, shiftDown: 0 };

    applySkillEffectBonus(actor, changes, skillRollOptions, "d8");
    expect(skillRollOptions.skillEffectModifierBonus).toBe(2);
  });

  test("ADD shiftUp is added to skillRollOptions.shiftUp", () => {
    const actor = makeActor({ targeting: { shiftUp: 0 } });
    const changes = [{ key: "system.skills.targeting.shiftUp", mode: 2, value: "1", field: "shiftUp" }];
    const skillRollOptions = { edge: false, snag: false, shiftUp: 1, shiftDown: 0 };

    applySkillEffectBonus(actor, changes, skillRollOptions, "d8");
    expect(skillRollOptions.shiftUp).toBe(2);
  });

  // Regression test: ActiveEffect.applyChange resolves an ADD-mode change to current + delta, not
  // just delta (DataField#_applyChangeAdd) - skillRollOptions.shiftUp already has this skill's
  // current shiftUp (1) baked into its own baseline before this call, same as the real dice.mjs
  // pipeline (calculatedShiftUp includes dataset.shiftUp, which is this same current value). Only
  // the toggle's own net contribution (+2) should be added, not current + delta (3) on top of a
  // baseline that already counts current once.
  test("ADD shiftUp on a nonzero baseline adds only the net delta, not current + delta", () => {
    const actor = makeActor({ targeting: { shiftUp: 1 } });
    const changes = [{ key: "system.skills.targeting.shiftUp", mode: 2, value: "2", field: "shiftUp" }];
    const skillRollOptions = { edge: false, snag: false, shiftUp: 1, shiftDown: 0 };

    applySkillEffectBonus(actor, changes, skillRollOptions, "d8");
    expect(skillRollOptions.shiftUp).toBe(3);
  });

  test("ADD modifier on a nonzero baseline accumulates only the net delta", () => {
    const actor = makeActor({ targeting: { modifier: 1 } });
    const changes = [{ key: "system.skills.targeting.modifier", mode: 2, value: "2", field: "modifier" }];
    const skillRollOptions = { edge: false, snag: false, shiftUp: 0, shiftDown: 0 };

    applySkillEffectBonus(actor, changes, skillRollOptions, "d8");
    expect(skillRollOptions.skillEffectModifierBonus).toBe(2);
  });

  test("an absolute shift OVERRIDE converts to an equivalent shiftUp delta", () => {
    const actor = makeActor({ targeting: { shift: "d8" } });
    // d8 -> d10 is one step better (see E20.skillShiftList ordering - lower index is better).
    const changes = [{ key: "system.skills.targeting.shift", mode: 5, value: "d10", field: "shift" }];
    const skillRollOptions = { edge: false, snag: false, shiftUp: 0, shiftDown: 0 };

    applySkillEffectBonus(actor, changes, skillRollOptions, "d8");
    expect(skillRollOptions.shiftUp).toBe(1);
  });

  test("an Essence-scoped edge change is OR'd in the same way a skill-scoped one is", () => {
    const actor = makeActor({ targeting: {} });
    actor.system.essenceShifts = { speed: { edge: false } };
    const changes = [
      { key: "system.essenceShifts.speed.edge", mode: 5, value: "true", scope: "essence", field: "edge" },
    ];
    const skillRollOptions = { edge: false, snag: false, shiftUp: 0, shiftDown: 0 };

    applySkillEffectBonus(actor, changes, skillRollOptions, "d8");
    expect(skillRollOptions.edge).toBe(true);
  });

  test("untrainedBonus shifts an untrained (d20) roll up to d2, matching dice.mjs's own substitution", () => {
    const actor = makeActor({ targeting: {} });
    actor.system.essenceShifts = { speed: { untrainedBonus: false } };
    const changes = [
      { key: "system.essenceShifts.speed.untrainedBonus", mode: 5, value: "true", scope: "essence", field: "untrainedBonus" },
    ];
    const skillRollOptions = { edge: false, snag: false, shiftUp: 0, shiftDown: 0 };

    applySkillEffectBonus(actor, changes, skillRollOptions, "d20");
    // d20 (index 10) -> d2 (index 9) is a 1-step upshift (see E20.skillShiftList ordering).
    expect(skillRollOptions.shiftUp).toBe(1);
  });

  test("untrainedBonus has no effect on an already-trained skill", () => {
    const actor = makeActor({ targeting: {} });
    actor.system.essenceShifts = { speed: { untrainedBonus: false } };
    const changes = [
      { key: "system.essenceShifts.speed.untrainedBonus", mode: 5, value: "true", scope: "essence", field: "untrainedBonus" },
    ];
    const skillRollOptions = { edge: false, snag: false, shiftUp: 0, shiftDown: 0 };

    applySkillEffectBonus(actor, changes, skillRollOptions, "d8");
    expect(skillRollOptions.shiftUp).toBe(0);
  });

  test("applies multiple changes from the same effect together", () => {
    const actor = makeActor({ targeting: { edge: false, modifier: 0 } });
    const changes = [
      { key: "system.skills.targeting.edge", mode: 5, value: "true", field: "edge" },
      { key: "system.skills.targeting.modifier", mode: 2, value: "1", field: "modifier" },
    ];
    const skillRollOptions = { edge: false, snag: false, shiftUp: 0, shiftDown: 0 };

    applySkillEffectBonus(actor, changes, skillRollOptions, "d8");
    expect(skillRollOptions.edge).toBe(true);
    expect(skillRollOptions.skillEffectModifierBonus).toBe(1);
  });
});
