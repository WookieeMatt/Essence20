import { jest } from '@jest/globals';
import { buildCombatModifierSourceFields, RollDialog } from './roll-dialog.mjs';

const PRESENCE_ID = "Compendium.essence20.gi_joe_crb.Item.EdP0LqcYh2tkMygI";
const I_LL_MAKE_IT_WORK_ID = "Compendium.essence20.jump_through_time.Item.nxgmUTaPwFcg94ia";

function makeActor(perkIds = []) {
  return { items: perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } })) };
}

/* _isUntrainedSnag */
describe("_isUntrainedSnag", () => {
  const rollDialog = new RollDialog();

  test("true for an untrained (d20-shift) skill, no Presence", async () => {
    const actor = makeActor();
    expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(true);
  });

  test("false for a trained skill (non-d20 shift)", async () => {
    const actor = makeActor();
    expect(await rollDialog._isUntrainedSnag({ shift: 'd8' }, actor)).toBe(false);
  });

  test("false for an untrained skill when the actor has Presence", async () => {
    const actor = makeActor([PRESENCE_ID]);
    expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(false);
  });

  test("Presence doesn't matter for an already-trained skill", async () => {
    const actor = makeActor([PRESENCE_ID]);
    expect(await rollDialog._isUntrainedSnag({ shift: 'd8' }, actor)).toBe(false);
  });

  test("false for an untrained skill when the actor has I'll Make It Work instead", async () => {
    const actor = makeActor([I_LL_MAKE_IT_WORK_ID]);
    expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(false);
  });

  describe("Air/Land/Sea Vehicle Qualification (Factions in Action Vol. 2, Dreadnok General Perks, p.63)", () => {
    const LAND_VEHICLE_QUALIFICATION_ID = "Compendium.essence20.intercontinental_adventures.Item.xLeoc9xLx06SpK7S";
    const AIR_VEHICLE_QUALIFICATION_ID = "Compendium.essence20.intercontinental_adventures.Item.GUcQm2RuUIEWzd4X";

    function makeDrivingActor(perkIds, pilotedVehicle) {
      return { ...makeActor(perkIds), _dice: { _getPilotedVehicle: jest.fn(() => pilotedVehicle) } };
    }

    function makeVehicle(movementType) {
      return { system: { movement: { aerial: { base: 0 }, ground: { base: 0 }, swim: { base: 0 }, [movementType]: { base: 30 } } } };
    }

    test("false for an untrained Driving Test while piloting a matching-type vehicle with the Perk", async () => {
      const actor = makeDrivingActor([LAND_VEHICLE_QUALIFICATION_ID], makeVehicle('ground'));
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor, 'driving')).toBe(false);
    });

    test("true when the Perk doesn't match the piloted vehicle's own movement type", async () => {
      const actor = makeDrivingActor([LAND_VEHICLE_QUALIFICATION_ID], makeVehicle('aerial'));
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor, 'driving')).toBe(true);
    });

    test("true without a piloted vehicle, even with the Perk", async () => {
      const actor = makeDrivingActor([LAND_VEHICLE_QUALIFICATION_ID], null);
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor, 'driving')).toBe(true);
    });

    test("true for a non-Driving Skill Test, even while piloting a matching vehicle with the Perk", async () => {
      const actor = makeDrivingActor([LAND_VEHICLE_QUALIFICATION_ID], makeVehicle('ground'));
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor, 'targeting')).toBe(true);
    });

    test("false when a different Qualification (Air) matches an aerial vehicle", async () => {
      const actor = makeDrivingActor([AIR_VEHICLE_QUALIFICATION_ID], makeVehicle('aerial'));
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor, 'driving')).toBe(false);
    });

    test("false for Skyward (Quartermaster's Guide to Gear, Influence Perk, p.13) piloting an aerial vehicle", async () => {
      const SKYWARD_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.1IlTYXe8k5Aj63Mn";
      const actor = makeDrivingActor([SKYWARD_ID], makeVehicle('aerial'));
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor, 'driving')).toBe(false);
    });

    test("true for Skyward piloting a ground vehicle", async () => {
      const SKYWARD_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.1IlTYXe8k5Aj63Mn";
      const actor = makeDrivingActor([SKYWARD_ID], makeVehicle('ground'));
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor, 'driving')).toBe(true);
    });

    test("false for Nu, Pogodi! (Oktober Guard Faction Perk) piloting a ground vehicle", async () => {
      const NU_POGODI_ID = "Compendium.essence20.intercontinental_adventures.Item.sItc8nD7ockbQ1mn";
      const actor = makeDrivingActor([NU_POGODI_ID], makeVehicle('ground'));
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor, 'driving')).toBe(false);
    });

    test("false for The Promise of Riches (Mercenary Faction Perk) piloting any of the three movement types", async () => {
      const THE_PROMISE_OF_RICHES_ID = "Compendium.essence20.intercontinental_adventures.Item.wW4xugDI7Sea2Btg";
      for (const movementType of ['aerial', 'ground', 'swim']) {
        const actor = makeDrivingActor([THE_PROMISE_OF_RICHES_ID], makeVehicle(movementType));
        expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor, 'driving')).toBe(false);
      }
    });

    function makeGoodToGoActor(choice, pilotedVehicle) {
      const GOOD_TO_GO_ID = "Compendium.essence20.intercontinental_adventures.Item.Yt3muowN1aALcqOj";
      return {
        items: [{ type: 'perk', flags: { core: { sourceId: GOOD_TO_GO_ID } }, system: { choice } }],
        _dice: { _getPilotedVehicle: jest.fn(() => pilotedVehicle) },
      };
    }

    test("false for Good To Go (Freedom Fighters Faction Perk) piloting the chosen movement type", async () => {
      const actor = makeGoodToGoActor('ground', makeVehicle('ground'));
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor, 'driving')).toBe(false);
    });

    test("true for Good To Go piloting a movement type other than the one chosen", async () => {
      const actor = makeGoodToGoActor('ground', makeVehicle('aerial'));
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor, 'driving')).toBe(true);
    });

    test("false for For The Syndicate (International Syndicate Faction Perk) piloting the chosen movement type", async () => {
      const FOR_THE_SYNDICATE_ID = "Compendium.essence20.intercontinental_adventures.Item.opygNwRWgeIyU1mE";
      const actor = {
        items: [{ type: 'perk', flags: { core: { sourceId: FOR_THE_SYNDICATE_ID } }, system: { choice: 'swim' } }],
        _dice: { _getPilotedVehicle: jest.fn(() => makeVehicle('swim')) },
      };
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor, 'driving')).toBe(false);
    });
  });

  describe("Green (Transformers CRB, General Perk, p.109)", () => {
    const GREEN_ID = "Compendium.essence20.tf_crb.Item.7t0TYx5BMrEHg1BE";

    function makeGreenActor({ combat = { id: 'combat1' }, stored } = {}) {
      game.combat = combat;
      return {
        ...makeActor([GREEN_ID]),
        getFlag: jest.fn(() => stored),
        setFlag: jest.fn(),
      };
    }

    afterEach(() => {
      game.combat = null;
    });

    test("false (suppressed) with uses remaining, and marks the count used", async () => {
      const actor = makeGreenActor({ stored: { epoch: 1, window: 'encounter', count: 1 } });

      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(false);

      expect(actor.setFlag).toHaveBeenCalledWith(
        'essence20', 'greenUsesThisEncounter', { epoch: 1, window: 'encounter', count: 2 },
      );
    });

    test("true once all 3 uses this combat are spent", async () => {
      const actor = makeGreenActor({ stored: { epoch: 1, window: 'encounter', count: 3 } });

      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(true);
      expect(actor.setFlag).not.toHaveBeenCalled();
    });

    test("resets to 0 uses when the stored count is from a different Combat", async () => {
      const actor = makeGreenActor({ stored: { epoch: 0, window: 'encounter', count: 3 } });

      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(false);
      expect(actor.setFlag).toHaveBeenCalledWith(
        'essence20', 'greenUsesThisEncounter', { epoch: 1, window: 'encounter', count: 1 },
      );
    });

    test("unconstrained (always false) outside of combat", async () => {
      const actor = makeGreenActor({ combat: null, stored: { epoch: 1, window: 'encounter', count: 3 } });

      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(false);
      expect(actor.setFlag).not.toHaveBeenCalled();
    });

    test("also applies for GI Joe CRB's own identically-worded reprint", async () => {
      const GREEN_GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.oelHthPlqIq4eDpp";
      game.combat = { id: 'combat1' };
      const actor = {
        ...makeActor([GREEN_GIJ_ID]),
        getFlag: jest.fn(() => ({ epoch: 1, window: 'encounter', count: 1 })),
        setFlag: jest.fn(),
      };

      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(false);
      expect(actor.setFlag).toHaveBeenCalledWith(
        'essence20', 'greenUsesThisEncounter', { epoch: 1, window: 'encounter', count: 2 },
      );
      game.combat = null;
    });
  });
});

