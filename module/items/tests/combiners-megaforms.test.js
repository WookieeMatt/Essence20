import { jest } from '@jest/globals';
import { finishParticipantHealth } from '../../mechanics/vehicles/megaform-bonus-health.mjs';
import { ZORD2, megaformsContaining } from '../zords/combiner-roster-helpers.mjs';
import { desiredAttacks, scaledEffect, strongest, countGeneratedUse, perSceneExhausted } from '../zords/megaform-attacks.mjs';
import {
  applyFocus, beginGuestMerge, coreBodyDerived, focusToggles, heldUntil, holdsMergePerk, mergeCost, mergeReach, modeLocked, storyPointCost, tokenGap,
} from '../zords/combiner-merge.mjs';
import { ineligibleZords } from '../zords/zord-feature-picks.mjs';
import { spectrumOf } from '../../rules/plugins/zords/zord-owner-spectrum.mjs';
import { roughRegionsAt } from '../../rules/plugins/combat/clear-rough-terrain.mjs';
import { zord2WeaponUnusable } from '../attacks/shield-mode-unusable-weapons.mjs';
import { registrySnapshot } from '../../mechanics/item-hooks.mjs';

let n = 0;
const item = (type, extra = {}) => ({
  id: extra.id ?? `i${++n}`, name: extra.name ?? type, type, system: extra.system ?? {},
  flags: { core: { sourceId: extra.source ?? null }, essence20: extra.flags ?? {} }, effects: extra.effects ?? [],
});
const effect = (damageValue, style = 'melee', extra = {}) => item('weaponEffect', {
  ...extra,
  system: { damageValue, damageType: 'blunt', classification: { skill: 'might', style }, range: extra.range ?? {}, ...(extra.system ?? {}) },
});
const actor = (type, items = [], system = {}, extra = {}) => {
  const a = {
    id: extra.id ?? `a${++n}`, uuid: extra.uuid ?? `Actor.a${n}`, name: extra.name ?? type, type, items,
    system, flags: { essence20: extra.flags ?? {} }, getFlag: (s, k) => a.flags.essence20[k],
  };
  items.forEach(i => {
    i.parent = a; 
  });
  return a;
};

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, user: { id: 'u1', targets: new Set() }, users: {}, actors: [] };
  global.CONFIG = {
    E20: {
      actorSizes: { small: 1, common: 1, large: 1, huge: 1, gigantic: 1, towering: 1, titanic: 1 },
      actorReach: { common: 5, large: 5, huge: 10, gigantic: 15, towering: 20 },
    },
  };
  global.fromUuidSync = uuid => global.game.actors.find(a => a.uuid == uuid) ?? null;
});

test('every module registers with the extension registry', () => {
  const reg = registrySnapshot();
  expect(reg.uses.map(u => u.id)).toEqual(expect.arrayContaining(['zord2-megaform-trait', 'zord2-combiner-merge', 'zord2-zord-features']));
  // Dozer Blade's terrain clearing and Shinobi's Defense pick are their items' own Use rules (module/rules/conv17-split2.test.js).
  expect(reg.uses.map(u => u.id)).not.toContain('zord2-dozer-blade');
  expect(reg.uses.map(u => u.id)).not.toContain('zord2-shinobi');
  // Hybridization is the Perk's own rules (module/rules/conv12-slH12.test.js).
  expect(reg.uses.map(u => u.id)).not.toContain('zord2-hybridization');
  expect(reg.costRules.some(r => r.id == 'zord2FastShift')).toBe(false);
});

test('scaledEffect triples damage and doubles reach or range', () => {
  const melee = scaledEffect(effect(2, 'melee', { range: { reachMultiplier: 1 } }), { damage: 3, reach: 2 });
  expect(melee).toMatchObject({ damageValue: 6, range: { reachMultiplier: 2 } });
  const ranged = scaledEffect(effect(1, 'energy', { range: { value: 60, long: 100 } }), { damage: 2, reach: 2, plus: 1 });
  expect(ranged).toMatchObject({ damageValue: 3, range: { value: 120, long: 200 } });
  expect(strongest([{ effect: effect(1) }, { effect: effect(4) }]).effect.system.damageValue).toBe(4);
});

