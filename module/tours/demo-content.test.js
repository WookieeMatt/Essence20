/**
 * Tests for the tour demo-actor definitions.
 *
 * The provisioning functions themselves are thin wrappers over Foundry document creation and are
 * verified by running them in a real client (see docs/TOURS_PLAN.md §7a). What is worth testing
 * here is the *data*: the definitions are hand-written objects passed straight to data models that
 * reject an invalid document silently — Foundry logs a validation error and the item simply never
 * appears on the actor. That failure mode cost two debugging rounds already (`essenceLevels`
 * wanted "level2" not "2"; a weapon effect's `style` has a fixed vocabulary that excludes
 * "ranged"), so the constraints that bit are pinned here.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { DEMO_ACTORS } = await import('./demo-content.mjs');

describe('DEMO_ACTORS definitions', () => {
  const entries = Object.entries(DEMO_ACTORS);

  it('defines at least the character the sheet tours need', () => {
    expect(Object.keys(DEMO_ACTORS)).toContain('character');
  });

  describe.each(entries)('%s', (key, def) => {
    it('has the fields ensureDemoActor reads', () => {
      expect(typeof def.name).toBe('string');
      expect(def.name.length).toBeGreaterThan(0);
      expect(typeof def.type).toBe('string');
      expect(Array.isArray(def.items)).toBe(true);
    });

    it('gives every item a name and a type', () => {
      for (const item of def.items) {
        expect(typeof item.name).toBe('string');
        expect(typeof item.type).toBe('string');
      }
    });

    it('does not reuse an item name within one actor', () => {
      // attachItem() finds its parent by name, so duplicates would attach to whichever came first.
      const names = def.items.map(i => i.name);
      expect(names).toHaveLength(new Set(names).size);
    });

    it('points every attachment at an item that exists on the same actor', () => {
      const names = new Set(def.items.map(i => i.name));
      for (const attachment of def.attach ?? []) {
        expect(names.has(attachment.parent)).toBe(true);
      }
    });

    it('only attaches types the sheet renders as children', () => {
      for (const attachment of def.attach ?? []) {
        expect(['weaponEffect', 'upgrade', 'perk']).toContain(attachment.type);
      }
    });

    it('gives every attached perk a type, so it sorts into a Perks tab section', () => {
      // The Perks tab groups by `system.type` (influence / origin / general / role). A perk
      // without one falls into General regardless of what granted it, which makes a tour step
      // pointing at the Role section come up empty.
      for (const attachment of def.attach ?? []) {
        if (attachment.type !== 'perk') continue;
        expect(['general', 'influence', 'origin', 'role']).toContain(attachment.system?.type);
      }
    });
  });
});

describe('field vocabularies that silently reject a document', () => {
  const role = DEMO_ACTORS.character.items.find(i => i.type === 'role');

  it("writes Role essence levels as 'levelN' strings", () => {
    // A bare "2" or a numeric 2 fails validation and the Role is never created at all — the actor
    // just quietly comes out without one.
    for (const levels of Object.values(role.system.essenceLevels)) {
      for (const level of levels) expect(level).toMatch(/^level([1-9]|1\d|20)$/);
    }
  });

  it('writes Role perk levels the same way', () => {
    for (const level of role.system.perkLevels) expect(level).toMatch(/^level([1-9]|1\d|20)$/);
  });

  it('gives weapon effects a style from the fixed vocabulary', () => {
    const styles = ['melee', 'energy', 'explosive', 'projectile'];
    for (const attachment of DEMO_ACTORS.character.attach ?? []) {
      const style = attachment.system?.classification?.style;
      if (style) expect(styles).toContain(style);
    }
  });
});

describe('icon paths', () => {
  // Every actor image in these definitions pointed at `assets/icons/actors/`, a directory that does
  // not exist, and three item icons named files that exist under a different name. Nothing throws
  // for a missing image — Foundry renders a broken-image glyph — so it survived six playtests
  // before anyone looked closely at a card that happened to show the icon large.
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

  /** @returns {string[]} Every `systems/essence20/...` path referenced by the definitions. */
  const referencedPaths = () => {
    const found = new Set();
    const walk = (value) => {
      if (typeof value === 'string') {
        if (value.startsWith('systems/essence20/')) found.add(value);
        return;
      }

      if (value && typeof value === 'object') Object.values(value).forEach(walk);
    };

    walk(DEMO_ACTORS);
    return [...found];
  };

  it('references at least one system asset', () => {
    expect(referencedPaths().length).toBeGreaterThan(0);
  });

  it('points every system asset path at a file that exists', () => {
    const missing = referencedPaths().filter(
      p => !fs.existsSync(path.join(ROOT, p.replace('systems/essence20/', ''))),
    );

    expect(missing).toEqual([]);
  });
});

describe('demo copy', () => {
  it('describes every item, so no tour step points at an empty description', () => {
    for (const def of Object.values(DEMO_ACTORS)) {
      for (const item of [...def.items, ...(def.attach ?? [])]) {
        expect(typeof item.system?.description).toBe('string');
        expect(item.system.description.length).toBeGreaterThan(0);
      }
    }
  });

  it('marks the content as demonstration material rather than playable content', () => {
    // These actors are created in a user's real world. Every description says what it is, so
    // nobody mistakes one for shipped game content if a tour is interrupted before cleanup.
    for (const def of Object.values(DEMO_ACTORS)) {
      for (const item of [...def.items, ...(def.attach ?? [])]) {
        expect(item.system.description.toLowerCase()).toMatch(/demonstration|training|demo/);
      }
    }
  });
});
