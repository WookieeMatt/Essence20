import { jest } from '@jest/globals';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The typed prerequisite text retired (2026-10-07, docs/rules-batches/prereq-text-retired.md): prerequisites are shown
 * from their `system.prerequisites.when` tags, and the packs no longer carry `system.prerequisite` text.
 *
 * Parity for `item:mentions` (rules/plugins/picks/flagged-companion-and-mentions.mjs): it used to search an item's name
 * plus its typed prerequisite text, and now searches the name plus the tags in words (prerequisiteText). OLD_ANSWERS is
 * what the old reader answered for every pack item, recorded over every top-level pack document (6,364) on 2026-10-07 while the packs
 * still had their text, for every mention pattern a pack rule uses. The new reader must give exactly the same answers.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn(), createViaGm: jest.fn() }));

await import('./plugins/index.mjs');
const { contextFor, evaluate } = await import('./predicate.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Every pack item document (top level), with its pack folder. */
function packItems() {
  const out = [];
  for (const pack of readdirSync(join(ROOT, 'packs'))) {
    const dir = join(ROOT, 'packs', pack, '_source');
    if (!existsSync(dir)) {
      continue;
    }

    for (const file of readdirSync(dir).filter(name => name.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      if (doc?.system && doc.type && !doc.items) {
        out.push({ pack, doc });
      } else if (doc?.system && doc.type) {
        // An actor: its embedded items count too.
        out.push(...(doc.items ?? []).filter(item => item?.system).map(item => ({ pack, doc: item, embedded: true })));
      }
    }
  }

  return out;
}

const ITEMS = packItems();
const TOP = ITEMS.filter(entry => !entry.embedded);

/* The old reader's matches (`pack/_id`) per pattern - the name, or the typed text, mentioned one of the texts. */
const OLD_ANSWERS = {
  'combiner|mega weapon': [
    'atsitems/yYaK1g58FCPpSNUr', // Accurate Combiner
    'eocitems/ZIJnA0z3Mrp8pfbd', // Matched Combiner
    'eocitems/a4BfJxhUC7hAhgdZ', // Gestalt Combiner
    'eocitems/cSikKrTZCSL53EKk', // Contact: Combiner Team
    'eocitems/mWyO6mHSMG4TVw3J', // Combiner Specialization
    'fgtaaitems/9oKCarkTuzwK8BQu', // Combiner Core
    'prcrbitems/Wc1FJ5YDeTQS6XoE', // Zord Mega-Weapon System
    'prcrbitems/ZZMBVjmosr0VViMU', // Combiner
    'ttsgitems/XbRfajp9KwfzDG5c', // Versatile Combiner
  ],
};

/** Every `item:mentions:<pattern>` a pack rule uses. */
function mentionPatterns() {
  const found = new Set();
  for (const { doc } of TOP) {
    for (const match of JSON.stringify(doc.system?.rules ?? []).matchAll(/item:mentions:([^"]+)/g)) {
      found.add(match[1]);
    }
  }

  return [...found].sort();
}

describe('item:mentions reads the prerequisite tags, with the same answers as the old text', () => {
  test('every pattern a pack rule uses has its old answers recorded', () => {
    const patterns = mentionPatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns).toEqual(Object.keys(OLD_ANSWERS).sort());
  });

  test.each(Object.keys(OLD_ANSWERS))('"%s" matches exactly what it did, over every pack item', pattern => {
    const matches = TOP
      .filter(({ doc }) => evaluate([`item:mentions:${pattern}`], contextFor({ item: doc, combat: null })) === true)
      .map(({ pack, doc }) => `${pack}/${doc._id}`)
      .sort();
    expect(matches).toEqual([...OLD_ANSWERS[pattern]].sort());
  });
});

describe('the packs no longer carry the typed text', () => {
  test('no pack item has a non-empty system.prerequisite', () => {
    const left = ITEMS
      .filter(({ doc }) => typeof doc.system.prerequisite == 'string' && doc.system.prerequisite.trim() !== '')
      .map(({ pack, doc }) => `${pack}: ${doc.name}`);
    expect(left).toEqual([]);
  });

  test('no pack rule asks the compendium index for system.prerequisite', () => {
    const asking = TOP
      .filter(({ doc }) => JSON.stringify(doc.system?.rules ?? []).includes('"system.prerequisite"'))
      .map(({ pack, doc }) => `${pack}: ${doc.name}`);
    expect(asking).toEqual([]);
  });
});
