import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './index.mjs';

/**
 * Pack hygiene (docs/rules-batches/small-cleanups.md, 2026-10-07): every pack item's `system` keys are
 * keys its data model defines (nested SchemaFields included). A key the model doesn't have is dropped by
 * Foundry on load, so it is dead weight in the source JSON and misleads whoever reads it. The number
 * fields that the packs used to store as strings are checked too.
 *
 * The jest stand-in for foundry.data.fields keeps each field's constructor options, so a SchemaField is
 * a stub whose options are all stubs; anything else (ObjectField, ArrayField, ...) is an open value.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PACKS = join(ROOT, 'packs');
const Stub = foundry.data.fields.StringField;

/* Keys allowed to stay, by pack, as "<type>.<path>" (or "<type>.<key>:string"). Empty since packs/prcrbitems
   was cleaned too (2026-10-06) - add an entry only for a key a pack genuinely needs to keep for a while. */
const ALLOWED = {};

/* Model fields that must be numbers, which some packs stored as numeric strings. */
const NUMBERS = {
  weaponEffect: ['numHands'],
  origin: ['baseAerialMovement', 'baseAquaticMovement', 'baseGroundMovement'],
};

const isSchema = field => field instanceof Stub && !!field.options && typeof field.options == 'object'
  && !(field.options instanceof Stub) && !Array.isArray(field.options)
  && Object.keys(field.options).length > 0 && Object.values(field.options).every(value => value instanceof Stub);

function strayKeys(schema, data, prefix = '', out = []) {
  for (const [key, value] of Object.entries(data ?? {})) {
    const field = schema[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (!field) {
      out.push(path);
    } else if (isSchema(field) && value && typeof value == 'object' && !Array.isArray(value)) {
      strayKeys(field.options, value, path, out);
    }
  }

  return out;
}

/** Every item in the packs: top-level item documents and actors' embedded items. */
function packItems() {
  const items = [];
  for (const pack of readdirSync(PACKS)) {
    const dir = join(PACKS, pack, '_source');
    if (!existsSync(dir)) {
      continue;
    }

    for (const file of readdirSync(dir).filter(name => name.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      for (const item of [doc, ...(Array.isArray(doc.items) ? doc.items : [])]) {
        if (item?.system && config[item.type]) {
          items.push({ pack, file, item });
        }
      }
    }
  }

  return items;
}

describe('pack items carry only their data model\'s system keys', () => {
  const items = packItems();
  const schemas = Object.fromEntries(Object.entries(config).map(([type, model]) => [type, model.defineSchema()]));

  test('the scan finds the packs', () => {
    expect(items.length).toBeGreaterThan(5000);
  });

  test('the key check sees nested SchemaFields and leaves open fields alone', () => {
    const schema = schemas.altMode;
    expect(strayKeys(schema, { altModeCrew: 1, altModeMovement: { ground: 30, hover: 5 }, crew: 0 })).toEqual(['altModeMovement.hover', 'crew']);
    expect(strayKeys(schemas.weapon, { items: { abcd: { anything: 1 } } })).toEqual([]);
  });

  test('no system key outside the model, except the allowlist', () => {
    const stray = [];
    for (const { pack, file, item } of items) {
      for (const path of strayKeys(schemas[item.type], item.system)) {
        if (!ALLOWED[pack]?.has(`${item.type}.${path}`)) {
          stray.push(`${pack}/${file} (${item.name}): ${item.type}.${path}`);
        }
      }
    }

    expect(stray).toEqual([]);
  });

  test('number fields hold numbers, not numeric strings', () => {
    const strings = [];
    for (const { pack, file, item } of items) {
      for (const key of NUMBERS[item.type] ?? []) {
        if (typeof item.system[key] == 'string' && !ALLOWED[pack]?.has(`${item.type}.${key}:string`)) {
          strings.push(`${pack}/${file} (${item.name}): ${item.type}.${key} = "${item.system[key]}"`);
        }
      }
    }

    expect(strings).toEqual([]);
  });
});
