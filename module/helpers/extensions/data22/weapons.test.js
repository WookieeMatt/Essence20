import { jest } from '@jest/globals';
import { onPrimeonComponent, WEAPON22, weaponHitRider } from './weapons.mjs';

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

// The Demolecularization Gun is its item's own rules (rules/conv10-slC10.test.js).
test('a miss marks nothing', async () => {
  const target = makeActor({ id: 't' });
  await weaponHitRider(makeActor(), target, { success: false }, { weaponSource: WEAPON22.assaultClaw, damageType: 'grapple' });
  await weaponHitRider(makeActor(), null, { success: true }, { weaponSource: WEAPON22.assaultClaw, damageType: 'grapple' });
  expect(target.setFlag).not.toHaveBeenCalled();
});

// The Snag itself is the Grappled switch (extensions/rules/grappled.test.js); the Claw only marks.
test('Assault Claw grapple marks the target', async () => {
  const target = makeActor({ id: 't', statuses: ['grappled'] });
  await weaponHitRider(makeActor(), target, { success: true }, { weaponSource: WEAPON22.assaultClaw, damageType: 'sharp' });
  expect(target.setFlag).not.toHaveBeenCalled();
  await weaponHitRider(makeActor(), target, { success: true }, { weaponSource: WEAPON22.assaultClaw, damageType: 'grapple' });
  expect(target.setFlag).toHaveBeenCalledWith('essence20', 'd22AssaultClawGrapple', expect.objectContaining({ scene: expect.anything() }));
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
