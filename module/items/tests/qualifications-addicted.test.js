import { jest } from '@jest/globals';
import { Q1, Q1_UPGRADE, handleQ1Relay, itemsFrom } from '../shared/qualification-gm-relay.mjs';
import {
  effectiveAvailability, isQualifiedUpgrade, onRequisitionAvailability,
} from '../gear/equipment-qualification.mjs';
import {
  combatThreatSummary, effectiveThreatLevel, onAddictPreUpdate,
} from '../resources/addicted-threat-level.mjs';
import { registrySnapshot } from '../../mechanics/item-hooks.mjs';
import '../gear/qualification-setup.mjs';

foundry.utils.flattenObject = (obj, prefix = '') => Object.entries(obj ?? {}).reduce((out, [key, value]) => {
  const path = prefix ? `${prefix}.${key}` : key;
  if (value && typeof value == 'object' && !Array.isArray(value)) {
    Object.assign(out, foundry.utils.flattenObject(value, path));
  } else {
    out[path] = value;
  }

  return out;
}, {});
foundry.utils.setProperty = (obj, path, value) => {
  const parts = path.split('.');
  let target = obj;
  for (const part of parts.slice(0, -1)) {
    target[part] ??= {};
    target = target[part];
  }

  target[parts.at(-1)] = value;
};

foundry.utils.escapeHTML = text => text;

const perk = (source, extra = {}) => ({ type: 'perk', name: extra.name ?? 'Perk', flags: { core: { sourceId: source }, essence20: extra.flags ?? {} } });

function makeActor(items = [], extra = {}) {
  const list = [...items];
  const actor = {
    id: extra.id ?? 'a1', uuid: `Actor.${extra.id ?? 'a1'}`, name: extra.name ?? 'Tester', type: extra.type ?? 'playerCharacter',
    flags: { essence20: { ...(extra.flags ?? {}) } },
    system: { skills: {}, defenses: {}, ...(extra.system ?? {}) },
    items: Object.assign(list, { contents: list, get: id => list.find(i => i.id == id) }),
    effects: Object.assign([...(extra.effects ?? [])], {}),
    setFlag: jest.fn(async (scope, key, value) => {
      actor.flags[scope] ??= {};
      actor.flags[scope][key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete actor.flags[scope][key];
    }),
    isOwner: true,
  };
  for (const item of list) {
    item.parent = actor;
  }

  return actor;
}

beforeEach(() => {
  game.combat = null;
  game.user = { isGM: true, isActiveGM: true, targets: new Set() };
  game.users = { activeGM: { id: 'gm' } };
  game.actors = { contents: [], party: null };
  global.canvas = undefined;
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: jest.fn(() => ({})) };
  CONFIG.E20.upgradeAvailabilityMatrix ??= {};
});

describe('registration', () => {
  test('registers uses, sources and decorators', () => {
    const registry = registrySnapshot();
    expect(registry.uses.map(use => use.id)).toEqual(expect.arrayContaining(['q1Qualify', 'q1Addiction']));
    // Ignite (and Fireball's Edge for its fire) is rules on the Perk now (rules/conv10-slC10.test.js).
    expect(Object.keys(registry.chatButtons)).not.toContain('q1FightFire');
  });
});

describe('common', () => {
  test('itemsFrom matches full uuid or bare id', () => {
    const actor = makeActor([perk(Q1.ninpoJoes), { type: 'upgrade', flags: { core: { sourceId: `Compendium.essence20.tf_crb.Item.${Q1_UPGRADE.silencer}` } } }]);
    expect(itemsFrom(actor, Q1.ninpoJoes)).toHaveLength(1);
    expect(itemsFrom(actor, Q1_UPGRADE.silencer)).toHaveLength(1);
    expect(itemsFrom(actor, null)).toEqual([]);
  });

  test('relay only writes q1 flags as the active GM', async () => {
    const actor = makeActor();
    global.fromUuid = jest.fn(async () => actor);
    expect(await handleQ1Relay({ action: 'q1Relay', uuid: 'x', key: 'q1Test', value: 3 })).toBe(true);
    expect(actor.flags.essence20.q1Test).toBe(3);
    expect(await handleQ1Relay({ action: 'q1Relay', uuid: 'x', key: 'riderMarks', value: 3 })).toBe(false);
  });
});

describe('qualification', () => {
  const weapon = (availability, extra = {}) => ({ type: 'weapon', name: extra.name ?? 'Gun', system: { availability, totalAvailability: extra.total ?? availability, traits: extra.traits ?? [], items: extra.items ?? {} }, flags: {} });

  test('no qualified upgrade: the requisition availability is the combined total', () => {
    const gun = weapon('standard', { total: 'limited', items: { a: { type: 'upgrade', uuid: 'Compendium.essence20.gi_joe_crb.Item.zzzzzzzzzzzzzzzz', availability: 'limited' } } });
    expect(isQualifiedUpgrade(makeActor(), { uuid: gun.system.items.a.uuid })).toBe(false);
    expect(effectiveAvailability(makeActor(), gun)).toBe('limited');
    const out = { availability: 'limited' };
    onRequisitionAvailability(makeActor(), gun, out);
    expect(out.availability).toBe('limited');
  });
});

describe('misc', () => {
  test('Addiction doubles Energon spending while craving', () => {
    const actor = makeActor([perk(Q1.addictedDarkEnergon)], { flags: { q1Addiction: { craving: true } }, system: { energon: { normal: { value: 5 } } } });
    const changes = { system: { energon: { normal: { value: 4 } } } };
    onAddictPreUpdate(actor, changes);
    expect(changes.system.energon.normal.value).toBe(3);
    actor.flags.essence20.q1Addiction.craving = false;
    const calm = { system: { energon: { normal: { value: 4 } } } };
    onAddictPreUpdate(actor, calm);
    expect(calm.system.energon.normal.value).toBe(4);
  });

  test('effective threat level', () => {
    expect(effectiveThreatLevel([3, 3, 3, 5], 4)).toBe(10);
    expect(effectiveThreatLevel([2, 2], 4)).toBe(3);
    expect(effectiveThreatLevel([0, 0, 0, 0, 0], 5)).toBe(1);
    expect(effectiveThreatLevel(Array(10).fill(0), 5)).toBe(2);
    expect(effectiveThreatLevel([], 5)).toBe(0);
    const combat = { combatants: { contents: [
      { actor: { type: 'playerCharacter', system: { level: 4 } } },
      { actor: { type: 'npc', system: { threatLevel: 5 } } },
    ] } };
    expect(combatThreatSummary(combat)).toMatchObject({ tl: 5, players: 1, partyLevel: 4, appropriate: 1 });
  });
});
