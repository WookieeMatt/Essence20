import { jest } from '@jest/globals';
import { Q1, Q1_UPGRADE, handleQ1Relay, itemsFrom } from './common.mjs';
import {
  effectiveAvailability, isQualifiedUpgrade, onKitPrerequisite, onRequisitionAccess, onRequisitionAvailability, perkAccess,
  isBiomechanicalArmor, isBiomechanicalVehicle, qualificationApplyDialog, qualificationSources, vehicleQualifier,
} from './qualification.mjs';
import { dangerSenseDerived, lastChanceHolderFor, planPoolSize, withInitiativeRerolls } from './rerolls.mjs';
import { burningOf, igniteHitRider } from './ignite.mjs';
import {
  combatThreatSummary, domeDerived, effectiveThreatLevel, endingThisTurn, isSaveRoll, nobilityPenalty, onAddictPreUpdate, onPartyPreUpdate,
  tenacitySources,
} from './misc.mjs';
import { registrySnapshot } from '../../extensions.mjs';
import './index.mjs';

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
    expect(registry.uses.map(use => use.id)).toEqual(expect.arrayContaining(['q1Qualify', 'q1BestLaidPlans', 'q1DomeGenerator', 'q1Addiction']));
    expect(Object.keys(registry.chatButtons)).toEqual(expect.arrayContaining(['q1PlansReroll', 'q1LastChance', 'q1FightFire', 'q1DropAndRoll', 'q1TenacityEnd']));
  });
});

