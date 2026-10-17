import { autoFeaturesDone, FEATURES, mixedTeamOptions, plannedFeatures, rangerColour, SPECTRUM_FEATURES, TEAM_FEATURES } from './zord-auto-features.mjs';
import { RANK_FEATURES, rankEffectData } from '../../items/zords/essence-skill-ranks.mjs';
import { warzordCosts, WARZORD_ID } from '../../sheet-handlers/drop-handler.mjs';
import { modeSizeIndexes, weaponSizeGap } from '../../items/attacks/weapon-upscale.mjs';

/**
 * A new Zord's starting Features (PR CRB p.134 and the sourcebooks), Strength's skill ranks (Auxiliary Zord, Carrier,
 * Warzord), Warzord's Story Points (Across the Stars p.105), and a wielder's Modes for weapon size (EoC p.48).
 */

test('every Feature a spectrum or team names has a compendium entry', () => {
  const named = [...Object.values(SPECTRUM_FEATURES), ...Object.values(TEAM_FEATURES).flat()]
    .filter(key => !['upgradedZord', 'megaformTrait'].includes(key));
  expect(named.filter(key => !FEATURES[key])).toEqual([]);
});

test('the colour comes from the Role\'s name; the plan is spectrum then team', () => {
  expect(rangerColour({ items: [{ type: 'role', name: 'Red Ranger' }] })).toBe('red');
  expect(rangerColour({ items: [{ type: 'role', name: 'Purple Ranger' }] })).toBe('purple');
  expect(rangerColour({ items: [] })).toBeNull();
  expect(plannedFeatures('black', 'dinozords')).toEqual(['hardenedChassis', 'combiner', 'heavyChassis']);
  expect(plannedFeatures(null, 'mixed', ['zeroG', 'warriorMode'])).toEqual(['zeroG', 'warriorMode']);
  expect(mixedTeamOptions()).toContain('temporalBuffer');
  expect(autoFeaturesDone({ flags: { essence20: { zordAutoFeatures: { team: 'none' } } } })).toBe(true);
});

test('skill ranks come with the Strength: one ↑ per rank on the picked Skills', () => {
  expect(Object.values(RANK_FEATURES).map(spec => spec.ranks)).toEqual([2, 2, 3]);
  expect(rankEffectData({ name: 'Warzord' }, { might: 2, brawn: 1 }).changes).toEqual([
    { key: 'system.skills.might.shiftUp', mode: 2, value: '2', priority: null },
    { key: 'system.skills.brawn.shiftUp', mode: 2, value: '1', priority: null },
  ]);
});

describe('Warzord Story Points', () => {
  const warzord = { type: 'zord', items: [{ flags: { core: { sourceId: WARZORD_ID } } }] };
  const zord = { type: 'zord', items: [] };

  test('a Warzord joining owes one per Zord already there; a Zord joining owes each Warzord one', () => {
    expect(warzordCosts([zord, zord], warzord)).toEqual([{ warzord, cost: 2 }]);
    expect(warzordCosts([warzord, zord], zord)).toEqual([{ warzord, cost: 1 }]);
    expect(warzordCosts([zord], zord)).toEqual([]);
    expect(warzordCosts([warzord], { type: 'playerCharacter', items: [] })).toEqual([]);
  });
});

test("a weapon's size is measured against the wielder's Modes: above the largest, below the smallest", () => {
  const bot = { system: { size: 'common' }, items: [{ type: 'altMode', system: { altModesize: 'huge' } }] };
  expect(modeSizeIndexes(bot)).toEqual([1, 3]);
  const gigantic = { flags: { essence20: { upscaled: { size: 'gigantic' } } } };
  expect(weaponSizeGap(gigantic, bot)).toBe(1);
  expect(weaponSizeGap({ flags: { essence20: { upscaled: { size: 'titanic' } } } }, bot)).toBe(3);
  expect(weaponSizeGap({ flags: {} }, bot)).toBe(0);
});
