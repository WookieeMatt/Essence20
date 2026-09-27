import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E20 } from './config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../../lang/en.json'), 'utf8'));

/**
 * E20.statusEffects (Space Vessel Conditions, Across the Stars p.25): Blanked, Compromised,
 * Decompressed, Jammed, Leaking, Spun-Out, Sputtering and Unstable - bookkeeping-only markers,
 * the same idiom as this system's other unenforced Conditions (see e.g. surprised's own doc
 * comment in this file). Each entry's own doc comment explains why the stacking/escalation RAW
 * describes isn't separately modeled.
 */
describe("E20.statusEffects (Space Vessel Conditions, Across the Stars p.25)", () => {
  test.each([
    'blanked', 'compromised', 'decompressed', 'jammed', 'leaking', 'spunOut', 'sputtering', 'unstable',
  ])("%s is registered with a localized name and an icon", (id) => {
    const entry = E20.statusEffects.find(status => status.id == id);
    expect(entry).toBeDefined();
    expect(entry.img).toBeTruthy();

    const nameKey = entry.name.replace(/^E20\./, '');
    expect(en.E20[nameKey]).toBeTruthy();
  });
});
