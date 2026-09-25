import { jest } from '@jest/globals';
import {
  HELP_YOURSELF_FLAG, isHelpYourselfCloneActive, summonHelpYourselfClone,
} from "./help-yourself.mjs";

function makeActor(flagValue = undefined) {
  return {
    getFlag: jest.fn((scope, key) => (key == HELP_YOURSELF_FLAG ? flagValue : undefined)),
    setFlag: jest.fn(),
  };
}

describe("summonHelpYourselfClone", () => {
  afterEach(() => {
    global.canvas = undefined;
  });

  test("stamps the clone with the scene it was cast on", async () => {
    global.canvas = { scene: { id: 'scene1' } };
    const actor = makeActor();

    await summonHelpYourselfClone(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', HELP_YOURSELF_FLAG, { sceneId: 'scene1' });
  });

  test("records a null scene when there is no canvas at all", async () => {
    const actor = makeActor();

    await summonHelpYourselfClone(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', HELP_YOURSELF_FLAG, { sceneId: null });
  });
});

describe("isHelpYourselfCloneActive", () => {
  afterEach(() => {
    global.canvas = undefined;
  });

  test("is false when the spell was never cast", () => {
    global.canvas = { scene: { id: 'scene1' } };

    expect(isHelpYourselfCloneActive(makeActor())).toBe(false);
  });

  test("is true on the scene the clone was summoned on", () => {
    global.canvas = { scene: { id: 'scene1' } };

    expect(isHelpYourselfCloneActive(makeActor({ sceneId: 'scene1' }))).toBe(true);
  });

  test("is false once the caster has moved to a different scene — RAW's '1 scene' duration", () => {
    global.canvas = { scene: { id: 'scene2' } };

    expect(isHelpYourselfCloneActive(makeActor({ sceneId: 'scene1' }))).toBe(false);
  });

  test("stays active when no scene was ever recorded", () => {
    global.canvas = { scene: { id: 'scene2' } };

    expect(isHelpYourselfCloneActive(makeActor({ sceneId: null }))).toBe(true);
  });

  test("stays active when there is no current scene to compare against", () => {
    expect(isHelpYourselfCloneActive(makeActor({ sceneId: 'scene1' }))).toBe(true);
  });
});
