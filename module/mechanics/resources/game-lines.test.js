import { actorLineOf, lineCode, lineMatches, lineOf } from './game-lines.mjs';
import { setCustomLines } from './custom-game-lines.mjs';
import { contextFor, evaluate } from '../../rules/predicate.mjs';

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

/* ---- An actor's game line (self:line / target:line) ---- */

const actor = (type, items = [], system = {}) => ({ type, system, items: { contents: items } });
const role = version => ({ type: 'role', system: { version } });
const fromPack = pack => ({ type: 'perk', _stats: { compendiumSource: `Compendium.essence20.${pack}.Item.x` } });

test('lineCode: keys and short codes alike; anything else is nothing', () => {
  expect(['giJoe', 'pr', 'TF', 'welcomeToNightVale', 'mlp'].map(lineCode)).toEqual(['gij', 'pr', 'tf', 'wtnv', 'mlp']);
  expect(['', 'starWars', undefined].map(lineCode)).toEqual(['', '', '']);
});

test("the Role first, then a Zord / Megaform's own line, then its books, then the world's setting", () => {
  expect(actorLineOf(actor('playerCharacter', [role('transformers'), fromPack('pr_crb')]))).toBe('tf');
  expect(actorLineOf(actor('zord'))).toBe('pr');
  expect(actorLineOf(actor('megaform', [], { subtype: ['megaformCombiner'] }))).toBe('tf');
  expect(actorLineOf(actor('megaform', [], { subtype: ['megaformZord'] }))).toBe('pr');
  expect(actorLineOf(actor('npc', [fromPack('gi_joe_crb'), fromPack('gi_joe_crb'), fromPack('pr_crb')]))).toBe('gij');
  expect(actorLineOf({ ...actor('npc', [fromPack('pr_crb')]), _stats: { compendiumSource: 'Compendium.essence20.wtnv_cg.Actor.x' } })).toBe('wtnv');
  expect(actorLineOf(actor('npc', []), 'myLittlePony')).toBe('mlp');
  expect(actorLineOf(actor('npc', []))).toBe('');
  expect(actorLineOf(null)).toBe('');
});

test('the self:line tag reads it, by short code or key', () => {
  const ranger = actor('playerCharacter', [role('powerRangers')]);
  const ask = tag => evaluate([tag], contextFor({ self: ranger }));
  expect([ask('self:line:pr'), ask('self:line:powerRangers'), ask('self:line:tf'), ask('not:self:line:gij'), ask('self:line:nonsense')])
    .toEqual([true, true, false, true, false]);
});

/* ---- Homebrew game lines (custom-game-lines.mjs) ---- */

describe('homebrew lines', () => {
  beforeEach(() => setCustomLines([{ label: 'M.A.S.K.', family: 'giJoe', packFolder: 'M.A.S.K.' }]));
  afterEach(() => {
    setCustomLines([]);
    delete globalThis.game;
  });

  const agentRole = { type: 'role', system: { version: 'giJoe', gameLine: 'mask' } };

  test('lineCode reads a homebrew id as its own code', () => {
    expect(['mask', 'MASK', 'voltron'].map(lineCode)).toEqual(['mask', 'mask', '']);
  });

  test("a Role on a homebrew line is that line's; a line since deleted falls back to the book line", () => {
    expect(actorLineOf(actor('playerCharacter', [agentRole]))).toBe('mask');
    setCustomLines([]);
    expect(actorLineOf(actor('playerCharacter', [agentRole]))).toBe('gij');
  });

  test('a homebrew line counts as the book line it is built on, not the other way round', () => {
    expect([lineMatches('mask', 'mask'), lineMatches('mask', 'gij'), lineMatches('mask', 'giJoe'), lineMatches('mask', 'pr')])
      .toEqual([true, true, true, false]);
    expect([lineMatches('gij', 'mask'), lineMatches('other', 'other'), lineMatches('', 'gij')]).toEqual([false, true, false]);
  });

  test('self:line reads the homebrew line and its book line', () => {
    const agent = actor('playerCharacter', [agentRole]);
    const ask = tag => evaluate([tag], contextFor({ self: agent }));
    expect([ask('self:line:mask'), ask('self:line:gij'), ask('self:line:pr')]).toEqual([true, true, false]);
  });

  test("a module's pack in the line's compendium folder (or one below it) is the line's; the system's own packs never are", () => {
    const folder = { name: 'Masks', ancestors: [{ name: 'M.A.S.K.' }] };
    globalThis.game = { packs: { get: id => (['my-mask.masks', 'essence20.pr_crb'].includes(id) ? { folder } : null) } };
    expect(lineOf('Compendium.my-mask.masks.Item.x')).toBe('mask');
    expect(lineOf('Compendium.my-mask.other.Item.x')).toBe('other');
    expect(lineOf('Compendium.essence20.pr_crb.Item.x')).toBe('pr');
  });
});

test("a Role switched to another book line no longer counts its old homebrew line", () => {
  setCustomLines([{ label: 'M.A.S.K.', family: 'giJoe' }]);
  expect(actorLineOf(actor('playerCharacter', [{ type: 'role', system: { version: 'powerRangers', gameLine: 'mask' } }]))).toBe('pr');
  setCustomLines([]);
});
