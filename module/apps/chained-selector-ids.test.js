import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Selectors whose form handler opens ANOTHER instance of the same class (the next step of a chain) need a per-instance
 * window id ("{id}"). With one fixed id, the first window's closeOnSubmit closed the second as well, so the chain
 * stopped without a word: Commando's two Expertise picks (ChoicesSelector, 2026-09) and an Essence Alteration's
 * bonus Skill -> Essence cost -> cost Skill steps (AlterationEssenceSelector, release checklist 2026-10-07).
 */

const DIR = dirname(fileURLToPath(import.meta.url));

test.each([
  ['alteration-essence-selector.mjs', 'alteration-essence'],
  ['choices-selector.mjs', 'choices'],
])('%s opens each step with its own window id', (file, prefix) => {
  const source = readFileSync(join(DIR, file), 'utf8');
  expect(source).toMatch(new RegExp(`id: "${prefix}-\\{id\\}"`));
});
