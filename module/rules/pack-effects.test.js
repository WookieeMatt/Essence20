import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'packs');

// Foundry v14 refuses an Active Effect without a name, and the whole item with it (play-through 2026-10-07: Diver and
// Rock Climber couldn't be added to a character).
test('every Active Effect in the packs has a name', () => {
  const unnamed = [];
  let checked = 0;
  for (const dir of readdirSync(PACKS)) {
    const source = join(PACKS, dir, '_source');
    if (!existsSync(source)) {
      continue;
    }

    for (const file of readdirSync(source).filter(name => name.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(source, file), 'utf8'));
      for (const effect of doc.effects ?? []) {
        checked++;
        if (!effect.name) {
          unnamed.push(`${dir}/${doc.name}`);
        }
      }
    }
  }

  expect(unnamed).toEqual([]);
  expect(checked).toBeGreaterThan(100);
});