describe('common', () => {
  test('itemsFrom matches full uuid or bare id', () => {
    const actor = makeActor([perk(Q1.tradeGoods), { type: 'upgrade', flags: { core: { sourceId: `Compendium.essence20.tf_crb.Item.${Q1_UPGRADE.organicArmor}` } } }]);
    expect(itemsFrom(actor, Q1.tradeGoods)).toHaveLength(1);
    expect(itemsFrom(actor, Q1_UPGRADE.organicArmor)).toHaveLength(1);
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

  test('chosen item qualifies (Trade Goods) or trains (Service)', () => {
    const chosen = [{ uuid: 'Compendium.essence20.x.Item.gun', name: 'Sniper Rifle' }];
    const actor = makeActor([perk(Q1.tradeGoods, { flags: { q1Chosen: chosen } })]);
    const rifle = { ...weapon('restricted', { name: 'Sniper Rifle' }), uuid: 'Compendium.essence20.x.Item.gun' };
    expect(perkAccess(actor, rifle)).toBe('qualified');
    const trained = makeActor([perk(Q1.service, { flags: { q1Chosen: chosen } })]);
    expect(perkAccess(trained, rifle)).toBe('trained');
  });

  test('no qualified upgrade: the requisition availability is the combined total', () => {
    const gun = weapon('standard', { total: 'limited', items: { a: { type: 'upgrade', uuid: 'Compendium.essence20.gi_joe_crb.Item.zzzzzzzzzzzzzzzz', availability: 'limited' } } });
    expect(isQualifiedUpgrade(makeActor(), { uuid: gun.system.items.a.uuid })).toBe(false);
    expect(effectiveAvailability(makeActor(), gun)).toBe('limited');
    const out = { availability: 'limited' };
    onRequisitionAvailability(makeActor(), gun, out);
    expect(out.availability).toBe('limited');
  });

  test('requisition access only widens', () => {
    const chosen = [{ uuid: 'Compendium.essence20.x.Item.gun', name: 'Gun' }];
    const actor = makeActor([perk(Q1.tradeGoods, { flags: { q1Chosen: chosen } })]);
    const out = { access: 'unknown' };
    onRequisitionAccess(actor, weapon('limited'), out);
    expect(out.access).toBe('qualified');
    const none = { access: 'qualified' };
    onRequisitionAccess(makeActor(), weapon('standard'), none);
    expect(none.access).toBe('qualified');
  });

  test('Good To Go lowers kit prerequisites one rank', () => {
    const out = { need: 'd6' };
    onKitPrerequisite(makeActor([perk(Q1.goodToGo)]), {}, out);
    expect(out.need).toBe(CONFIG.E20.skillShiftList[CONFIG.E20.skillShiftList.indexOf('d6') + 1]);
    const untouched = { need: 'd6' };
    onKitPrerequisite(makeActor(), {}, untouched);
    expect(untouched.need).toBe('d6');
  });

  test('vehicle qualifications by size, passengers and paint', () => {
    const land = size => ({ name: 'Truck', system: { size, movement: { ground: { base: 30 } }, crew: { numPassengers: 0 }, traits: {} } });
    expect(vehicleQualifier(makeActor([perk(Q1.megaTrainingRegimen)]), land('huge'))).toBe(Q1.megaTrainingRegimen);
    expect(vehicleQualifier(makeActor([perk(Q1.megaTrainingRegimen)]), land('large'))).toBeNull();
    expect(vehicleQualifier(makeActor([perk(Q1.sparedNoExpense)]), land('long'))).toBe(Q1.sparedNoExpense);
    expect(vehicleQualifier(makeActor([perk(Q1.surgicalOperators)]), { system: { crew: { numPassengers: 2 } } })).toBe(Q1.surgicalOperators);
    expect(vehicleQualifier(makeActor([perk(Q1.ultraSecretStrikeForce)]), { name: 'Python Conquest', system: {} })).toBe(Q1.ultraSecretStrikeForce);
  });

  test('driving sources and untrained snag lift', () => {
    const vehicle = { name: 'Truck', system: { size: 'huge', movement: { ground: { base: 30 } } } };
    const actor = makeActor([perk(Q1.megaTrainingRegimen, { name: 'Mega' })], { system: { skills: { driving: { shift: 'd4' } } } });
    actor._dice = { _getPilotedVehicle: () => vehicle };
    expect(qualificationSources(actor, null, { rolledSkill: 'driving' }).sources[0]).toMatchObject({ shiftUp: 1 });
    const untrained = makeActor([perk(Q1.megaTrainingRegimen)], { system: { skills: { driving: { shift: 'd20' } } } });
    untrained._dice = actor._dice;
    const options = { snag: true };
    qualificationApplyDialog(untrained, options, { rolledSkill: 'driving' });
    expect(options.snag).toBe(false);
  });

  test('Cobra-La snag on non-biomechanical weapons', () => {
    const actor = makeActor([perk(Q1.gloryOfCobraLa), perk(Q1.megaTrainingRegimen), { id: 'w1', type: 'weapon', name: 'Rifle', system: {} }]);
    const effect = { type: 'weaponEffect', parent: actor, flags: { essence20: { parentId: 'w1' } } };
    const sources = qualificationSources(actor, null, { isAttack: true, item: effect }).sources.map(s => s.id);
    expect(sources).toEqual(['q1CobraLaWeapon']);
  });
});

describe('The Glory of Cobra-La (Ferocious Fighters p.73)', () => {
  test('battledress without Organic Armor gives a Snag on every Skill Test while worn', () => {
    const vest = { id: 'v1', type: 'armor', name: 'Protective Vest', system: { equipped: true } };
    const actor = makeActor([perk(Q1.gloryOfCobraLa), vest]);
    expect(qualificationSources(actor, null, { rolledSkill: 'alertness' }).sources.map(s => s.id)).toContain('q1CobraLaArmor');

    const organic = { type: 'upgrade', name: 'Organic Armor', flags: { core: { sourceId: `Compendium.essence20.gi_joe_crb.Item.${Q1_UPGRADE.organicArmor}` }, essence20: { parentId: 'v1' } } };
    const covered = makeActor([perk(Q1.gloryOfCobraLa), { ...vest }, organic]);
    expect(isBiomechanicalArmor(covered.items.get('v1'))).toBe(true);
    expect(qualificationSources(covered, null, { rolledSkill: 'alertness' }).sources.map(s => s.id)).not.toContain('q1CobraLaArmor');

    const unworn = makeActor([perk(Q1.gloryOfCobraLa), { ...vest, system: { equipped: false } }]);
    expect(qualificationSources(unworn, null, { rolledSkill: 'alertness' }).sources.map(s => s.id)).not.toContain('q1CobraLaArmor');
  });

  test('Biomechanical vehicles are a Qualification', () => {
    const actor = makeActor([perk(Q1.gloryOfCobraLa)]);
    const bio = { name: 'Insectoid Flyer', system: { traits: { biomechanical: true } } };
    const truck = { name: 'Supply Truck', system: { traits: {} } };
    expect(isBiomechanicalVehicle(bio)).toBe(true);
    expect(isBiomechanicalVehicle({ name: 'Cobra-La Mount', system: { traits: {} } })).toBe(true);
    expect(vehicleQualifier(actor, bio)).toBe(Q1.gloryOfCobraLa);
    expect(vehicleQualifier(actor, truck)).toBeNull();
  });
});

describe('rerolls', () => {
  test('Danger Sense rerolls 1s and 2s on initiative skill dice', () => {
    expect(withInitiativeRerolls('2d20kl + d6 + 0')).toBe('2d20kl + d6r<=2 + 0');
    expect(withInitiativeRerolls('d20 + {d2,d4,d6}kh + 1')).toBe('d20 + {d2,d4r<=2,d6r<=2}kh + 1');
    const actor = makeActor([perk(Q1.dangerSense)], { system: { initiative: { formula: 'd20 + d8 + 0' } } });
    dangerSenseDerived(actor);
    dangerSenseDerived(actor);
    expect(actor.system.initiative.formula).toBe('d20 + d8r<=2 + 0');
  });

  test('Best-Laid Plans pool size', () => {
    expect(planPoolSize(9)).toBe(0);
    expect(planPoolSize(10)).toBe(1);
    expect(planPoolSize(15)).toBe(2);
    expect(planPoolSize(24)).toBe(3);
  });

  test('One Last Chance holder', () => {
    const holder = makeActor([perk(Q1.oneLastChance)], { id: 'h1' });
    const ally = makeActor([], { id: 'b1' });
    game.actors = { contents: [holder, ally] };
    expect(lastChanceHolderFor(ally, { onScene: new Set(['h1']) })).toBe(holder);
    expect(lastChanceHolderFor(holder, { onScene: new Set(['h1']) })).toBeNull();
    expect(lastChanceHolderFor(ally, { onScene: new Set(['zz']) })).toBeNull();
  });
});

describe('ignite', () => {
  test('a fire hit sets the target alight once', async () => {
    const attacker = makeActor([perk(Q1.ignite, { name: 'Ignite' })]);
    const target = makeActor([], { id: 't1', name: 'Viper' });
    const result = { damageValue: 2 };
    expect(await igniteHitRider(attacker, target, result, { damageType: 'fire' })).toBe(true);
    expect(burningOf(target)).toMatchObject({ by: attacker.uuid });
    expect(await igniteHitRider(attacker, target, result, { damageType: 'fire' })).toBe(false);
    expect(await igniteHitRider(attacker, makeActor(), result, { damageType: 'blunt' })).toBe(false);
  });
});

describe('misc', () => {
  test('Tenacity edge on saves', () => {
    const actor = makeActor([perk(Q1.tenacity)]);
    expect(isSaveRoll({ riderSpec: JSON.stringify({ kind: 'save' }) })).toBe(true);
    expect(tenacitySources(actor, null, { dataset: { riderSpec: '{"kind":"save"}' } }).sources[0].edge).toBe(true);
    expect(tenacitySources(actor, null, { dataset: {} }).sources).toEqual([]);
  });

  test('Tenacity finds what ends this turn', () => {
    const combat = { id: 'c', round: 3, turn: 1 };
    const actor = makeActor([], { flags: { riderMarks: [{ combatId: 'c', untilRound: 3, untilTurn: 1, by: 'Actor.x', kind: 'k' }] } });
    expect(endingThisTurn(actor, combat).marks).toHaveLength(1);
    expect(endingThisTurn(actor, null).marks).toHaveLength(0);
  });

  test('Dome Generator doubles the armor bonus', () => {
    const armor = { id: 'arm', type: 'armor', system: { equipped: true, totalBonusToughness: 2, totalBonusEvasion: 0 } };
    const actor = makeActor([armor], { flags: { q1DomeActive: { armorId: 'arm', scene: 1 } }, system: { defenses: { toughness: { total: 14, string: '' }, evasion: { total: 12, string: '' } } } });
    domeDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(16);
    expect(actor.system.defenses.evasion.total).toBe(12);
  });

  test('Nobility trims the session reset', () => {
    const noble = makeActor([perk(Q1.nobility)]);
    expect(nobilityPenalty([noble, makeActor()])).toBe(1);
    const party = { type: 'party', members: [noble, makeActor()] };
    const changes = { system: { storyPoints: 2, gmPoints: 2 } };
    onPartyPreUpdate(party, changes);
    expect(changes.system.storyPoints).toBe(1);
    const spend = { system: { storyPoints: 2 } };
    onPartyPreUpdate(party, spend);
    expect(spend.system.storyPoints).toBe(2);
  });

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
