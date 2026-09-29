import { jest } from '@jest/globals';
import { onPrimeonComponent, WEAPON22, weaponHitRider, weaponRollSources } from './weapons.mjs';

function makeActor(extra = {}) {
  const actor = {
    id: extra.id ?? 'a', uuid: `Actor.${extra.id ?? 'a'}`, name: extra.name ?? 'Bot', type: extra.type ?? 'character',
    flags: { essence20: { ...(extra.flags ?? {}) } }, system: extra.system ?? {}, statuses: new Set(extra.statuses ?? []),
    items: { contents: [] },
  };
  actor.setFlag = jest.fn(async (scope, key, value) => {
    actor.flags[scope][key] = value;
  });
  return actor;
}

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, settings: { get: () => 3 } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
});

test('Demolecularization Gun marks the target for the scene; Sharp attacks then have Edge', async () => {
  const shooter = makeActor();
  const target = makeActor({ id: 't' });
  await weaponHitRider(shooter, target, { success: true }, { weaponSource: WEAPON22.demolecularizationGun });
  expect(target.flags.essence20.d22Demolecularized).toMatchObject({ scene: 3 });
  expect(ChatMessage.create).toHaveBeenCalled();

  const sharp = { system: { damageType: 'sharp' } };
  expect(weaponRollSources(makeActor(), target, { item: sharp, isAttack: true }).sources[0]).toMatchObject({ edge: true });
  expect(weaponRollSources(makeActor(), target, { item: { system: { damageType: 'blunt', secondaryDamage: { type: 'sharp' } } }, isAttack: true }).sources).toHaveLength(1);
  expect(weaponRollSources(makeActor(), target, { item: { system: { damageType: 'blunt' } }, isAttack: true }).sources).toEqual([]);
  game.settings.get = () => 4;
  expect(weaponRollSources(makeActor(), target, { item: sharp, isAttack: true }).sources).toEqual([]);
});

test('a miss marks nothing', async () => {
  const target = makeActor({ id: 't' });
  await weaponHitRider(makeActor(), target, { success: false }, { weaponSource: WEAPON22.demolecularizationGun });
  await weaponHitRider(makeActor(), null, { success: true }, { weaponSource: WEAPON22.demolecularizationGun });
  expect(target.setFlag).not.toHaveBeenCalled();
});

test('Assault Claw grapple: Snag on the escape', async () => {
  const target = makeActor({ id: 't', statuses: ['grappled'] });
  await weaponHitRider(makeActor(), target, { success: true }, { weaponSource: WEAPON22.assaultClaw, damageType: 'sharp' });
  expect(target.setFlag).not.toHaveBeenCalled();
  await weaponHitRider(makeActor(), target, { success: true }, { weaponSource: WEAPON22.assaultClaw, damageType: 'grapple' });
  expect(weaponRollSources(target, null, { rolledSkill: 'athletics', isAttack: false }).sources[0]).toMatchObject({ snag: true });
  expect(weaponRollSources(target, null, { rolledSkill: 'targeting', isAttack: false }).sources).toEqual([]);
  expect(weaponRollSources(target, null, { rolledSkill: 'might', isAttack: true }).sources).toEqual([]);
  target.statuses.clear();
  expect(weaponRollSources(target, null, { rolledSkill: 'athletics', isAttack: false }).sources).toEqual([]);
});

test('Primeon Blade offers the extra Energy damage to a Combiner component', async () => {
  const member = makeActor({ id: 'm', name: 'Member' });
  const combiner = makeActor({ id: 'c', type: 'megaform', system: { subtype: ['megaformCombiner'], actors: { x: { uuid: 'Actor.m' } } } });
  global.fromUuidSync = () => member;
  await weaponHitRider(makeActor(), combiner, { success: true }, { weaponSource: WEAPON22.primeonBlade });
  expect(ChatMessage.create.mock.calls[0][0].content).toContain('data-e20-ext="d22PrimeonComponent"');

  ChatMessage.create.mockClear();
  await weaponHitRider(makeActor(), makeActor({ id: 'x' }), { success: true }, { weaponSource: WEAPON22.primeonBlade });
  expect(ChatMessage.create).not.toHaveBeenCalled();

  global.fromUuid = async () => null;
  const button = { dataset: { uuid: 'Actor.m' }, disabled: false };
  await onPrimeonComponent(null, button);
  expect(button.disabled).toBe(false);
});
