import { jest } from '@jest/globals';
import { TF2 } from './common.mjs';
import {
  MARK, arrogantForbids, broadUnderstandingApplies, marksOf, tf2ApplyDialog, tf2HitRider, tf2PreRoll, tf2RollSources, tf2Specializes, tf2Toggles,
} from './rolls.mjs';
import { cageCapacity, deconstructKind, differentEssences, requisitionDifOf, weAreOneSize } from './uses.mjs';
import { SPECIAL_ATTACKS, missingSpecialAttacks, negatedObscuringMatrix, scrambleVictims, tf2Derived, weAreOneEffect } from './modes.mjs';

const item = (uuid, extra = {}) => ({ id: extra.id ?? uuid.slice(-6), name: extra.name ?? 'Thing', type: extra.type ?? 'perk', system: extra.system ?? {}, flags: { core: { sourceId: uuid }, essence20: extra.flags ?? {} } });
const actor = (items = [], extra = {}) => ({
  uuid: extra.uuid ?? 'Actor.a', id: extra.id ?? 'a', name: extra.name ?? 'A', type: extra.type ?? 'character',
  system: extra.system ?? {}, flags: { essence20: extra.flags ?? {} }, statuses: new Set(extra.statuses ?? []), items: { contents: items },
});

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, user: { targets: new Set() }, actors: [], combat: null };
  global.CONFIG = {
    E20: {
      skillToEssence: { science: 'smarts', persuasion: 'social', might: 'strength', athletics: 'strength', alertness: 'smarts', driving: 'speed' },
      skills: {}, availabilityDifficulties: { standard: 0, limited: 10, restricted: 15 },
    },
  };
  global.ui = { notifications: { warn: jest.fn() } };
});

test('Bullbar gives Edge on a Ram in Alt Mode', () => {
  const holder = actor([item(TF2.bullbar, { type: 'gear' })], { system: { isTransformed: true } });
  const out = tf2RollSources(holder, null, { item: { system: { isRam: true } } });
  expect(out.sources[0]).toMatchObject({ id: 'tf2Bullbar', edge: true });
});

test('Caterpillar Tread adds two ↑1 to a Bot Mode shove', () => {
  const holder = actor([item(TF2.caterpillarTread, { type: 'gear' })], { system: { canTransform: true, isTransformed: false } });
  const out = tf2RollSources(holder, null, { isShove: true });
  expect(out.sources.reduce((n, s) => n + s.shiftUp, 0)).toBe(2);
});

test('Broad Understanding: Specialized out of combat, ↓2 off-Specialization', async () => {
  const holder = actor([item(TF2.broadUnderstanding)], { system: { skills: { science: { specializations: { chem: { name: 'Chemistry' } } } } } });
  expect(broadUnderstandingApplies(holder)).toBe(true);
  expect(tf2Specializes(holder, 'science')).toBe(true);
  expect(tf2RollSources(holder, null, { rolledSkill: 'science', dataset: {} }).sources[0].shiftDown).toBe(2);
  expect(tf2RollSources(holder, null, { rolledSkill: 'science', dataset: { isSpecialized: true } }).sources).toEqual([]);
  // dice.mjs gives roll sources no dataset - the pre-roll hook remembers it.
  await tf2PreRoll(holder, { specializationKey: 'chem' }, null);
  expect(tf2RollSources(holder, null, { rolledSkill: 'science' }).sources).toEqual([]);
  global.game.combat = { id: 'c' };
  expect(broadUnderstandingApplies(holder)).toBe(false);
  holder.flags.essence20.tf2AppliedScience = true;
  expect(broadUnderstandingApplies(holder)).toBe(true);
  expect(tf2RollSources(holder, null, { rolledSkill: 'science', dataset: {} }).consumes[0].ext).toBe('tf2AppliedScience');
});

test('Cage prisoner escape tests take ↓2 and the focus Snag', () => {
  const prisoner = actor([], { flags: { riderMarks: [{ kind: MARK.caged, by: 'Actor.h', label: 'Cage', focused: true }] } });
  expect(marksOf(prisoner, MARK.caged)).toHaveLength(1);
  const out = tf2RollSources(prisoner, null, { rolledSkill: 'brawn' });
  expect(out.sources.map(s => s.id)).toEqual(['tf2Caged', 'tf2CageFocus']);
  expect(out.consumes[0].ext).toBe('tf2CageFocus');
});

test('Diversion: Snag attacking the diverter', () => {
  const diverter = actor([], { uuid: 'Actor.d' });
  const diverted = actor([], { uuid: 'Actor.x', flags: { riderMarks: [{ kind: MARK.diversion, by: 'Actor.d' }] } });
  const out = tf2RollSources(diverted, diverter, { isAttack: true });
  expect(out.sources[0]).toMatchObject({ id: 'tf2DiversionSnag', snag: true });
});

test('dialog switches', async () => {
  const holder = actor([item(TF2.acuteSense), item(TF2.supportingCast, { type: 'hangUp' }), item(TF2.earthspoiled, { type: 'hangUp' })]);
  const names = tf2Toggles(holder, { rolledSkill: 'persuasion' }).map(t => t.name);
  expect(names).toEqual(expect.arrayContaining(['tf2AcuteSense', 'tf2SupportingCast', 'tf2Earthspoiled']));
  const options = { shiftUp: 0, shiftDown: 0, ext: { tf2AcuteSense: true, tf2SupportingCast: true, tf2Earthspoiled: true } };
  await tf2ApplyDialog(holder, options);
  expect(options).toMatchObject({ shiftUp: 1, shiftDown: 2 });
});

