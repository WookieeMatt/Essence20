import { jest } from '@jest/globals';
import { getBestVisionGrant, USED_TO_THE_DARK_ID, VISION_FOCUSER_ID } from "./vision-grant.mjs";

const FRIEND_OF_DARKNESS_ID = "Compendium.essence20.gi_joe_crb.Item.NEBliN2pwDIEXcyv";
const NIGHT_EYES_ID = "Compendium.essence20.gi_joe_crb.Item.KXS6M4RyxgjItogK";

function makeItem({
  sourceId, range, mode = 'darkvision', enabled = true, type = 'perk', equipped = true,
  whileMorphed = false, teamWide = false,
}) {
  return {
    type,
    flags: { core: { sourceId } },
    system: { equipped, visionGrant: { enabled, mode, range, whileMorphed, teamWide } },
  };
}

function makeActor(items, { isMorphed = false } = {}) {
  return { items, system: { isMorphed } };
}

describe("getBestVisionGrant", () => {
  test("returns null when nothing grants vision", () => {
    expect(getBestVisionGrant(makeActor([{ type: 'perk', system: {} }]))).toBe(null);
    expect(getBestVisionGrant(makeActor([]))).toBe(null);
    expect(getBestVisionGrant(undefined)).toBe(null);
  });

  test("returns the single grant on offer", () => {
    const actor = makeActor([makeItem({ sourceId: FRIEND_OF_DARKNESS_ID, range: 30 })]);

    expect(getBestVisionGrant(actor)).toEqual({ mode: 'darkvision', range: 30 });
  });

  test("picks the largest range rather than stacking", () => {
    const actor = makeActor([
      makeItem({ sourceId: FRIEND_OF_DARKNESS_ID, range: 30 }),
      makeItem({ sourceId: NIGHT_EYES_ID, range: 90 }),
    ]);

    expect(getBestVisionGrant(actor)).toEqual({ mode: 'darkvision', range: 90 });
  });

  test("skips disabled grants and unequipped gear", () => {
    const actor = makeActor([
      makeItem({ sourceId: FRIEND_OF_DARKNESS_ID, range: 30, enabled: false }),
      makeItem({ sourceId: 'goggles', range: 60, type: 'gear', equipped: false }),
    ]);

    expect(getBestVisionGrant(actor)).toBe(null);
  });

  describe("Used to the Dark's doubling clause (Cobra Codex p.81)", () => {
    test("is plainly 30 feet on its own — nothing to double", () => {
      const actor = makeActor([makeItem({ sourceId: USED_TO_THE_DARK_ID, range: 30 })]);

      expect(getBestVisionGrant(actor)).toEqual({ mode: 'darkvision', range: 30 });
    });

    test("doubles to 60 alongside Friend of Darkness — RAW's own worked example", () => {
      const actor = makeActor([
        makeItem({ sourceId: USED_TO_THE_DARK_ID, range: 30 }),
        makeItem({ sourceId: FRIEND_OF_DARKNESS_ID, range: 30 }),
      ]);

      expect(getBestVisionGrant(actor)).toEqual({ mode: 'darkvision', range: 60 });
    });

    // RAW doubles "the range you can see in the dark" - whatever you could already see, not Used
    // to the Dark's own 30.
    test("doubles the BEST range, so Night Eyes reaches 180 rather than 60", () => {
      const actor = makeActor([
        makeItem({ sourceId: USED_TO_THE_DARK_ID, range: 30 }),
        makeItem({ sourceId: NIGHT_EYES_ID, range: 90 }),
      ]);

      expect(getBestVisionGrant(actor)).toEqual({ mode: 'darkvision', range: 180 });
    });

    test("counts equipped gear as an other source too, not just Perks", () => {
      const actor = makeActor([
        makeItem({ sourceId: USED_TO_THE_DARK_ID, range: 30 }),
        makeItem({ sourceId: 'goggles', range: 20, type: 'gear', equipped: true }),
      ]);

      expect(getBestVisionGrant(actor)).toEqual({ mode: 'darkvision', range: 60 });
    });

    test("does not double against a source that is present but switched off", () => {
      const actor = makeActor([
        makeItem({ sourceId: USED_TO_THE_DARK_ID, range: 30 }),
        makeItem({ sourceId: FRIEND_OF_DARKNESS_ID, range: 30, enabled: false }),
      ]);

      expect(getBestVisionGrant(actor)).toEqual({ mode: 'darkvision', range: 30 });
    });

    test("picks up a vision grant from an alteration-type item too (Enhanced Photoreceptors)", () => {
      const ENHANCED_PHOTORECEPTORS_ID = "Compendium.essence20.cobra_codex.Item.lIZ82fVg0ariPYcb";
      const actor = makeActor([
        makeItem({ sourceId: ENHANCED_PHOTORECEPTORS_ID, range: 30, type: 'alteration' }),
      ]);

      expect(getBestVisionGrant(actor)).toEqual({ mode: 'darkvision', range: 30 });
    });

    test("resolves an Actor-embedded copy by _stats.compendiumSource", () => {
      const actor = makeActor([
        {
          type: 'perk',
          flags: {},
          _stats: { compendiumSource: USED_TO_THE_DARK_ID },
          system: { equipped: true, visionGrant: { enabled: true, mode: 'darkvision', range: 30 } },
        },
        makeItem({ sourceId: FRIEND_OF_DARKNESS_ID, range: 30 }),
      ]);

      expect(getBestVisionGrant(actor)).toEqual({ mode: 'darkvision', range: 60 });
    });
  });

  describe("Vision Focuser (PR CRB, Blue Ranger Grid Tech II pick, p.38)", () => {
    global.canvas = {
      tokens: { placeables: [] },
      grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
    };

    beforeEach(() => {
      canvas.tokens.placeables = [];
      canvas.grid.measurePath.mockReturnValue({ distance: 5 });
    });

    test("applies to the holder only while Morphed", () => {
      const item = makeItem({ sourceId: VISION_FOCUSER_ID, range: 30, whileMorphed: true });

      expect(getBestVisionGrant(makeActor([item], { isMorphed: false }))).toBe(null);
      expect(getBestVisionGrant(makeActor([item], { isMorphed: true }))).toEqual({ mode: 'darkvision', range: 30 });
    });

    test("extends to a nearby ally holding it while Morphed, teamWide", () => {
      const selfToken = { actor: {}, document: { disposition: 1 }, center: {} };
      const actor = { items: [], system: { isMorphed: false }, getActiveTokens: jest.fn(() => [selfToken]) };

      const allyActor = {
        system: { isMorphed: true },
        items: [makeItem({ sourceId: VISION_FOCUSER_ID, range: 30, whileMorphed: true, teamWide: true })],
      };
      const allyToken = { actor: allyActor, document: { disposition: 1 }, center: {} };
      canvas.tokens.placeables = [selfToken, allyToken];

      expect(getBestVisionGrant(actor)).toEqual({ mode: 'darkvision', range: 30 });
    });

    test("does not extend from an ally who isn't Morphed", () => {
      const selfToken = { actor: {}, document: { disposition: 1 }, center: {} };
      const actor = { items: [], system: { isMorphed: false }, getActiveTokens: jest.fn(() => [selfToken]) };

      const allyActor = {
        system: { isMorphed: false },
        items: [makeItem({ sourceId: VISION_FOCUSER_ID, range: 30, whileMorphed: true, teamWide: true })],
      };
      const allyToken = { actor: allyActor, document: { disposition: 1 }, center: {} };
      canvas.tokens.placeables = [selfToken, allyToken];

      expect(getBestVisionGrant(actor)).toBe(null);
    });

    test("does not extend from a nearby ally's grant that isn't teamWide", () => {
      const selfToken = { actor: {}, document: { disposition: 1 }, center: {} };
      const actor = { items: [], system: { isMorphed: false }, getActiveTokens: jest.fn(() => [selfToken]) };

      const allyActor = {
        system: { isMorphed: true },
        items: [makeItem({ sourceId: VISION_FOCUSER_ID, range: 30, whileMorphed: true, teamWide: false })],
      };
      const allyToken = { actor: allyActor, document: { disposition: 1 }, center: {} };
      canvas.tokens.placeables = [selfToken, allyToken];

      expect(getBestVisionGrant(actor)).toBe(null);
    });
  });
});
