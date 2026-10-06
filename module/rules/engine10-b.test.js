import { jest } from '@jest/globals';

/**
 * Round 10, group B engine pieces (module/rules/ext/b/): HitRider, Veto / ArmorPair, the ignoreArmor Defense mode and
 * armor shred, the push / actAs / collect / rollFormulaVsEach / healAction / actWhileDefeated / shredArmor steps, the
 * self:limitUsed and damage:attack / damage:melee tags, the patchedUp event, the MissImmunity / SneakAttackImmunity /
 * CrashProtection readers, and the roll's dataset reaching hit / miss Triggers.
 */

const hooks = {};
global.Hooks = { on: (name, fn) => (hooks[name] = [...(hooks[name] ?? []), fn]), once: () => {}, callAll: () => {} };

let lastApply = null;
const flatRolls = [];
jest.unstable_mockModule('./helpers/extensions/react/core.mjs', () => ({
  lastApplyContext: () => lastApply,
  rollVsMany: jest.fn(async () => []),
  rollVs: jest.fn(async (actor, skill, dif) => {
    flatRolls.push({ name: actor.name, skill, dif });
    return { success: dif <= 12, cancelled: dif > 20 };
  }),
}));
const pushed = [];
jest.unstable_mockModule('./helpers/forced-movement.mjs', () => ({
  pushActor: jest.fn(async (actor, from, feet) => {
    pushed.push({ name: actor.name, from: from.name, feet });
    return from.name != 'Wall';
  }),
}));
const restored = [];
jest.unstable_mockModule('./helpers/extensions/other2/medic.mjs', () => ({
  restoreHealth: jest.fn(async (healer, target, amount) => restored.push({ healer: healer.name, target: target.name, amount })),
}));
const stamped = [];
jest.unstable_mockModule('./helpers/perks.mjs', () => ({
  markUsedThisTurn: jest.fn(async (actor, key) => stamped.push({ name: actor.name, key })),
  actorHasPerk: () => false,
}));
jest.unstable_mockModule('./helpers/action-economy.mjs', () => ({ ACT_WHILE_DEFEATED_FLAG: 'actWhileDefeatedThisTurn', spend: jest.fn(async () => ({})) }));

