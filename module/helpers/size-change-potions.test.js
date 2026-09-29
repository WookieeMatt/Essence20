import { jest } from '@jest/globals';
import {
  applySizeChangePotion, expireSizeChangePotions, isSizeChangePotionActive, isSizeChangePotionExpired,
  removeSizeChangePotion,
} from './size-change-potions.mjs';

// Drunk in the current (default 1) scene on the Scene Clock.
const THIS_SCENE = { epoch: 1, window: 'scene', count: 1 };

function makeActor({ size = 'common', originalSize = undefined, scene = THIS_SCENE } = {}) {
  const flagStore = {};
  if (originalSize !== undefined) {
    flagStore.sizeChangePotionOriginalSize = originalSize;
    if (scene) {
      flagStore.sizeChangePotionScene = scene;
    }
  }

  const actor = {
    system: { size },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flagStore[key];
    }),
    update: jest.fn(async (data) => {
      actor.system.size = data['system.size'];
    }),
    flagStore,
  };
  return actor;
}

afterEach(() => {
  delete global.game;
});

describe("applySizeChangePotion", () => {
  test("saves the original size, stamps the scene and sets the new size", async () => {
    const actor = makeActor();

    await applySizeChangePotion(actor, 'huge');

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'sizeChangePotionOriginalSize', 'common');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'sizeChangePotionScene', THIS_SCENE);
    expect(actor.update).toHaveBeenCalledWith({ 'system.size': 'huge' });
    expect(isSizeChangePotionActive(actor)).toBe(true);
  });

  test("a second potion in the same scene does nothing", async () => {
    const actor = makeActor({ size: 'huge', originalSize: 'common' });

    await applySizeChangePotion(actor, 'small');

    expect(actor.update).not.toHaveBeenCalled();
  });

  test("a potion from an earlier scene is reverted before the new one applies", async () => {
    const actor = makeActor({ size: 'huge', originalSize: 'common', scene: { ...THIS_SCENE, epoch: 0 } });

    await applySizeChangePotion(actor, 'small');

    expect(actor.update).toHaveBeenNthCalledWith(1, { 'system.size': 'common' });
    expect(actor.update).toHaveBeenNthCalledWith(2, { 'system.size': 'small' });
    expect(actor.flagStore.sizeChangePotionOriginalSize).toBe('common');
  });
});

describe("isSizeChangePotionExpired", () => {
  test("not while its scene is running", () => {
    expect(isSizeChangePotionExpired(makeActor({ originalSize: 'common' }))).toBe(false);
  });

  test("once the GM has started a new scene", () => {
    global.game = { settings: { get: (scope, key) => (key == 'sceneClockScene' ? 2 : undefined) } };
    expect(isSizeChangePotionExpired(makeActor({ originalSize: 'common' }))).toBe(true);
  });

  test("a potion drunk before potions had a duration counts as expired", () => {
    expect(isSizeChangePotionExpired(makeActor({ originalSize: 'common', scene: null }))).toBe(true);
  });

  test("never without a potion", () => {
    expect(isSizeChangePotionExpired(makeActor())).toBe(false);
  });
});

describe("removeSizeChangePotion", () => {
  test("restores the size and clears both flags", async () => {
    const actor = makeActor({ size: 'huge', originalSize: 'common' });

    await removeSizeChangePotion(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.size': 'common' });
    expect(actor.flagStore).toEqual({});
  });
});

describe("expireSizeChangePotions", () => {
  test("the active GM reverts every world and unlinked-token actor whose scene has ended", async () => {
    const worldActor = makeActor({ size: 'huge', originalSize: 'common', scene: { ...THIS_SCENE, epoch: 0 } });
    const tokenActor = makeActor({ size: 'small', originalSize: 'common', scene: { ...THIS_SCENE, epoch: 0 } });
    const running = makeActor({ size: 'huge', originalSize: 'common' });
    global.game = {
      users: { activeGM: { isSelf: true } },
      actors: [worldActor, running],
      scenes: [{ tokens: [{ actorLink: false, actor: tokenActor }, { actorLink: true, actor: worldActor }] }],
    };

    await expireSizeChangePotions();

    expect(worldActor.update).toHaveBeenCalledTimes(1);
    expect(tokenActor.update).toHaveBeenCalledWith({ 'system.size': 'common' });
    expect(running.update).not.toHaveBeenCalled();
  });

  test("does nothing on a non-GM client", async () => {
    const actor = makeActor({ size: 'huge', originalSize: 'common', scene: null });
    global.game = { users: { activeGM: { isSelf: false } }, actors: [actor] };

    await expireSizeChangePotions();

    expect(actor.update).not.toHaveBeenCalled();
  });
});
