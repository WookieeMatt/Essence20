import { jest } from '@jest/globals';
import { canUseGrant, grantKindOf } from './grant-uses.mjs';
import { endOnFumble, grantCopy, imperfectionOf, kitAvailability, temporary } from './grants.mjs';

function flagged(obj) {
  obj.flags ??= {};
  obj.flags.essence20 ??= {};
  obj.getFlag = (scope, key) => obj.flags?.[scope]?.[key];
  obj.setFlag = jest.fn(async (scope, key, value) => {
    obj.flags[scope] ??= {};
    obj.flags[scope][key] = value;
  });
  obj.unsetFlag = jest.fn(async (scope, key) => {
    delete obj.flags?.[scope]?.[key];
  });
  return obj;
}

const sourced = (uuid, extra = {}) => flagged({
  id: extra.id ?? uuid.split('.').pop(), name: extra.name ?? 'Item', type: extra.type ?? 'perk', img: '',
  flags: { core: { sourceId: uuid }, essence20: { ...(extra.flags ?? {}) } },
  system: extra.system ?? {},
});

function makeActor(items = [], system = {}) {
  const list = [...items];
  const created = [];
  const actor = flagged({
    id: 'a1', uuid: 'Actor.a1', name: 'Tester', type: 'playerCharacter',
    system: { level: 10, essences: { smarts: { max: 3 } }, powers: { personal: { value: 2, max: 3 } }, ...system },
    items: Object.assign(list, { contents: list, get: id => list.find(i => i.id == id) }),
    effects: [],
    update: jest.fn(async () => {}),
    createEmbeddedDocuments: jest.fn(async (type, data) => data.map((d, i) => {
      const item = flagged({ ...d, id: `new${created.length + i}`, flags: d.flags ?? {}, system: d.system ?? {} });
      item.update = jest.fn(async () => {});
      created.push(item);
      list.push(item);
      return item;
    })),
    updateEmbeddedDocuments: jest.fn(async () => {}),
    deleteEmbeddedDocuments: jest.fn(async (type, ids) => {
      for (const id of ids) {
        const i = list.findIndex(x => x.id == id);
        if (i >= 0) list.splice(i, 1);
      }
    }),
    getActiveTokens: () => [],
    toggleStatusEffect: jest.fn(async () => {}),
  });
  for (const i of list) {
    i.parent = actor;
  }

  return actor;
}

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, settings: { get: () => 1 }, combat: null, user: { targets: new Set() } };
  global.CONFIG = { E20: { essences: { social: 'S', speed: 'Sp', strength: 'St', smarts: 'Sm' }, availabilityDifficulties: { standard: 0, limited: 10 } } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: jest.fn(() => ({})) };
  global.fromUuid = jest.fn(async () => null);
  foundry.applications.api.DialogV2 = { wait: jest.fn(async () => null), confirm: jest.fn(async () => false) };
  foundry.utils.escapeHTML ??= t => t;
  foundry.utils.setProperty ??= (obj, path, value) => {
    const parts = path.split('.');
    let o = obj;
    for (const part of parts.slice(0, -1)) {
      o[part] ??= {};
      o = o[part];
    }

    o[parts.at(-1)] = value;
  };
});

describe("the Use table", () => {
  test("which items have a Use button, and when", () => {
    const actor = makeActor();
    expect(grantKindOf(sourced('Compendium.essence20.gi_joe_crb.Item.az09yEPydnE1tBTj'))).toBeNull();

    // (A Hint of Independence's and Personal Power Supply's Uses are rules on the Perks now - rules/conv16-b.test.js,
    // rules/conv17-split3.test.js.)
    const supply = sourced('Compendium.essence20.field_guide_action_adventure.Item.Uy3t5KLbeGHv08ho');
    supply.parent = actor;
    expect(grantKindOf(supply)).toBeNull();
    expect(canUseGrant(supply)).toBe(false);
  });
});

describe("helpers", () => {
  test("kit availability from its name, and temporary stamps", () => {
    expect(kitAvailability('Limited Burglary Kit')).toBe('limited');
    expect(kitAvailability('Medicine Kit')).toBe('standard');
    expect(temporary('scene')).toEqual({ kind: 'scene', scene: 1 });
  });

  test("Imperfections are read off the item that keeps one", () => {
    const hint = sourced('Compendium.essence20.decepticon_directive.Item.TkzfZUNiGvv5iWDh', { flags: { imperfection: { n: 2 } } });
    expect(imperfectionOf(makeActor([hint]))).toEqual({ n: 2 });
  });

  test("a copy carries who granted it and how long it lasts", async () => {
    const actor = makeActor();
    const source = { toObject: () => ({ _id: 'x', name: 'Knife', type: 'weapon', system: { traits: [], classification: { size: 'light' } } }) };
    fromUuid.mockResolvedValue(source);
    const grantor = { id: 'g1' };
    const created = await grantCopy(actor, 'Compendium.essence20.gi_joe_crb.Item.x', { grantedBy: grantor, temporary: { kind: 'scene' }, integrated: true });
    expect(created.flags.essence20.grantedBy).toBe('g1');
    expect(created.flags.essence20.temporary).toEqual({ kind: 'scene' });
    // Integrated is a weapon size, not a trait (a trait made the weapon fail validation).
    expect(created.system.traits).toEqual([]);
    expect(created.system.classification.size).toBe('integrated');
    expect(created.flags.core.sourceId).toBe('Compendium.essence20.gi_joe_crb.Item.x');
  });

  test("a makeshift weapon falls apart on a Fumble", async () => {
    const weapon = flagged({ id: 'w', name: 'Chair', type: 'weapon', flags: { essence20: { endsOnFumble: true } } });
    const actor = makeActor([weapon]);
    await endOnFumble(actor, weapon, { outcomes: [{ isFumble: false }] });
    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
    await endOnFumble(actor, weapon, { outcomes: [{ isFumble: true }] });
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['w']);
  });
});
