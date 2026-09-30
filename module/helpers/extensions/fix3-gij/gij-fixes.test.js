import { jest } from '@jest/globals';
import {
  angrySources, megaTrainingSources, ONE_WITH_YOUR_WEAPON_RULE, packAttackSources, surgicalOperatorsApply,
  surgicalOperatorsToggles,
} from './gij-fixes.mjs';

const ANGRY = 'Compendium.essence20.cobra_codex.Item.wGMyGbySdNSgPs8B';
const MEGA = 'Compendium.essence20.ferocious_fighters.Item.nLT8HSCCGWEBiRlq';
const SURGICAL = 'Compendium.essence20.ferocious_fighters.Item.JtRCN6ppDatZVmav';
const ONE_WITH = 'Compendium.essence20.intercontinental_adventures.Item.RH3AFV38EBAfTvW1';

const item = (type, uuid, name, useStats = false) => ({
  type, name, flags: useStats ? {} : { core: { sourceId: uuid } }, _stats: useStats ? { compendiumSource: uuid } : {},
});

function makeActor({ id = 'a1', items = [], flags = {} } = {}) {
  return {
    id, uuid: `Actor.${id}`, items,
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
  };
}

beforeEach(() => {
  // No settings registered, so the scene clock reads its default epoch of 1.
  global.game = { i18n: { has: () => false, localize: key => key }, combat: null };
});

describe("Angry", () => {
  const snagOn = skill => ({ angryHangUpSnag: { epoch: 1, window: 'scene', count: 1, skill } });

  test("Snags every roll of the chosen Skill this scene, labelled with the Hang-Up", () => {
    const actor = makeActor({ items: [item('hangUp', ANGRY, 'Angry')], flags: snagOn('deception') });
    expect(angrySources(actor, { rolledSkill: 'deception' })).toEqual([{ id: 'fix3Angry', label: 'Angry', snag: true }]);
    // Not used up - the second roll gets it too.
    expect(angrySources(actor, { rolledSkill: 'deception' })).toHaveLength(1);
  });

  test("not on another Skill, after the scene changed, or without the Hang-Up", () => {
    expect(angrySources(makeActor({ items: [item('hangUp', ANGRY, 'Angry')], flags: snagOn('deception') }), { rolledSkill: 'culture' })).toEqual([]);
    const stale = { angryHangUpSnag: { epoch: 0, window: 'scene', count: 1, skill: 'deception' } };
    expect(angrySources(makeActor({ items: [item('hangUp', ANGRY, 'Angry')], flags: stale }), { rolledSkill: 'deception' })).toEqual([]);
    expect(angrySources(makeActor({ flags: snagOn('deception') }), { rolledSkill: 'deception' })).toEqual([]);
  });
});

describe("Pack Attack", () => {
  test("↑1 on every attack against the Growled target while the grant runs", () => {
    const ally = makeActor({ flags: { packAttackGrowl: { targetId: 'enemy1', label: 'Pack Attack', sceneEpoch: 1 } } });
    expect(packAttackSources(ally, { id: 'enemy1' }, { isAttack: true }))
      .toEqual([{ id: 'fix3PackAttack', label: 'Pack Attack', shiftUp: 1 }]);
    expect(packAttackSources(ally, { id: 'enemy1' }, { isAttack: false })).toEqual([]);
    expect(packAttackSources(ally, { id: 'other' }, { isAttack: true })).toEqual([]);
  });
});

describe("Mega Training Regimen", () => {
  const holder = makeActor({ items: [item('perk', MEGA, 'Mega Training Regimen', true)] });
  const effect = damageType => ({ type: 'weaponEffect', system: { damageType } });

  test("Snags Grapple and Trip attacks and a plain Shove against the holder", () => {
    for (const ctx of [{ isAttack: true, item: effect('grapple') }, { isAttack: true, item: effect('knocProne') }, { isShove: true }]) {
      expect(megaTrainingSources(makeActor(), holder, ctx))
        .toEqual([{ id: 'fix3MegaTrainingRegimen', label: 'Mega Training Regimen', snag: true }]);
    }
  });

  test("leaves the Maneuver alternate effect to the existing check, and ignores other attacks and non-holders", () => {
    expect(megaTrainingSources(makeActor(), holder, { isAttack: true, item: effect('maneuver') })).toEqual([]);
    expect(megaTrainingSources(makeActor(), holder, { isShove: true, item: effect('maneuver') })).toEqual([]);
    expect(megaTrainingSources(makeActor(), holder, { isAttack: true, item: effect('blunt') })).toEqual([]);
    expect(megaTrainingSources(makeActor(), makeActor(), { isAttack: true, item: effect('grapple') })).toEqual([]);
    expect(megaTrainingSources(makeActor(), null, { isAttack: true, item: effect('grapple') })).toEqual([]);
  });
});

describe("Surgical Operators", () => {
  const holder = makeActor({ items: [item('perk', SURGICAL, 'Surgical Operators')] });

  test("an off-by-default switch on Science tests only", () => {
    const toggles = surgicalOperatorsToggles(holder, { rolledSkill: 'science' });
    expect(toggles).toEqual([expect.objectContaining({ name: 'fix3SurgicalOperators', type: 'checkbox', value: false })]);
    expect(surgicalOperatorsToggles(holder, { rolledSkill: 'medicine' })).toEqual([]);
    expect(surgicalOperatorsToggles(makeActor(), { rolledSkill: 'science' })).toEqual([]);
  });

  test("ticked, it gives Edge", () => {
    const options = { edge: false, ext: { fix3SurgicalOperators: true } };
    surgicalOperatorsApply(holder, options);
    expect(options.edge).toBe(true);

    const unticked = { edge: false, ext: {} };
    surgicalOperatorsApply(holder, unticked);
    expect(unticked.edge).toBe(false);
  });
});

describe("One With Your Weapons", () => {
  test("an asked Free-action discount on Draw Weapon for the holder", () => {
    const holder = makeActor({ items: [item('perk', ONE_WITH, 'One With Your Weapons')] });
    expect(ONE_WITH_YOUR_WEAPON_RULE.has(holder)).toBe(true);
    expect(ONE_WITH_YOUR_WEAPON_RULE.has(makeActor())).toBe(false);
    expect(ONE_WITH_YOUR_WEAPON_RULE.matches({ key: 'drawWeapon' })).toBe(true);
    expect(ONE_WITH_YOUR_WEAPON_RULE.matches({ key: 'hide' })).toBe(false);
    expect(ONE_WITH_YOUR_WEAPON_RULE.to('move')).toBe('free');
    expect(ONE_WITH_YOUR_WEAPON_RULE.ask).toBeTruthy();
  });
});
