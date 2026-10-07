import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Pack hygiene (2026-10-06): several packs hold their own copies of another book's items under the SAME _id
 * (the Transformers CRB copies the G.I. JOE CRB's weapon effects). A parent's system.items entry must point at
 * its own pack's copy when there is one - 19 TF CRB weapons used to point at gi_joe_crb / pr_crb, so a TF Long
 * Bludgeon dropped the Power Rangers "Martial Arts" effect and none of them got the TF book's own copies.
 * A supplement pointing at a core book it has no copy of (Quartermaster's Guide -> gi_joe_crb) is fine.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const system = JSON.parse(readFileSync(join(ROOT, 'system.json'), 'utf8'));
const dirOf = Object.fromEntries(system.packs.map(pack => [pack.name, pack.path]));

/** Every pack's source docs, as [packName, doc]. */
function packDocs() {
  const out = [];
  for (const pack of system.packs) {
    const dir = join(ROOT, pack.path, '_source');
    if (!existsSync(dir)) {
      continue;
    }

    for (const file of readdirSync(dir).filter(name => name.endsWith('.json'))) {
      out.push([pack.name, JSON.parse(readFileSync(join(dir, file), 'utf8'))]);
    }
  }

  return out;
}

test("a child-item link uses its own pack's copy of that item when the pack has one", () => {
  const docs = packDocs();
  const ids = {};
  for (const [pack, doc] of docs) {
    (ids[pack] ??= new Set()).add(doc._id);
  }

  const crossed = [];
  for (const [pack, doc] of docs) {
    for (const entry of Object.values(doc.system?.items ?? {})) {
      const [, , other, , id] = String(entry?.uuid ?? '').split('.');
      if (other && other != pack && dirOf[other] && ids[pack]?.has(id)) {
        crossed.push(`${pack}: ${doc.name} -> ${entry.uuid}`);
      }
    }
  }

  expect(crossed).toEqual([]);
});