/* buildCombatModifierSourceFields */
describe("buildCombatModifierSourceFields", () => {
  test("empty input yields empty results", () => {
    expect(buildCombatModifierSourceFields(undefined)).toEqual({
      shiftModifierSources: [], edgeSourcesText: '', snagSourcesText: '',
    });
    expect(buildCombatModifierSourceFields([])).toEqual({
      shiftModifierSources: [], edgeSourcesText: '', snagSourcesText: '',
    });
  });

  test("filters to only the shiftUp/shiftDown-granting sources, in order", () => {
    const sources = [
      { id: 'informedAccuracy', label: 'Informed Accuracy', shiftUp: 2, shiftDown: 0, edge: false, snag: false },
      { id: 'firstStrike', label: 'First Strike', shiftUp: 0, shiftDown: 0, edge: true, snag: false },
      { id: 'fightMe', label: 'Fight Me!', shiftUp: 0, shiftDown: 1, edge: false, snag: false },
    ];

    const { shiftModifierSources } = buildCombatModifierSourceFields(sources);

    expect(shiftModifierSources).toEqual([sources[0], sources[2]]);
  });

  test("joins edge-granting source labels with a comma", () => {
    const sources = [
      { id: 'firstStrike', label: 'First Strike', shiftUp: 0, shiftDown: 0, edge: true, snag: false },
      { id: 'markTarget', label: 'Mark Target', shiftUp: 1, shiftDown: 0, edge: false, snag: false },
      { id: 'vantagePoint', label: 'Vantage Point', shiftUp: 0, shiftDown: 0, edge: true, snag: false },
    ];

    const { edgeSourcesText } = buildCombatModifierSourceFields(sources);

    expect(edgeSourcesText).toBe('First Strike, Vantage Point');
  });

  test("joins snag-granting source labels with a comma", () => {
    const sources = [
      { id: 'cover', label: 'Cover', shiftUp: 0, shiftDown: 2, edge: false, snag: false },
      { id: 'paranoia', label: 'Paranoia', shiftUp: 0, shiftDown: 0, edge: false, snag: true },
      { id: 'resistance', label: 'Resistance', shiftUp: 0, shiftDown: 0, edge: false, snag: true },
    ];

    const { snagSourcesText } = buildCombatModifierSourceFields(sources);

    expect(snagSourcesText).toBe('Paranoia, Resistance');
  });
});
