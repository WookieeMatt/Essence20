import { jest } from '@jest/globals';
import Essence20CompendiumBrowser from './compendium-browser.mjs';

/**
 * A browser without the real constructor, which wants a live ApplicationV2.
 *
 * `_index` is what _buildIndex would have produced: one flat row per compendium entry, carrying a
 * facet's value only for the types that facet covers.
 */
function makeBrowser(index, { activeType = 'equipment', traits = [], gearType = [] } = {}) {
  const browser = Object.create(Essence20CompendiumBrowser.prototype);
  browser._index = index;
  browser._visiblePackIds = new Set(index.map(e => e.bookId));
  browser._availableTypes = [...new Set(index.map(e => e.type))].sort();
  browser._filters = {
    search: "",
    excludedBooks: new Set(),
    booksExpanded: true,
    activeType,
    excludedSubtypes: {},
    requiredFacets: { traits: new Set(traits), gearType: new Set(gearType) },
  };

  return browser;
}

/**
 * One index row. `traits` is null for types the trait facet does not cover, `gearType` null for
 * everything but gear - exactly as _buildIndex writes them.
 */
function entry(name, type, { traits = null, gearType = null } = {}) {
  return {
    uuid: `uuid.${name}`,
    name,
    type,
    typeLabel: type,
    subtype: null,
    traits,
    gearType,
    book: 'Book',
    bookId: 'essence20.book',
    page: null,
  };
}

const facet = (browser, key) => browser._getFacetContexts().find(f => f.key === key);

const RIFLE = entry('Rifle', 'weapon', { traits: ['ballistic', 'reload'] });
const SILENCED = entry('Silenced Pistol', 'weapon', { traits: ['ballistic', 'silent'] });
const SNIPER = entry('Sniper Rifle', 'weapon', { traits: ['ballistic', 'silent', 'sniper'] });
const VEST = entry('Vest', 'armor', { traits: ['deflective'] });
const BUCKLER = entry('Buckler', 'shield', { traits: ['deflective', 'bulky'] });
const ROPE = entry('Rope', 'gear', { gearType: 'exploration' });
const TOOLKIT = entry('Toolkit', 'gear', { gearType: 'tools' });
const MEDKIT = entry('Medkit', 'gear', { gearType: 'medical' });

beforeEach(() => {
  global.game = {
    ...(global.game ?? {}),
    i18n: { localize: jest.fn(k => k) },
  };
  global.CONFIG = {
    ...(global.CONFIG ?? {}),
    E20: {
      ...(global.CONFIG?.E20 ?? {}),
      weaponTraits: {
        ballistic: 'Ballistic', reload: 'Reload', silent: 'Silent', sniper: 'Sniper', unused: 'Unused',
      },
      armorTraits: { deflective: 'Deflective', bulky: 'Bulky' },
      gearTypes: {
        tools: 'Tools', kits: 'Kits', medical: 'Medical', exploration: 'Exploration', other: 'Other',
      },
    },
  };
});

/* Facets REQUIRE rather than exclude - the opposite of the Type and Books groups. An item has many
   traits, and the question a player actually has is "which weapons are Silent?", which under
   exclusion semantics would mean unchecking forty other traits to ask. */
describe('the traits facet', () => {
  test('filters nothing when nothing is required', () => {
    const browser = makeBrowser([RIFLE, SILENCED, VEST, ROPE]);

    expect(browser._getFilteredResults().map(e => e.name))
      .toEqual(['Rifle', 'Silenced Pistol', 'Vest', 'Rope']);
  });

  test('narrows to the items that have the required trait', () => {
    const browser = makeBrowser([RIFLE, SILENCED, SNIPER, VEST], { traits: ['silent'] });

    expect(browser._getFilteredResults().map(e => e.name)).toEqual(['Silenced Pistol', 'Sniper Rifle']);
  });

  /* ALL of the chosen traits, not any: picking Silent and Sniper means "a silenced sniper", which
     is the question worth asking. OR is already available by picking one at a time. */
  test('requires every chosen trait, not just one of them', () => {
    const browser = makeBrowser([RIFLE, SILENCED, SNIPER], { traits: ['silent', 'sniper'] });

    expect(browser._getFilteredResults().map(e => e.name)).toEqual(['Sniper Rifle']);
  });

  // A shield carries ARMOR traits - see data/item/shield.mjs.
  test('covers shields, using the armor trait list', () => {
    const browser = makeBrowser([VEST, BUCKLER, SILENCED], { traits: ['bulky'] });

    expect(browser._getFilteredResults().map(e => e.name)).toEqual(['Buckler']);
  });

  test('matches armor and shields together on a shared trait', () => {
    const browser = makeBrowser([VEST, BUCKLER, RIFLE], { traits: ['deflective'] });

    expect(browser._getFilteredResults().map(e => e.name)).toEqual(['Vest', 'Buckler']);
  });

  /* Gear has no traits at all, so it cannot satisfy a trait filter - which is correct, and is what
     keeps a coil of rope out of the results for "Silent" while it shares the Equipment tab. */
  test('drops types with no traits once a trait is required', () => {
    const browser = makeBrowser([SILENCED, ROPE], { traits: ['silent'] });

    expect(browser._getFilteredResults().map(e => e.name)).toEqual(['Silenced Pistol']);
  });
});

/* Gear has no traits - checked against the schema and all 256 pack entries. What it has is
   gearType, a single category, so several checked can only sensibly mean "either". */
