import { jest } from '@jest/globals';
import {
  FIX3_TF, KIND, liveMark, markDigDeepSnag, nextTurnWindow, personalVehicleSources, tfFixApplyDialog, tfFixPostRoll,
  tfFixRollSources, tfFixSceneAdvanced, tfFixToggles, tfFixTurnEnd,
} from './tf-fixes.mjs';
import { SUMMON } from '../../summons.mjs';

function perk(uuid, extra = {}) {
  return { name: extra.name ?? 'Perk', type: 'perk', flags: { core: { sourceId: uuid } }, system: extra.system ?? {} };
}

function makeActor({ id = 'a1', items = [], flags = {}, statuses = [], system = {}, type = 'playerCharacter' } = {}) {
  const actor = {
    id, uuid: `Actor.${id}`, type, items, system, flags: { essence20: { ...flags } },
    statuses: new Set(statuses),
    getActiveTokens: () => [],
    setFlag: jest.fn(async (scope, key, value) => {
      actor.flags.essence20[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete actor.flags.essence20[key];
    }),
    toggleStatusEffect: jest.fn(async () => {}),
  };
  return actor;
}

beforeEach(() => {
  global.game = { actors: [], user: { targets: new Set() }, combat: null, i18n: { has: () => false } };
});

describe("nextTurnWindow", () => {
  test("empty out of combat", () => {
    expect(nextTurnWindow(makeActor())).toEqual({});
  });

  test("a creature still to act this round has its next turn this round", () => {
    const actor = makeActor({ id: 'late' });
    game.combat = { id: 'c', round: 2, turn: 0, turns: [{ actor: { id: 'x' } }, { actor: { id: 'late' } }] };
    expect(nextTurnWindow(actor)).toEqual({ combatId: 'c', untilRound: 2, untilTurn: 1 });
  });

  test("a creature that already acted (or is acting) has its next turn next round", () => {
    const actor = makeActor({ id: 'early' });
    game.combat = { id: 'c', round: 2, turn: 1, turns: [{ actor: { id: 'early' } }, { actor: { id: 'x' } }] };
    expect(nextTurnWindow(actor)).toEqual({ combatId: 'c', untilRound: 3, untilTurn: 0 });
  });
});

describe("personal vehicles", () => {
  function crewed(key, owner, skill) {
    const vehicle = { type: 'vehicle', name: 'Ride', flags: { essence20: { personalVehicle: key, companionOf: owner.uuid } }, system: { actors: { a: { uuid: owner.uuid, vehicleRole: 'driver' } } } };
    game.actors = [vehicle];
    return personalVehicleSources(owner, null, { rolledSkill: skill });
  }

  test("Galaxy Glider gives Edge on Acrobatics while crewing it, labelled with the Perk", () => {
    const owner = makeActor({ items: [perk(SUMMON.galaxyGlider, { name: 'Galaxy Glider' })] });
    expect(crewed('galaxyGlider', owner, 'acrobatics').sources).toEqual([{ id: 'fix3PersonalVehicle', label: 'Galaxy Glider', edge: true }]);
    expect(crewed('galaxyGlider', owner, 'driving').sources).toEqual([]);
  });

  test("Jet Jammer gives Edge on Driving", () => {
    const owner = makeActor({ items: [perk(SUMMON.jetJammer, { name: 'Jet Jammer' })] });
    expect(crewed('jetJammer', owner, 'driving').sources[0]).toMatchObject({ label: 'Jet Jammer', edge: true });
  });

  test("nothing when not crewing a vehicle", () => {
    game.actors = [];
    expect(personalVehicleSources(makeActor(), null, { rolledSkill: 'driving' }).sources).toEqual([]);
  });
});

describe("Dig Deep", () => {
  test("out of combat: a Snag spent by the next Skill Test", async () => {
    const actor = makeActor();
    await markDigDeepSnag(actor, { name: 'Dig Deep' });
    const mark = liveMark(actor, KIND.digDeep);
    expect(mark).toMatchObject({ once: true, label: 'Dig Deep' });

    const { sources, consumes } = tfFixRollSources(actor, null, { rolledSkill: 'might' });
    expect(sources).toContainEqual({ id: 'fix3DigDeep', label: 'Dig Deep', snag: true });
    expect(consumes).toEqual([{ actorUuid: actor.uuid, kind: KIND.digDeep, by: actor.uuid }]);
  });

  test("in combat: every Skill Test until the end of the holder's next turn", async () => {
    const actor = makeActor({ id: 'me' });
    game.combat = { id: 'c', round: 1, turn: 0, turns: [{ actor: { id: 'me' } }, { actor: { id: 'x' } }] };
    await markDigDeepSnag(actor, { name: 'Dig Deep' });

    const first = tfFixRollSources(actor, null, { rolledSkill: 'might' });
    expect(first.sources.some(s => s.id == 'fix3DigDeep')).toBe(true);
    expect(first.consumes).toEqual([]);

    game.combat.round = 2;
    game.combat.turn = 0;
    expect(liveMark(actor, KIND.digDeep)).not.toBeNull();
    game.combat.turn = 1;
    expect(liveMark(actor, KIND.digDeep)).toBeNull();
  });
});

describe("Covering Fire", () => {
  test("a miss marks the target; it takes a Snag on attacks during its own next turn", async () => {
    const gunner = makeActor({ id: 'gun', items: [perk(FIX3_TF.coveringFire, { name: 'Covering Fire' })] });
    const target = makeActor({ id: 'foe' });
    game.combat = { id: 'c', round: 1, turn: 0, turns: [{ actor: { id: 'gun' } }, { actor: { id: 'foe' } }], combatant: { actor: { id: 'gun' } } };

    await tfFixPostRoll(gunner, [{ success: false }], { isAttack: true }, { hits: [{ target, hit: false }] });
    expect(liveMark(target, KIND.coveringFire)).toMatchObject({ label: 'Covering Fire', untilRound: 1, untilTurn: 1 });

    // Not its turn yet: no Snag.
    expect(tfFixRollSources(target, null, { rolledSkill: 'targeting', isAttack: true }).sources).toEqual([]);

    game.combat.turn = 1;
    game.combat.combatant = { actor: { id: 'foe' } };
    expect(tfFixRollSources(target, null, { rolledSkill: 'targeting', isAttack: true }).sources)
      .toContainEqual({ id: 'fix3CoveringFire', label: 'Covering Fire', snag: true });
    // Only attacks.
    expect(tfFixRollSources(target, null, { rolledSkill: 'alertness', isAttack: false }).sources).toEqual([]);
  });

  test("a hit marks nothing", async () => {
    const gunner = makeActor({ items: [perk(FIX3_TF.coveringFire)] });
    const target = makeActor({ id: 'foe' });
    await tfFixPostRoll(gunner, [{ success: true }], { isAttack: true }, { hits: [{ target, hit: true }] });
    expect(liveMark(target, KIND.coveringFire)).toBeNull();
  });
});

describe("Watchful Eyes", () => {
  test("marks targeted enemies with its own label; spent by their first test on their turn", async () => {
    const leader = makeActor({ id: 'lead', items: [perk(FIX3_TF.watchfulEyes, { name: 'Watchful Eyes' })] });
    const foe = makeActor({ id: 'foe' });
    game.user.targets = new Set([{ actor: foe, document: { disposition: -1 } }]);

    await tfFixPostRoll(leader, [{ success: true }], { isWatchfulEyesAttempt: true }, { hits: [] });
    const { sources, consumes } = tfFixRollSources(foe, null, { rolledSkill: 'athletics' });
    expect(sources).toContainEqual({ id: 'fix3WatchfulEyes', label: 'Watchful Eyes', snag: true });
    expect(consumes).toEqual([{ actorUuid: foe.uuid, kind: KIND.watchfulEyes, by: leader.uuid }]);
  });

  test("a failed roll marks nobody", async () => {
    const leader = makeActor({ items: [perk(FIX3_TF.watchfulEyes)] });
    const foe = makeActor({ id: 'foe' });
    game.user.targets = new Set([{ actor: foe, document: { disposition: -1 } }]);
    await tfFixPostRoll(leader, [{ success: false }], { isWatchfulEyesAttempt: true }, { hits: [] });
    expect(liveMark(foe, KIND.watchfulEyes)).toBeNull();
  });
});

describe("Predacon's Frightened", () => {
  test("comes off at the end of the target's next turn", async () => {
    const predacon = makeActor({ id: 'p', items: [perk(FIX3_TF.predacon, { name: 'Predacon' })] });
    const foe = makeActor({ id: 'foe', statuses: ['frightened'] });
    const combat = { id: 'c', round: 1, turn: 0, turns: [{ actor: { id: 'p' } }, { actor: { id: 'foe' } }] };
    game.combat = combat;

    await tfFixPostRoll(predacon, [{ success: true }], { isPredaconAttempt: true }, { hits: [{ target: foe, hit: true }] });
    expect(foe.flags.essence20.riderMarks).toEqual([expect.objectContaining({ kind: KIND.predaconFright, untilRound: 1 })]);

    await tfFixTurnEnd(foe, combat, { round: 1, turn: 1 });
    expect(foe.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(foe.flags.essence20.riderMarks).toEqual([]);
  });

  test("an unrelated turn end leaves it alone", async () => {
    const foe = makeActor({ id: 'foe', statuses: ['frightened'], flags: { riderMarks: [{ kind: KIND.predaconFright, combatId: 'c', untilRound: 3, untilTurn: 1 }] } });
    await tfFixTurnEnd(foe, { id: 'c', round: 2 }, { round: 2, turn: 1 });
    expect(foe.toggleStatusEffect).not.toHaveBeenCalled();
  });
});

describe("Get To Know", () => {
  test("an unspent Edge goes when a new scene starts", async () => {
    const caster = makeActor({ flags: { pendingGetToKnowEdge: { skill: 'insight', targetId: 'x' } } });
    game.actors = [caster, makeActor({ id: 'other' })];
    await tfFixSceneAdvanced();
    expect(caster.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingGetToKnowEdge');
    expect(caster.flags.essence20.pendingGetToKnowEdge).toBeUndefined();
  });
});

describe("Roll Options Dialog switches", () => {
  test("Experiment (Shove): a switch for breaking a grapple (the Shove ↑1 is a rule)", () => {
    const items = [perk(FIX3_TF.experiment, { name: 'Experiment', system: { choice: 'shove' } })];
    const actor = makeActor({ items, statuses: ['grappled'] });
    expect(tfFixRollSources(actor, null, { rolledSkill: 'athletics', isShove: true }).sources).toEqual([]);

    const [toggle] = tfFixToggles(actor, { rolledSkill: 'athletics' });
    expect(toggle).toMatchObject({ name: 'fix3ExperimentEscape', value: true });
    expect(tfFixToggles(makeActor({ items }), { rolledSkill: 'athletics' })).toEqual([]);

    const options = { shiftUp: 1, ext: { fix3ExperimentEscape: true } };
    tfFixApplyDialog(null, options);
    expect(options.shiftUp).toBe(2);
  });

  test("Experiment with another option does nothing here", () => {
    const actor = makeActor({ items: [perk(FIX3_TF.experiment, { system: { choice: 'technology' } })], statuses: ['grappled'] });
    expect(tfFixToggles(actor, { rolledSkill: 'athletics' })).toEqual([]);
  });
});
