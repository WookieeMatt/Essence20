import { jest } from '@jest/globals';
import { activateEmtCrashCourseEssenceRestore, pickEmtCrashCourseEssence } from './emt-crash-course.mjs';

global.game = { user: { targets: new Set() }, i18n: { localize: (k) => k, format: (k) => k } };
global.ui = { notifications: { warn: jest.fn() } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeEssences(overrides = {}) {
  return {
    strength: { value: 3, max: 3 },
    speed: { value: 3, max: 3 },
    smarts: { value: 3, max: 3 },
    social: { value: 3, max: 3 },
    ...overrides,
  };
}

function makeActor(id, name, essences = makeEssences()) {
  return {
    id,
    name,
    getActiveTokens: jest.fn(() => []),
    system: { essences },
    update: jest.fn(async function (data) {
      for (const [path, value] of Object.entries(data)) {
        const key = path.split('.')[2];
        this.system.essences[key].value = value;
      }
    }),
  };
}

describe("pickEmtCrashCourseEssence", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("returns null when the target has no damaged Essence", async () => {
    const actor = makeActor('a1', 'Ally');
    expect(await pickEmtCrashCourseEssence(actor)).toBeNull();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("prompts and returns the chosen Essence when at least one is damaged", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('smarts');
    const actor = makeActor('a1', 'Ally', makeEssences({ smarts: { value: 2, max: 3 } }));

    expect(await pickEmtCrashCourseEssence(actor)).toBe('smarts');
    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor('a1', 'Ally', makeEssences({ speed: { value: 1, max: 3 } }));
    expect(await pickEmtCrashCourseEssence(actor)).toBeNull();
  });
});

describe("activateEmtCrashCourseEssenceRestore", () => {
  beforeEach(() => {
    global.game.user.targets = new Set();
    global.ui.notifications.warn.mockReset();
    global.foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("restores the chosen Essence on whichever ally is already targeted", async () => {
    const actor = makeActor('a1', 'Medic');
    const ally = makeActor('a2', 'Ally', makeEssences({ strength: { value: 1, max: 3 } }));
    global.game.user.targets = new Set([{ actor: ally }]);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('strength');

    const result = await activateEmtCrashCourseEssenceRestore(actor, 'EMT Crash Course');

    expect(result).toBe(ally);
    expect(ally.update).toHaveBeenCalledWith({ 'system.essences.strength.value': 2 });
  });

  test("restores the actor's own Essence when self is picked from the dialog", async () => {
    const actor = makeActor('a1', 'Medic', makeEssences({ social: { value: 0, max: 3 } }));
    // First dialog call picks the ally target (self), second picks the Essence.
    foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('a1')
      .mockResolvedValueOnce('social');

    const result = await activateEmtCrashCourseEssenceRestore(actor, 'EMT Crash Course');

    expect(result).toBe(actor);
    expect(actor.update).toHaveBeenCalledWith({ 'system.essences.social.value': 1 });
  });

  test("returns null and warns when the target has no damaged Essence", async () => {
    const actor = makeActor('a1', 'Medic');
    const ally = makeActor('a2', 'Ally');
    global.game.user.targets = new Set([{ actor: ally }]);

    const result = await activateEmtCrashCourseEssenceRestore(actor, 'EMT Crash Course');

    expect(result).toBeNull();
    expect(ally.update).not.toHaveBeenCalled();
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  test("returns null when no target is chosen", async () => {
    const actor = makeActor('a1', 'Medic');
    foundry.applications.api.DialogV2.wait.mockResolvedValue(null);

    const result = await activateEmtCrashCourseEssenceRestore(actor, 'EMT Crash Course');

    expect(result).toBeNull();
  });
});
