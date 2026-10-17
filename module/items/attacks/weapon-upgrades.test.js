import { jest } from '@jest/globals';
import { existsSync, readdirSync, readFileSync } from 'fs';
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({ setEntryAndAddItem: jest.fn(async () => 'key1') }));
const {
  affectsGeneratedEffects, applyToEffect, chosenElement, desiredGeneratedEffects, gainedElementTraits,
  syncGeneratedEffects, UPGRADE,
} = await import('./weapon-upgrades.mjs');

global.foundry = {
  data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: {
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

// The pack's own rules ride along, like a real copy (generated alternates are AlternateEffect rules).
function packRules(id) {
  for (const dir of readdirSync('packs')) {
    const src = `packs/${dir}/_source`;
    const file = existsSync(src) ? readdirSync(src).find(name => name.endsWith(`_${id}.json`)) : null;
    if (file) {
      return JSON.parse(readFileSync(`${src}/${file}`, 'utf8')).system.rules ?? [];
    }
  }

  return [];
}

let nextUpgrade = 1;
const upgrade = (id, weaponId, extra = {}) => ({
  id: `u${nextUpgrade++}`, type: 'upgrade', name: id, flags: { core: { sourceId: `Compendium.essence20.tf_crb.Item.${id}` }, essence20: { parentId: weaponId, ...extra.flags } },
  system: { traits: extra.traits ?? [], rules: packRules(id) },
});
const NONLETHAL = 'QbfY2NGNmUmKa6uO';
const FOLDING_STOCK = 'bChPSldjpYZgAnIh';
const TRACER_ROUNDS = 'uT2aZsKK307koPCu';

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
  // (Scope, Aerodynamics, Swift, Deadly, Eruptive, Lingering, Tossable Vial and Chrono-Trigger are item rules:
  // rules/conv14-systems.test.js.)
  test("a bomb's range becomes Reach", () => {
    const blast = makeEffect('w1', { radius: 10, damageType: 'stun' });
    makeActor([makeWeapon(), blast, upgrade(UPGRADE.timeBomb, 'w1')]);
    applyToEffect(blast.system, blast);
    expect(blast.system.radius).toBe(10);
    expect(blast.system.range.value).toBeNull();
    expect(blast.system.range.reachMultiplier).toBe(1);
  });

  // (Rust Derivatives' 1 Acid is its ItemModifier stage item rule - rules/conv17-Split1.test.js.)
  test("an Element weapon deals its chosen element", () => {
    const weapon = makeWeapon('w1', { traits: ['element'], elementChoice: 'fire' });
    const effect = makeEffect('w1', { damageType: 'element' });
    makeActor([weapon, effect]);
    applyToEffect(effect.system, effect);
    expect(effect.system.damageType).toBe('fire');
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

  test("no weapon, no changes", () => {
    const effect = makeEffect('gone');
    makeActor([effect]);
    applyToEffect(effect.system, effect);
    expect(effect.system.upgradeTouched).toEqual([]);
  });
});

describe("granted alternate effects", () => {
  test("Nonlethal, Tracer Rounds and a gained Laser trait each ask for their alternate", () => {
    const weapon = makeWeapon();
    const effect = makeEffect();
    makeActor([weapon, effect, upgrade(NONLETHAL, 'w1'), upgrade('Reactor', 'w1', { traits: ['laser'] })]);
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

  test("Folding Stock copies the primary as a one-handed alternate at ↓2", () => {
    const weapon = makeWeapon();
    makeActor([weapon, makeEffect(), upgrade(FOLDING_STOCK, 'w1')]);
    const folding = desiredGeneratedEffects(weapon).find(w => w.key == 'foldingStock');
    expect(folding.changes).toEqual({ numHands: 1, shiftDown: 2 });
  });

  test("the sync creates what's missing and deletes what's no longer granted", async () => {
    const weapon = makeWeapon();
    const effect = makeEffect();
    const stale = { id: 'old', type: 'weaponEffect', flags: { essence20: { parentId: 'w1', generatedKey: 'w1:covering' } }, system: {} };
    const actor = makeActor([weapon, effect, stale, upgrade(TRACER_ROUNDS, 'w1')]);

    const result = await syncGeneratedEffects(actor);

    expect(result).toEqual({ created: 1, deleted: 1 });
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['old']);
    expect(actor.createEmbeddedDocuments.mock.calls[0][1][0].flags.essence20.generatedKey).toBe('w1:spot');
  });

  test("Big Swing (a Perk's rule) gives heavy Ballistic weapons the two bludgeon alternates, and nothing else", () => {
    const heavy = makeWeapon('w1', { traits: ['ballistic'], classification: { size: 'heavy' } });
    const rifle = makeWeapon('w2', { traits: ['ballistic'] });
    const perk = { id: 'p1', type: 'perk', name: 'Big Swing', flags: { core: { sourceId: 'Compendium.essence20.ferocious_fighters.Item.sHJakOYf1rgVP6Pv' } }, system: { rules: packRules('sHJakOYf1rgVP6Pv') } };
    makeActor([heavy, rifle, makeEffect('w1'), { ...makeEffect('w2'), id: 'e2' }, perk]);
    const swing = desiredGeneratedEffects(heavy).filter(w => w.key.startsWith('bigSwing'));
    expect(swing.map(w => [w.key, w.changes.damageValue, w.changes['classification.skill']])).toEqual([['bigSwing', 1, 'might'], ['bigSwing2', 2, 'might']]);
    expect(desiredGeneratedEffects(rifle).filter(w => w.key.startsWith('bigSwing'))).toEqual([]);
    expect(affectsGeneratedEffects(perk)).toBe(true);
  });

  // Round 17 (split1): was the hand-written WEAPON_PERK.fluidMotion entry.
  test("Fluid Motion (a Perk's rule) gives Silent Martial Arts weapons a Maneuver alternate, unless they print one", () => {
    const fists = makeWeapon('w1', { traits: ['silent', 'martialArts'] });
    const loud = makeWeapon('w2', { traits: ['martialArts'] });
    const printed = makeWeapon('w3', { traits: ['silent', 'martialArts'] });
    const perk = { id: 'p1', type: 'perk', name: 'Fluid Motion', flags: { core: { sourceId: 'Compendium.essence20.intercontinental_adventures.Item.TESyOcJFtd9Qn9Tk' } }, system: { rules: packRules('TESyOcJFtd9Qn9Tk') } };
    makeActor([fists, loud, printed, makeEffect('w1'), { ...makeEffect('w2'), id: 'e2' }, { ...makeEffect('w3'), id: 'e3' },
      { ...makeEffect('w3', { damageType: 'maneuver' }), id: 'e4' }, perk]);
    const maneuver = desiredGeneratedEffects(fists).find(w => w.key == 'fluidMotion');
    expect(maneuver.changes).toEqual({ damageType: 'maneuver', damageValue: 1, shiftDown: 0, 'secondaryDamage.type': null, 'secondaryDamage.value': 0 });
    expect(maneuver.name).toBe('E20.DamageManeuver (Rifle)');
    expect(desiredGeneratedEffects(loud).find(w => w.key == 'fluidMotion')).toBeUndefined();
    expect(desiredGeneratedEffects(printed).find(w => w.key == 'fluidMotion')).toBeUndefined();
    expect(affectsGeneratedEffects(perk)).toBe(true);
  });

  test("Strobe is skipped when the weapon already prints a Blinding effect", () => {
    const weapon = makeWeapon();
    const blinding = { ...makeEffect('w1', { damageType: 'blindingBlast' }), id: 'e9' };
    makeActor([weapon, makeEffect(), blinding, upgrade('Bd7nMQQmv0MFrsjO', 'w1')]);
    expect(desiredGeneratedEffects(weapon).map(w => w.key)).not.toContain('strobe');
    const plain = makeWeapon();
    makeActor([plain, makeEffect(), upgrade('Bd7nMQQmv0MFrsjO', 'w1')]);
    expect(desiredGeneratedEffects(plain).map(w => w.key)).toContain('strobe');
  });

  test("Pistol Whip (an External Ballistic weapon) and Specialty Flexibility (the Long Range Rifle) generate their alternates", () => {
    const gun = makeWeapon('g', { traits: ['ballistic'], hardpoint: { type: 'external' } });
    const lrr = { ...makeWeapon('l', { traits: ['ballistic'], hardpoint: { type: 'integrated' } }), name: 'Long Range Rifle' };
    const perk = id => ({ id, type: 'perk', name: id, flags: {}, system: { rules: packRules(id) } });
    makeActor([gun, lrr, makeEffect('g'), { ...makeEffect('l'), id: 'e2' }, perk('fiSowblyLmO9dN8F'), perk('2XuM8xyiRhMdNBMg')]);
    expect(desiredGeneratedEffects(gun).map(w => w.key)).toEqual(['pistolWhipStun', 'pistolWhipBlunt', 'pistolWhipManeuver']);
    expect(desiredGeneratedEffects(lrr).map(w => w.key)).toEqual(['sfStun', 'sfIntimidate', 'sfManeuver']);
  });

  test("an effect the old other3 sync made is kept, not made again", async () => {
    const gun = makeWeapon('g', { traits: ['ballistic'] });
    const old = { id: 'old', type: 'weaponEffect', flags: { essence20: { parentId: 'g', o3GeneratedKey: 'g:pistolWhipStun' } }, system: {} };
    const perk = { id: 'p', type: 'perk', name: 'Pistol Whip', flags: {}, system: { rules: packRules('fiSowblyLmO9dN8F') } };
    const actor = makeActor([gun, makeEffect('g'), old, perk]);
    const result = await syncGeneratedEffects(actor);
    expect(result).toEqual({ created: 2, deleted: 0 });
  });

  test("which changes trigger a sync", () => {
    expect(affectsGeneratedEffects({ type: 'upgrade', flags: { essence20: { parentId: 'w1' } } })).toBe(true);
    expect(affectsGeneratedEffects({ type: 'weapon' }, { system: { elementChoice: 'fire' } })).toBe(true);
    expect(affectsGeneratedEffects({ type: 'weapon' }, { name: 'x' })).toBe(false);
    expect(affectsGeneratedEffects({ type: 'gear' })).toBe(false);
  });
});

// (The crit upgrades' Essence / Defense damage are CriticalOption rules - rules/conv15-systems.test.js; Surging is a DialogSwitch
// rule - rules/conv16-LeftA.test.js.)
