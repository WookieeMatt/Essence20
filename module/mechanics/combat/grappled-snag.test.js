import { grappledApplyDialog, grappledToggles, grappleEscapeSkills } from './grappled-snag.mjs';

const actor = ({ grappled = true, version = null } = {}) => ({
  statuses: new Set(grappled ? ['grappled'] : []),
  items: { contents: version ? [{ type: 'role', system: { version } }] : [] },
  flags: { essence20: {} },
});
const withLine = line => {
  global.game = { settings: { get: () => line }, i18n: { localize: key => key } };
};

const toggle = (a, ctx) => grappledToggles(a, ctx)[0];

beforeEach(() => withLine(''));

afterEach(() => {
  delete global.game;
});

test('a Grappled creature gets a Snag switch that starts on, for every roll', () => {
  const grappled = actor();
  expect(toggle(grappled, { rolledSkill: 'athletics' })).toEqual({ name: 'grappledSnag', type: 'checkbox', label: 'E20.GrappledSnagToggle', value: true });
  expect(toggle(grappled, { rolledSkill: 'alertness' }).value).toBe(true);
  expect(toggle(grappled, { rolledSkill: 'might', item: { type: 'weaponEffect' } }).value).toBe(true);
});

test('no switch when not Grappled', () => {
  expect(grappledToggles(actor({ grappled: false }), { rolledSkill: 'might' })).toEqual([]);
});

test('an Assault Claw grapple (its rule mark) labels the switch for the Claw', () => {
  const clawed = actor();
  clawed.flags.essence20.ruleMarks = { assaultClawGrapple: { by: 'Actor.x', until: null, stamp: null } };
  expect(toggle(clawed, { rolledSkill: 'athletics' })).toMatchObject({ label: 'E20.GrappledClawSnagToggle', value: true });

  clawed.flags.essence20.ruleMarks = {};
  expect(toggle(clawed, { rolledSkill: 'athletics' }).label).toBe('E20.GrappledSnagToggle');
});

test('escape Skills follow the game line, then the Role', () => {
  withLine('giJoe');
  expect(grappleEscapeSkills(actor())).toEqual(['athletics', 'might', 'finesse']);
  withLine('');
  expect(grappleEscapeSkills(actor({ version: 'powerRangers' }))).toEqual(['athletics', 'brawn', 'finesse']);
  expect(grappleEscapeSkills(actor())).toEqual(expect.arrayContaining(['acrobatics', 'might', 'brawn']));
});

test('the switch adds a Snag, or cancels an Edge', () => {
  const off = { ext: {} };
  grappledApplyDialog(actor(), off);
  expect(off.snag).toBeUndefined();

  const on = { ext: { grappledSnag: true } };
  grappledApplyDialog(actor(), on);
  expect(on.snag).toBe(true);

  const withEdge = { edge: true, ext: { grappledSnag: true } };
  grappledApplyDialog(actor(), withEdge);
  expect(withEdge).toMatchObject({ edge: false });
});
