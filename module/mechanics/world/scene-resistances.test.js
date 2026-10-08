import { jest } from '@jest/globals';
import { clearSceneResistances, grantSceneResistance, sceneResistancesOf } from "./scene-resistances.mjs";

describe("scene Resistances (Hardened Armor, Elemental Adaptation)", () => {
  let scene = 3;
  beforeEach(() => {
    scene = 3;
    global.game = { ...(global.game ?? {}), settings: { get: jest.fn((ns, key) => (key == 'sceneClockScene' ? scene : 1)) } };
  });

  test("a granted Resistance is stamped with the current scene", async () => {
    const actor = { setFlag: jest.fn() };
    await grantSceneResistance(actor, 'fire');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'sceneResistances.fire', { epoch: 3, window: 'scene', count: 1, morphedOnly: false });
  });

  test("applies this scene, and ends when the scene changes", () => {
    const actor = { system: {}, flags: { essence20: { sceneResistances: { fire: { epoch: 3 }, cold: { epoch: 2 } } } } };
    expect(sceneResistancesOf(actor)).toEqual(['fire']);
    scene = 4;
    expect(sceneResistancesOf(actor)).toEqual([]);
  });

  test("a Morphed-form Resistance only applies while Morphed", () => {
    const flags = { essence20: { sceneResistances: { fire: { epoch: 3, morphedOnly: true } } } };
    expect(sceneResistancesOf({ system: { isMorphed: false }, flags })).toEqual([]);
    expect(sceneResistancesOf({ system: { isMorphed: true }, flags })).toEqual(['fire']);
  });

  test("a new scene clears the records off every actor that has one", async () => {
    const withOne = { flags: { essence20: { sceneResistances: { fire: { epoch: 3 } } } }, unsetFlag: jest.fn() };
    const without = { flags: {}, unsetFlag: jest.fn() };
    const tokenActor = { flags: { essence20: { sceneResistances: { cold: { epoch: 3 } } } }, unsetFlag: jest.fn() };
    global.game.actors = [withOne, without];
    global.game.scenes = [{ tokens: [{ actorLink: false, actor: tokenActor }, { actorLink: true, actor: withOne }] }];
    await clearSceneResistances();
    expect(withOne.unsetFlag).toHaveBeenCalledTimes(1);
    expect(withOne.unsetFlag).toHaveBeenCalledWith('essence20', 'sceneResistances');
    expect(tokenActor.unsetFlag).toHaveBeenCalledWith('essence20', 'sceneResistances');
    expect(without.unsetFlag).not.toHaveBeenCalled();
  });
});
