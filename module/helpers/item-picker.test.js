import { jest } from '@jest/globals';
import { findCompendiumItems, pickCompendiumItem } from './item-picker.mjs';

function makePack(id, entries) {
  return {
    metadata: { id },
    getIndex: jest.fn(async () => ({ values: () => entries })),
  };
}

function entry(name, type, availability, extra = {}) {
  return { uuid: `Compendium.${name}`, name, type, img: 'icon.svg', system: { availability }, ...extra };
}

describe("findCompendiumItems", () => {
  afterEach(() => {
    global.game = undefined;
  });

  function setPacks(packs, disabled = {}) {
    global.game = {
      packs: packs,
      settings: { get: () => disabled },
      i18n: { localize: key => key },
    };
    // getVisibleItemPacks reads game.packs, filtering to Item packs the GM left enabled.
    global.game.packs.filter = Array.prototype.filter.bind(packs);
    global.game.packs[Symbol.iterator] = Array.prototype[Symbol.iterator].bind(packs);
  }

  test("keeps only the requested type", async () => {
    const pack = makePack('essence20.a', [
      entry('Blade', 'weapon', 'standard'),
      entry('Vest', 'armor', 'standard'),
    ]);
    pack.documentName = 'Item';
    setPacks([pack]);

    const rows = await findCompendiumItems({ type: 'weapon' });

    expect(rows.map(r => r.name)).toEqual(['Blade']);
  });

  test("filters by availability tier when one is given", async () => {
    const pack = makePack('essence20.a', [
      entry('Standard Gun', 'weapon', 'standard'),
      entry('Limited Gun', 'weapon', 'limited'),
      entry('Restricted Gun', 'weapon', 'restricted'),
    ]);
    pack.documentName = 'Item';
    setPacks([pack]);

    const rows = await findCompendiumItems({ type: 'weapon', availabilities: ['standard', 'limited'] });

    expect(rows.map(r => r.name).sort()).toEqual(['Limited Gun', 'Standard Gun']);
  });

  test("applies a caller's own predicate for anything the coarse filters can't express", async () => {
    const pack = makePack('essence20.a', [
      entry('One Hander', 'weapon', 'standard', { system: { availability: 'standard', numHands: 1 } }),
      entry('Two Hander', 'weapon', 'standard', { system: { availability: 'standard', numHands: 2 } }),
    ]);
    pack.documentName = 'Item';
    setPacks([pack]);

    const rows = await findCompendiumItems({
      type: 'weapon',
      fields: ['system.numHands'],
      matches: e => e.system?.numHands == 2,
    });

    expect(rows.map(r => r.name)).toEqual(['Two Hander']);
  });

  test("sorts by name across packs", async () => {
    const a = makePack('essence20.a', [entry('Zeta', 'weapon', 'standard')]);
    const b = makePack('essence20.b', [entry('Alpha', 'weapon', 'standard')]);
    a.documentName = 'Item';
    b.documentName = 'Item';
    setPacks([a, b]);

    const rows = await findCompendiumItems({ type: 'weapon' });

    expect(rows.map(r => r.name)).toEqual(['Alpha', 'Zeta']);
  });

  // A book the GM switched off must not be a source a Perk can hand items out of.
  test("skips a pack the GM has disabled", async () => {
    const a = makePack('essence20.a', [entry('Hidden', 'weapon', 'standard')]);
    const b = makePack('essence20.b', [entry('Visible', 'weapon', 'standard')]);
    a.documentName = 'Item';
    b.documentName = 'Item';
    setPacks([a, b], { 'essence20.a': false });

    const rows = await findCompendiumItems({ type: 'weapon' });

    expect(rows.map(r => r.name)).toEqual(['Visible']);
  });
});

describe("pickCompendiumItem", () => {
  const wait = jest.fn();

  beforeEach(() => {
    wait.mockReset();
    global.foundry = { applications: { api: { DialogV2: { wait } } }, utils: {} };
    global.game = { i18n: { localize: key => key } };
  });

  afterEach(() => {
    global.foundry = undefined;
    global.game = undefined;
  });

  // Nothing matching usually means a disabled sourcebook - the caller should be able to say so
  // rather than have a picker silently choose for the player.
  test("returns null without opening a dialog when nothing matched", async () => {
    expect(await pickCompendiumItem([], { title: 't', label: 'l' })).toBe(null);
    expect(await pickCompendiumItem(undefined, { title: 't', label: 'l' })).toBe(null);
    expect(wait).not.toHaveBeenCalled();
  });

  test("returns the chosen uuid", async () => {
    wait.mockResolvedValue('Compendium.Blade');

    const rows = [{ uuid: 'Compendium.Blade', name: 'Blade' }];
    expect(await pickCompendiumItem(rows, { title: 't', label: 'l' })).toBe('Compendium.Blade');
  });

  test("returns null on cancel", async () => {
    wait.mockResolvedValue('cancel');

    const rows = [{ uuid: 'Compendium.Blade', name: 'Blade' }];
    expect(await pickCompendiumItem(rows, { title: 't', label: 'l' })).toBe(null);
  });
});
