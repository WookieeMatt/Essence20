import { jest } from '@jest/globals';
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({ setEntryAndAddItem: jest.fn(async () => 'key1') }));
const {
  affectsGeneratedEffects, applyToEffect, applyToWeapon, chosenElement, desiredGeneratedEffects, gainedElementTraits,
  getCritEssenceOptions, hasChronoTrigger, canSurge, syncGeneratedEffects, UPGRADE, WEAPON_PERK,
} = await import('./weapon-upgrades.mjs');

global.foundry = {
  utils: {
    setProperty: (obj, path, value) => {
      const parts = path.split('.');
      let o = obj;
      for (const part of parts.slice(0, -1)) {
        o[part] ??= {};
        o = o[part];
      }

      o[parts.at(-1)] = value;
    },
    randomID: () => 'r',
  },
};

const upgrade = (id, weaponId, extra = {}) => ({
  type: 'upgrade', name: id, flags: { core: { sourceId: `Compendium.essence20.tf_crb.Item.${id}` }, essence20: { parentId: weaponId, ...extra.flags } },
  system: { traits: extra.traits ?? [] },
});

function makeActor(items) {
  const list = [...items];
  list.get = id => list.find(i => i.id == id);
  const actor = { uuid: 'Actor.a', items: list, createEmbeddedDocuments: jest.fn(async (t, data) => data.map((d, i) => ({ ...d, id: `new${i}`, setFlag: jest.fn() }))), deleteEmbeddedDocuments: jest.fn() };
  for (const item of list) {
    item.parent = actor;
  }

  return actor;
}

function makeWeapon(id = 'w1', system = {}) {
  return { id, type: 'weapon', name: 'Rifle', system: { traits: [], classification: { size: 'long' }, ...system }, _source: { system: { traits: system.traits ?? [] } }, flags: {}, update: jest.fn() };
}

function makeEffect(weaponId = 'w1', system = {}) {
  const base = { damageType: 'sharp', damageValue: 1, range: { value: 100, long: 400 }, radius: 0, classification: { skill: 'targeting', style: 'projectile' }, numTargets: 1, shiftDown: 0, secondaryDamage: { type: null, value: 0 }, ...system };
  return {
    id: 'e1', type: 'weaponEffect', name: 'Shot', flags: { essence20: { parentId: weaponId } },
    system: JSON.parse(JSON.stringify(base)), _source: { system: JSON.parse(JSON.stringify(base)) },
    toObject() {
      return { name: this.name, type: 'weaponEffect', system: JSON.parse(JSON.stringify(base)), flags: {} };
    },
  };
}

beforeEach(() => {
  global.game = { i18n: { localize: k => k } };
  global.CONFIG = { E20: { weaponSizeHands: { integrated: 0, sidearm: 1, medium: 2, long: 2, heavy: 2 } } };
});

describe("the effect's own numbers", () => {
  test("Scope doubles both ranges; Smart Scope multiplies them 1.5 and 2", () => {
    const weapon = makeWeapon();
    const effect = makeEffect();
    makeActor([weapon, effect, upgrade(UPGRADE.scope, 'w1')]);
    applyToEffect(effect.system, effect);
    expect(effect.system.range).toEqual({ value: 200, long: 800 });
    expect(effect.system.upgradeTouched).toEqual(expect.arrayContaining(['range.value', 'range.long']));

    const smart = makeEffect();
    makeActor([makeWeapon(), smart, upgrade(UPGRADE.smartScope, 'w1')]);
    applyToEffect(smart.system, smart);
    expect(smart.system.range).toEqual({ value: 150, long: 800 });
  });

  test("grips and Automated swap the skill; Swift adds a target; Deadly adds damage", () => {
    const effect = makeEffect();
    makeActor([makeWeapon(), effect, upgrade(UPGRADE.refinedGrip, 'w1'), upgrade(UPGRADE.swift, 'w1'), upgrade(UPGRADE.deadly, 'w1')]);
    applyToEffect(effect.system, effect);
    expect(effect.system.classification.skill).toBe('finesse');
    expect(effect.system.numTargets).toBe(2);
    expect(effect.system.damageValue).toBe(2);
  });

  test("Eruptive doubles a blast, Lingering lengthens Stun, a bomb's range becomes Reach", () => {
    const blast = makeEffect('w1', { radius: 10, damageType: 'stun' });
    makeActor([makeWeapon(), blast, upgrade(UPGRADE.eruptive, 'w1'), upgrade(UPGRADE.lingering, 'w1'), upgrade(UPGRADE.timeBomb, 'w1')]);
    applyToEffect(blast.system, blast);
    expect(blast.system.radius).toBe(20);
    expect(blast.system.damageValue).toBe(2);
    expect(blast.system.range.value).toBeNull();
    expect(blast.system.range.reachMultiplier).toBe(1);
  });

  test("an Element weapon deals its chosen element; Rust Derivatives adds 1 Acid", () => {
    const weapon = makeWeapon('w1', { traits: ['element'], elementChoice: 'fire' });
    const effect = makeEffect('w1', { damageType: 'element' });
    makeActor([weapon, effect, upgrade(UPGRADE.rustDerivatives, 'w1')]);
    applyToEffect(effect.system, effect);
    expect(effect.system.damageType).toBe('fire');
    expect(effect.system.secondaryDamage).toEqual({ type: 'acid', value: 1 });
    expect(chosenElement(weapon)).toBe('fire');
  });

  test("Explosive Ammo gives a ranged weapon a 10ft blast; Utility Loaders changes its damage", () => {
    const weapon = makeWeapon();
    weapon.flags = { essence20: { mutation: { blastSet: 10, damageType: 'cold' } } };
    const effect = makeEffect();
    makeActor([weapon, effect]);
    applyToEffect(effect.system, effect);
    expect(effect.system.radius).toBe(10);
    expect(effect.system.shape).toBe('circle');
    expect(effect.system.damageType).toBe('cold');
  });

  test("Scramble Wave rides 1 Electromagnetic on every attack, even unarmed", () => {
    const effect = makeEffect(null);
    effect.flags.essence20.parentId = null;
    makeActor([effect, { type: 'perk', flags: { core: { sourceId: WEAPON_PERK.scrambleWave } } }]);
    applyToEffect(effect.system, effect);
    expect(effect.system.secondaryDamage).toEqual({ type: 'emp', value: 1 });
  });

  test("no weapon, no changes", () => {
    const effect = makeEffect('gone');
    makeActor([effect]);
    applyToEffect(effect.system, effect);
    expect(effect.system.upgradeTouched).toEqual([]);
  });
});

