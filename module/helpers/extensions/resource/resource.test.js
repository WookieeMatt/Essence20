import { jest } from '@jest/globals';
import { registrySnapshot } from '../../extensions.mjs';
import { IDS, changed, has, isItem, setChanged, teamOf } from './common.mjs';
import { ENERGON_CAP_EXTRAS, grantTemp, revokeTemp, revokeUpdate, tempGrants } from './temp-resources.mjs';
import { afterTurnEnd, personalStoryPoints, spendPersonalStoryPoint } from './personal-points.mjs';
import { toWealthTest } from './wealth.mjs';
import { budgetLeft, upgradeCost } from './motor-pool.mjs';
import { bodyOfEnergySplit, bodyOfEnergyUnmorph, innerConservationRefund } from './power-spend.mjs';
import {
  addictionDie, applyDarkEnergonDefenses, isRestUpdate, pointsPerDose, repairBonusHeld, strainOf, strainSources, synthEnPayer,
} from './energon.mjs';
import { beastModePackages } from './beast-mode.mjs';
import { anomalyBand, smallerDie, weImproviseForfeit } from './story-spend.mjs';
import {
  camperFit, canResearch, cupsLeft, essenceDamage, healStress, honestCompassionMax, pastriesLeft, spellsToShare,
} from './mlp.mjs';
import './index.mjs';

function flagged(obj) {
  obj.flags ??= {};
  obj.flags.essence20 ??= {};
  obj.getFlag = (scope, key) => obj.flags?.[scope]?.[key];
  obj.setFlag = jest.fn(async (scope, key, value) => {
    obj.flags[scope][key] = value;
  });
  obj.unsetFlag = jest.fn(async (scope, key) => {
    delete obj.flags[scope][key];
  });
  obj.update = jest.fn(async (changes) => {
    for (const [key, value] of Object.entries(changes)) {
      const parts = key.split('.');
      let target = obj;
      for (const part of parts.slice(0, -1)) {
        target[part] ??= {};
        target = target[part];
      }

      target[parts.at(-1)] = value;
    }
  });
  obj.isOwner = true;
  return obj;
}

const item = (uuid, extra = {}) => flagged({ id: extra.id ?? uuid, type: extra.type ?? 'perk', name: extra.name ?? 'Item', flags: { core: { sourceId: uuid }, essence20: extra.flags ?? {} }, system: extra.system ?? {} });

function actor(items = [], system = {}, extra = {}) {
  return flagged({ id: extra.id ?? 'a1', uuid: extra.uuid ?? 'Actor.a1', name: 'Tester', type: 'playerCharacter', items, system, flags: { essence20: {} } });
}

beforeEach(() => {
  global.game.users = { activeGM: null };
  global.game.user = { id: 'u1', isGM: true };
  global.game.i18n = { localize: k => k, format: k => k };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
});

describe('common', () => {
  test('item identity never matches an empty uuid', () => {
    expect(isItem({ flags: {} }, '')).toBe(false);
    expect(isItem(item(IDS.camper), IDS.camper)).toBe(true);
    expect(has(actor([item(IDS.camper)]), IDS.camper)).toBe(true);
    expect(has(actor([]), undefined)).toBe(false);
  });

  test('changed reads flat and nested diffs; setChanged writes back', () => {
    expect(changed({ system: { powers: { personal: { value: 3 } } } }, 'system.powers.personal.value')).toBe(3);
    expect(changed({ 'system.x': 1 }, 'system.x')).toBe(1);
    expect(changed({ system: {} }, 'system.x')).toBeUndefined();
    const diff = { system: { a: 1 } };
    setChanged(diff, 'system.a', 2);
    expect(diff.system.a).toBe(2);
    const flat = { 'system.a': 1 };
    setChanged(flat, 'system.a', 5);
    expect(flat['system.a']).toBe(5);
  });

  test('teamOf includes party-mates', () => {
    const a = actor([], {}, { uuid: 'Actor.a' });
    const b = actor([], {}, { uuid: 'Actor.b' });
    const party = { type: 'party', system: { actors: { x: { uuid: 'Actor.a' }, y: { uuid: 'Actor.b' } } }, members: [a, b] };
    global.game.actors = [a, b, party];
    expect(teamOf(a).map(m => m.uuid)).toEqual(['Actor.a', 'Actor.b']);
    global.game.actors = undefined;
  });
});

