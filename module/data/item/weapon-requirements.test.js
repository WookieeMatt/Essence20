import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPrerequisites } from '../../rules/prerequisites.mjs';

/**
 * Weapon requirements as prerequisites (2026-10-07, docs/rules-batches/weapon-requirements.md): the free-text
 * `system.requirements.custom` on pack weapons was turned into `system.prerequisites.when` tags where it names
 * something checkable (a Skill rank, a size, an Origin / Perk / Role / Focus, an item owned). "Nil" was cleared;
 * usage notes ("See combined weapon rules...") stay as text.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const system = JSON.parse(readFileSync(join(ROOT, 'system.json'), 'utf8'));

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

const docs = packDocs();
const weapons = docs.filter(([, doc]) => doc.type == 'weapon');
const weapon = (pack, name) => weapons.find(([p, doc]) => p == pack && doc.name == name)?.[1];
const flat = when => (when ?? []).flatMap(entry => (entry && typeof entry == 'object' ? flat(entry.any) : [entry]));

const actor = ({ skills = {}, size = 'common', items = [] } = {}) => ({
  name: 'Test',
  type: 'playerCharacter',
  system: { size, skills: Object.fromEntries(Object.entries(skills).map(([key, shift]) => [key, { shift }])) },
  items: { contents: items.map(([type, name]) => ({ type, name, system: {}, flags: {} })) },
});

test('no pack weapon still carries "Nil" (or another empty word) as its requirement text', () => {
  const nil = weapons.filter(([, doc]) => /^\s*(nil|none|-|—)\s*$/i.test(doc.system?.requirements?.custom ?? ''));
  expect(nil.map(([pack, doc]) => `${pack}: ${doc.name}`)).toEqual([]);
});

test('every Origin / Perk / Role / Focus / item a weapon prerequisite names exists in the packs', () => {
  const byType = new Set(docs.map(([, doc]) => `${doc.type}:${String(doc.name).toLowerCase()}`));
  const anyName = new Set(docs.map(([, doc]) => String(doc.name).toLowerCase()));
  const missing = [];
  for (const [pack, doc] of weapons) {
    for (const tag of flat(doc.system?.prerequisites?.when)) {
      let match;
      if ((match = /^self:hasType:([\w-]+):(.+)$/.exec(tag)) && !byType.has(`${match[1]}:${match[2].toLowerCase()}`)) {
        missing.push(`${pack}: ${doc.name} -> ${tag}`);
      } else if ((match = /^self:has:(.+)$/.exec(tag)) && !anyName.has(match[1].toLowerCase())) {
        missing.push(`${pack}: ${doc.name} -> ${tag}`);
      }
    }
  }

  expect(missing).toEqual([]);
});

test('a fully converted requirement leaves no text behind, and partial ones keep only the remainder', () => {
  expect(weapon('enigma_of_combination', 'Titansword').system).toMatchObject({
    prerequisites: { when: ['self:size>=towering'] },
    requirements: { custom: '' },
  });
  expect(weapon('cobra_codex', 'Compound Z').system.prerequisites.when)
    .toEqual([{ any: ['self:skill:infiltration>=d8', 'self:skill:science>=d8'] }]);
  expect(weapon('pr_crb', 'Power Cannon').system.requirements.custom).toBe('3 Rangers');
  expect(weapon('beneath_the_helmet', 'Dino Spike').system.requirements.custom).toMatch(/combined weapon/i);
  expect(weapon('beneath_the_helmet', 'Dino Spike').system.prerequisites?.when ?? []).toEqual([]);
});

test('weapon prerequisites check against a character', () => {
  const blade = weapon('pr_crb', 'Martial Arts Long Blade');
  expect(checkPrerequisites(actor({ skills: { might: 'd6' } }), blade).met).toBe(true);
  expect(checkPrerequisites(actor({ skills: { finesse: 'd4' } }), blade).met).toBe(false);

  const fire = weapon('wtnv_citizens_guide', 'Fire Breath');
  expect(checkPrerequisites(actor({ items: [['origin', 'Dragon'], ['perk', 'Fire Breathing']] }), fire).met).toBe(true);
  expect(checkPrerequisites(actor({ items: [['origin', 'Dragon']] }), fire).unmet).toEqual(['Has Fire Breathing (perk)']);

  // Forge of Solus Prime: Brawn d12 and Huge, or Brawn d10 and Gigantic, or Brawn d8 and Towering.
  const forge = weapon('enigma_of_combination', 'Forge of Solus Prime');
  const forgeMet = (brawn, size) => checkPrerequisites(actor({ skills: { brawn }, size }), forge).met;
  expect(forgeMet('d12', 'huge')).toBe(true);
  expect(forgeMet('d10', 'gigantic')).toBe(true);
  expect(forgeMet('d8', 'towering')).toBe(true);
  expect(forgeMet('d10', 'huge')).toBe(false);
  expect(forgeMet('d8', 'gigantic')).toBe(false);
  expect(forgeMet('d6', 'titanic')).toBe(false);

  const psycho = weapon('finster_s_monster_matic_cookbook', 'Psycho Sword');
  expect(checkPrerequisites(actor({ items: [['role', 'Path Of Cruelty']] }), psycho).met).toBe(true);
  expect(checkPrerequisites(actor(), psycho).met).toBe(false);

  const dualblade = weapon('through_the_shattered_grid', 'Eltarian Dualblade');
  expect(checkPrerequisites(actor(), dualblade)).toMatchObject({ met: true, asks: ['Access to alien technology'] });
});
