import {
  fillPlaceholders, missionDefaults, missionHtml, missionTitle, outlineHtml, resultLink, resultText, rollSection, sectionOrder,
} from './mission.mjs';

const section = (name, ...results) => ({ name, uuid: `RollTable.${name}`, results });
const drawn = (name, link = name, text = name) => ({ name, link, text });

test('a result reads as its description, else its name; a document result links to it', () => {
  expect(resultText({ name: 'The Bank', description: '<p>The city bank</p>' })).toBe('The city bank');
  expect(resultText({ name: 'The Bank', description: '<p>One</p><p>Two</p>' })).toBe('<p>One</p><p>Two</p>');
  expect(resultText({ name: 'A <b>bold</b> plan', description: '' })).toBe('A &lt;b&gt;bold&lt;/b&gt; plan');
  expect(resultLink({ name: 'Miles {Mayhem}', documentUuid: 'Actor.abc' })).toBe('@UUID[Actor.abc]{Miles Mayhem}');
  expect(resultLink({ name: 'Rain', description: '' })).toBe('Rain');
  expect(resultText(null)).toBe('');
});

test('tables come in their folder order, then by name', () => {
  const tables = [{ name: 'Scheme', sort: 200 }, { name: 'Prize', sort: 100 }, { name: 'Crew', sort: 200 }, { name: 'Twist' }];
  expect(sectionOrder(tables).map(table => table.name)).toEqual(['Twist', 'Prize', 'Crew', 'Scheme']);
  expect(sectionOrder(undefined)).toEqual([]);
});

test('a section is its table rolled once', async () => {
  const table = {
    name: 'Prize', uuid: 'RollTable.p',
    roll: async () => ({ results: [{ name: 'Gold', description: '' }, { name: 'Boss', documentUuid: 'Actor.b' }] }),
  };
  expect(await rollSection(table)).toEqual({
    name: 'Prize', uuid: 'RollTable.p',
    results: [{ name: 'Gold', text: 'Gold', link: 'Gold' }, { name: 'Boss', text: 'Boss', link: '@UUID[Actor.b]{Boss}' }],
  });
  expect((await rollSection({ name: 'Empty', uuid: 'x', roll: async () => undefined })).results).toEqual([]);
});

test('placeholders take a section\'s draw, in any case or spacing; unknown ones stay', () => {
  const sections = [section('Location', drawn('the docks')), section('Big Prize', drawn('a jet'), drawn('a tank'))];
  expect(fillPlaceholders('Heist at {location}: {BigPrize} {Nope}', sections)).toBe('Heist at the docks: a jet, a tank {Nope}');
});

test('the title: filled from the draws, else the source and the first draw, else the source', () => {
  const sections = [section('Location', drawn('the docks'))];
  expect(missionTitle('Heist at {Location}', sections, 'Heists')).toBe('Heist at the docks');
  expect(missionTitle('  ', sections, 'Heists')).toBe('Heists: the docks');
  expect(missionTitle('', [], 'Heists')).toBe('Heists');
});

test('the outline: escaped paragraphs and lists, its placeholders as links', () => {
  const sections = [section('Crew', drawn('Boss', '@UUID[Actor.b]{Boss}'))];
  const outline = '1. A tip-off\n2. {Crew} strikes\n\n- Chase\n- Showdown\n\nKeep it <short>\nand fun';
  expect(outlineHtml(outline, sections)).toBe([
    '<ol><li>A tip-off</li><li>@UUID[Actor.b]{Boss} strikes</li></ol>',
    '<ul><li>Chase</li><li>Showdown</li></ul>',
    '<p>Keep it &lt;short&gt;<br>and fun</p>',
  ].join('\n'));
  expect(outlineHtml('', sections)).toBe('');
});

test('the page: a line per section, then the outline', () => {
  const sections = [section('Prize', drawn('Gold')), section('Twist')];
  expect(missionHtml(sections, 'Go.')).toBe('<p><strong>Prize:</strong> Gold</p>\n<p><strong>Twist:</strong> -</p>\n<p>Go.</p>');
  expect(missionHtml(sections)).toBe('<p><strong>Prize:</strong> Gold</p>\n<p><strong>Twist:</strong> -</p>');
});

test('a source\'s own title and outline come from its flags', () => {
  expect(missionDefaults({ essence20: { mission: { title: 'Heist at {Location}', outline: 'Go' } } })).toEqual({ title: 'Heist at {Location}', outline: 'Go' });
  expect(missionDefaults(undefined)).toEqual({ title: '', outline: '' });
});
