import { jest } from '@jest/globals';

let participants = [];
let crew = [];
jest.unstable_mockModule('./mechanics/vehicles/megaform-participants.mjs', () => ({
  getMegaformParticipants: () => participants,
  getMegaformCrew: () => crew,
}));
const {
  GROUP, ROLLER, applyRollerChoice, groupRowOutcome, isMegazord, megazordCrew, outcomeOf, rollerChoices, shiftsBetween,
} = await import('./megazord-rolls.mjs');

const megazord = (extra = {}) => ({ type: 'megaform', system: { subtype: ['megaformZord'], skills: { might: { shift: 'd6' } } }, ...extra });
const zord = (health = 6) => ({ type: 'zord', system: { health: { max: 6, value: health } } });
const pilot = (uuid, shift) => ({ uuid, name: uuid, type: 'playerCharacter', system: { skills: { driving: { shift } } } });

beforeEach(() => {
  participants = [];
  crew = [];
  global.fromUuidSync = jest.fn();
});

describe("isMegazord", () => {
  test("a Power Rangers Megazord, not a Transformers Combiner or another actor", () => {
    expect(isMegazord(megazord())).toBe(true);
    expect(isMegazord({ type: 'megaform', system: { subtype: ['megaformCombiner'] } })).toBe(false);
    expect(isMegazord({ type: 'zord', system: {} })).toBe(false);
  });
});

describe("megazordCrew", () => {
  test("the crew of its working Zords and a Cybertronian taking part as itself", () => {
    const guest = { type: 'playerCharacter', name: 'Bot', system: { health: { max: 5, value: 5 } } };
    participants = [zord(6), zord(0), guest];
    crew = [pilot('Actor.red', 'd6')];
    expect(megazordCrew(megazord()).map(actor => actor.name ?? actor.uuid)).toEqual(['Actor.red', 'Bot']);
  });

  test("a Combiner has none", () => {
    crew = [pilot('Actor.red', 'd6')];
    expect(megazordCrew({ type: 'megaform', system: { subtype: ['megaformCombiner'] } })).toEqual([]);
  });
});

describe("rollerChoices", () => {
  test("the Megazord, each pilot, and the crew together", () => {
    participants = [zord()];
    crew = [pilot('Actor.red', 'd6'), pilot('Actor.blue', 'd4')];
    const [select] = rollerChoices(megazord());
    expect(select.name).toBe(ROLLER);
    expect(select.options.map(option => option.value)).toEqual(['self', 'pilot:Actor.red', 'pilot:Actor.blue', GROUP]);
  });

  test("nothing without a crew, or for anything but a Megazord", () => {
    participants = [zord()];
    expect(rollerChoices(megazord())).toEqual([]);
    crew = [pilot('Actor.red', 'd6')];
    expect(rollerChoices({ type: 'zord', system: {} })).toEqual([]);
  });
});

describe("shiftsBetween", () => {
  test("counts the steps along the shift list, best first", () => {
    const list = ['d12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'];
    expect(shiftsBetween('d6', 'd10', list)).toEqual({ shiftUp: 2, shiftDown: 0 });
    expect(shiftsBetween('d10', 'd4', list)).toEqual({ shiftUp: 0, shiftDown: 3 });
    expect(shiftsBetween('d6', 'd6', list)).toEqual({ shiftUp: 0, shiftDown: 0 });
    expect(shiftsBetween('d6', 'nope', list)).toEqual({ shiftUp: 0, shiftDown: 0 });
  });
});

describe("applyRollerChoice", () => {
  test("a pilot's Driving becomes the die, and the card names them", () => {
    global.fromUuidSync = jest.fn(() => pilot('Actor.red', 'd10'));
    const options = { shiftUp: 1, shiftDown: 0, ext: { [ROLLER]: 'pilot:Actor.red' } };
    applyRollerChoice(megazord(), options, { baseShift: 'd6' });
    expect(options.shiftUp).toBe(3);
    expect(options.rollerNote).toBe('E20.MegazordRolledByPilot');
  });

  test("the crew flags a group test; the Megazord's own die changes nothing", () => {
    const group = { ext: { [ROLLER]: GROUP } };
    applyRollerChoice(megazord(), group, {});
    expect(group.megazordGroup).toBe(true);

    const self = { shiftUp: 0, shiftDown: 0, ext: { [ROLLER]: 'self' } };
    applyRollerChoice(megazord(), self, { baseShift: 'd6' });
    expect(self).toEqual({ shiftUp: 0, shiftDown: 0, ext: { [ROLLER]: 'self' } });
  });
});

describe("the group outcome", () => {
  const tallied = rows => ({ rows: rows.map((row, index) => ({ id: `p${index}`, rolled: true, chaos: false, ...row })) });

  test("half or more succeed; a Critical Success among the successes makes it one", () => {
    const records = { p0: { total: 20, crit: true }, p1: { total: 9 }, p2: { total: 16 }, p3: { total: 4 } };
    const outcome = outcomeOf({ dif: 15 }, tallied([{ success: true }, { success: false }, { success: true }, { success: false }]), id => records[id]);
    expect(outcome).toMatchObject({ successes: 2, rolled: 4, best: 20 });
    expect(groupRowOutcome(outcome, { difficulty: 15 })).toEqual({ success: true, crit: true, multiplier: 1 });
  });

  test("fewer than half is a miss, crit or not", () => {
    const records = { p0: { total: 22, crit: true }, p1: { total: 3 }, p2: { total: 5 } };
    const outcome = outcomeOf({ dif: 15 }, tallied([{ success: true }, { success: false }, { success: false }]), id => records[id]);
    expect(groupRowOutcome(outcome, { difficulty: 15 })).toEqual({ success: false, crit: false, multiplier: 0 });
  });

  test("another target compares the totals against its own Defense", () => {
    const records = { p0: { total: 18 }, p1: { total: 13 } };
    const outcome = outcomeOf({ dif: 15 }, tallied([{ success: true }, { success: false }]), id => records[id]);
    expect(groupRowOutcome(outcome, { difficulty: 19 }).success).toBe(false);
    expect(groupRowOutcome(outcome, { difficulty: 12 }).success).toBe(true);
  });

  test("whoever hasn't rolled, or swapped in Create Chaos, doesn't count", () => {
    const records = { p0: { total: 18 } };
    const outcome = outcomeOf({ dif: 15 }, tallied([{ success: true }, { rolled: false }, { chaos: true }]), id => records[id]);
    expect(outcome.rolled).toBe(1);
    expect(groupRowOutcome(outcome, { difficulty: 15 }).success).toBe(true);
    expect(groupRowOutcome(outcomeOf({ dif: 15 }, tallied([]), () => null), { difficulty: 15 }).success).toBe(false);
  });
});
