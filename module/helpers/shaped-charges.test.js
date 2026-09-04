import { jest } from '@jest/globals';
import { applyShapedCharges, SHAPED_CHARGES_ID } from './shaped-charges.mjs';

global.game = { i18n: { localize: (k) => k, format: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
global.canvas = { tokens: { setTargets: jest.fn() } };

// A controllable stand-in for Foundry's own Roll class - jest.setup.js's shared global.Roll (used
// by other test files) has no evaluate() at all, since nothing else in this codebase's test suite
// exercises a real dice roll outside of Application-level mocking (see dice.test.js's own
// _rollSkillHelper = jest.fn() pattern). This file replaces global.Roll wholesale, same as
// shield-modulation.test.js already does for global.foundry/global.game.
let nextRollTotal = 3;
global.Roll = class Roll {
  constructor(formula) {
    this.formula = formula;
  }
  async evaluate() {
    this.total = nextRollTotal;
    return this;
  }
};

function makeActor({ hasPerk = true, shift = 'd8' } = {}) {
  const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: SHAPED_CHARGES_ID } } }] : [];
  return { items, system: { skills: { targeting: { shift } } } };
}

function makeExplosiveEffect(overrides = {}) {
  return { type: 'weaponEffect', system: { classification: { skill: 'targeting', style: 'explosive' } }, ...overrides };
}

function makeToken(id, name) {
  return { id, name };
}

describe("applyShapedCharges", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
    canvas.tokens.setTargets.mockReset();
    nextRollTotal = 3;
  });

  test("passes tokens through unchanged without the Perk", async () => {
    const tokens = [makeToken('t1', 'Alpha')];
    const result = await applyShapedCharges(makeActor({ hasPerk: false }), makeExplosiveEffect(), tokens);

    expect(result).toBe(tokens);
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("passes tokens through unchanged for a non-explosive attack, even with the Perk", async () => {
    const tokens = [makeToken('t1', 'Alpha')];
    const nonExplosive = makeExplosiveEffect({ system: { classification: { skill: 'targeting', style: 'ballistic' } } });
    const result = await applyShapedCharges(makeActor(), nonExplosive, tokens);

    expect(result).toBe(tokens);
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("passes an empty catch through unchanged without prompting", async () => {
    const result = await applyShapedCharges(makeActor(), makeExplosiveEffect(), []);

    expect(result).toEqual([]);
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("skips the roll/prompt for a non-rollable shift (e.g. autoSuccess)", async () => {
    const tokens = [makeToken('t1', 'Alpha')];
    const result = await applyShapedCharges(makeActor({ shift: 'autoSuccess' }), makeExplosiveEffect(), tokens);

    expect(result).toBe(tokens);
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("removes exactly the tokens the player checked off, and re-targets the remainder", async () => {
    const tokens = [makeToken('t1', 'Alpha'), makeToken('t2', 'Bravo'), makeToken('t3', 'Charlie')];
    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ buttons }) => {
      const confirmButton = buttons.find(b => b.action == 'confirm');
      const form = { elements: { t1: { checked: true }, t2: { checked: false }, t3: { checked: false } } };
      return confirmButton.callback(null, { form });
    });

    const result = await applyShapedCharges(makeActor(), makeExplosiveEffect(), tokens);

    expect(result).toEqual([tokens[1], tokens[2]]);
    expect(canvas.tokens.setTargets).toHaveBeenCalledWith(['t2', 't3']);
  });

  test("passes every token through, untouched, when nothing is checked off", async () => {
    const tokens = [makeToken('t1', 'Alpha')];
    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ buttons }) => {
      const confirmButton = buttons.find(b => b.action == 'confirm');
      return confirmButton.callback(null, { form: { elements: { t1: { checked: false } } } });
    });

    const result = await applyShapedCharges(makeActor(), makeExplosiveEffect(), tokens);

    expect(result).toEqual(tokens);
    expect(canvas.tokens.setTargets).not.toHaveBeenCalled();
  });

  test("cancelling the dialog leaves every token targeted", async () => {
    const tokens = [makeToken('t1', 'Alpha')];
    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ buttons }) => {
      const cancelButton = buttons.find(b => b.action == 'cancel');
      return cancelButton.callback();
    });

    const result = await applyShapedCharges(makeActor(), makeExplosiveEffect(), tokens);

    expect(result).toEqual(tokens);
    expect(canvas.tokens.setTargets).not.toHaveBeenCalled();
  });

  test("the prompt lists every caught token by name and carries the pick-count label", async () => {
    nextRollTotal = 5;
    foundry.applications.api.DialogV2.wait.mockResolvedValue([]);
    const tokens = [makeToken('t1', 'Alpha'), makeToken('t2', 'Bravo')];

    await applyShapedCharges(makeActor(), makeExplosiveEffect(), tokens);

    const call = foundry.applications.api.DialogV2.wait.mock.calls[0][0];
    expect(call.content).toContain('Alpha');
    expect(call.content).toContain('Bravo');
    expect(call.content).toContain('E20.ShapedChargesPickLabel');
    expect(call.window.title).toBe('E20.ShapedChargesPickTitle');
  });
});
