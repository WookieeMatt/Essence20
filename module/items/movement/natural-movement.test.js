import { jest } from '@jest/globals';
import { getNaturalMovementType, pickNaturalMovementType, toggleNaturalMovement } from './natural-movement.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor(type = undefined) {
  const flagStore = { naturalMovementType: type };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flagStore[key];
    }),
  };
}

describe("pickNaturalMovementType", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("returns the chosen type", () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('swim');
    return expect(pickNaturalMovementType()).resolves.toBe('swim');
  });

  test("returns null when cancelled", () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    return expect(pickNaturalMovementType()).resolves.toBeNull();
  });
});

describe("getNaturalMovementType", () => {
  test("returns the active type", () => {
    expect(getNaturalMovementType(makeActor('climb'))).toBe('climb');
  });

  test("returns null when inactive", () => {
    expect(getNaturalMovementType(makeActor())).toBeNull();
  });
});

describe("toggleNaturalMovement", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("prompts and activates the chosen type when inactive", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('climb');
    const actor = makeActor();

    const result = await toggleNaturalMovement(actor);

    expect(result).toBe('climb');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'naturalMovementType', 'climb');
  });

  test("deactivates when already active, without prompting", async () => {
    const actor = makeActor('swim');

    const result = await toggleNaturalMovement(actor);

    expect(result).toBe(false);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'naturalMovementType');
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("returns null and activates nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    const result = await toggleNaturalMovement(actor);

    expect(result).toBeNull();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

// An actor standing on a scene tagged with the given terrain, with the given environments of
// expertise (see mechanics/world/environment.mjs#getTerrain).
function onTerrain(actor, terrain, environments = ['arctic']) {
  const scene = { getFlag: (scope, key) => (key == 'terrain' ? terrain : undefined) };
  return {
    ...actor,
    documentName: 'Actor',
    getActiveTokens: () => [{ regions: [], parent: scene }],
    system: { ...(actor.system ?? {}), environments },
  };
}

describe("toggleNaturalMovement - environment of expertise from the scene's terrain", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
    ui.notifications.warn.mockClear();
  });

  test("refuses to switch on, with a warning, when the terrain isn't an environment of expertise", async () => {
    const actor = onTerrain(makeActor(), 'desert');
    expect(await toggleNaturalMovement(actor)).toBeNull();
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.NotInEnvironmentOfExpertise');
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("switches on as normal in an environment of expertise", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('swim');
    expect(await toggleNaturalMovement(onTerrain(makeActor(), 'arctic'))).toBe('swim');
    expect(ui.notifications.warn).not.toHaveBeenCalled();
  });

  test("can always be switched back off", async () => {
    expect(await toggleNaturalMovement(onTerrain(makeActor('climb'), 'desert'))).toBe(false);
  });
});
