import { jest } from '@jest/globals';
import { addSpecialization, deleteSpecialization, normalizeSpecializations } from "./specialization-handler.mjs";

function makeActor({ isLocked = false, existingSpecializations = {}, shift = 'd8' } = {}) {
  return {
    system: {
      isLocked,
      skills: {
        athletics: { shift, specializations: existingSpecializations },
        brawn: { shift, specializations: {} },
      },
    },
    update: jest.fn(),
  };
}

describe("addSpecialization", () => {
  test("writes a new entry keyed by a slug of its name, defaulting to player-bought and specialized", async () => {
    const actor = makeActor();
    await addSpecialization(actor, 'athletics', 'Climbing');

    expect(actor.update).toHaveBeenCalledTimes(1);
    const [updateData] = actor.update.mock.calls[0];
    const [path, entry] = Object.entries(updateData)[0];

    expect(path).toBe('system.skills.athletics.specializations.climbing');
    expect(entry).toEqual({
      name: 'Climbing',
      shift: 'd8',
      isSpecialized: true,
      edge: false,
      shiftUp: 0,
      shiftDown: 0,
      snag: false,
      granted: false,
    });
  });

  test("camelCases a multi-word name into its key, so a Perk's Active Effect can target it predictably", async () => {
    const actor = makeActor();
    await addSpecialization(actor, 'athletics', 'Sports Activity');

    const [updateData] = actor.update.mock.calls[0];
    const [path] = Object.entries(updateData)[0];
    expect(path).toBe('system.skills.athletics.specializations.sportsActivity');
  });

  test("trims the name before saving", async () => {
    const actor = makeActor();
    await addSpecialization(actor, 'athletics', '  Climbing  ');

    const [updateData] = actor.update.mock.calls[0];
    const entry = Object.values(updateData)[0];
    expect(entry.name).toBe('Climbing');
  });

  test("title-cases a free-typed name before saving, so it reads the same as a standard-catalog pick", async () => {
    const actor = makeActor();
    await addSpecialization(actor, 'athletics', 'sniper rifle');

    const [updateData] = actor.update.mock.calls[0];
    const [path, entry] = Object.entries(updateData)[0];
    expect(entry.name).toBe('Sniper Rifle');
    expect(path).toBe('system.skills.athletics.specializations.sniperRifle');
  });

  test("does nothing for a blank name", async () => {
    const actor = makeActor();
    await addSpecialization(actor, 'athletics', '   ');

    expect(actor.update).not.toHaveBeenCalled();
  });

  test("does nothing when the actor is locked", async () => {
    const actor = makeActor({ isLocked: true });
    await addSpecialization(actor, 'athletics', 'Climbing');

    expect(actor.update).not.toHaveBeenCalled();
  });

  test("appends a numeric suffix when a second specialization would slugify to the same key", async () => {
    const actor = makeActor({ existingSpecializations: { climbing: { name: 'Climbing' } } });
    await addSpecialization(actor, 'athletics', 'Climbing!');

    const [updateData] = actor.update.mock.calls[0];
    const [path] = Object.entries(updateData)[0];
    expect(path).toBe('system.skills.athletics.specializations.climbing2');
  });

  test("refuses to add the same name twice under one skill", async () => {
    const actor = makeActor({ existingSpecializations: { climbing: { name: 'Climbing' } } });
    await addSpecialization(actor, 'athletics', 'Climbing');

    expect(actor.update).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("the duplicate check is case- and whitespace-insensitive", async () => {
    const actor = makeActor({ existingSpecializations: { climbing: { name: 'Climbing' } } });
    await addSpecialization(actor, 'athletics', '  climbing  ');

    expect(actor.update).not.toHaveBeenCalled();
  });

  test("a duplicate under a different skill is unaffected", async () => {
    const actor = makeActor({ existingSpecializations: { climbing: { name: 'Climbing' } } });
    await addSpecialization(actor, 'brawn', 'Climbing');

    expect(actor.update).toHaveBeenCalled();
  });
});

describe("deleteSpecialization", () => {
  test("deletes the specialization by key", async () => {
    const actor = makeActor({ existingSpecializations: { running: { name: 'Running' } } });
    await deleteSpecialization(actor, 'athletics', 'running');

    expect(actor.update).toHaveBeenCalledTimes(1);
    const [updateData] = actor.update.mock.calls[0];
    expect(Object.keys(updateData)).toEqual(['system.skills.athletics.specializations.running']);
    expect(updateData['system.skills.athletics.specializations.running'])
      .toBeInstanceOf(foundry.data.operators.ForcedDeletion);
  });

  test("does nothing when the actor is locked", async () => {
    const actor = makeActor({ isLocked: true });
    await deleteSpecialization(actor, 'athletics', 'running');

    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("normalizeSpecializations", () => {
  test("fills in every missing field with its default, matching a normally-bought specialization", () => {
    const actor = makeActor({
      existingSpecializations: { medicine: { name: 'Medicine', granted: true } },
    });

    normalizeSpecializations(actor);

    expect(actor.system.skills.athletics.specializations.medicine).toEqual({
      name: 'Medicine',
      shift: 'd8',
      isSpecialized: true,
      edge: false,
      shiftUp: 0,
      shiftDown: 0,
      snag: false,
      granted: true,
    });
  });

  test("leaves already-set fields alone", () => {
    const actor = makeActor({
      existingSpecializations: { medicine: { name: 'Medicine', shift: 'd12', edge: true } },
    });

    normalizeSpecializations(actor);

    expect(actor.system.skills.athletics.specializations.medicine.shift).toBe('d12');
    expect(actor.system.skills.athletics.specializations.medicine.edge).toBe(true);
  });

  test("does nothing for a skill with no specializations", () => {
    const actor = makeActor();
    expect(() => normalizeSpecializations(actor)).not.toThrow();
  });
});
