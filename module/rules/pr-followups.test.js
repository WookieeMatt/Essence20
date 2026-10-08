/**
 * The PR core book follow-ups (2026-10-07, docs/rules-batches/pr-followups.md):
 *  1. the generic weapons carry each line's printed name;
 *  2. the A Jump Through Time Perks and the Pre Gen weapons moved out of the PR core pack (old uuid aliases + migration);
 *  3. the Grid Relic's Relic Weapon Traits are picks, and the traits' effects are rules;
 *  4. PR Expertise only offers a Skill the character has at d4 or higher (ChoiceSet minShift).
 */
import { jest } from '@jest/globals';
import './plugins/index.mjs';
import { askRule, choiceLabel, choiceOptions, matchedLegacyChoice } from './lifecycle.mjs';
import { runSteps, stepContext } from './steps.mjs';
import { validateRule } from './types.mjs';
import { contextFor, evaluate } from './predicate.mjs';
import { inheritedRules, rulesSourceOf } from './inherit.mjs';
import { setSubPerkHelpers } from './plugins/picks/pick-sub-perk.mjs';
import { currentUuid, MOVED_ITEM_UUIDS, sourceOf, sourceOfOrUndefined } from '../items/shared/item-lookups.mjs';
import { IRON_BRAVADO } from '../items/defenses/iron-bravado-shared-immunity.mjs';
import { migrateItemData, migrateMovedItemSources, resetMigrationCaches } from '../migration.mjs';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PACKS = join(ROOT, 'packs');
const manifest = JSON.parse(readFileSync(join(ROOT, 'system.json'), 'utf8'));
const packDir = name => manifest.packs.find(pack => pack.name == name)?.path?.replace(/^packs\//, '');

/** Every document of a pack's _source folder, by _id. */
function packDocs(dir) {
  const docs = new Map();
  for (const file of readdirSync(join(PACKS, dir, '_source'))) {
    const doc = JSON.parse(readFileSync(join(PACKS, dir, '_source', file), 'utf8'));
    docs.set(doc._id, { ...doc, file });
  }

  return docs;
}

const PR = packDocs('prcrbitems');
const GIJ = packDocs('gijcrbitems');
const TF = packDocs('tfcrbitems');
const JTT = packDocs('jttitems');
const PREGEN = packDocs('prpgitems');

let nextId = 1;

function makeItem(rules, extra = {}) {
  const item = {
    id: `i${nextId++}`, name: extra.name ?? 'Test Perk', type: extra.type ?? 'perk', flags: extra.flags ?? {},
    _stats: { compendiumSource: extra.source ?? 'Compendium.essence20.test.Item.perk0000000000001' },
    system: { rules, ...(extra.system ?? {}) }, isOwner: true,
  };
  item.update = jest.fn(async update => {
    for (const [path, value] of Object.entries(update)) {
      global.foundry.utils.setProperty(item, path, value);
    }
  });
  return item;
}

function makeActor(items = [], skills = {}) {
  const actor = { id: `a${nextId++}`, documentName: 'Actor', type: 'playerCharacter', name: 'Tester', system: { skills }, isOwner: true };
  actor.items = { contents: items, get: id => items.find(item => item.id == id) };
  for (const item of items) {
    item.parent = actor;
  }

  return actor;
}

beforeAll(() => {
  global.CONFIG = {
    E20: {
      skills: { athletics: 'E20.SkillAthletics', might: 'E20.SkillMight', culture: 'E20.SkillCulture', science: 'E20.SkillScience', persuasion: 'E20.SkillPersuasion' },
      skillToEssence: { athletics: 'strength', might: 'strength', culture: 'smarts', science: 'smarts', persuasion: 'social' },
      essences: { strength: 'E20.EssenceStrength', smarts: 'E20.EssenceSmarts', social: 'E20.EssenceSocial' },
    },
  };
  global.game = { user: { id: 'u1', isGM: true, targets: new Set() }, users: {}, combat: null, i18n: { localize: key => key, format: key => key } };
  global.ui = { notifications: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: {
      ...(global.foundry?.utils ?? {}),
      deepClone: value => JSON.parse(JSON.stringify(value)),
      setProperty: (object, key, value) => {
        const keys = key.split('.');
        const last = keys.pop();
        keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
      },
      getProperty: (object, key) => key.split('.').reduce((o, k) => o?.[k], object),
      isEmpty: value => !value || !Object.keys(value).length,
    },
  };
});

afterEach(() => setSubPerkHelpers(null));

/* -------------------------------------------- */
/*  1. Weapon names                              */
/* -------------------------------------------- */

describe('1. the generic weapons carry each line\'s printed name', () => {
  const NAMES = {
    // PR CRB 2nd printing, Tables 8-3.1 to 8-3.3 (pp.110, 114).
    pr: {
      I5BXHrLRKQSRnvuF: 'Grenade', '0BM1VVo7BJgyF5yv': 'Grenade Effect', Pqv0B3tLP8Jahl5S: 'Grenade',
      ZNokHTRBa5aindap: 'Close Combat Bludgeon', Ty7ZBubtYM7BIwbT: 'Close Combat Bludgeon Effect', '2X1w4UM04U6LliE0': 'Close Combat Bludgeon Alternate Effect 1',
      WlJKvvOXczVPzUaD: 'Martial Arts Long Bludgeon', Jt5FmeFqopWQkHbb: 'Martial Arts Long Bludgeon Effect', xEobfe1YNl85DACZ: 'Martial Arts Long Bludgeon',
      C3MuIKOU1t6Vdp9C: 'Martial Arts Long Blade', uYAnV5vfucrRlJlr: 'Martial Arts Long Blade Effect', '90aj0LwwIHN1JKcX': 'Martial Arts Long Blade',
      '7CFO4VIOM5VE4PyI': 'Martial Arts Medium Blade', pbfLfPqG58y5bu7z: 'Martial Arts Medium Blade Effect', twAzK7PJVBNaMLJk: 'Martial Arts Medium Blade',
      oy8BIwJnGGOMCgMv: 'Zeo Laser Pistols', A9y8bQESIlPw9BnP: 'Zeo Laser Pistols Effect', xThllZn6ehdOWt3K: 'Zeo Laser Pistols (Black) Effect', '5zj2CgvpGqW2KOa8': 'Zeo Laser Pistols',
    },
    // G.I. JOE CRB p.141 / p.143 and Transformers CRB p.123-125 print Close combat bludgeon and Long bludgeon, but keep
    // Frag Grenade, Long blade and Medium blade.
    gij: {
      ZNokHTRBa5aindap: 'Close Combat Bludgeon', Ty7ZBubtYM7BIwbT: 'Close Combat Bludgeon Effect', WlJKvvOXczVPzUaD: 'Long Bludgeon', Jt5FmeFqopWQkHbb: 'Long Bludgeon Effect',
      I5BXHrLRKQSRnvuF: 'Frag Grenade', C3MuIKOU1t6Vdp9C: 'Long Blade', '7CFO4VIOM5VE4PyI': 'Medium Blade',
    },
    tf: {
      ZNokHTRBa5aindap: 'Close Combat Bludgeon', YODFm2APSGLPdnw0: 'Close Combat Bludgeon Alternate Effect 2', WlJKvvOXczVPzUaD: 'Long Bludgeon', lX2ckG2qnzekOFXE: 'Long Bludgeon Alternate Effect 2',
      I5BXHrLRKQSRnvuF: 'Frag Grenade', C3MuIKOU1t6Vdp9C: 'Long Blade', '7CFO4VIOM5VE4PyI': 'Medium Blade',
    },
  };

  test.each([['pr', PR], ['gij', GIJ], ['tf', TF]])('%s: names, _ids and file names', (line, docs) => {
    for (const [id, name] of Object.entries(NAMES[line])) {
      expect([id, docs.get(id)?.name]).toEqual([id, name]);
      // File names are kept (the old name stays in the file name).
      expect(docs.get(id).file.endsWith(`_${id}.json`)).toBe(true);
    }
  });

  test('no old name is left in the three core packs or Cobra Codex', () => {
    const old = /Frag Grenade|Close Combat Bludgeoning|Long Bludgeoning|Zeo Laser Pistol(?!s)|(?<!Martial Arts )(Long|Medium) Blade/;
    for (const doc of PR.values()) {
      expect([doc.file, old.test(JSON.stringify(doc))]).toEqual([doc.file, false]);
    }

    const bludgeoning = /Close Combat Bludgeoning|(?<!Heavy |Short |Thrown )Long Bludgeoning/;
    for (const doc of [...GIJ.values(), ...TF.values(), ...packDocs('ccitems').values()]) {
      expect([doc.file, bludgeoning.test(JSON.stringify(doc))]).toEqual([doc.file, false]);
    }
  });

  test('every renamed weapon\'s effect entries carry the weapon\'s new name', () => {
    for (const [docs, ids] of [[PR, Object.keys(NAMES.pr)], [GIJ, Object.keys(NAMES.gij)], [TF, Object.keys(NAMES.tf)]]) {
      for (const id of ids) {
        const weapon = docs.get(id);
        if (weapon.type != 'weapon') {
          continue;
        }

        for (const entry of Object.values(weapon.system.items ?? {})) {
          expect([entry.uuid, entry.name.startsWith(`${weapon.name} `)]).toEqual([entry.uuid, true]);
        }
      }
    }
  });
});

/* -------------------------------------------- */
/*  2. Moved items                               */
/* -------------------------------------------- */

describe('2. the stray items moved out of the PR core pack', () => {
  const JTT_IDS = ['iVpoqL7ZY4SK4iLc', 'DAqOZsEq03rJWWQo', '7kHQ53hZFgwhSFVi', 'E4hk9pHESLuYQuO7', '8bmqJ7hyOAcVNB1Y', 'hSu10Kgj9g1LSmyv', 'M3pQgNMsU5hU5dMN'];
  const PREGEN_WEAPONS = ['bMF0bpeywVj9CYYz', '1EmLoN9DRgps867P', 'XmZCw5vdjrMmQmbA', 'HBkOFDpX3EjGAm9x'];
  const OLD = id => `Compendium.essence20.pr_crb.Item.${id}`;

  test('the JTT Perks are in the JTT pack, in its Spectrum Modification folder, with their _ids', () => {
    expect(packDir('jump_through_time')).toBe('jttitems');
    const folder = JTT.get('S0TVSZfMxXIqPYj4');
    expect([folder.name, folder.folder, folder._key]).toEqual(['Spectrum Modification', 'eLSZnCfOYYVJN6bw', '!folders!S0TVSZfMxXIqPYj4']);
    expect(JTT.get('eLSZnCfOYYVJN6bw').name).toBe('Role');
    for (const id of JTT_IDS) {
      const perk = JTT.get(id);
      expect([id, perk?.type, perk?.folder, perk?._key, perk?.system?.source?.book]).toEqual([id, 'perk', 'S0TVSZfMxXIqPYj4', `!items!${id}`, 'A Jump Through Time']);
      expect(PR.has(id)).toBe(false);
    }
  });

  test('the Pre Gen weapons are in the new Power Rangers Pre Gen Characters pack, their effects with them', () => {
    const pack = manifest.packs.find(entry => entry.name == 'power_rangers_pre_gens');
    expect(pack).toMatchObject({ label: 'Power Rangers Pre Gen Characters', path: 'packs/prpgitems', type: 'Item', system: 'essence20' });
    expect(manifest.packFolders.find(folder => folder.name == 'Power Rangers').packs).toContain('power_rangers_pre_gens');
    expect(existsSync(join(PACKS, 'prpgitems', '_source'))).toBe(true);
    for (const id of PREGEN_WEAPONS) {
      const weapon = PREGEN.get(id);
      expect([weapon.type, weapon.folder, weapon.system.source.book]).toEqual(['weapon', 'Cp5ngUHeZZt7nlpL', 'Power Rangers Pre Gen Characters']);
      for (const entry of Object.values(weapon.system.items)) {
        expect(entry.uuid.startsWith('Compendium.essence20.power_rangers_pre_gens.Item.')).toBe(true);
        expect(PREGEN.get(entry.uuid.split('.').pop())?.type).toBe('weaponEffect');
      }
    }

    // Every folder a document names is in the same pack.
    for (const docs of [PREGEN, JTT]) {
      for (const doc of docs.values()) {
        expect([doc.file, !doc.folder || docs.has(doc.folder)]).toEqual([doc.file, true]);
      }
    }

    expect(PREGEN.get('Cp5ngUHeZZt7nlpL')).toMatchObject({ name: 'Weapons', folder: null });
    expect(PREGEN.get('49heUbi6A1Hl45yV')).toMatchObject({ name: 'Weapon Effects', folder: null });
    expect([...PR.values()].some(doc => /Power Rangers Pre Gen/.test(doc.system?.source?.book ?? ''))).toBe(false);
  });

  test('the Black Ranger\'s Iron Bravado entry and the module constant name the JTT uuid', () => {
    const black = PR.get('0udD6YSOR8uwGaTF');
    const entry = Object.values(black.system.items).find(item => item.name == 'Iron Bravado');
    expect(entry).toMatchObject({ uuid: 'Compendium.essence20.jump_through_time.Item.8bmqJ7hyOAcVNB1Y', choiceGroup: 'black-2', level: 2 });
    expect(IRON_BRAVADO).toBe('Compendium.essence20.jump_through_time.Item.8bmqJ7hyOAcVNB1Y');
    const stale = new RegExp(`pr_crb\\.Item\\.(${[...JTT_IDS, ...PREGEN_WEAPONS].join('|')})`);
    for (const docs of [PR, JTT, PREGEN]) {
      for (const doc of docs.values()) {
        expect([doc.file, stale.test(JSON.stringify(doc))]).toEqual([doc.file, false]);
      }
    }
  });

  test('the alias map: every moved item, old uuid -> new; anything else unchanged', () => {
    expect(Object.keys(MOVED_ITEM_UUIDS)).toHaveLength(18);
    for (const [from, to] of Object.entries(MOVED_ITEM_UUIDS)) {
      const id = to.split('.').pop();
      expect(from).toBe(OLD(id));
      expect(to.includes('.jump_through_time.') ? JTT.has(id) : PREGEN.has(id)).toBe(true);
    }

    expect(currentUuid(OLD('8bmqJ7hyOAcVNB1Y'))).toBe(IRON_BRAVADO);
    expect(currentUuid('Compendium.essence20.pr_crb.Item.82Ld65NsKwfMZaSC')).toBe('Compendium.essence20.pr_crb.Item.82Ld65NsKwfMZaSC');
    expect(currentUuid(null)).toBeNull();
    expect(currentUuid(undefined)).toBeUndefined();
  });

  test('sourceOf and rules inheritance read an old copy\'s uuid as the new one', () => {
    const old = { flags: { core: { sourceId: OLD('8bmqJ7hyOAcVNB1Y') } }, _source: { system: { rules: [] } } };
    expect(sourceOf(old)).toBe(IRON_BRAVADO);
    expect(sourceOfOrUndefined(old)).toBe(IRON_BRAVADO);
    expect(sourceOf({})).toBeNull();
    expect(sourceOfOrUndefined({})).toBeUndefined();
    expect(rulesSourceOf(old)).toBe(IRON_BRAVADO);
    expect(rulesSourceOf({ flags: { essence20: { rulesSource: OLD('DAqOZsEq03rJWWQo') } } })).toBe('Compendium.essence20.jump_through_time.Item.DAqOZsEq03rJWWQo');

    const lookup = jest.fn(uuid => (uuid == IRON_BRAVADO ? { system: { rules: JTT.get('8bmqJ7hyOAcVNB1Y').system.rules } } : null));
    expect(inheritedRules(old, lookup)).toHaveLength(2);
    expect(lookup).toHaveBeenCalledWith(IRON_BRAVADO);
  });

  test('migrateMovedItemSources: source fields, system.items entries and picks; value-matched and idempotent', () => {
    const item = {
      flags: { core: { sourceId: OLD('8bmqJ7hyOAcVNB1Y') }, essence20: { rulesSource: OLD('bMF0bpeywVj9CYYz'), rules: { choices: { perks: [OLD('iVpoqL7ZY4SK4iLc'), 'Compendium.essence20.x.Item.keep000000000001'], one: OLD('M3pQgNMsU5hU5dMN'), skill: 'might' } } } },
      _stats: { compendiumSource: OLD('8bmqJ7hyOAcVNB1Y') },
      system: { items: { a1: { uuid: OLD('8bmqJ7hyOAcVNB1Y'), name: 'Iron Bravado' }, b2: { uuid: 'Compendium.essence20.pr_crb.Item.1DphEJt2hPswKDzI' } } },
    };
    const update = migrateMovedItemSources(item);
    expect(update).toEqual({
      'flags.core.sourceId': IRON_BRAVADO,
      '_stats.compendiumSource': IRON_BRAVADO,
      'flags.essence20.rulesSource': 'Compendium.essence20.power_rangers_pre_gens.Item.bMF0bpeywVj9CYYz',
      'system.items.a1.uuid': IRON_BRAVADO,
      'flags.essence20.rules.choices.perks': ['Compendium.essence20.jump_through_time.Item.iVpoqL7ZY4SK4iLc', 'Compendium.essence20.x.Item.keep000000000001'],
      'flags.essence20.rules.choices.one': 'Compendium.essence20.jump_through_time.Item.M3pQgNMsU5hU5dMN',
    });

    for (const [path, value] of Object.entries(update)) {
      global.foundry.utils.setProperty(item, path, value);
    }

    expect(migrateMovedItemSources(item)).toEqual({});
    // A document is read from its _source.
    expect(migrateMovedItemSources({ _source: { _stats: { compendiumSource: OLD('XmZCw5vdjrMmQmbA') } }, _stats: {} }))
      .toEqual({ '_stats.compendiumSource': 'Compendium.essence20.power_rangers_pre_gens.Item.XmZCw5vdjrMmQmbA' });
    expect(migrateMovedItemSources({ _stats: { compendiumSource: 'Compendium.essence20.pr_crb.Item.82Ld65NsKwfMZaSC' } })).toEqual({});
  });

  test('migrateItemData runs it for world and embedded items', async () => {
    resetMigrationCaches();
    global.game.packs = { get: () => null, [Symbol.iterator]: function* () {} };
    const world = { type: 'perk', name: 'Iron Bravado', flags: {}, _stats: { compendiumSource: OLD('8bmqJ7hyOAcVNB1Y') }, system: { actionType: 'free' } };
    expect((await migrateItemData(world, { id: 'actor1' }))['_stats.compendiumSource']).toBe(IRON_BRAVADO);
  });
});

/* -------------------------------------------- */
/*  3. Grid Relic Weapon                         */
/* -------------------------------------------- */

describe('3. the Grid Relic\'s Relic Weapon Traits (PR CRB p.61)', () => {
  const TRAIT_IDS = ['op48tWsOS2uno2MA', 'FL7xnRUhVwmtKj2N', 'fPnUOnzp4glrlvtR', 'v0xy8scGOCGFBrOa', 'rDwsw5Gaps5GLB71', 'uk0T2IjgefVwOufv', 'qt9OhfYaZwc6NV9c', 'aExhIUpfJTx6fJeU'];
  const gridRelic = PR.get('82Ld65NsKwfMZaSC');
  const relicTrait = PR.get('U8hcTqLqPyMGyz22');

  test('both list the eight traits; the Grid Relic Weapon picks two, each Relic Weapon Trait one', () => {
    for (const [item, count] of [[gridRelic, 2], [relicTrait, 1]]) {
      const uuids = Object.values(item.system.items).map(entry => entry.uuid);
      expect(uuids.sort()).toEqual(TRAIT_IDS.map(id => `Compendium.essence20.pr_crb.Item.${id}`).sort());
      for (const entry of Object.values(item.system.items)) {
        expect(entry.name).toBe(PR.get(entry.uuid.split('.').pop()).name);
      }

      const pick = item.system.rules.find(rule => rule.steps?.some(step => step.do == 'pickSubPerk'));
      expect(pick).toMatchObject({ type: 'Trigger', event: 'added', removeOnStop: true });
      expect(pick.steps[0]).toMatchObject({ do: 'pickSubPerk', key: 'perks', count, required: true });
      expect(item.system.automation.status).toBe('full');
      for (const rule of item.system.rules) {
        expect(validateRule(rule)).toEqual([]);
      }
    }

    // The Grid Relic weapon is still made first; the Relic Weapon Trait keeps its _id for the copies characters hold.
    expect(gridRelic.system.rules[0].steps[0].do).toBe('choose');
    expect(relicTrait._id).toBe('U8hcTqLqPyMGyz22');
  });

  test('the pick offers the traits not yet held, and makes two', async () => {
    const owned = 'Compendium.essence20.pr_crb.Item.aExhIUpfJTx6fJeU';
    const item = makeItem(gridRelic.system.rules, { name: 'Grid Relic Weapon', source: 'Compendium.essence20.pr_crb.Item.82Ld65NsKwfMZaSC', system: { items: gridRelic.system.items } });
    const actor = makeActor([item, makeItem([], { source: owned })]);
    const create = jest.fn(async () => 'key');
    setSubPerkHelpers({ create, gameLine: () => 'pr', general: async () => ({}) });
    const offered = [];
    const ctx = stepContext({ actor, item, rule: gridRelic.system.rules[1], targets: [] });
    ctx.askPick = async (step, options) => {
      offered.push(options.map(option => option.label));
      return options[0].value;
    };

    expect(await runSteps(gridRelic.system.rules[1].steps, ctx)).toBe(true);
    expect(offered[0]).toHaveLength(7);
    expect(offered[0]).not.toContain('Relic Weapon Trait: Zord Control');
    expect(offered[1]).toHaveLength(6);
    expect(create).toHaveBeenCalledTimes(2);
    expect(item.flags.essence20.rules.choices.perks).toHaveLength(2);
  });

  test('the traits\' rules: Zord Control, Energy Blasts, Fast Draw, Intelligence, Shatter Strike', () => {
    const rules = id => PR.get(id).system.rules ?? [];
    for (const id of TRAIT_IDS) {
      for (const rule of rules(id)) {
        expect([id, validateRule(rule)]).toEqual([id, []]);
      }
    }

    expect(rules('aExhIUpfJTx6fJeU')).toEqual([
      expect.objectContaining({ type: 'RollModifier', scope: 'ownZord', upshift: 1, when: ['attack', 'self:type:zord'] }),
      expect.objectContaining({ type: 'SummonTime', mode: 'halve' }),
    ]);
    expect(rules('op48tWsOS2uno2MA')).toEqual([expect.objectContaining({ type: 'DialogSwitch', upshift: 1, limit: { per: 'rest', max: 3 } })]);
    expect(rules('uk0T2IjgefVwOufv')).toEqual([expect.objectContaining({ type: 'DialogSwitch', upshift: 2 })]);
    // Fast Draw's rule replaces its switch-on Active Effect.
    expect(PR.get('FL7xnRUhVwmtKj2N').effects).toEqual([]);
    // Multi-Strike, Proximity Alarm and Thunderous stay with the table.
    for (const id of ['v0xy8scGOCGFBrOa', 'rDwsw5Gaps5GLB71', 'qt9OhfYaZwc6NV9c']) {
      expect([id, rules(id), PR.get(id).system.automation.status]).toEqual([id, [], 'manual']);
    }
  });

  test('the Grid Relic switches are offered on Grid Relic attacks only; Fast Draw\'s Edge needs it in hand', () => {
    const weapon = { id: 'w1', type: 'weapon', name: 'Grid Relic', flags: { essence20: { pr2GridRelic: true } }, system: { equipped: true } };
    const strike = { id: 'e1', type: 'weaponEffect', name: 'Grid Relic Strike', flags: { essence20: { pr2GridRelic: 'might', parentId: 'w1' } }, system: {} };
    const other = { id: 'e2', type: 'weaponEffect', name: 'Blade Blaster', flags: { essence20: {} }, system: {} };
    const actor = makeActor([weapon, strike, other]);
    const shatter = PR.get('uk0T2IjgefVwOufv').system.rules[0].when;
    const dialog = item => evaluate(shatter.filter(tag => tag != 'attack'), contextFor({ self: actor, item }));
    expect(dialog(strike)).toBe(true);
    expect(dialog(other)).toBe(false);

    const fastDraw = PR.get('FL7xnRUhVwmtKj2N').system.rules[0].when.filter(tag => tag != 'roll:initiative');
    expect(evaluate(fastDraw, contextFor({ self: actor }))).toBe(true);
    weapon.system.equipped = false;
    expect(evaluate(fastDraw, contextFor({ self: actor }))).toBe(false);
  });

  test('Intelligence picks three Smarts or Social Skills and gives them Edge', () => {
    const [choice, edge] = PR.get('fPnUOnzp4glrlvtR').system.rules;
    expect(choice).toMatchObject({ type: 'ChoiceSet', from: 'skill', count: 3, required: true });
    expect(choiceOptions(choice).map(option => option.value)).toEqual(['culture', 'science', 'persuasion']);
    expect(edge).toMatchObject({ type: 'RollModifier', edge: true, when: ['skill:{choice.skills}'] });
  });
});

/* -------------------------------------------- */
/*  4. Expertise                                 */
/* -------------------------------------------- */

describe('4. PR Expertise: "Choose a Skill at d4 or higher" (PR CRB p.95)', () => {
  const expertise = PR.get('uoCQgYOCeIQNzF0q');
  const choice = expertise.system.rules[0];
  const skills = { athletics: { shift: 'd2' }, might: { shift: 'd4' }, culture: { shift: 'd8' }, science: { shift: 'd20' }, persuasion: { shift: 'd6' } };

  test('only PR Expertise carries the filter; the G.I. JOE and MLP ones print no such prerequisite', () => {
    expect(choice).toMatchObject({ type: 'ChoiceSet', key: 'skill', from: 'skill', minShift: 'd4', rename: true, required: true, legacy: 'system.choice' });
    expect(validateRule(choice)).toEqual([]);
    for (const dir of ['gijcrbitems', 'mlpcrbitems']) {
      for (const doc of packDocs(dir).values()) {
        if (doc.name == 'Expertise') {
          expect([dir, JSON.stringify(doc.system.rules ?? []).includes('minShift')]).toEqual([dir, false]);
        }
      }
    }
  });

  test('the pick offers only the Skills at d4 or higher', () => {
    const actor = makeActor([], skills);
    expect(choiceOptions(choice, { actor }).map(option => option.value)).toEqual(['might', 'culture', 'persuasion']);
    expect(choiceOptions({ ...choice, minShift: undefined }, { actor }).map(option => option.value)).toHaveLength(5);
    expect(choiceOptions({ ...choice, maxShift: 'd4', minShift: undefined }, { actor }).map(option => option.value)).toEqual(['athletics', 'might', 'science']);
    expect(validateRule({ ...choice, minShift: 'd5' }).join(' ')).toMatch(/minShift/);
  });

  test('a pick already below d4 is kept and still named (label lookups and old picks ignore the filter)', () => {
    const actor = makeActor([], skills);
    const item = makeItem([choice], { system: { choice: 'athletics' } });
    item.parent = actor;
    expect(choiceOptions(choice, { actor, allOptions: true }).map(option => option.value)).toHaveLength(5);
    expect(choiceLabel(choice, 'athletics', { actor, item })).toBe('E20.SkillAthletics');
    expect(matchedLegacyChoice(choice, item, actor)).toBe('athletics');
  });

  test('count and excludeCopies still work with the filter', async () => {
    const rule = { ...choice, rename: false, legacy: undefined, count: 2, excludeCopies: true };
    const source = 'Compendium.essence20.test.Item.expertise0000001';
    const item = makeItem([rule], { source });
    const copy = makeItem([rule], { source, flags: { essence20: { rules: { choices: { skill: ['culture'] } } } } });
    const actor = makeActor([item, copy], skills);
    const offered = [];
    const ask = jest.fn(async (r, i, { options }) => {
      offered.push(options.map(option => option.value));
      return options[0]?.value ?? null;
    });
    expect(await askRule(rule, item, actor, { ask })).toEqual(['might', 'persuasion']);
    expect(offered).toEqual([['might', 'persuasion'], ['persuasion']]);
  });
});