test('PR Megazord: Enhanced Melee/Ranged Attack from the Zord\'s strongest attack, once per scene per copy', () => {
  const zord = actor('zord', [
    effect(2), effect(3), effect(2, 'energy', { range: { value: 50, long: 120 } }),
    item('megaformTrait', { system: { type: 'enhancedMeleeAttack' }, flags: { zord2DamageType: 'fire' } }),
    item('megaformTrait', { system: { type: 'enhancedMeleeAttack' } }),
    item('megaformTrait', { system: { type: 'enhancedRangedAttack' } }),
  ], {}, { name: 'Tyranno' });
  const mega = actor('megaform', [], { subtype: ['megaformZord'] });
  const specs = desiredAttacks(mega, [zord]);
  expect(specs).toHaveLength(2);
  expect(specs[0]).toMatchObject({ perScene: 2, effect: { damageValue: 9, damageType: 'fire', range: { reachMultiplier: 2 } } });
  expect(specs[1]).toMatchObject({ perScene: 1, effect: { damageValue: 6, range: { value: 100, long: 240 } } });
});

test('Combiner: basic strike/blast scale x2 for a trio, x3 for a Gestalt; Enhanced Attack doubles; Titan Hardpoint only Gigantic+', () => {
  const claws = effect(2);
  const gun = item('weapon', { system: { hardpoint: { type: 'integrated' } } });
  const blast = effect(2, 'energy', { range: { value: 30, long: 60 }, flags: { parentId: gun.id } });
  const a = actor('playerCharacter', [claws, gun, blast, item('megaformTrait', { system: { type: 'enhancedAttack' }, flags: { zord2EffectId: claws.id } })]);
  const b = actor('playerCharacter', [item('megaformTrait', { system: { type: 'titanHardpoint' }, flags: { zord2WeaponUuid: 'Compendium.x.Item.titan' } })]);
  const trio = actor('megaform', [], { subtype: ['megaformCombiner'], size: 'huge' });
  const specs = desiredAttacks(trio, [a, b]);
  const strike = specs.find(s => s.key == 'eoc-basic-strike');
  expect(strike.effect.damageValue).toBe(5); // 2 x 2, +1 because it is the Enhanced one
  expect(specs.find(s => s.key.startsWith('eoc-enh')).effect.damageValue).toBe(4);
  expect(specs.find(s => s.key == 'eoc-basic-blast').effect).toMatchObject({ damageValue: 4, range: { value: 60, long: 120 } });
  expect(specs.some(s => s.copyUuid)).toBe(false);

  const gestalt = actor('megaform', [], { subtype: ['megaformCombiner'], size: 'titanic' });
  const four = [a, b, actor('npc'), actor('npc')];
  const g = desiredAttacks(gestalt, four);
  expect(g.find(s => s.key == 'eoc-basic-strike').effect.damageValue).toBe(7);
  expect(g.find(s => s.copyUuid)?.copyUuid).toBe('Compendium.x.Item.titan');
});

test('generated Megaform attacks stop after their per-scene uses', async () => {
  const weapon = item('weapon', { flags: { zord2Gen: 'pr-Melee-z', zord2PerScene: 1 } });
  const mega = actor('megaform', [weapon]);
  mega.setFlag = jest.fn(async (s, k, v) => {
    mega.flags.essence20[k] = v; 
  });
  expect(perSceneExhausted(weapon)).toBe(false);
  expect(zord2WeaponUnusable(weapon)).toBe(null);
  await countGeneratedUse(mega, [], {}, { rider: { weaponId: weapon.id } });
  expect(perSceneExhausted(weapon)).toBe(true);
  expect(zord2WeaponUnusable(weapon)).toBe('E20.Zord2UsedThisScene');
  expect(zord2WeaponUnusable(item('weapon', { flags: { zord2ShieldMode: true } }))).toBe('E20.Zord2WeaponInShieldMode');
});