await import('./ext/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { runSteps, stepContext, stepErrors } = await import('./steps.mjs');
const { validateRule } = await import('./types.mjs');
const { evaluateTag, contextFor } = await import('./predicate.mjs');
const { recordUse } = await import('./limits.mjs');
const { hitRiderOnAttack, hitRiderOnCast } = await import('./ext/b/hit-rider.mjs');
const { checkActorUpdate, itemVeto, ruleAllowsArmorPair } = await import('./ext/b/veto.mjs');
const { ignoreArmorAdjust, armorShredDerived } = await import('./ext/b/armor.mjs');
const { firePatchedUp } = await import('./ext/b/steps.mjs');
const { ruleIgnoresMissEffects, ruleSneakAttackImmune, crashProtectionOf, ruleHideBonus } = await import('./ext/b/readers.mjs');
const { attackRange } = await import('./ext/b/attack.mjs');
const { recipients } = await import('./steps.mjs');
const { runPostRoll } = await import('../helpers/extensions.mjs');
await import('./triggers.mjs');

let nextId = 1;
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
const setPath = (object, key, value) => {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
};

async function applyUpdate(doc, data) {
  for (const [key, value] of Object.entries(data)) {
    const parts = key.split('.');
    if (parts[parts.length - 1].startsWith('-=')) {
      const last = parts.pop().slice(2);
      delete getPath(doc, parts.join('.'))?.[last];
    } else {
      setPath(doc, key, value);
    }
  }
}

function makeItem(data) {
  const item = { id: `i${nextId++}`, flags: {}, system: {}, ...data, async update(changes) {
    await applyUpdate(this, changes);
  } };
  item.uuid ??= `Item.${item.id}`;
  return item;
}

function makeActor(name, { items = [], x = 0, disposition = 1, system = {}, statuses = [], flags = {}, type = 'playerCharacter' } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, documentName: 'Actor', isOwner: true, statuses: new Set(statuses), flags: { essence20: { ...flags } },
    system: { level: 5, health: { value: 10, max: 10 }, defenses: {}, ...system },
    async update(data) {
      await applyUpdate(this, data);
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
    async setFlag(scope, key, value) {
      setPath(this.flags, `${scope}.${key}`, value);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  const token = { id: `t${actor.id}`, actor, document: { disposition }, center: { x, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  const list = items.map(data => makeItem(data));
  actor.items = { contents: list, get: id => list.find(item => item.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() };
  list.forEach(item => (item.parent = item.actor = actor));
  rebuildIndex(actor);
  game.actors.contents.push(actor);
  canvas.tokens.placeables.push(token);
  return actor;
}

const rules = (...list) => ({ system: { rules: list } });
const tools = () => ({
  damageBonusNote: jest.fn((result, amount) => {
    result.damageValue += amount;
  }),
});

beforeEach(() => {
  pushed.length = 0;
  restored.length = 0;
  stamped.length = 0;
  lastApply = null;
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] },
    i18n: { localize: k => k, format: k => k, has: () => false }, settings: { get: () => 1 }, actors: { contents: [] },
  };
  global.CONFIG = { E20: { damageTypes: { sharp: 'Sharp', blunt: 'Blunt', fire: 'Fire', stun: 'Stun' } } };
  global.canvas = { tokens: { placeables: [], setTargets: jest.fn() }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
  global.ui = { notifications: { warn: jest.fn() } };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.fromUuidSync = uuid => game.actors.contents.find(actor => actor.uuid == uuid)
    ?? game.actors.contents.flatMap(actor => actor.items.contents).find(item => item.uuid == uuid) ?? null;
  global.foundry = { utils: { getProperty: getPath, setProperty: setPath, deepClone: v => JSON.parse(JSON.stringify(v)) } };
});

describe('HitRider', () => {
  test('validates', () => {
    expect(validateRule({ type: 'HitRider', note: 1 })).toEqual([]);
    expect(validateRule({ type: 'HitRider' })).toEqual(['changes nothing']);
    expect(validateRule({ type: 'HitRider', option: { damage: 1 } })).toEqual(['option.damageType is required']);
    expect(validateRule({ type: 'HitRider', note: 1, watch: 'ally', marked: 'x' })).toContain('watch and marked can\'t both be set');
    expect(validateRule({ type: 'HitRider', retypeFrom: 'blunt', note: 1 })).toContain('retypeFrom needs damageType or damageTypeFrom');
  });

  test('note, retype (with the crit option), option and siblings on a weapon hit', () => {
    const weapon = { id: 'w', type: 'weapon', name: 'Blaster', system: {} };
    const attacker = makeActor('Hero', {
      items: [
        weapon, { id: 'e1', type: 'weaponEffect', name: 'Shot', flags: { essence20: { parentId: 'w' } }, system: { damageValue: 3, damageType: 'blunt' } },
        { id: 'e2', type: 'weaponEffect', name: 'Stun Shot', flags: { essence20: { parentId: 'w' } }, system: { damageValue: 1, damageType: 'stun' } },
        { name: 'Perk', type: 'perk', ...rules(
          { type: 'HitRider', label: 'Bonus', note: '@var.base - 1', when: ['weapon:name~blaster'] },
          { type: 'HitRider', label: 'Sharpen', damageType: 'sharp', retypeFrom: 'blunt', retypeCrit: true },
          { type: 'HitRider', label: 'Stun ammo', option: { damage: '@var.damage + 1', damageType: 'stun' }, when: ['roll:switch:ammo'] },
          { type: 'HitRider', label: 'Others', siblings: { label: 'Also: {effect}' } },
        ) },
      ],
    });
    const result = { damageValue: 3, damageType: 'blunt', criticalOptions: [{ key: 'double', damageType: 'blunt' }] };
    const t = tools();
    hitRiderOnAttack(attacker, null, result, { itemUuid: 'Item.e1', switches: ['ammo'] }, t);
    expect(t.damageBonusNote).toHaveBeenCalledWith(result, 2, 'Bonus');
    expect(result).toMatchObject({ damageValue: 5, damageType: 'sharp', criticalOptions: [{ damageType: 'sharp' }] });
    expect(result.riderOptions).toEqual([
      expect.objectContaining({ label: 'Stun ammo', damageValue: 6, damageType: 'stun' }),
      expect.objectContaining({ label: 'Also: Stun Shot', damageValue: 1, damageType: 'stun' }),
    ]);

    // No switch, a fire hit: no option, no retype.
    const fire = { damageValue: 3, damageType: 'fire' };
    hitRiderOnAttack(attacker, null, fire, { itemUuid: 'Item.e1', switches: [] }, tools());
    expect(fire.damageType).toBe('fire');
    expect(fire.riderOptions).toHaveLength(1);
  });

  test('siblings fall back to an option; damageTypeFrom; host scope', () => {
    const attacker = makeActor('Hero', {
      flags: { element: 'cold' },
      items: [
        { id: 'lone', type: 'weaponEffect', name: 'Punch', system: { damageValue: 2, damageType: 'blunt' } },
        { id: 'w', type: 'weapon', name: 'Saber' },
        { id: 'cut', type: 'weaponEffect', name: 'Cut', flags: { essence20: { parentId: 'w' } }, system: { damageValue: 2, damageType: 'sharp' } },
        { name: 'Upgrade', type: 'upgrade', flags: { essence20: { parentId: 'w' } }, ...rules({ type: 'HitRider', scope: 'host', label: 'Edge', note: 1 }) },
        { name: 'Perk', type: 'perk', ...rules(
          { type: 'HitRider', label: 'Onslaught', siblings: { fallback: { damage: 1, damageType: 'maneuver', label: 'Maneuver' } }, when: ['attack:unarmed'] },
          { type: 'HitRider', label: 'Element', damageTypeFrom: 'flags.essence20.element', when: ['weapon:name~saber'] },
        ) },
      ],
    });
    const punch = { damageValue: 2, damageType: 'blunt' };
    hitRiderOnAttack(attacker, null, punch, { itemUuid: 'Item.lone' }, tools());
    expect(punch.riderOptions).toEqual([expect.objectContaining({ label: 'Maneuver', damageValue: 1, damageType: 'maneuver' })]);
    expect(punch.damageValue).toBe(2);
    const cut = { damageValue: 2, damageType: 'sharp' };
    hitRiderOnAttack(attacker, null, cut, { itemUuid: 'Item.cut' }, tools());
    expect(cut).toMatchObject({ damageValue: 3, damageType: 'cold' });
  });

  test('watch: ally - an ally on the holder\'s side gets the note once, wherever the holder is', () => {
    const rule = { type: 'HitRider', label: 'Sway', watch: 'ally', note: 1, when: ['item:damageType:stun'] };
    makeActor('Face', { items: [{ name: 'Sway', type: 'perk', flags: { core: { sourceId: 'Compendium.x.Item.sway' } }, ...rules(rule) }] });
    makeActor('Face 2', { items: [{ name: 'Sway', type: 'perk', flags: { core: { sourceId: 'Compendium.x.Item.sway' } }, ...rules(rule) }] });
    const ally = makeActor('Ally', { items: [{ id: 'fist', type: 'weaponEffect', name: 'Fist', system: { damageValue: 1, damageType: 'stun' } }] });
    const foe = makeActor('Foe', { disposition: -1, items: [{ id: 'claw', type: 'weaponEffect', name: 'Claw', system: { damageValue: 1, damageType: 'stun' } }] });
    const hit = { damageValue: 1, damageType: 'stun' };
    hitRiderOnAttack(ally, null, hit, { itemUuid: ally.items.contents[0].uuid, damageType: 'stun' }, tools());
    expect(hit.damageValue).toBe(2);
    const enemy = { damageValue: 1, damageType: 'stun' };
    hitRiderOnAttack(foe, null, enemy, { itemUuid: foe.items.contents[0].uuid, damageType: 'stun' }, tools());
    expect(enemy.damageValue).toBe(1);
    // The holder's own hits don't count.
    const face = game.actors.contents[0];
    const own = { damageValue: 1, damageType: 'stun' };
    hitRiderOnAttack(face, null, own, { damageType: 'stun' }, tools());
    expect(own.damageValue).toBe(2);
  });

  test('marked: the rule acts on hits by whoever carries the holder\'s mark, until it runs out', () => {
    const caster = makeActor('Caster', { items: [{ name: 'Soften', type: 'spell', ...rules({ type: 'HitRider', label: 'Soften', negate: true, marked: 'soft' }) }] });
    const brute = makeActor('Brute', { disposition: -1, flags: { ruleMarks: { soft: { by: caster.uuid, until: null } } } });
    const hit = { damageValue: 4, damageType: 'blunt' };
    hitRiderOnAttack(brute, null, hit, {}, tools());
    expect(hit.damageValue).toBe(0);
    delete brute.flags.essence20.ruleMarks.soft;
    const next = { damageValue: 4 };
    hitRiderOnAttack(brute, null, next, {}, tools());
    expect(next.damageValue).toBe(4);
  });

  test('on: cast - a successful spell row with damage gets the note; a weapon attack does not', async () => {
    const mage = makeActor('Mage', {
      items: [
        { id: 'fb', type: 'spell', name: 'Fireball', system: { damageType: 'fire' } },
        { id: 'sw', type: 'weaponEffect', name: 'Sword', system: { damageType: 'fire' } },
        { name: 'Bang', type: 'perk', ...rules({ type: 'HitRider', label: 'Bang', on: 'cast', note: 1, when: ['item:type:spell', 'item:damageType:fire'] }) },
      ],
    });
    const rows = [{ success: true, damageValue: 2 }, { success: false, damageValue: 2 }, { success: true, damageValue: 0 }];
    await hitRiderOnCast(mage, rows, { damageType: 'fire' }, { rider: { itemUuid: 'Item.fb' } });
    expect(rows.map(r => r.damageValue)).toEqual([3, 2, 0]);
    expect(rows[0].damageBonusLabel).toBe('+1 (Bang)');
    const sword = [{ success: true, damageValue: 2 }];
    await hitRiderOnCast(mage, sword, {}, { rider: { itemUuid: 'Item.sw' } });
    expect(sword[0].damageValue).toBe(2);
    // An attack-mode rule never fires on a cast.
    const t = tools();
    hitRiderOnAttack(mage, null, { damageValue: 2 }, { itemUuid: 'Item.fb' }, t);
    expect(t.damageBonusNote).not.toHaveBeenCalled();
  });
});

describe('Veto and ArmorPair', () => {
  test('validates', () => {
    expect(validateRule({ type: 'Veto', on: 'create', items: ['item:type:perk'] })).toEqual([]);
    expect(validateRule({ type: 'Veto', on: 'create' })).toEqual(['create needs items (a list of item: tags)']);
    expect(validateRule({ type: 'Veto', on: 'update', path: 'flags.x' })).toEqual(['update needs a path starting with system.']);
    expect(validateRule({ type: 'ArmorPair', items: ['item:type:armor'] })).toContain('other is required');
  });

  test('create and equip vetoes; the hooks refuse and warn', () => {
    const actor = makeActor('Hero', { items: [{ name: 'Hang-Up', type: 'hangUp', ...rules(
      { type: 'Veto', on: 'create', items: ['item:id:WEIRD'], message: '{name} cannot' },
      { type: 'Veto', on: 'equip', items: ['item:name~cursed'] },
    ) }] });
    const weird = { name: 'Weird', type: 'perk', flags: { core: { sourceId: 'Compendium.x.Item.WEIRD' } }, parent: actor };
    expect(itemVeto(actor, weird, 'create')).not.toBeNull();
    expect(hooks.preCreateItem.map(fn => fn(weird)).includes(false)).toBe(true);
    expect(ui.notifications.warn).toHaveBeenCalledWith('Hero cannot');
    expect(hooks.preCreateItem.every(fn => fn({ name: 'Other', type: 'perk', parent: actor }) !== false)).toBe(true);
    const cursed = { name: 'Cursed Blade', type: 'weapon', system: { equipped: false }, parent: actor };
    expect(hooks.preUpdateItem.map(fn => fn(cursed, { system: { equipped: true } })).includes(false)).toBe(true);
    expect(hooks.preUpdateItem.every(fn => fn(cursed, { system: { equipped: false } }) !== false)).toBe(true);
  });

  test('update vetoes: clamp keeps the old value, a plain one refuses the update; marked ones land on the marked', async () => {
    const holder = makeActor('Cuffer', { items: [{ name: 'Cuffs', type: 'gear', ...rules(
      { type: 'Veto', on: 'update', marked: 'rust', path: 'system.health.value', change: 'up', clamp: true },
      { type: 'Veto', on: 'update', marked: 'cuffed', path: 'system.isTransformed', message: 'no' },
      { type: 'Veto', on: 'update', marked: 'cuffed', path: 'system.energon.normal.value', change: 'down' },
    ) }] });
    const prisoner = makeActor('Bot', { system: { health: { value: 2, max: 10 }, isTransformed: false, energon: { normal: { value: 3 } } } });
    const heal = { system: { health: { value: 5 } } };
    expect(checkActorUpdate(prisoner, heal)).toBe(true);
    expect(heal.system.health.value).toBe(5);
    prisoner.flags.essence20.ruleMarks = { rust: { by: holder.uuid }, cuffed: { by: holder.uuid } };
    expect(checkActorUpdate(prisoner, heal)).toBe(true);
    expect(heal.system.health.value).toBe(2);
    expect(checkActorUpdate(prisoner, { system: { health: { value: 1 } } })).toBe(true);
    expect(checkActorUpdate(prisoner, { system: { isTransformed: true } })).toBe(false);
    expect(checkActorUpdate(prisoner, { system: { isTransformed: false } })).toBe(true);
    expect(checkActorUpdate(prisoner, { system: { energon: { normal: { value: 2 } } } })).toBe(false);
    expect(checkActorUpdate(prisoner, { system: { energon: { normal: { value: 4 } } } })).toBe(true);
    expect(checkActorUpdate(holder, { system: { isTransformed: true } })).toBe(true);
  });

  test('ArmorPair allows a matching pair either way round', () => {
    const actor = makeActor('Marine', { items: [
      { name: 'Bio-Tech', type: 'perk', ...rules({ type: 'ArmorPair', items: ['item:hasUpgrade:name~organic'], other: ['item:trait:computerized'] }) },
      { id: 'org', name: 'Suit', type: 'armor' }, { name: 'Organic Battledress', type: 'upgrade', flags: { essence20: { parentId: 'org' } } },
      { id: 'cpu', name: 'Rig', type: 'armor', system: { traits: ['computerized'] } }, { id: 'plain', name: 'Plain', type: 'armor' },
    ] });
    const [, org, , cpu, plain] = actor.items.contents;
    expect(ruleAllowsArmorPair(actor, org, cpu)).toBe(true);
    expect(ruleAllowsArmorPair(actor, cpu, org)).toBe(true);
    expect(ruleAllowsArmorPair(actor, org, plain)).toBe(false);
    expect(ruleAllowsArmorPair(makeActor('Other'), org, cpu)).toBe(false);
  });
});

describe('ignoreArmor and armor shred', () => {
  test('validates', () => {
    expect(validateRule({ type: 'Defense', defense: 'any', mode: 'ignoreArmor', outgoing: true })).toEqual([]);
    expect(validateRule({ type: 'Defense', defense: 'any', mode: 'ignoreArmor' })).toContain('ignoreArmor needs outgoing: true (it changes the target\'s Defense)');
    expect(validateRule({ type: 'Defense', defense: 'toughness', amount: 1, armor: 'worn' })).toContain('armor only goes with mode ignoreArmor');
  });

  test('the attacked Defense\'s armor share, the Morphed value, nothing when Armor Stripped; worn armor for Toughness', () => {
    const attacker = makeActor('Flamer', { items: [
      { id: 'fx', name: 'Flames', type: 'weaponEffect', ...rules({ type: 'Defense', defense: 'any', mode: 'ignoreArmor', outgoing: true, when: ['item:own'] }) },
      { name: 'Comms', type: 'perk', ...rules({ type: 'Defense', defense: 'toughness', mode: 'ignoreArmor', armor: 'worn', outgoing: true, when: ['self:marked:comms'] }) },
    ] });
    const fx = attacker.items.contents[0];
    const morphed = makeActor('Ranger', { system: { isMorphed: true, defenses: { cleverness: { armor: 0, morphed: 2 } } } });
    expect(ignoreArmorAdjust(attacker, morphed, 'cleverness', { item: fx })).toBe(-2);
    morphed.statuses.add('armorStripped');
    expect(ignoreArmorAdjust(attacker, morphed, 'cleverness', { item: fx })).toBe(0);
    const plain = makeActor('Thug', { system: { defenses: { cleverness: { armor: 1 }, toughness: { armor: 1 } } }, items: [{ type: 'armor', system: { equipped: true, totalBonusToughness: 2 } }] });
    expect(ignoreArmorAdjust(attacker, plain, 'cleverness', { item: { type: 'weaponEffect', id: 'other' } })).toBe(0);
    attacker.flags.essence20.ruleMarks = { comms: { by: attacker.uuid } };
    expect(ignoreArmorAdjust(attacker, plain, 'toughness', {})).toBe(-3);
    expect(ignoreArmorAdjust(attacker, plain, 'willpower', {})).toBe(0);
  });

  test('shredArmor adds up on the target and Toughness loses it, at most the armor share', async () => {
    const zord = makeActor('Zord', { items: [{ name: 'Anti-Armor', type: 'feature' }] });
    const foe = makeActor('Foe', { system: { defenses: { toughness: { total: 15, armor: 3, string: '12' } } } });
    const ctx = stepContext({ actor: zord, item: zord.items.contents[0], targets: [foe] });
    await runSteps([{ do: 'shredArmor', to: 'target', amount: 2 }], ctx);
    await runSteps([{ do: 'shredArmor', to: 'target', amount: 2 }], ctx);
    expect(foe.flags.essence20.ruleMarks.armorShred).toMatchObject({ count: 4, until: 'scene' });
    armorShredDerived(foe);
    expect(foe.system.defenses.toughness.total).toBe(12);
    expect(foe.system.defenses.toughness.string).toContain('- 3');
    const bare = makeActor('Bare', { system: { defenses: { toughness: { total: 10, armor: 0 } } }, flags: { ruleMarks: { armorShred: { count: 2 } } } });
    armorShredDerived(bare);
    expect(bare.system.defenses.toughness.total).toBe(10);
    expect(stepErrors([{ do: 'shredArmor', amount: 'x +' }])).toHaveLength(1);
  });
});

describe('steps, tags and events', () => {
  test('push: the actor away from the target; @var.pushed', async () => {
    const hero = makeActor('Hero');
    const foe = makeActor('Foe');
    const ctx = stepContext({ actor: hero, item: {}, targets: [foe] });
    await runSteps([{ do: 'push', feet: 10 }], ctx);
    expect(pushed).toEqual([{ name: 'Hero', from: 'Foe', feet: 10 }]);
    expect(ctx.vars.pushed).toBe(1);
    const none = stepContext({ actor: hero, item: {}, targets: [] });
    await runSteps([{ do: 'push', feet: 10 }], none);
    expect(none.vars.pushed).toBe(0);
    await runSteps([{ do: 'push', to: 'target', feet: 5 }], ctx);
    expect(pushed[1]).toEqual({ name: 'Foe', from: 'Hero', feet: 5 });
    expect(stepErrors([{ do: 'push', from: 'nowhere' }])).toHaveLength(1);
  });

  test('actAs runs steps as the recipient; collect retargets without the canvas', async () => {
    const hero = makeActor('Hero', { x: 0 });
    const near = makeActor('Near', { x: 10, system: { health: { value: 4, max: 10 } } });
    makeActor('Healthy', { x: 10 });
    const patched = makeActor('Patched', { x: 10, system: { health: { value: 1, max: 10 } } });
    const ctx = stepContext({ actor: hero, item: {}, targets: [patched] });
    await runSteps([{ do: 'collect', to: 'all:30', filter: ['target:data:system.health.value<$system.health.max'], without: 'targets', required: true }], ctx);
    expect(ctx.targets.map(a => a.name)).toEqual(['Near']);
    expect(canvas.tokens.setTargets).not.toHaveBeenCalled();
    await runSteps([{ do: 'actAs', to: 'target', steps: [{ do: 'chat', text: '{name} acts' }] }], ctx);
    expect(ctx.chat).toContain('Near acts');
    const empty = stepContext({ actor: hero, item: {}, targets: [] });
    expect(await runSteps([{ do: 'collect', to: 'all:1', required: true }, { do: 'chat', text: 'never' }], empty)).toBe(false);
    expect(near.name).toBe('Near');
    expect(stepErrors([{ do: 'actAs' }])).toEqual(['steps[0]: actAs needs steps']);
  });

  test('rollFormulaVsEach: one roll per recipient against its Defense (best of a list)', async () => {
    const totals = [12, 8];
    global.Roll = class {
      constructor(formula) {
        this.formula = formula;
      }

      async evaluate() {
        this.total = totals.shift();
        return this;
      }
    };
    const gm = makeActor('GM');
    const a = makeActor('A', { system: { defenses: { toughness: { total: 11 } } } });
    const b = makeActor('B', { system: { defenses: { toughness: { total: 5 }, evasion: { total: 9 } } } });
    const ctx = stepContext({ actor: gm, item: {}, targets: [a, b] });
    await runSteps([{ do: 'rollFormulaVsEach', formula: '2d20kh + 1d8', defense: ['toughness', 'evasion'], onHit: [{ do: 'chat', text: 'hit {target}' }], onMiss: [{ do: 'chat', text: 'miss {target}' }] }], ctx);
    expect(ctx.chat.filter(line => /^(hit|miss)/.test(line))).toEqual(['hit A', 'miss B']);
    expect(ctx.vars.hits).toBe(1);
    expect(stepErrors([{ do: 'rollFormulaVsEach', defense: 'luck' }])).toHaveLength(2);
  });

  test('healAction and actWhileDefeated', async () => {
    const medic = makeActor('Medic');
    const down = makeActor('Down', { statuses: ['defeated'] });
    const ctx = stepContext({ actor: medic, item: {}, targets: [down] });
    await runSteps([{ do: 'healAction', to: 'target', amount: 2 }, { do: 'actWhileDefeated' }], ctx);
    expect(restored).toEqual([{ healer: 'Medic', target: 'Down', amount: 2 }]);
    expect(stamped).toEqual([{ name: 'Medic', key: 'actWhileDefeatedThisTurn' }]);
  });

  test('self:limitUsed reads a keyed limit in its window', async () => {
    const hero = makeActor('Hero');
    game.combat = { id: 'c', started: true, round: 1, turn: 0 };
    const ctx = contextFor({ self: hero });
    expect(evaluateTag('self:limitUsed:roll', ctx)).toBe(false);
    await recordUse(hero, { limit: { per: 'turn', key: 'roll' } }, null, 0);
    expect(evaluateTag('self:limitUsed:roll', ctx)).toBe(true);
    game.combat.turn = 1;
    expect(evaluateTag('self:limitUsed:roll:turn', contextFor({ self: hero }))).toBe(false);
  });

  test('damage:attack / damage:melee read the card the GM applied to this actor', () => {
    const hero = makeActor('Hero');
    const ctx = contextFor({ self: hero, damageType: 'blunt', damageAmount: 3 });
    expect(evaluateTag('damage:attack', ctx)).toBe(false);
    lastApply = { isAttack: true, isMelee: true, targetUuid: hero.uuid };
    expect(evaluateTag('damage:attack', ctx)).toBe(true);
    expect(evaluateTag('damage:melee', ctx)).toBe(true);
    lastApply = { isAttack: true, isMelee: false, targetUuid: 'Actor.someoneElse' };
    expect(evaluateTag('damage:attack', ctx)).toBe(false);
    expect(evaluateTag('damage:attack', contextFor({ self: hero }))).toBeNull();
  });

  test('patchedUp fires on a successful Patch Up, with the amount and the patched creature', async () => {
    const medic = makeActor('Medic', { items: [{ name: 'Intensive', type: 'perk', ...rules({ type: 'Trigger', event: 'patchedUp', when: ['skill:technology', 'var:amount>0'], steps: [{ do: 'chat', text: '{target} for {var.amount}' }] }) }] });
    const patient = makeActor('Patient');
    game.user.targets = new Set([patient.token]);
    game.user.targets.first = () => patient.token;
    await firePatchedUp(medic, [{ success: true }], { isPatchUpAttempt: true, patchUpAmount: 3 }, { rider: { skill: 'technology' } });
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Patient for 3') }));
    ChatMessage.create.mockClear();
    await firePatchedUp(medic, [{ success: false }], { isPatchUpAttempt: true, patchUpAmount: 3 }, { rider: { skill: 'technology' } });
    await firePatchedUp(medic, [{ success: true }], { isPatchUpAttempt: true, patchUpAmount: 3 }, { rider: { skill: 'science' } });
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });

  test('the roll\'s dataset reaches hit / miss Triggers (roll:dataset:<key>)', async () => {
    const hero = makeActor('Hero', { items: [{ name: 'Expert', type: 'perk', ...rules({ type: 'Trigger', event: 'miss', when: ['roll:dataset:isTakedown'], steps: [{ do: 'chat', text: 'missed {target}' }] }) }] });
    const foe = makeActor('Foe', { disposition: -1 });
    const results = [{ targetUuid: foe.uuid, success: false }];
    await runPostRoll(hero, results, {}, { hits: [{ target: foe, hit: false, result: results[0] }], rider: { dataset: { isTakedown: true } } });
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('missed Foe') }));
    ChatMessage.create.mockClear();
    await runPostRoll(hero, results, {}, { hits: [{ target: foe, hit: false, result: results[0] }], rider: { dataset: {} } });
    expect(ChatMessage.create.mock.calls.some(([data]) => String(data.content).includes('missed'))).toBe(false);
  });
});

describe('rule types read by hand-written code', () => {
  test('MissImmunity, SneakAttackImmunity and CrashProtection', () => {
    const holder = makeActor('Holder', { items: [
      { name: 'Seconds', type: 'perk', ...rules({ type: 'MissImmunity', when: ['defense:evasion'] }) },
      { name: 'Trick', type: 'perk', ...rules({ type: 'SneakAttackImmunity' }) },
      { name: 'Cage', type: 'perk', ...rules({ type: 'CrashProtection' }) },
    ] });
    expect(ruleIgnoresMissEffects(holder, 'evasion')).toBe(true);
    expect(ruleIgnoresMissEffects(holder, 'toughness')).toBe(false);
    expect(ruleSneakAttackImmune(holder)).toBe(true);
    expect(crashProtectionOf(holder)?.name).toBe('Cage');
    const nobody = makeActor('Nobody');
    expect(ruleIgnoresMissEffects(nobody, 'evasion') || ruleSneakAttackImmune(nobody) || !!crashProtectionOf(nobody)).toBe(false);
    expect(ruleIgnoresMissEffects(null, 'evasion')).toBe(false);
  });
});

describe('attacks a rule makes, rollFlat, markedByMe, HideBonus', () => {
  test('attack: the rolled attack again at the target, with dataset flags; a cancelled roll stops the run', async () => {
    const hero = makeActor('Hero', { items: [{ id: 'gun', type: 'weapon' }, { id: 'shot', type: 'weaponEffect', name: 'Shot', flags: { essence20: { parentId: 'gun' } } }] });
    const shot = hero.items.get('shot');
    shot.roll = jest.fn(async () => ({}));
    const foe = makeActor('Foe', { disposition: -1 });
    const ctx = stepContext({ actor: hero, item: {}, targets: [foe] });
    ctx.vars.rolledItem = shot.uuid;
    expect(await runSteps([{ do: 'attack', item: 'rolled', dataset: { followUp: 'x' } }], ctx)).toBe(true);
    expect(canvas.tokens.setTargets).toHaveBeenCalledWith([foe.token.id]);
    expect(shot.roll).toHaveBeenCalledWith({ bypassEconomy: true, followUp: 'x' });
    shot.roll.mockResolvedValueOnce({ cancelled: true });
    expect(await runSteps([{ do: 'attack', item: 'rolled' }, { do: 'chat', text: 'after' }], ctx)).toBe(false);
    const none = stepContext({ actor: hero, item: {}, targets: [] });
    expect(await runSteps([{ do: 'attack', item: 'name~Shot' }], none)).toBe(false);
    expect(stepErrors([{ do: 'attack', dataset: 'x' }])).toHaveLength(1);
  });

  test('attackEach: every creature in the attack\'s range meeting the filter; action and pay first; none - stop with the message', async () => {
    const hero = makeActor('Hero', { items: [{ id: 'gun', type: 'weapon' }, { id: 'shot', type: 'weaponEffect', name: 'Shot', flags: { essence20: { parentId: 'gun' } }, system: { range: { value: 20 } } }] });
    const shot = hero.items.get('shot');
    shot.roll = jest.fn(async () => ({}));
    const near = makeActor('Near', { x: 10, disposition: -1 });
    makeActor('Pal', { x: 10, disposition: 1 });
    makeActor('Far', { x: 50, disposition: -1 });
    const ctx = stepContext({ actor: hero, item: { flags: { essence20: { rules: { choices: { attack: 'shot' } } } } }, targets: [] });
    ctx.item.flags = { essence20: { rules: { choices: { attack: 'shot' } } } };
    await runSteps([{ do: 'attackEach', item: 'choice:attack', filter: ['not:target:ally'], action: 'wholeTurn', pay: [{ do: 'chat', text: 'paid' }] }], ctx);
    expect(ctx.vars.attacked).toBe(1);
    expect(ctx.chat).toContain('paid');
    expect(canvas.tokens.setTargets).toHaveBeenLastCalledWith([near.token.id]);
    expect(shot.roll).toHaveBeenCalledTimes(1);
    expect(attackRange({ system: { range: { reachMultiplier: 2 } } })).toBe(10);
    const empty = stepContext({ actor: hero, item: ctx.item, targets: [] });
    expect(await runSteps([{ do: 'attackEach', item: 'choice:attack', filter: ['target:name~nobody'], message: 'none here' }], empty)).toBe(false);
    expect(empty.chat).toEqual(['none here']);
    expect(stepErrors([{ do: 'attackEach', action: 'nap' }])).toHaveLength(1);
  });

  test('self:canSpendStoryPoints asks the Story Point gate (payable when no helpers are wired)', () => {
    expect(evaluateTag('self:canSpendStoryPoints', contextFor({ self: makeActor('Hero') }))).toBe(true);
    expect(evaluateTag('self:canSpendStoryPoints', contextFor({}))).toBeNull();
  });

  test('rollFlat: a flat DIF (a formula reading the target), targets cleared; success / failure branches; a cancelled roll stops', async () => {
    const hero = makeActor('Hero');
    const foe = makeActor('Foe', { system: { defenses: { toughness: { total: 11 }, evasion: { total: 12 } } } });
    const ctx = stepContext({ actor: hero, item: {}, targets: [foe] });
    await runSteps([{ do: 'rollFlat', skill: 'might', dif: 'max(@target.system.defenses.toughness.total, @target.system.defenses.evasion.total)', onSuccess: [{ do: 'chat', text: 'yes' }], onFail: [{ do: 'chat', text: 'no' }] }], ctx);
    expect(flatRolls.at(-1)).toEqual({ name: 'Hero', skill: 'might', dif: 12 });
    expect(ctx.chat).toEqual(['yes']);
    await runSteps([{ do: 'rollFlat', skill: 'might', dif: 15, onFail: [{ do: 'chat', text: 'no' }] }], ctx);
    expect(ctx.chat).toEqual(['yes', 'no']);
    expect(await runSteps([{ do: 'rollFlat', skill: 'might', dif: 25 }, { do: 'chat', text: 'never' }], ctx)).toBe(false);
    expect(stepErrors([{ do: 'rollFlat' }])).toEqual(['steps[0]: rollFlat needs a skill']);
  });

  test('markedByMe:<key> reaches whoever carries the actor\'s mark (perSetter too)', () => {
    const setter = makeActor('Setter');
    const other = makeActor('Other');
    makeActor('A', { flags: { ruleMarks: { [`fear--${setter.id}`]: { by: setter.uuid } } } });
    makeActor('B', { flags: { ruleMarks: { fear: { by: setter.uuid } } } });
    makeActor('C', { flags: { ruleMarks: { fear: { by: other.uuid } } } });
    const ctx = stepContext({ actor: setter, item: {}, targets: [] });
    expect(recipients({ to: 'markedByMe:fear' }, ctx).map(actor => actor.name).sort()).toEqual(['A', 'B']);
    expect(stepErrors([{ do: 'chat', to: 'markedByMe:fear' }])).toEqual([]);
  });

  test('HideBonus adds while its condition holds', () => {
    const bot = makeActor('Bot', { system: { isTransformed: true }, items: [{ name: 'Sneak', type: 'perk', ...rules({ type: 'HideBonus', amount: 5, when: ['self:transformed'] }, { type: 'HideBonus', amount: 1, when: ['skill:infiltration'] }) }] });
    expect(ruleHideBonus(bot, { rolledSkill: 'infiltration' })).toBe(6);
    expect(ruleHideBonus(bot, { rolledSkill: 'athletics' })).toBe(5);
    expect(validateRule({ type: 'HideBonus' })).toEqual(['amount is required']);
  });
});