describe("the weapon itself", () => {
  test("Microtech steps the size down and the hands with it; the Harness wields two-handed in one", () => {
    const weapon = makeWeapon('w1', { effectiveSize: 'long', derivedHands: 2, hands: null });
    makeActor([weapon, upgrade(UPGRADE.microtech, 'w1'), upgrade(UPGRADE.microtech, 'w1')]);
    applyToWeapon(weapon);
    expect(weapon.system.effectiveSize).toBe('sidearm');
    expect(weapon.system.derivedHands).toBe(1);

    const heavy = makeWeapon('w2', { effectiveSize: 'heavy', derivedHands: 2 });
    makeActor([heavy, { type: 'perk', flags: { core: { sourceId: WEAPON_PERK.hyperkineticHarness } } }]);
    applyToWeapon(heavy);
    expect(heavy.system.derivedHands).toBe(1);
  });
});

describe("granted alternate effects", () => {
  test("Nonlethal, Tracer Rounds and a gained Laser trait each ask for their alternate", () => {
    const weapon = makeWeapon();
    const effect = makeEffect();
    makeActor([weapon, effect, upgrade(UPGRADE.nonlethal, 'w1'), upgrade('Reactor', 'w1', { traits: ['laser'] })]);
    const keys = desiredGeneratedEffects(weapon).map(w => w.key);
    expect(keys).toEqual(expect.arrayContaining(['nonlethal', 'spot', 'laserStun']));
    expect(gainedElementTraits(weapon)).toEqual(['laser']);
  });

  test("a gained Sonic trait copies the primary against Willpower at ↓2", () => {
    const weapon = makeWeapon();
    makeActor([weapon, makeEffect(), upgrade('Banshee', 'w1', { traits: ['sonic'] })]);
    const sonic = desiredGeneratedEffects(weapon).find(w => w.key == 'sonic');
    expect(sonic.changes).toEqual({ defenseType: 'willpower', shiftDown: 2 });
  });

  test("the sync creates what's missing and deletes what's no longer granted", async () => {
    const weapon = makeWeapon();
    const effect = makeEffect();
    const stale = { id: 'old', type: 'weaponEffect', flags: { essence20: { parentId: 'w1', generatedKey: 'w1:covering' } }, system: {} };
    const actor = makeActor([weapon, effect, stale, upgrade(UPGRADE.tracerRounds, 'w1')]);

    const result = await syncGeneratedEffects(actor);

    expect(result).toEqual({ created: 1, deleted: 1 });
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['old']);
    expect(actor.createEmbeddedDocuments.mock.calls[0][1][0].flags.essence20.generatedKey).toBe('w1:spot');
  });

  test("which changes trigger a sync", () => {
    expect(affectsGeneratedEffects({ type: 'upgrade', flags: { essence20: { parentId: 'w1' } } })).toBe(true);
    expect(affectsGeneratedEffects({ type: 'weapon' }, { system: { elementChoice: 'fire' } })).toBe(true);
    expect(affectsGeneratedEffects({ type: 'weapon' }, { name: 'x' })).toBe(false);
    expect(affectsGeneratedEffects({ type: 'gear' })).toBe(false);
  });
});

describe("roll-time", () => {
  test("crit upgrades offer their Essence; Surging needs element damage; Chrono-Trigger is found", () => {
    const weapon = makeWeapon();
    makeActor([weapon, upgrade(UPGRADE.bewildering, 'w1'), upgrade(UPGRADE.maiming, 'w1'), upgrade(UPGRADE.surging, 'w1'), upgrade(UPGRADE.chronoTrigger, 'w1')]);
    // The Transformers versions damage a Defense (TF CRB p.129-131).
    expect(getCritEssenceOptions(weapon).map(o => o.defense)).toEqual(['cleverness', 'evasion']);
    expect(canSurge(weapon, { system: { damageType: 'fire' } })).toBe(true);
    expect(canSurge(weapon, { system: { damageType: 'sharp' } })).toBe(false);
    expect(hasChronoTrigger(weapon)).toBe(true);
  });
});
