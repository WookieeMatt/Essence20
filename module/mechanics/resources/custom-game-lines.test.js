import {
  customLine, customLineForFolders, customLines, customLinesOf, lineFamily, lineIdFrom, normalizeLine, setCustomLines,
  roleGrantsMorph, specializationsForRole,
} from './custom-game-lines.mjs';

afterEach(() => setCustomLines([]));

test('an id from a name: acronyms stay one word', () => {
  expect(lineIdFrom('M.A.S.K.')).toBe('mask');
  expect(lineIdFrom('ThunderCats HO!')).toBe('thundercats-ho');
  expect(lineIdFrom('  ')).toBe('');
});

test('a line is tidied, and refused without a name, on a book line\'s id or with no known family', () => {
  expect(normalizeLine({ label: ' Voltron ', family: 'powerRangers', specializations: { driving: 'Lions, Lions , Air' }, terms: { Zord: ' Lion ', Morph: '' } })).toEqual({
    id: 'voltron', label: 'Voltron', family: 'powerRangers', packFolder: '', specializations: { driving: ['Lions', 'Air'] }, terms: { Zord: 'Lion' }, canMorph: false,
    look: { frame: '', accent: '', logo: '', headerArt: '' }, source: 'world',
  });
  expect(normalizeLine({ label: 'He-Man', family: 'giJoe', canMorph: true }).canMorph).toBe(true);
  expect(normalizeLine({ label: 'He-Man', family: 'giJoe', canMorph: 'yes' }).canMorph).toBe(false);
  expect(normalizeLine({ label: '', family: 'giJoe' })).toBeNull();
  expect(normalizeLine({ label: 'PR', family: 'giJoe' })).toBeNull();
  expect(normalizeLine({ label: 'GI Joe', id: 'giJoe', family: 'giJoe' })).toBeNull();
  expect(normalizeLine({ label: 'Jem', family: 'starWars' })).toBeNull();
  expect(normalizeLine(null)).toBeNull();
});

test('world lines come first; a module line with the same id is left out', () => {
  setCustomLines(
    [{ label: 'M.A.S.K.', family: 'giJoe', packFolder: 'M.A.S.K.' }],
    [{ id: 'mask-module', lines: [{ label: 'MASK', family: 'transformers' }, { label: 'SilverHawks', family: 'giJoe' }] }],
  );
  expect(customLines().map(line => `${line.id}:${line.family}:${line.source}`)).toEqual(['mask:giJoe:world', 'silverhawks:giJoe:mask-module']);
  expect(customLine('MASK')?.label).toBe('M.A.S.K.');
  expect(customLine('giJoe')).toBeNull();
  expect(customLinesOf('giJoe').length).toBe(2);
  expect(customLinesOf('powerRangers')).toEqual([]);
});

test('a line\'s family: a book line is its own, a homebrew line its book line, anything else none', () => {
  setCustomLines([{ label: 'Voltron', family: 'powerRangers' }]);
  expect(['giJoe', 'voltron', 'mask', '', undefined].map(lineFamily)).toEqual(['giJoe', 'powerRangers', '', '', '']);
});

test('the homebrew line of a compendium folder, or one it sits in', () => {
  setCustomLines([{ label: 'M.A.S.K.', family: 'giJoe', packFolder: 'M.A.S.K.' }]);
  expect(customLineForFolders(['Masks', 'M.A.S.K.'])?.id).toBe('mask');
  expect(customLineForFolders(['GI Joe'])).toBeNull();
  expect(customLineForFolders([])).toBeNull();
});

test("a Role's suggested Specializations: its book line's plus its homebrew line's", () => {
  setCustomLines([{ label: 'M.A.S.K.', family: 'giJoe', specializations: { driving: ['Air', 'Stunts'], deception: ['Masks'] } }]);
  const standard = { giJoe: { driving: ['Air', 'Land'] } };
  expect(specializationsForRole({ system: { version: 'giJoe', gameLine: 'mask' } }, standard)).toEqual({ driving: ['Air', 'Land', 'Stunts'], deception: ['Masks'] });
  expect(specializationsForRole({ system: { version: 'giJoe', gameLine: '' } }, standard)).toEqual({ driving: ['Air', 'Land'] });
  expect(standard.giJoe.driving).toEqual(['Air', 'Land']);
});

test('a Role lets its character Morph: a Power Rangers Role, or one on a homebrew line that Morphs', () => {
  setCustomLines([{ label: 'He-Man', family: 'giJoe', canMorph: true }, { label: 'M.A.S.K.', family: 'giJoe' }]);
  const role = (version, gameLine = '') => ({ system: { version, gameLine } });
  expect(roleGrantsMorph(role('powerRangers'))).toBe(true);
  expect(roleGrantsMorph(role('giJoe', 'he-man'))).toBe(true);
  expect(roleGrantsMorph(role('giJoe', 'mask'))).toBe(false);
  expect(roleGrantsMorph(role('giJoe'))).toBe(false);
  // A Role moved to another book line no longer counts as the homebrew line's.
  expect(roleGrantsMorph(role('transformers', 'he-man'))).toBe(false);
  expect(roleGrantsMorph(null)).toBe(false);
});