test('merge cost: Gestalt 3, Matched 2, Universal Component by team size, Efficient Combination 1 + Free', () => {
  const perk = src => item('perk', { source: src });
  expect(mergeCost(actor('playerCharacter'), perk(ZORD2.gestaltCombiner), 4)).toEqual({ energon: 3, action: 'standard' });
  expect(mergeCost(actor('playerCharacter'), perk(ZORD2.matchedCombiner), 2)).toEqual({ energon: 2, action: 'standard' });
  expect(mergeCost(actor('playerCharacter'), perk(ZORD2.universalComponent), 5).energon).toBe(3);
  expect(mergeCost(actor('playerCharacter', [item('perk', { source: ZORD2.efficientCombination })]), perk(ZORD2.gestaltCombiner), 4))
    .toEqual({ energon: 1, action: 'free' });
});

test('Story Points for NPC components, less one for Universal Receptors', () => {
  const pc = actor('playerCharacter');
  const npcs = [actor('npc'), actor('npc')];
  expect(storyPointCost(pc, npcs)).toBe(2);
  const receptor = actor('npc', [item('megaformTrait', { system: { type: 'universalReceptors' } })]);
  expect(storyPointCost(pc, [receptor, actor('npc')])).toBe(1);
  expect(storyPointCost(actor('npc'), npcs)).toBe(0);
});

test('merge reach: edge gap, doubled by Macro-Magnetic Linkage', () => {
  const a = { center: { x: 50, y: 50 }, w: 100, h: 100 };
  const b = { center: { x: 350, y: 50 }, w: 100, h: 100 };
  expect(tokenGap(a, b, { size: 100, distance: 5 })).toBe(10);
  expect(mergeReach(actor('playerCharacter', [], { size: 'common' }))).toBe(5);
  expect(mergeReach(actor('playerCharacter', [item('upgrade', { source: ZORD2.macroMagneticLinkage })], { size: 'common' }))).toBe(10);
});

test('Core Body doubles a component\'s share on a Gigantic+ Combiner', () => {
  const body = actor('playerCharacter', [item('megaformTrait', { system: { type: 'coreBody' } })], { health: { max: 5, value: 4 } }, { name: 'Hook' });
  const other = actor('playerCharacter', [], { health: { max: 5, value: 5 } }, { name: 'Scrapper' });
  global.game.actors = [body, other];
  const form = actor('megaform', [], {
    subtype: ['megaformCombiner'], size: 'titanic',
    actors: { a: { uuid: body.uuid }, b: { uuid: other.uuid } },
    participantHealth: [{ name: 'Hook', value: 4, max: 5 }, { name: 'Scrapper', value: 5, max: 5 }],
    combinedHealthMax: 10, combinedHealthValue: 9, health: { max: 10, value: 9 },
  });
  // The doubling is Megaform-only extra Health damage uses first (mechanics/vehicles/megaform-bonus-health.mjs).
  coreBodyDerived(form);
  finishParticipantHealth(form, [body, other]);
  expect(form.system).toMatchObject({ combinedHealthMax: 15, combinedHealthValue: 14, health: { max: 15, value: 14 } });
  expect(form.system.participantHealth[0]).toEqual({ name: 'Hook', value: 9, max: 10 });
  global.game.actors.push(form);
  expect(megaformsContaining(body)).toEqual([form]);
});

