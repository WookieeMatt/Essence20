import { jest } from '@jest/globals';
import {
  activateResourceful, canUseResourceful, EXTREMELY_RESOURCEFUL_ID, isResourcefulEdgeActive,
} from './resourceful.mjs';

function makeActor(flagStore = {}, { health = { value: 5, max: 10, bonus: 0 }, items = [] } = {}) {
  return {
    system: { health },
    items,
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flagStore[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    update: jest.fn(async (data) => Object.assign({}, data)),
  };
}

describe("canUseResourceful", () => {
  test("true before it's used, false once already used this scene", () => {
    global.game = { combat: { id: 'combat1' } };
    expect(canUseResourceful(makeActor())).toBe(true);

    const actor = makeActor({ resourcefulUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 } });
    expect(canUseResourceful(actor)).toBe(false);
  });
});

describe("activateResourceful / isResourcefulEdgeActive", () => {
  let originalFoundry;
  beforeEach(() => {
    global.game = { combat: { id: 'combat1', round: 1 }, i18n: { localize: (k) => k, format: (k) => k } };
    originalFoundry = global.foundry;
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
  });
  afterEach(() => {
    global.foundry = originalFoundry;
  });

  test("choosing 'edge' banks the Initiative Edge and marks the scene used", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('edge');
    const actor = makeActor();

    const activated = await activateResourceful(actor);

    expect(activated).toBe(true);
    expect(isResourcefulEdgeActive(actor)).toBe(true);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("the Edge lasts until a NEW combat starts", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('edge');
    const actor = makeActor();
    await activateResourceful(actor);
    expect(isResourcefulEdgeActive(actor)).toBe(true);

    global.game.combat = { id: 'combat2', round: 1 };
    expect(isResourcefulEdgeActive(actor)).toBe(false);
  });

  test("choosing 'temphealth' grants 1 Temporary Health instead", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('temphealth');
    const actor = makeActor();

    const activated = await activateResourceful(actor);

    expect(activated).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 1 });
    expect(isResourcefulEdgeActive(actor)).toBe(false);
  });

  test("does nothing when the picker is cancelled", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    const activated = await activateResourceful(actor);

    expect(activated).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("Extremely Resourceful grants BOTH benefits with no picker shown", async () => {
    const actor = makeActor({}, {
      items: [{ type: 'perk', flags: { core: { sourceId: EXTREMELY_RESOURCEFUL_ID } } }],
    });

    const activated = await activateResourceful(actor);

    expect(activated).toBe(true);
    expect(global.foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(isResourcefulEdgeActive(actor)).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 1 });
  });
});