describe('the gear type facet', () => {
  test('narrows to one category', () => {
    const browser = makeBrowser([ROPE, TOOLKIT, MEDKIT], { gearType: ['tools'] });

    expect(browser._getFilteredResults().map(e => e.name)).toEqual(['Toolkit']);
  });

  test('matches ANY of several categories, since no gear is two at once', () => {
    const browser = makeBrowser([ROPE, TOOLKIT, MEDKIT], { gearType: ['tools', 'medical'] });

    expect(browser._getFilteredResults().map(e => e.name)).toEqual(['Toolkit', 'Medkit']);
  });

  test('drops the types that have no gear category', () => {
    const browser = makeBrowser([TOOLKIT, RIFLE], { gearType: ['tools'] });

    expect(browser._getFilteredResults().map(e => e.name)).toEqual(['Toolkit']);
  });
});

describe('facets together', () => {
  /* Facets combine with AND. Requiring a weapon trait and a gear category matches nothing, which is
     honest - nothing is both. */
  test('requiring a trait and a gear category matches nothing', () => {
    const browser = makeBrowser([SILENCED, TOOLKIT], { traits: ['silent'], gearType: ['tools'] });

    expect(browser._getFilteredResults()).toEqual([]);
  });
});

describe('the facet sidebar', () => {
  /* The raw weapon enum alone is over forty entries, most matching nothing in the books a given
     table has enabled - so each list is narrowed to values actually present. */
  test('offers only values something on the tab actually has', () => {
    const browser = makeBrowser([RIFLE, SILENCED]);

    const keys = facet(browser, 'traits').options.map(o => o.key);

    expect(keys).toEqual(expect.arrayContaining(['ballistic', 'reload', 'silent']));
    expect(keys).not.toContain('unused');
    expect(keys).not.toContain('sniper');
  });

  test('pools the enums of every covered type on the tab', () => {
    const browser = makeBrowser([SILENCED, BUCKLER]);

    expect(facet(browser, 'traits').options.map(o => o.key))
      .toEqual(expect.arrayContaining(['silent', 'deflective', 'bulky']));
  });

  test('shows both facets on a tab that has weapons and gear', () => {
    const browser = makeBrowser([SILENCED, TOOLKIT]);

    expect(browser._getFacetContexts().map(f => f.key)).toEqual(['traits', 'gearType']);
  });

  test('omits a facet with nothing to offer on this tab', () => {
    const browser = makeBrowser([TOOLKIT]);

    expect(browser._getFacetContexts().map(f => f.key)).toEqual(['gearType']);
  });

  /* Otherwise picking two values with no overlap would empty the results, which would empty the
     list, which would leave no way to un-pick the second one. */
  test('keeps a required value listed even when nothing matches any more', () => {
    const browser = makeBrowser([RIFLE], { traits: ['silent'] });

    const options = facet(browser, 'traits').options;

    expect(options.map(o => o.key)).toContain('silent');
    expect(options.find(o => o.key === 'silent').checked).toBe(true);
  });

  test('reports whether anything is required, for the collapsed state', () => {
    expect(facet(makeBrowser([RIFLE]), 'traits').any).toBe(true);
    expect(facet(makeBrowser([RIFLE], { traits: ['reload'] }), 'traits').any).toBe(false);
  });

  test('carries its own hint, since the two facets combine differently', () => {
    const browser = makeBrowser([SILENCED, TOOLKIT]);

    expect(facet(browser, 'traits').hint).toBe('E20.CompendiumBrowserFilterTraitsHint');
    expect(facet(browser, 'gearType').hint).toBe('E20.CompendiumBrowserFilterGearTypeHint');
  });

  test('is absent entirely on a tab with no facets', () => {
    const browser = makeBrowser([entry('Sneak Attack', 'perk')], { activeType: 'perk' });

    expect(browser._getFacetContexts()).toEqual([]);
  });

  test('is absent when nothing on the tab has any value for it', () => {
    const browser = makeBrowser([entry('Plain Weapon', 'weapon', { traits: [] })]);

    expect(browser._getFacetContexts()).toEqual([]);
  });
});

/* The sidebar writes a facet's key into data-facet and the click handler reads it back. A wrong
   value there used to be silent: every click landed in a bucket nothing reads, so the filter did
   nothing and explained nothing. This is what a `../` in front of a Handlebars block parameter
   produced in practice - it renders empty. */
describe('an unknown facet key', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    console.warn.mockRestore();
  });

  test('is refused rather than given a bucket of its own', () => {
    const browser = makeBrowser([RIFLE]);

    expect(browser._requiredFor('')).toBeNull();
    expect(browser._requiredFor('notAFacet')).toBeNull();
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  test('does not quietly appear in the filter state', () => {
    const browser = makeBrowser([RIFLE]);

    browser._requiredFor('notAFacet');

    expect(Object.keys(browser._filters.requiredFacets)).toEqual(['traits', 'gearType']);
  });

  test('still returns the real facets their own sets', () => {
    const browser = makeBrowser([RIFLE], { traits: ['reload'] });

    expect([...browser._requiredFor('traits')]).toEqual(['reload']);
    expect(browser._requiredFor('gearType')).toEqual(new Set());
    expect(console.warn).not.toHaveBeenCalled();
  });

  // A facet whose set is missing entirely - an older stored filter state - is still created.
  test('creates a missing set for a facet that is real', () => {
    const browser = makeBrowser([RIFLE]);
    delete browser._filters.requiredFacets.gearType;

    expect(browser._requiredFor('gearType')).toEqual(new Set());
  });
});