describe('temporary resources', () => {
  test('revoking temp Health takes it off the maximum and clamps the value', () => {
    const update = revokeUpdate({ health: { bonus: 1, max: 11, value: 9 } }, [{ kind: 'health', amount: 1 }]);
    expect(update).toEqual({ 'system.health.bonus': 0, 'system.health.value': 9 });
    const full = revokeUpdate({ health: { bonus: 1, max: 11, value: 11 } }, [{ kind: 'health', amount: 1 }]);
    expect(full['system.health.value']).toBe(10);
  });

  test('revoking temp Energon keeps allowed extra over the maximum', () => {
    const update = revokeUpdate({ energon: { normal: { max: 4, value: 7 } } }, [{ kind: 'energon', amount: 2 }], 1);
    expect(update['system.energon.normal.value']).toBe(5);
  });

  test('grant and revoke round trip', async () => {
    const a = actor([], { health: { bonus: 0, max: 10, value: 10 } });
    await grantTemp(a, { kind: 'health', amount: 2, source: 'test', untilDamage: true });
    expect(a.system.health.bonus).toBe(2);
    expect(tempGrants(a)).toHaveLength(1);
    a.system.health.max = 12;
    expect(await revokeTemp(a, g => g.untilDamage)).toBe(1);
    expect(a.system.health.bonus).toBe(0);
    expect(tempGrants(a)).toHaveLength(0);
  });

  test('the Repair Progress bonus point counts as allowed extra', () => {
    expect(ENERGON_CAP_EXTRAS).toContain(repairBonusHeld);
    expect(repairBonusHeld(actor([item(IDS.repairProgressEnergon)]))).toBe(1);
    expect(repairBonusHeld(actor([item(IDS.repairProgressEnergon, { flags: { repairBonusSpent: true } })]))).toBe(0);
  });
});

describe('Ruthless Points', () => {
  test('points expire after their turn ends', () => {
    const { kept, expired } = afterTurnEnd([{ id: 'a', turnEndsLeft: 2 }, { id: 'b', turnEndsLeft: 1 }]);
    expect(kept.map(p => p.id)).toEqual(['a']);
    expect(expired.map(p => p.id)).toEqual(['b']);
  });

  test('spending a shared point removes it from both holders', async () => {
    const a = actor([], {}, { uuid: 'Actor.a' });
    const b = actor([], {}, { uuid: 'Actor.b', id: 'b' });
    a.flags.essence20.personalPoints = [{ id: '1', shareId: 's', turnEndsLeft: 1 }];
    b.flags.essence20.personalPoints = [{ id: '2', shareId: 's', turnEndsLeft: 1 }];
    global.game.actors = [a, b];
    expect(personalStoryPoints(a)).toBe(1);
    expect(await spendPersonalStoryPoint(a, 1, false)).toBe(true);
    expect(personalStoryPoints(a)).toBe(0);
    expect(personalStoryPoints(b)).toBe(0);
    expect(await spendPersonalStoryPoint(a, 1, false)).toBe(false);
    global.game.actors = undefined;
  });
});

describe('Wealth Tests', () => {
  test('a Requisition roll becomes a Wealth Test with the Wealth skill shifts', () => {
    const dataset = toWealthTest({ skill: 'targeting', essence: 'speed', shiftUp: 1, shiftDown: 0 }, { shiftUp: 0, shiftDown: 1 });
    expect(dataset).toMatchObject({ skill: 'wealth', shiftUp: 1, shiftDown: 1, requisitionSkill: 'targeting' });
    expect(dataset.essence).toBeUndefined();
  });
});

describe('Motor Pool Connections', () => {
  test('upgrade costs follow the availability table', () => {
    expect(upgradeCost('standard')).toBe(1);
    expect(upgradeCost('limited')).toBe(2);
    expect(upgradeCost('restricted')).toBe(5);
    expect(budgetLeft(actor(), { id: 'v' })).toBe(3);
  });
});

describe('Personal Power', () => {
  test('Body of Energy keeps Health at 1 until the pool is gone', () => {
    expect(bodyOfEnergySplit(3, 4, 5)).toEqual({ health: 1, power: 1 });
    expect(bodyOfEnergySplit(3, 1, 5)).toEqual({ health: 0, power: 0 });
    expect(bodyOfEnergyUnmorph(3, 6, 10, 4)).toEqual({ health: 4, power: 4 });
  });

  test('Inner Conservation pays half, rounded up', () => {
    expect(innerConservationRefund(3)).toBe(1);
    expect(innerConservationRefund(4)).toBe(2);
  });
});