test('All Out Attack control shows on a Might attack out of combat', () => {
  const holder = actor([item(TF2.allOutAttack), item(TF2.evasiveFighting)]);
  const toggles = tf2Toggles(holder, { item: { type: 'weaponEffect', system: { classification: { skill: 'might' } } }, rolledSkill: 'might' });
  expect(toggles.filter(t => t.type == 'number').map(t => t.name)).toEqual(['tf2AllOutAttack', 'tf2EvasiveFighting']);
});

test('Arrogant forbids first-turn attacks on lower Threat Levels only', () => {
  const holder = actor([item(TF2.arrogant, { type: 'hangUp' })], { id: 'h', system: { level: 5 } });
  global.game.combat = { round: 1, combatant: { actor: { id: 'h' } } };
  expect(arrogantForbids(holder, [{ system: { threatLevel: 2 } }])).toBe(true);
  expect(arrogantForbids(holder, [{ system: { threatLevel: 2 } }, { system: { threatLevel: 6 } }])).toBe(false);
  global.game.combat.round = 2;
  expect(arrogantForbids(holder, [{ system: { threatLevel: 2 } }])).toBe(false);
});

test('Roller Drum: Stun 2 unarmed in Bot Mode', async () => {
  const holder = actor([item(TF2.rollerDrum, { type: 'gear' })], { system: { isTransformed: false } });
  const damageBonusNote = jest.fn();
  await tf2HitRider(holder, actor(), { damageValue: 1 }, { isUnarmed: true, damageType: 'stun' }, { damageBonusNote });
  expect(damageBonusNote).toHaveBeenCalledWith(expect.anything(), 1, 'Thing');
});

test('loose Obscuring Matrix is negated while Prone; Bullbar shove immunity', () => {
  const matrix = item(TF2.obscuringMatrixBasic, { type: 'upgrade', system: { type: 'armor', armorBonus: { defense: 'evasion', value: 2 } } });
  const wearer = actor([matrix, item(TF2.bullbar, { type: 'gear' })], {
    statuses: ['prone'], system: { canTransform: true, isTransformed: false, defenses: { evasion: { total: 14, string: '14' } } },
  });
  expect(negatedObscuringMatrix(wearer).amount).toBe(2);
  tf2Derived(wearer);
  expect(wearer.system.defenses.evasion.total).toBe(12);
  expect(wearer.system.tf2ShoveImmune).toBe(true);
});

test('Alt Mode special attacks', () => {
  const altMode = item(TF2.charger, { type: 'altMode' });
  expect(SPECIAL_ATTACKS[TF2.charger].damage).toBe(2);
  expect(missingSpecialAttacks(actor([altMode]), altMode)).toEqual([TF2.ram, TF2.flyby]);
  expect(missingSpecialAttacks(actor([altMode, item(TF2.ram, { type: 'weapon' })]), altMode)).toEqual([TF2.flyby]);
});

test('We Are One! sizes, skills and effect', () => {
  expect(weAreOneSize(actor([], { system: { essences: { social: { max: 3 } } } }))).toBe(2);
  expect(differentEssences('science', 'might')).toBe(true);
  expect(differentEssences('science', 'alertness')).toBe(false);
  const effect = weAreOneEffect({ uuid: 'Actor.h' }, { skills: ['science', 'might'], label: 'We Are One!' });
  expect(effect.system.reroll).toMatchObject({ mode: 'ones', target: 'skillDice', maxUses: 0, skills: ['science', 'might'] });
});

test('Cage capacity, Deconstruct targets and DIF', () => {
  expect(cageCapacity(actor([], { system: { isTransformed: false } }))).toBe(1);
  const mode = { id: 'm', type: 'altMode', system: { altModeCrew: 2 }, flags: {} };
  expect(cageCapacity(actor([mode, item(TF2.extraCrewCapacity, { type: 'gear' })], { system: { isTransformed: true, altModeId: 'm' } }))).toBe(6);
  expect(deconstructKind({ type: 'gear', name: 'Medical Kit' })).toBe('kit');
  expect(deconstructKind({ type: 'weapon', name: 'Blaster' })).toBe('weapon');
  expect(requisitionDifOf({ system: { availability: 'restricted' } })).toBe(15);
});

test('Scramble Modulator picks the healthiest components', () => {
  const a = actor([], { uuid: 'Actor.1', system: { health: { value: 4 } } });
  const b = actor([], { uuid: 'Actor.2', system: { health: { value: 6 } } });
  const c = actor([], { uuid: 'Actor.3', system: { health: { value: 6 } } });
  global.fromUuidSync = uuid => [a, b, c].find(x => x.uuid == uuid);
  const form = { type: 'megaform', system: { subtype: ['megaformCombiner'], actors: { x: { uuid: 'Actor.1' }, y: { uuid: 'Actor.2' }, z: { uuid: 'Actor.3' } } } };
  expect(scrambleVictims(form).map(v => v.uuid)).toEqual(['Actor.2', 'Actor.3']);
});
