import { jest } from '@jest/globals';
import { canUseGrant, GRANT, grantKindOf, isGrantUse } from './grant-uses.mjs';
import { endOnFumble, essenceRedirect, grantCopy, imperfectionOf, kitAvailability, runGrant, temporary, thickSkullsShift } from './grants.mjs';

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
    const quake = sourced(GRANT.riotGear);
    quake.parent = actor;
    expect(isGrantUse(quake)).toBe(true);
    expect(grantKindOf(sourced(GRANT.kitbasher))).toBeNull();
    expect(canUseGrant(quake)).toBe(false);
    game.combat = { id: 'c', round: 1, turn: 0 };
    expect(canUseGrant(quake)).toBe(true);

    const once = sourced(GRANT.customGear);
    once.parent = actor;
    expect(canUseGrant(once)).toBe(true);
    once.flags.essence20.granted = true;
    expect(canUseGrant(once)).toBe(false);

    const offense = sourced(GRANT.integratedOffense, { flags: { grantedCount: 5 } });
    offense.parent = actor;
    expect(canUseGrant(offense)).toBe(false);
  });
});

describe("helpers", () => {
  test("kit availability from its name, and temporary stamps", () => {
    expect(kitAvailability('Limited Burglary Kit')).toBe('limited');
    expect(kitAvailability('Medicine Kit')).toBe('standard');
    expect(temporary('scene')).toEqual({ kind: 'scene', scene: 1 });
  });

  test("Essence redirects, Thick Skulls and Imperfections are read off their items", () => {
    const cordial = sourced(GRANT.cordial, { flags: { redirectFrom: 'speed' } });
    const rough = sourced(GRANT.roughAndTakesNoGuff, { flags: { redirectFrom: 'speed' } });
    const skulls = sourced(GRANT.thickSkulls, { flags: { toToughness: 2 } });
    const hint = sourced(GRANT.hintOfIndependence, { flags: { imperfection: { n: 2 } } });
    expect(essenceRedirect(makeActor([cordial]), { name: 'Explorer' }, 'speed')).toBe('social');
    expect(essenceRedirect(makeActor([rough]), { name: 'Officer' }, 'speed')).toBe('strength');
    expect(essenceRedirect(makeActor([rough]), { name: 'Infantry' }, 'speed')).toBe('speed');
    expect(thickSkullsShift(makeActor([skulls]))).toBe(2);
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

describe("Use buttons", () => {
  test("Rough and Takes No Guff switches its redirect on and off", async () => {
    const rough = sourced(GRANT.roughAndTakesNoGuff);
    makeActor([rough]);
    await runGrant(rough, null);
    expect(rough.flags.essence20.redirectFrom).toBe('speed');
    await runGrant(rough, null);
    expect(rough.flags.essence20.redirectFrom).toBeNull();
  });

  test("Thick Skulls records how many increases went to Toughness", async () => {
    const skulls = sourced(GRANT.thickSkulls);
    makeActor([skulls]);
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('2');
    await runGrant(skulls, null);
    expect(skulls.flags.essence20.toToughness).toBe(2);
  });

  test("Monstrous Attack makes a new unarmed attack, once", async () => {
    const monstrous = sourced(GRANT.monstrousAttack, { name: 'Monstrous Attack' });
    const actor = makeActor([monstrous]);
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('sharp');
    await runGrant(monstrous, null);
    const attack = actor.createEmbeddedDocuments.mock.calls[0][1][0];
    expect(attack.type).toBe('weaponEffect');
    expect(attack.system).toEqual(expect.objectContaining({ damageType: 'sharp', damageValue: 2, range: { reachMultiplier: 2 } }));
    expect(monstrous.flags.essence20.granted).toBe(true);
  });

  test("Never Unarmed makes a Silent one-handed weapon for the scene", async () => {
    const perk = sourced(GRANT.neverUnarmed);
    const actor = makeActor([perk]);
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('finesse').mockResolvedValueOnce('blunt');
    await runGrant(perk, null);
    const [weapon] = actor.createEmbeddedDocuments.mock.calls[0][1];
    expect(weapon.system.traits).toEqual(['silent']);
    expect(weapon.flags.essence20.endsOnFumble).toBe(true);
    expect(weapon.flags.essence20.temporary.kind).toBe('scene');
    const [effect] = actor.createEmbeddedDocuments.mock.calls[1][1];
    expect(effect.system.classification.skill).toBe('finesse');
  });

  test("a Torch lights the carrier's token and goes out again", async () => {
    const torch = sourced(GRANT.torch, { type: 'gear' });
    const actor = makeActor([torch]);
    const token = { light: { bright: 0, dim: 0, angle: 360 }, update: jest.fn(async () => {}) };
    actor.getActiveTokens = () => [{ document: token }];
    await runGrant(torch, null);
    expect(token.update).toHaveBeenCalledWith({ 'light.bright': 25, 'light.dim': 50, 'light.angle': 360 });
    await runGrant(torch, null);
    expect(token.update).toHaveBeenLastCalledWith({ 'light.bright': 0, 'light.dim': 0, 'light.angle': 360 });
  });

  test("Cordial remembers the chosen Essence", async () => {
    const cordial = sourced(GRANT.cordial);
    makeActor([cordial]);
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('strength');
    await runGrant(cordial, null);
    expect(cordial.flags.essence20.redirectFrom).toBe('strength');
    expect(cordial.flags.essence20.granted).toBe(true);
  });
});
