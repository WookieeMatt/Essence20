import {
  SUGGESTED_TERMS, normalizeTerms, parseTermLines, replaceInMessage, rewriteTranslations, termPairs, termReplacer,
} from './line-terms.mjs';

const voltron = { Zord: 'Lion', Megazord: 'Voltron', 'Role Point': 'Mask Charge' };

test('words are tidied, and "Book = Yours" lines read', () => {
  expect(normalizeTerms({ ' Zord ': ' Lion ', Morph: '', Ranger: 'Ranger', '': 'x' })).toEqual({ Zord: 'Lion' });
  expect(normalizeTerms(null)).toEqual({});
  expect(parseTermLines('Energon = Quintessons\nno equals here\r\nThreat = Robeast = big')).toEqual({ Energon: 'Quintessons', Threat: 'Robeast = big' });
  expect(SUGGESTED_TERMS).toContain('Zord');
});

test('whole words in any case, with their endings, and not inside a longer word', () => {
  const swap = termReplacer(termPairs({}, voltron));
  expect(swap('Zord, zords, ZORD and Megazord')).toBe('Lion, lions, LION and Voltron');
  expect(swap("the Zord's Role Points")).toBe("the Lion's Mask Charges");
  expect(swap('Zordon and Megazords')).toBe('Zordon and Voltrons');
  expect(termReplacer([])).toBeNull();
});

test('placeholders and HTML tags are left alone in language strings', () => {
  const swap = termReplacer(termPairs({}, voltron));
  expect(replaceInMessage('<i class="zord"></i> {zord} joins the Zord', swap)).toBe('<i class="zord"></i> {zord} joins the Lion');
  const tree = { E20: { A: 'Zord', B: { C: 'Megazord {name}' }, D: 'none' } };
  expect(rewriteTranslations(tree, swap)).toBe(2);
  expect(tree).toEqual({ E20: { A: 'Lion', B: { C: 'Voltron {name}' }, D: 'none' } });
});

test("a crossover: text in the world's words or the book's turns into the actor's own line's", () => {
  // A G.I. Joe in a Voltron world: the system's text says Lion, back to Zord; the data's Zord stays.
  expect(termPairs(voltron, {})).toEqual([
    { from: 'Lion', to: 'Zord' }, { from: 'Voltron', to: 'Megazord' }, { from: 'Mask Charge', to: 'Role Point' },
  ]);
  // A ThunderCats character in the same world.
  const swap = termReplacer(termPairs(voltron, { Zord: 'Thundertank' }));
  expect(swap('Lion and Zord, Voltron')).toBe('Thundertank and Thundertank, Megazord');
  // No crossover: the world's own line.
  expect(termPairs(voltron, voltron).map(pair => pair.from)).toEqual(['Zord', 'Megazord', 'Role Point']);
});
