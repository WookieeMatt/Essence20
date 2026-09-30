import { SHADOW_ID, SHADOW_SWITCH, shadowApplyDialog, shadowToggles } from './shadow.mjs';

const holder = ({ infiltrating = true, hasPerk = true } = {}) => ({
  name: 'Snake',
  items: hasPerk ? [{ type: 'perk', name: 'Shadow', flags: { core: { sourceId: SHADOW_ID } } }] : [],
  getFlag: (scope, key) => (key == 'infiltratingActive' ? infiltrating : undefined),
});

const targeting = target => {
  global.game = { user: { targets: { first: () => (target ? { actor: target } : undefined) } }, i18n: { has: () => false } };
};

afterEach(() => {
  delete global.game;
});

test('offers the ↓2 switch at an Infiltrating Shadow holder, on by default for a non-attack Alertness test', () => {
  targeting(holder());
  const [toggle] = shadowToggles({}, { rolledSkill: 'alertness' });
  expect(toggle).toEqual(expect.objectContaining({ name: SHADOW_SWITCH, type: 'checkbox', value: true }));
  expect(toggle.label).toContain('Snake');
});

test('off by default for other Skills and for attacks', () => {
  targeting(holder());
  expect(shadowToggles({}, { rolledSkill: 'technology' })[0].value).toBe(false);
  expect(shadowToggles({}, { rolledSkill: 'alertness', item: { type: 'weaponEffect' } })[0].value).toBe(false);
});

test('no switch while not Infiltrating, without the Perk, or with no target', () => {
  targeting(holder({ infiltrating: false }));
  expect(shadowToggles({}, { rolledSkill: 'alertness' })).toEqual([]);
  targeting(holder({ hasPerk: false }));
  expect(shadowToggles({}, { rolledSkill: 'alertness' })).toEqual([]);
  targeting(null);
  expect(shadowToggles({}, { rolledSkill: 'alertness' })).toEqual([]);
});

test('ticked, it adds ↓2', () => {
  const options = { shiftDown: 1, ext: { [SHADOW_SWITCH]: true } };
  shadowApplyDialog({}, options);
  expect(options.shiftDown).toBe(3);

  const unticked = { shiftDown: 0, ext: {} };
  shadowApplyDialog({}, unticked);
  expect(unticked.shiftDown).toBe(0);
});