describe('Energon strains', () => {
  test('Dark Energon raises Toughness and Evasion while held', () => {
    const system = { energon: { dark: { value: 1 } }, defenses: { toughness: { total: 12, string: '12' }, evasion: { total: 10 } } };
    applyDarkEnergonDefenses(system);
    expect(system.defenses.toughness.total).toBe(13);
    expect(system.defenses.evasion.total).toBe(11);
  });

  test('strain roll sources', () => {
    const a = actor([], { energon: { dark: { value: 1 } } });
    expect(strainSources(a, { rolledEssence: 'strength' }, {}).map(s => s.id)).toEqual(['darkEnergon']);
    expect(strainSources(a, { rolledEssence: 'smarts', rolledSkill: 'alertness' }, { primalActive: true }).map(s => s.id)).toEqual(['primalEnergon']);
    expect(strainSources(a, { rolledEssence: 'social', rolledSkill: 'persuasion' }, { primalActive: true })[0].shiftDown).toBe(1);
  });

  test('stable Synth-En surcharge, doses and the addiction ladder', () => {
    expect(synthEnPayer(2, 3)).toBe('synth');
    expect(synthEnPayer(3, 3)).toBe('normal');
    expect(synthEnPayer(5, 0)).toBe('fail');
    expect(pointsPerDose('primal')).toBe(2);
    expect(pointsPerDose('red')).toBe(1);
    expect(addictionDie(0)).toBe('d6');
    expect(addictionDie(6)).toBe('auto');
    expect(strainOf(item(IDS.redEnergon))).toBe('red');
    expect(isRestUpdate({ system: { energon: { dark: { value: 0 }, red: { value: 0 }, normal: { value: 2 } } } })).toBe(true);
  });
});

describe('Beast Mode', () => {
  test('packages widen at 10th and 20th level', () => {
    expect(beastModePackages(1)).toHaveLength(1);
    expect(beastModePackages(10).map(([k]) => k)).toEqual(['engrafted1', 'engrafted2', 'evolving1']);
    expect(beastModePackages(20)).toHaveLength(6);
  });
});

describe('Story Point riders', () => {
  test('We Improvise forfeits the unspent grants', () => {
    expect(weImproviseForfeit({ granted: 2, spent: 1 }, 5)).toBe(1);
    expect(weImproviseForfeit({ granted: 2, spent: 3 }, 5)).toBe(0);
    expect(weImproviseForfeit({ granted: 3, spent: 0 }, 1)).toBe(1);
  });

  test('History Buff rolls one die smaller', () => {
    expect(smallerDie('1d8')).toBe('1d6');
    expect(smallerDie('1d2')).toBe('1d2');
    expect(smallerDie('2d8')).toBe('1d12');
    expect(anomalyBand(1)).toBe('none');
    expect(anomalyBand(7)).toBe('lasting');
    expect(anomalyBand(16)).toBe('cataclysmic');
  });
});

describe('My Little Pony', () => {
  test('Stress healing heals Health', async () => {
    const a = actor([], { health: { max: 5, value: 3 }, essences: { smarts: { max: 3, value: 1 } } });
    expect(essenceDamage(a)).toBe(2);
    expect(await healStress(a, 1, 'health')).toBe(1);
    expect(a.system.health.value).toBe(4);
  });

  test('Honest Compassion, Camper, jam and research gates', () => {
    expect(honestCompassionMax(3)).toBe(1);
    expect(honestCompassionMax(11)).toBe(3);
    expect(camperFit(actor([], { health: { max: 6, value: 3 } }))).toBe(true);
    expect(camperFit(actor([], { health: { max: 6, value: 2 } }))).toBe(false);
    expect(cupsLeft({ system: { quantity: 1 }, flags: {} })).toBe(3);
    expect(pastriesLeft({ flags: { essence20: { zapPastries: 4 } } })).toBe(4);
    expect(canResearch('d8', 'superior')).toBe(true);
    expect(canResearch('d6', 'superior')).toBe(false);
  });

  test('the Circle shares spells members lack', () => {
    const spell = (name) => ({ type: 'spell', name, flags: { core: { sourceId: `S.${name}` } } });
    const a = actor([spell('Beam')], {}, { uuid: 'A' });
    const b = actor([spell('Shield')], {}, { uuid: 'B' });
    const out = spellsToShare([a, b]);
    expect(out[0].spells.map(s => s.name)).toEqual(['Shield']);
    expect(out[1].spells.map(s => s.name)).toEqual(['Beam']);
  });
});

describe('registration', () => {
  test('Use buttons match their items', () => {
    const uses = registrySnapshot().uses;
    const find = uuid => uses.find(use => use.matches(item(uuid)));
    for (const uuid of [IDS.playFavorites, IDS.motorPool, IDS.bodyOfEnergy, IDS.darkEnergon, IDS.historyBuff,
      IDS.honestCompassion, IDS.camper, IDS.zapAppleJam, IDS.circleOfMagicalFriends, IDS.extensiveResearch]) {
      expect(find(uuid)).toBeTruthy();
    }
  });
});
