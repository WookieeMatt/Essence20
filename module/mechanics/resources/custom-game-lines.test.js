import {
  customLine, customLineForFolders, customLines, customLinesOf, lineFamily, lineIdFrom, normalizeLine, setCustomLines,
  actorLine, actorRule, actorRulesLine, lineRule, roleGrantsMorph, roleLine, roleRule, ruleLineFor, worldLineId, worldRule, specializationsForRole,
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
    look: { frame: '', accent: '', logo: '', headerArt: '' }, rules: {}, source: 'world',
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

test("a line's rules switches: its own, then its book line's, then the core rules'", () => {
  setCustomLines([
    { label: 'M.A.S.K.', family: 'giJoe', rules: { requisition: false, gmStoryPool: 'no', bogus: true } },
    { label: 'He-Man', family: 'giJoe', canMorph: true },
    { label: 'Pony Rangers', family: 'myLittlePony', rules: { megaformSubtype: 'megaformZord', startingEssenceMax: '10' } },
  ]);
  expect(customLine('mask').rules).toEqual({ requisition: false });
  expect(lineRule('mask', 'requisition')).toBe(false);
  expect(lineRule('mask', 'canQualify')).toBe(true);
  expect(lineRule('mask', 'gmStoryPool')).toBe(true);
  expect(lineRule('he-man', 'canMorph')).toBe(true);
  expect(lineRule('pony-rangers', 'megaformSubtype')).toBe('megaformZord');
  expect(lineRule('pony-rangers', 'startingEssenceMax')).toBe(10);
  expect(lineRule('pony-rangers', 'canSpellcast')).toBe(true);
  expect(lineRule('', 'megaformSubtype')).toBe('megaformCombiner');
  expect(lineRule('powerRangers', 'megaformSubtype')).toBe('megaformZord');
  expect(lineRule('mask', 'nope')).toBeUndefined();
});

test("a Role's line and switches follow its homebrew line while that line is still on its book line", () => {
  setCustomLines([{ label: 'He-Man', family: 'giJoe', canMorph: true }]);
  const heMan = { system: { version: 'giJoe', gameLine: 'he-man' } };
  const moved = { system: { version: 'transformers', gameLine: 'he-man' } };
  expect(roleLine(heMan)).toBe('he-man');
  expect(roleLine(moved)).toBe('transformers');
  expect(roleLine(null)).toBe('');
  expect(roleRule(heMan, 'canMorph')).toBe(true);
  expect(roleRule(heMan, 'canQualify')).toBe(true);
  expect(roleRule(moved, 'canMorph')).toBe(false);
  expect(roleRule({ system: { version: 'myLittlePony' } }, 'canSpellcast')).toBe(true);
});

test("the world's line wins over a Role's, unless the Role is on a homebrew line built on it", () => {
  setCustomLines([
    { label: 'M.A.S.K.', family: 'giJoe', rules: { requisition: false } },
    { label: 'Voltron', family: 'powerRangers' },
  ]);
  const joe = { system: { version: 'giJoe' } };
  const mask = { system: { version: 'giJoe', gameLine: 'mask' } };
  const pony = { system: { version: 'myLittlePony' } };
  expect(ruleLineFor(joe, '')).toBe('giJoe');
  expect(ruleLineFor(joe, 'powerRangers')).toBe('powerRangers');
  expect(ruleLineFor(mask, 'giJoe')).toBe('mask');
  expect(ruleLineFor(mask, 'voltron')).toBe('voltron');
  expect(ruleLineFor(null, 'voltron')).toBe('voltron');
  expect(roleRule(joe, 'canMorph', 'voltron')).toBe(true);
  expect(roleRule(pony, 'canSpellcast', 'giJoe')).toBe(false);
  expect(roleRule(pony, 'canSpellcast', '')).toBe(true);
  expect(roleRule(mask, 'requisition', 'giJoe')).toBe(false);
});

test("the world's line is read from the setting, '' with no world", () => {
  setCustomLines([{ label: 'M.A.S.K.', family: 'giJoe', rules: { requisition: false } }]);
  expect(worldLineId()).toBe('');
  globalThis.game = { settings: { get: (scope, key) => (key == 'gameLine' ? 'mask' : null) } };
  expect(worldLineId()).toBe('mask');
  expect(worldRule('requisition')).toBe(false);
  expect(roleRule({ system: { version: 'myLittlePony' } }, 'canSpellcast')).toBe(false);
  globalThis.game = { settings: { get: () => {
    throw new Error('not registered');
  } } };
  expect(worldLineId()).toBe('');
  delete globalThis.game;
});

test("an actor's line: the GM's pick, else its Role's; in a world with a line, that line wins as for Roles", () => {
  setCustomLines([{ label: 'Voltron', family: 'powerRangers', rules: { megaformJoinTypes: ['zord', 'vehicle'], vehicleAltModes: true } }]);
  const lion = { type: 'zord', flags: { essence20: { rulesLine: 'voltron' } }, items: [] };
  const stray = { type: 'vehicle', flags: { essence20: { rulesLine: 'gone' } }, items: [] };
  const joe = { type: 'npc', items: [{ type: 'role', system: { version: 'giJoe' } }] };
  expect(actorLine(lion)).toBe('voltron');
  expect(actorLine(stray)).toBe('');
  expect(actorLine(joe)).toBe('giJoe');
  expect(actorRulesLine(lion, '')).toBe('voltron');
  expect(actorRulesLine(lion, 'powerRangers')).toBe('voltron');
  expect(actorRulesLine(lion, 'transformers')).toBe('transformers');
  expect(actorRule(lion, 'vehicleAltModes', '')).toBe(true);
  expect(actorRule(lion, 'megaformJoinTypes', '')).toEqual(['zord', 'vehicle']);
  expect(actorRule(stray, 'vehicleAltModes', '')).toBe(false);
});
