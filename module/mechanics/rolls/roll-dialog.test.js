import { jest } from '@jest/globals';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { buildCombatModifierSourceFields, RollDialog } from './roll-dialog.mjs';


function makeActor(perkIds = []) {
  return { items: perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } })) };
}

/* _isUntrainedSnag */
describe("_isUntrainedSnag", () => {
  const rollDialog = new RollDialog();

  test("true for an untrained (d20-shift) skill", async () => {
    const actor = makeActor();
    expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(true);
  });

  test("false for a trained skill (non-d20 shift)", async () => {
    const actor = makeActor();
    expect(await rollDialog._isUntrainedSnag({ shift: 'd8' }, actor)).toBe(false);
  });

  // Item rules now (immune: ["untrainedSnag"] while driving a Zord): each actor's Perk carries its
  // pack rules, and the vehicle lists it as crew.
  describe("Zord / Phantom Ship / Quantasaurus Rex while piloting a Zord", () => {
    const ZORD = 'rCpCrfzMYPupoYNI';
    const PHANTOM_SHIP = 'OfsTu9GpONWPV88t';
    const QUANTASAURUS_REX = 'sn5jhTf8sJqRFhKS';
    let next = 1;

    function rulesOf(id) {
      for (const dir of readdirSync('packs')) {
        const src = `packs/${dir}/_source`;
        const file = existsSync(src) ? readdirSync(src).find(name => name.endsWith(`_${id}.json`)) : null;
        if (file) {
          return JSON.parse(readFileSync(`${src}/${file}`, 'utf8')).system.rules;
        }
      }

      return [];
    }

    function makeDrivingActor(id, vehicleType) {
      const actor = { id: `a${next}`, uuid: `Actor.a${next++}`, statuses: new Set(), system: {}, flags: {} };
      actor.items = [{ id: `i${next++}`, type: 'perk', flags: {}, system: { rules: rulesOf(id) }, parent: actor }];
      const vehicle = vehicleType ? { type: vehicleType, system: { actors: { a: { uuid: actor.uuid, vehicleRole: 'driver' } } } } : null;
      global.game = { ...(global.game ?? {}), actors: { contents: vehicle ? [actor, vehicle] : [actor] } };
      return actor;
    }

    afterEach(() => {
      global.game.actors = undefined;
    });

    test("false for Zord (PR CRB, Role Perk, p.35) while piloting a Zord", async () => {
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, makeDrivingActor(ZORD, 'zord'), 'driving')).toBe(false);
    });

    test("true for Zord piloting a non-Zord vehicle", async () => {
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, makeDrivingActor(ZORD, 'vehicle'), 'driving')).toBe(true);
    });

    test("true for Zord with no piloted vehicle", async () => {
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, makeDrivingActor(ZORD, null), 'driving')).toBe(true);
    });

    test("false for Phantom Ship (Across the Stars, p.62) on Driving while piloting a Zord", async () => {
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, makeDrivingActor(PHANTOM_SHIP, 'zord'), 'driving')).toBe(false);
    });

    test("true for Phantom Ship piloting a non-Zord vehicle", async () => {
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, makeDrivingActor(PHANTOM_SHIP, 'vehicle'), 'driving')).toBe(true);
    });

    test("false for Quantasaurus Rex (A Jump Through Time, p.46) on Driving while piloting a Zord", async () => {
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, makeDrivingActor(QUANTASAURUS_REX, 'zord'), 'driving')).toBe(false);
    });

    test("false for Quantasaurus Rex on Animal Handling while piloting a Zord", async () => {
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, makeDrivingActor(QUANTASAURUS_REX, 'zord'), 'animalHandling')).toBe(false);
    });

    test("true for Quantasaurus Rex on Animal Handling with no piloted Zord", async () => {
      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, makeDrivingActor(QUANTASAURUS_REX, null), 'animalHandling')).toBe(true);
    });
  });

  // Green is an UntrainedSnagImmunity rule on each printing now (rules/plugins/rolls/untrained-snag-immunity.mjs); its uses
  // are counted under the rule's own limit (flags.essence20.ruleUses.<item id>-0).
  function greenRules(file) {
    return JSON.parse(readFileSync(`packs/${file}`, 'utf8')).system.rules;
  }

  function makeGreenActor(file, { combat = null, stored } = {}) {
    game.combat = combat;
    return {
      items: [{ id: 'green', type: 'perk', flags: {}, system: { rules: greenRules(file) } }],
      getFlag: jest.fn((scope, key) => (key == 'ruleUses.green-0' ? stored : undefined)),
      setFlag: jest.fn(),
    };
  }

  describe("Green (Transformers CRB, General Perk, p.109)", () => {
    const FILE = 'tfcrbitems/_source/Green_7t0TYx5BMrEHg1BE.json';
    const inCombat = { id: 'combat1' };

    afterEach(() => {
      game.combat = null;
    });

    test("false (suppressed) with uses remaining, and marks the count used", async () => {
      const actor = makeGreenActor(FILE, { combat: inCombat, stored: { epoch: 1, window: 'encounter', count: 1 } });

      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(false);

      expect(actor.setFlag).toHaveBeenCalledWith(
        'essence20', 'ruleUses.green-0', { epoch: 1, window: 'encounter', count: 2 },
      );
    });

    test("true once all 3 uses this combat are spent", async () => {
      const actor = makeGreenActor(FILE, { combat: inCombat, stored: { epoch: 1, window: 'encounter', count: 3 } });

      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(true);
      expect(actor.setFlag).not.toHaveBeenCalled();
    });

    test("resets to 0 uses when the stored count is from a different Combat", async () => {
      const actor = makeGreenActor(FILE, { combat: inCombat, stored: { epoch: 0, window: 'encounter', count: 3 } });

      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(false);
      expect(actor.setFlag).toHaveBeenCalledWith(
        'essence20', 'ruleUses.green-0', { epoch: 1, window: 'encounter', count: 1 },
      );
    });

    test("unconstrained (always false) outside of combat", async () => {
      const actor = makeGreenActor(FILE, { stored: { epoch: 1, window: 'encounter', count: 3 } });

      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(false);
      expect(actor.setFlag).not.toHaveBeenCalled();
    });
  });

  // Green (GI Joe CRB, General Perk, p.131) - unlike the Transformers CRB printing above, RAW here
  // reads "Three times per mission," a strictly wider window than a single encounter. Tracked with
  // the scene counter instead, and available outside of combat too.
  describe("Green (GI Joe CRB, General Perk, p.131)", () => {
    const FILE = 'gijcrbitems/_source/Green_oelHthPlqIq4eDpp.json';

    afterEach(() => {
      game.combat = null;
    });

    test("false (suppressed) with uses remaining outside of combat, and marks the count used", async () => {
      const actor = makeGreenActor(FILE, { stored: { epoch: 1, window: 'scene', count: 1 } });

      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(false);

      expect(actor.setFlag).toHaveBeenCalledWith(
        'essence20', 'ruleUses.green-0', { epoch: 1, window: 'scene', count: 2 },
      );
    });

    test("also works with an active combat", async () => {
      const actor = makeGreenActor(FILE, { combat: { id: 'combat1' }, stored: { epoch: 1, window: 'scene', count: 1 } });

      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(false);
      expect(actor.setFlag).toHaveBeenCalledWith(
        'essence20', 'ruleUses.green-0', { epoch: 1, window: 'scene', count: 2 },
      );
    });

    test("true once all 3 uses this mission (scene) are spent", async () => {
      const actor = makeGreenActor(FILE, { stored: { epoch: 1, window: 'scene', count: 3 } });

      expect(await rollDialog._isUntrainedSnag({ shift: 'd20' }, actor)).toBe(true);
      expect(actor.setFlag).not.toHaveBeenCalled();
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
