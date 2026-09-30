import { grappledSources, grappleEscapeSkills } from './grappled.mjs';

const actor = ({ grappled = true, version = null } = {}) => ({
  statuses: new Set(grappled ? ['grappled'] : []),
  items: { contents: version ? [{ type: 'role', system: { version } }] : [] },
});
const withLine = line => {
  global.game = { settings: { get: () => line }, i18n: { localize: key => key } };
};

afterEach(() => {
  delete global.game;
});

test('a Grappled creature takes a Snag on anything but an escape test', () => {
  withLine('transformers');
  const grappled = actor();
  expect(grappledSources(grappled, null, { rolledSkill: 'might' }).sources).toEqual([{ id: 'grappled', label: 'E20.GrappledSnag', snag: true }]);
  expect(grappledSources(grappled, null, { rolledSkill: 'alertness' }).sources).toHaveLength(1);
  expect(grappledSources(grappled, null, { rolledSkill: 'acrobatics' }).sources).toEqual([]);
});

test('attacks are never escape attempts', () => {
  withLine('transformers');
  expect(grappledSources(actor(), null, { rolledSkill: 'brawn', isAttack: true }).sources).toHaveLength(1);
});

test('no Snag when not Grappled', () => {
  withLine('giJoe');
  expect(grappledSources(actor({ grappled: false }), null, { rolledSkill: 'might' }).sources).toEqual([]);
});

test('escape Skills follow the game line, then the Role', () => {
  withLine('giJoe');
  expect(grappleEscapeSkills(actor())).toEqual(['athletics', 'might', 'finesse']);
  withLine('');
  expect(grappleEscapeSkills(actor({ version: 'powerRangers' }))).toEqual(['athletics', 'brawn', 'finesse']);
  expect(grappleEscapeSkills(actor())).toEqual(expect.arrayContaining(['acrobatics', 'might', 'brawn']));
});
