import { jest } from '@jest/globals';
import { activateConsultMemories, canUseConsultMemories, isConsultMemoriesActive } from './consult-memories.mjs';

global.game = { i18n: { localize: (k) => k, format: (k) => k } };

function makeActor(flagStore = {}) {
  return {
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flagStore[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("canUseConsultMemories", () => {
  test("true before it's used, false once already used this scene", () => {
    expect(canUseConsultMemories(makeActor())).toBe(true);

    const actor = makeActor({ consultMemoriesUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 } });
    expect(canUseConsultMemories(actor)).toBe(false);
  });
});

describe("activateConsultMemories / isConsultMemoriesActive", () => {
  let originalFoundry;
  beforeEach(() => {
    originalFoundry = global.foundry;
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn() } } },
    };
  });
  afterEach(() => {
    global.foundry = originalFoundry;
  });

  test("banks the chosen skill and marks the scene used", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('science');
    const actor = makeActor();

    const activated = await activateConsultMemories(actor);

    expect(activated).toBe(true);
    expect(isConsultMemoriesActive(actor, 'science')).toBe(true);
    expect(isConsultMemoriesActive(actor, 'culture')).toBe(false);
  });

  test("does nothing when the picker is cancelled", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    const activated = await activateConsultMemories(actor);

    expect(activated).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(isConsultMemoriesActive(actor, 'science')).toBe(false);
  });
});
