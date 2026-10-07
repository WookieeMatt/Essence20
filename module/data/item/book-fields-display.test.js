import fs from 'node:fs';

/**
 * Book fields nothing else reads, shown read-only on the actor sheet (docs/rules-batches/small-cleanups.md, 2026-10-07):
 * a Focus's increase skills, a weapon's other printed requirements, and a shield's requirements (whose Brawn die also
 * gives the Brawn shortfall - armor-gear-data-rules.test.js).
 */
describe('actor-sheet chips for book fields', () => {
  const read = path => fs.readFileSync(path, 'utf8');
  const lang = JSON.parse(read('lang/en.json')).E20;

  test('a Focus shows the skills its Essence increase goes into', () => {
    const template = read('templates/actor/parts/items/focus.hbs');
    expect(template).toMatch(/\{\{#if item\.system\.skills\.length\}\}/);
    expect(template).toMatch(/name="chip\.focus\.skills"/);
    expect(template).toMatch(/\{\{#each item\.system\.skills as \|skill\|\}\}\{\{lookup @root\.config\.originSkills skill\}\}/);
    expect(template).toContain('E20.FocusIncreaseSkills');
    expect(lang.FocusIncreaseSkills).toEqual(expect.any(String));
  });

  test('a weapon shows its custom requirement text', () => {
    const template = read('templates/actor/parts/items/weapon/details.hbs');
    expect(template).toMatch(/\{\{#if item\.system\.requirements\.custom\}\}\s*<span class="chip" name="chip\.weapon\.requirementsCustom">\{\{localize 'E20\.WeaponRequirements'\}\}: \{\{item\.system\.requirements\.custom\}\}<\/span>/);
  });

  test('a shield shows its requirements text', () => {
    const template = read('templates/actor/parts/items/shield/details.hbs');
    expect(template).toMatch(/\{\{#if item\.system\.requirements\}\}\s*<span class="chip" name="chip\.shield\.requirements">\{\{localize 'E20\.ShieldRequirements'\}\}: \{\{item\.system\.requirements\}\}<\/span>/);
    expect(lang.ShieldRequirements).toEqual(expect.any(String));
  });

  test('the templates keep CRLF line endings', () => {
    for (const path of ['templates/actor/parts/items/focus.hbs', 'templates/actor/parts/items/weapon/details.hbs', 'templates/actor/parts/items/shield/details.hbs']) {
      expect(read(path)).not.toMatch(/(?<!\r)\n/);
    }
  });
});
