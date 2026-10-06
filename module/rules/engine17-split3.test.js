import { jest } from '@jest/globals';

/**
 * Round 17, split3 (docs/rules-batches/slSplit317.md): the engine pieces - recipient bondedAlly and tag self:bonded,
 * applyCondition's filled condition, Movement stages vehicleBase / vehicle, PetCommand upshift, ContactAllegiance, KitUses,
 * the roleDropped event, pick source damagedEssences and ref @countSubtype.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const applyTimedCondition = jest.fn(async (actor, status) => actor.statuses.add(status));
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({ applyTimedCondition }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { RULE_TYPES, TRIGGER_EVENTS, validateRule } = await import('./types.mjs');
const { evaluateTag, contextFor } = await import('./predicate.mjs');
const { runSteps, stepContext, pickOptions } = await import('./steps.mjs');
const { resolveValue } = await import('./formula.mjs');
const { fireTriggers } = await import('./triggers.mjs');
const { applyMovementStage } = await import('./plugins/effects/derived-hook-movement.mjs');
const { VEHICLE_STAGES } = await import('./plugins/effects/vehicle-movement-stages.mjs');
const { rulePetCommandUpshift } = await import('./plugins/picks/pet-command.mjs');
const { ruleContactAllegiance } = await import('./plugins/resources/contact-allegiance.mjs');
const { ruleKitUses } = await import('./plugins/resources/kit-uses.mjs');
const { fireRoleDropped } = await import('./plugins/effects/role-dropped-event.mjs');
const { damagedEssenceOptions } = await import('./plugins/picks/damaged-essences.mjs');

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

let nextId = 1;
function makeActor({ rules = [], system = {}, flags = {}, type = 'playerCharacter' } = {}) {
  const actor = {
    id: `a${nextId++}`, name: 'Actor', type, statuses: new Set(), flags: { essence20: { ...flags } }, system: { ...system },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    async toggleStatusEffect(status, { active } = {}) {
      if (active === false) {
        this.statuses.delete(status);
      } else {
        this.statuses.add(status);
      }
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  const items = rules.length ? [{ id: `i${nextId++}`, name: 'Perk', type: 'perk', flags: {}, system: { rules }, parent: actor, async update(data) {
    for (const [key, value] of Object.entries(data)) {
      setPath(this, key, value);
    }
  } }] : [];
  actor.items = { contents: items, get: id => items.find(item => item.id == id), find: fn => items.find(fn), filter: fn => items.filter(fn), [Symbol.iterator]: () => items[Symbol.iterator]() };
  rebuildIndex(actor);
  return actor;
}

beforeEach(() => {
  global.game = { combat: null, user: { targets: new Set() }, i18n: { localize: key => key, format: key => key }, settings: { get: () => 1 } };
  global.CONFIG = { E20: { essences: { strength: 'E20.Str', speed: 'E20.Spd', smarts: 'E20.Sma', social: 'E20.Soc' } } };
});

test('recipient bondedAlly and tag self:bonded read the bond from either side', async () => {
  const partner = makeActor();
  const holder = makeActor({ flags: { bond: { partner: partner.uuid, linked: false } } });
  global.fromUuidSync = uuid => [holder, partner].find(actor => actor.uuid == uuid) ?? null;
  global.game.actors = { contents: [holder, partner], [Symbol.iterator]: () => [holder, partner][Symbol.iterator]() };
  expect(evaluateTag('self:bonded', contextFor({ self: holder }))).toBe(true);
  expect(evaluateTag('self:bonded', contextFor({ self: partner }))).toBe(true);
  expect(evaluateTag('self:bonded', contextFor({ self: makeActor() }))).toBe(false);

  const ctx = stepContext({ actor: holder, item: null, targets: [] });
  ctx.vars.status = 'frightened';
  await runSteps([{ do: 'applyCondition', condition: '{var.status}', to: 'bondedAlly' }], ctx);
  expect(partner.statuses.has('frightened')).toBe(true);
  expect(holder.statuses.has('frightened')).toBe(false);
});

test('applyCondition with a condition that fills to nothing applies nothing', async () => {
  const actor = makeActor();
  applyTimedCondition.mockClear();
  await runSteps([{ do: 'applyCondition', condition: '{var.missing}', to: 'self' }], stepContext({ actor, item: null, targets: [] }));
  expect(applyTimedCondition).not.toHaveBeenCalled();
});

test('Movement stages vehicleBase and vehicle are accepted, and apply only when asked for', () => {
  expect(VEHICLE_STAGES).toEqual(['vehicleBase', 'vehicle']);
  for (const stage of VEHICLE_STAGES) {
    expect(RULE_TYPES.Movement.params.stage.options).toContain(stage);
  }

  const vehicle = makeActor({ type: 'vehicle', system: { movement: { ground: { total: 20 }, swim: { total: 40 } } }, rules: [
    { type: 'Movement', movement: 'ground', stage: 'vehicleBase', op: 'max', value: '@actor.system.movement.swim.total' },
    { type: 'Movement', movement: 'ground', stage: 'vehicle', op: 'add', value: -50 },
  ] });
  applyMovementStage(vehicle, 'final');
  expect(vehicle.system.movement.ground.total).toBe(20);
  applyMovementStage(vehicle, 'vehicleBase');
  expect(vehicle.system.movement.ground.total).toBe(40);
  applyMovementStage(vehicle, 'vehicle');
  expect(vehicle.system.movement.ground.total).toBe(0);
});

test('PetCommand: upshift alone is valid, the biggest counts; neither is an error', () => {
  expect(validateRule({ type: 'PetCommand', upshift: 1 })).toEqual([]);
  expect(validateRule({ type: 'PetCommand' })).toEqual(['needs difTier or upshift']);
  expect(rulePetCommandUpshift(makeActor({ rules: [{ type: 'PetCommand', upshift: 1 }, { type: 'PetCommand', upshift: 2, when: ['self:type:companion'] }], type: 'companion' }))).toBe(2);
});

test('ContactAllegiance: summed over the rules whose when holds, the Contact as target:', () => {
  const summoner = makeActor({ rules: [{ type: 'ContactAllegiance', amount: 1, when: ['target:data:flags.essence20.hometown'] }, { type: 'ContactAllegiance', amount: '1 + 1' }] });
  expect(ruleContactAllegiance(summoner, makeActor({ flags: { hometown: true } }))).toBe(3);
  expect(ruleContactAllegiance(summoner, makeActor())).toBe(2);
});

test('KitUses: tiers narrow it, the most uses wins, never below 1', () => {
  expect(validateRule({ type: 'KitUses', uses: 2, tiers: ['epic'] })).toEqual([expect.stringContaining('tiers must be among')]);
  const actor = makeActor({ rules: [{ type: 'KitUses', uses: 3, tiers: ['standard'] }, { type: 'KitUses', uses: 2 }, { type: 'KitUses', uses: 0 }] });
  expect(ruleKitUses(actor, 'standard')).toBe(3);
  expect(ruleKitUses(actor, 'restricted')).toBe(2);
});

test('event roleDropped fires the actor\'s roleDropped Triggers', async () => {
  expect(TRIGGER_EVENTS).toContain('roleDropped');
  const actor = makeActor({ rules: [{ type: 'Trigger', event: 'roleDropped', steps: [{ do: 'updateActor', to: 'self', set: { 'flags.essence20.dropped': true } }] }] });
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  await fireRoleDropped(actor);
  expect(actor.flags.essence20.dropped).toBe(true);
  await fireRoleDropped(null);
  expect(typeof fireTriggers).toBe('function');
});

test('pick source damagedEssences and ref @countSubtype', () => {
  const hurt = makeActor({ system: { essences: { strength: { value: 1, max: 2 }, speed: { value: 2, max: 2 }, social: { value: 0, max: 3 } } } });
  expect(damagedEssenceOptions({}, { actor: makeActor(), targets: [hurt] })).toEqual([{ value: 'strength', label: 'E20.Str' }, { value: 'social', label: 'E20.Soc' }]);
  expect(damagedEssenceOptions({ of: 'self' }, { actor: hurt, targets: [] }).map(option => option.value)).toEqual(['strength', 'social']);
  expect(pickOptions({ from: 'damagedEssences' }, { actor: hurt, targets: [] })).toEqual([]);

  const ranger = makeActor();
  ranger.items.contents.push({ type: 'power', system: { type: 'grid' } }, { type: 'power', system: { type: 'grid' } }, { type: 'power', system: { type: 'sorcerous' } }, { type: 'perk', system: { type: 'grid' } });
  expect(resolveValue('@countSubtype.power.grid', { actor: ranger })).toBe(2);
  expect(resolveValue('@countSubtype.power.zord', { actor: ranger })).toBe(0);
});
