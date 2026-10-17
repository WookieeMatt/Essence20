import { lineOf } from './game-lines.mjs';

// Every Item pack in system.json sorts into its game line (the field guide spans lines, so it stays 'other').
test('every pack has its game line', () => {
  const at = pack => lineOf(`Compendium.essence20.${pack}.Item.x`);
  expect(['dark_skies_over_equestria', 'in_a_jam', 'story_of_the_seasons', 'knights_of_canterlot', 'mlp_crb'].map(at)).toEqual(Array(5).fill('mlp'));
  expect(['operation_cold_iron', 'operation_snakebit', 'gi_joe_crb'].map(at)).toEqual(['gij', 'gij', 'gij']);
  expect(['power_rangers_adventures', 'pr_crb'].map(at)).toEqual(['pr', 'pr']);
  expect(at('field_guide_action_adventure')).toBe('other');
  expect(at('wtnv_host_guide')).toBe('wtnv');
  expect(at('transformers_adventures')).toBe('tf');
});