describe('Enigma of Combination p.43-49: Mode Lock, Other Cybertronians, holding together', () => {
  test('Mode Lock refuses the merge', () => {
    global.ui = { notifications: { warn: jest.fn() } };
    expect(modeLocked({ name: 'Bot', statuses: new Set(['modeLock']) })).toBe(true);
    expect(modeLocked({ name: 'Bot', statuses: new Set() })).toBe(false);
  });

  test('a Combiner Perk merges on its own; a guest needs someone who can, and only one guest at a time', async () => {
    global.ui = { notifications: { warn: jest.fn() } };
    const perk = actor('playerCharacter', [item('perk', { source: ZORD2.gestaltCombiner })]);
    const guest = actor('playerCharacter', [], { energon: { normal: { value: 6 } } });
    expect([holdsMergePerk(perk), holdsMergePerk(guest)]).toEqual([true, false]);

    const lonely = actor('megaform', [], { subtype: ['megaformCombiner'], actors: {} });
    expect(await beginGuestMerge(guest, lonely)).toBeNull();
    expect(global.ui.notifications.warn).toHaveBeenCalledWith('E20.Zord2GuestNeedsCombiner');

    global.game.actors = [perk];
    const full = actor('megaform', [], { subtype: ['megaformCombiner'], actors: { a: { uuid: perk.uuid }, b: { uuid: 'Actor.x', guestEpoch: 1 } } });
    expect(await beginGuestMerge(guest, full)).toBeNull();
    expect(global.ui.notifications.warn).toHaveBeenCalledWith('E20.Zord2OneGuest');
  });

  test('a postponed break-apart holds until the round it names, in that combat only', () => {
    const form = { flags: { essence20: { zord2HoldTogether: { combatId: 'c1', round: 4 } } } };
    expect(heldUntil(form, { id: 'c1' })).toBe(4);
    expect(heldUntil(form, { id: 'c2' })).toBeNull();
    expect(heldUntil({ flags: {} }, { id: 'c1' })).toBeNull();
  });
});

test('focusing a component: Snag, or ↓1 with Gestalt Hunter', () => {
  const form = actor('megaform', [], { subtype: ['megaformCombiner'] });
  global.game.user.targets = { first: () => ({ actor: form }) };
  const plain = actor('playerCharacter');
  expect(focusToggles(plain, { item: { type: 'weaponEffect' } })).toHaveLength(1);
  const options = { ext: { zord2FocusComponent: true }, shiftDown: 0 };
  applyFocus(plain, options);
  expect(options.snag).toBe(true);
  const hunter = actor('playerCharacter', [item('perk', { source: ZORD2.gestaltHunter })]);
  const o2 = { ext: { zord2FocusComponent: true }, shiftDown: 0 };
  applyFocus(hunter, o2);
  expect(o2).toMatchObject({ shiftDown: 1 });
  expect(o2.snag).toBeUndefined();
});

// Warrior Mode's and Mesh Zord's Towering, Mesh Zord's picks and Power Matrix are rules (module/rules/conv10-slA10.test.js).
test('spectrum and combine eligibility', () => {
  expect(spectrumOf(actor('playerCharacter', [item('role', { name: 'Black Ranger' })]))).toBe('black');

  const combiner = actor('zord', [item('feature', { source: ZORD2.combiner })]);
  const plain = actor('zord');
  const versatile = actor('zord', [item('feature', { source: ZORD2.combiner }), item('feature', { source: ZORD2.versatileCombiner })]);
  expect(ineligibleZords([combiner, plain])).toEqual([plain]);
  expect(ineligibleZords([versatile, plain])).toEqual([]);
  expect(ineligibleZords([versatile, plain, actor('zord')])).toHaveLength(1);
});

// Carapaced's +20 Ground and its pick are the Alt Mode items' own rules (module/rules/conv6-slA6.test.js).

test("Dozer Blade's clearRoughTerrain step finds single-square Rough Terrain under a point", () => {
  const region = { id: 'r', behaviors: [{ system: { roughTerrain: true } }], shapes: [{ type: 'rectangle', x: 0, y: 0, width: 100, height: 100 }] };
  expect(roughRegionsAt({ regions: [region] }, { x: 50, y: 50 })).toEqual([region]);
  expect(roughRegionsAt({ regions: [region] }, { x: 150, y: 50 })).toEqual([]);
});

// Shinobi's motorcycle Driving is the Perk's own RollModifier now (module/rules/conv5-slA5.test.js); Hybridization
// (Steady Hands, Helping Hand, the daily Mass Shift uses, Half Track, Evasive Conversion) is the Perk's own rules
// (module/rules/conv12-slH12.test.js; Change Size: conv10-slA10.test.js).
