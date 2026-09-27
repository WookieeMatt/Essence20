import { jest } from '@jest/globals';
import { findGrantableGeneralPerks } from './why-do-i-know-that.mjs';

function makePack(entries) {
  return {
    documentName: 'Item',
    metadata: { id: 'essence20.a' },
    getIndex: jest.fn(async () => ({ values: () => entries })),
  };
}

function perkEntry(name, uuid, type) {
  return { uuid, name, type: 'perk', img: 'i', system: { type } };
}

describe("findGrantableGeneralPerks", () => {
  afterEach(() => {
    global.game = undefined;
  });

  function setPack(entries) {
    const packs = [makePack(entries)];
    packs.filter = Array.prototype.filter.bind(packs);
    global.game = { packs, settings: { get: () => ({}) }, i18n: { localize: k => k } };
  }

  test("offers General Perks and nothing else", async () => {
    setPack([
      perkEntry('Tough', 'u1', 'general'),
      perkEntry('Role Thing', 'u2', 'role'),
      perkEntry('Origin Thing', 'u3', 'origin'),
    ]);

    const rows = await findGrantableGeneralPerks({ items: [] });

    expect(rows.map(r => r.name)).toEqual(['Tough']);
  });

  // Offering one the actor already has would fail silently inside grantPerkOutright.
  test("hides a General Perk the actor already holds", async () => {
    setPack([perkEntry('Tough', 'u1', 'general'), perkEntry('Wily', 'u2', 'general')]);

    const actor = { items: [{ type: 'perk', flags: { core: { sourceId: 'u1' } } }] };
    const rows = await findGrantableGeneralPerks(actor);

    expect(rows.map(r => r.name)).toEqual(['Wily']);
  });

  test("resolves an Actor-embedded copy by _stats.compendiumSource", async () => {
    setPack([perkEntry('Tough', 'u1', 'general')]);

    const actor = { items: [{ type: 'perk', flags: {}, _stats: { compendiumSource: 'u1' } }] };

    expect(await findGrantableGeneralPerks(actor)).toEqual([]);
  });

  test("tolerates an actor with no items at all", async () => {
    setPack([perkEntry('Tough', 'u1', 'general')]);

    expect((await findGrantableGeneralPerks(undefined)).map(r => r.name)).toEqual(['Tough']);
  });
});
