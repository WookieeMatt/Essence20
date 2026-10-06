import { jest } from '@jest/globals';
import {
  findSecretHelperClaimant, getSecretHelperDie, rollSecretHelperAssist, SECRET_HELPER_ID,
} from "./secret-helper.mjs";

function makeActor({ id = 'pony1', hasPerk = true, skills = {} } = {}) {
  return {
    id,
    name: 'Rarity',
    items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: SECRET_HELPER_ID } } }] : [],
    system: { skills },
    getRollData: () => ({}),
  };
}

describe("findSecretHelperClaimant", () => {
  afterEach(() => {
    global.game = undefined;
  });

  test("returns the viewing user's own character when it holds the Perk", () => {
    const claimant = makeActor({ id: 'rarity1' });
    global.game = { user: { character: claimant } };

    expect(findSecretHelperClaimant(makeActor({ id: 'roller1', hasPerk: false }))).toBe(claimant);
  });

  test("returns null when the failed roll is the claimant's own — RAW says 'a FRIEND'", () => {
    const claimant = makeActor({ id: 'rarity1' });
    global.game = { user: { character: claimant } };

    expect(findSecretHelperClaimant(claimant)).toBe(null);
  });

  test("returns null when the viewing user's character lacks the Perk", () => {
    global.game = { user: { character: makeActor({ id: 'rarity1', hasPerk: false }) } };

    expect(findSecretHelperClaimant(makeActor({ id: 'roller1' }))).toBe(null);
  });

  test("returns null for a user with no assigned character at all", () => {
    global.game = { user: {} };

    expect(findSecretHelperClaimant(makeActor({ id: 'roller1' }))).toBe(null);
  });
});

describe("getSecretHelperDie", () => {
  test("returns the helper's own shift for the skill the friend was using", () => {
    const actor = makeActor({ skills: { athletics: { shift: 'd6' }, deception: { shift: 'd2' } } });

    expect(getSecretHelperDie(actor, 'athletics')).toBe('d6');
    expect(getSecretHelperDie(actor, 'deception')).toBe('d2');
  });

  test("returns null for an untrained skill — a d20 shift contributes no Skill Die at all", () => {
    const actor = makeActor({ skills: { athletics: { shift: 'd20' } } });

    expect(getSecretHelperDie(actor, 'athletics')).toBe(null);
  });

  test("returns null for a skill the helper has no entry for", () => {
    expect(getSecretHelperDie(makeActor(), 'athletics')).toBe(null);
  });
});

describe("rollSecretHelperAssist", () => {
  let rollSpy;

  beforeEach(() => {
    rollSpy = jest.fn();
    global.Roll = class {
      constructor(formula) {
        this.formula = formula;
        rollSpy(formula);
      }

      async evaluate() {
        this.total = 99;
        return this;
      }
    };
  });

  afterEach(() => {
    global.Roll = undefined;
  });

  test("rolls the friend's total plus the helper's own Skill Die", async () => {
    const actor = makeActor({ skills: { athletics: { shift: 'd6' } } });

    const roll = await rollSecretHelperAssist(actor, 'athletics', 14);

    expect(rollSpy).toHaveBeenCalledWith('14 + d6');
    expect(roll.total).toBe(99);
  });

  test("rolls nothing when the helper is untrained in that skill", async () => {
    const actor = makeActor({ skills: { athletics: { shift: 'd20' } } });

    expect(await rollSecretHelperAssist(actor, 'athletics', 14)).toBe(null);
    expect(rollSpy).not.toHaveBeenCalled();
  });
});
