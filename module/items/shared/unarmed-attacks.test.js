import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPrintedUnarmedWeapon, isUnarmedAttack, parentWeaponOf, UNARMED_WEAPON_IDS } from './unarmed-attacks.mjs';
import { contextFor, evaluateTag } from '../../rules/predicate.mjs';
import { isBarehandedAttack, UNARMED_WEAPON_IDS as REEXPORTED_IDS } from '../../rules/plugins/tags/barehanded-tags.mjs';
import { describeAttack } from '../../mechanics/actions/action-perks.mjs';
import { buildRiderContext } from '../../mechanics/combat/target-riders.mjs';
import { Dice } from '../../dice.mjs';

/**
 * The one "is this attack unarmed?" definition (docs/rules-batches/unarmed-definition.md) and every reader of it.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const PRINTED = {
  gijUnarmedCombat: 'Compendium.essence20.gi_joe_crb.Item.OU9rXvoKfXtcpvFy',
  tfUnarmedCombat: 'Compendium.essence20.tf_crb.Item.OU9rXvoKfXtcpvFy',
  wtnvUnarmedStrike: 'Compendium.essence20.wtnv_citizens_guide.Item.Cwd1FASmKXWiAFom',
  prUnarmedCombat: 'Compendium.essence20.pr_crb.Item.5Y0qpK0gnsupCNHX',
  prStrike: 'Compendium.essence20.pr_crb.Item.YUm8S0ztubmNytbg',
};

let nextId = 1;

/** An actor holding the given items (each gets the actor as its parent). */
function makeActor(items = []) {
  const actor = { id: `a${nextId++}`, type: 'playerCharacter', flags: {}, system: {} };
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  for (const item of items) {
    item.parent = actor;
  }

  return actor;
}

/** A weapon copied from `source` (or unsourced) - the source written the way `how` says. */
function weapon(source = null, how = 'sourceId') {
  const item = { id: `w${nextId++}`, type: 'weapon', name: 'Weapon', flags: {}, _stats: {}, system: { equipped: true, traits: [] } };
  if (source && how == 'sourceId') {
    item.flags.core = { sourceId: source };
  } else if (source && how == 'compendiumSource') {
    item._stats.compendiumSource = source;
  } else if (source && how == 'rulesSource') {
    item.flags.essence20 = { rulesSource: source };
  }

  return item;
}

/** A weaponEffect, hanging off `parent` when given. */
function attack(parent = null, extra = {}) {
  return {
    id: `e${nextId++}`, type: 'weaponEffect', name: 'Attack', flags: { essence20: parent ? { parentId: parent.id } : {} },
    system: { classification: { style: 'melee', skill: 'might' } }, ...extra,
  };
}

/** An actor with one attack of the given weapon (or a weaponless one). */
function armedWith(source, how) {
  const held = source === undefined ? null : weapon(source, how);
  const effect = attack(held);
  const actor = makeActor(held ? [held, effect] : [effect]);
  return { actor, held, effect };
}

describe('isUnarmedAttack - the shared definition', () => {
  test('a weaponEffect with no parent weapon is unarmed', () => {
    const { actor, effect } = armedWith(undefined);
    expect(isUnarmedAttack(effect, actor)).toBe(true);
    // Even with no actor to look on.
    expect(isUnarmedAttack(attack())).toBe(true);
  });

  test.each(Object.entries(PRINTED))('an attack of the printed unarmed weapon %s is unarmed', (key, source) => {
    const { actor, effect } = armedWith(source);
    expect(isUnarmedAttack(effect, actor)).toBe(true);
  });

  test('the PR Unarmed Combat (formerly "Brawling") counts whichever way the copy records its source', () => {
    for (const how of ['sourceId', 'compendiumSource', 'rulesSource']) {
      const { actor, effect } = armedWith(PRINTED.prUnarmedCombat, how);
      expect(isUnarmedAttack(effect, actor)).toBe(true);
    }
  });

  test('the pack item itself (no source, its own uuid) counts as printed unarmed', () => {
    expect(isPrintedUnarmedWeapon({ type: 'weapon', uuid: PRINTED.prUnarmedCombat, flags: {} })).toBe(true);
    expect(isPrintedUnarmedWeapon(null)).toBe(false);
  });

  test("an ordinary weapon's attack is not unarmed", () => {
    const { actor, effect } = armedWith('Compendium.essence20.pr_crb.Item.notAnUnarmedOne');
    expect(isUnarmedAttack(effect, actor)).toBe(false);
    const { actor: other, effect: unsourced } = armedWith(null);
    expect(isUnarmedAttack(unsourced, other)).toBe(false);
  });

  test('a parentId that resolves to nothing is a weapon attack; a non-attack item is never unarmed', () => {
    const dangling = attack(null, { flags: { essence20: { parentId: 'gone' } } });
    expect(isUnarmedAttack(dangling, makeActor([dangling]))).toBe(false);
    expect(isUnarmedAttack({ type: 'weapon', flags: {} })).toBe(false);
    expect(isUnarmedAttack(null)).toBe(false);
  });

  test("the parent weapon is found on the item's own actor, else on the one passed in", () => {
    const held = weapon(PRINTED.gijUnarmedCombat);
    const actor = makeActor([held]);
    const loose = attack(held);
    expect(parentWeaponOf(loose, actor)).toBe(held);
    expect(isUnarmedAttack(loose, actor)).toBe(true);
    expect(parentWeaponOf(loose)).toBeNull();
  });

  test("a caller's own weapon lookup is trusted (null: unarmed)", () => {
    const blade = weapon();
    const effect = attack(blade);
    expect(isUnarmedAttack(effect, null, null)).toBe(true);
    expect(isUnarmedAttack(effect, null, blade)).toBe(false);
    expect(isUnarmedAttack(effect, null, weapon(PRINTED.wtnvUnarmedStrike))).toBe(true);
  });
});

describe('the readers', () => {
  const cases = () => {
    const fist = armedWith(undefined);
    const printed = armedWith(PRINTED.prUnarmedCombat);
    const blade = armedWith('Compendium.essence20.pr_crb.Item.notAnUnarmedOne');
    return { fist, printed, blade };
  };

  test('attack:unarmed - no weapon, or a printed unarmed one; only in an attack', () => {
    const { fist, printed, blade } = cases();
    const tag = ({ actor, effect }, isAttack = true) => evaluateTag('attack:unarmed', contextFor({ self: actor, item: effect, isAttack }));
    expect([tag(fist), tag(printed), tag(blade)]).toEqual([true, true, false]);
    expect(tag(printed, false)).toBe(false);
  });

  test('attack:barehanded - the same definition, answering on the item when isAttack is unset', () => {
    const { fist, printed, blade } = cases();
    const tag = ({ actor, effect }, isAttack) => evaluateTag('attack:barehanded', contextFor({ self: actor, item: effect, isAttack }));
    expect([tag(fist, true), tag(printed, true), tag(blade, true)]).toEqual([true, true, false]);
    expect([tag(printed, undefined), tag(printed, false)]).toEqual([true, false]);
    expect(isBarehandedAttack(printed.effect, printed.actor)).toBe(true);
    expect(REEXPORTED_IDS).toBe(UNARMED_WEAPON_IDS);
  });

  test('dice.mjs#_isUnarmedWeaponEffect (the roll context isUnarmedAttack)', () => {
    const dice = new Dice({}, {}, {});
    const { fist, printed, blade } = cases();
    expect([fist, printed, blade].map(({ actor, effect }) => dice._isUnarmedWeaponEffect(actor, effect))).toEqual([true, true, false]);
    expect(dice._isUnarmedWeaponEffect(fist.actor, { type: 'weapon', flags: {} })).toBe(false);
  });

  test('action-perks.mjs#describeAttack().unarmed (Relentless Blows etc. filters)', () => {
    const { fist, printed, blade } = cases();
    expect([fist, printed, blade].map(({ actor, effect }) => describeAttack(actor, effect).unarmed)).toEqual([true, true, false]);
    // The caller handing its own weapon in.
    expect(describeAttack(blade.actor, blade.effect, null).unarmed).toBe(true);
  });

  test('target-riders.mjs#buildRiderContext().isUnarmed (Hate Plague)', () => {
    const { fist, printed, blade } = cases();
    expect([fist, printed, blade].map(({ actor, effect }) => buildRiderContext(actor, effect, {}, {}).isUnarmed)).toEqual([true, true, false]);
  });
});

describe('the printed unarmed weapons in the packs', () => {
  const system = JSON.parse(readFileSync(join(ROOT, 'system.json'), 'utf8'));
  const packPath = name => system.packs.find(pack => pack.name == name)?.path;

  /** The pack source document a compendium uuid points at, or null. */
  function sourceDoc(uuid) {
    const [, , pack, , id] = uuid.split('.');
    const path = packPath(pack);
    if (!path) {
      return null;
    }

    const dir = join(ROOT, path, '_source');
    const file = readdirSync(dir).find(name => name.endsWith(`_${id}.json`));
    return file ? JSON.parse(readFileSync(join(dir, file), 'utf8')) : null;
  }

  test.each(UNARMED_WEAPON_IDS)('%s exists and is an integrated weapon', uuid => {
    const doc = sourceDoc(uuid);
    expect(doc).not.toBeNull();
    expect(doc._id).toBe(uuid.split('.').pop());
    expect(doc.type).toBe('weapon');
    expect(doc.system.classification.size).toBe('integrated');
  });

  test("the 1st printing's Strike is gone from the pack; an existing copy of it still counts", () => {
    expect(sourceDoc(PRINTED.prStrike)).toBeNull();
    expect(isPrintedUnarmedWeapon({ flags: { core: { sourceId: PRINTED.prStrike } } })).toBe(true);
  });

  test.each(UNARMED_WEAPON_IDS)("every effect of %s rolls the better of Finesse and Might (each book: Finesse or Might)", uuid => {
    const doc = sourceDoc(uuid);
    for (const entry of Object.values(doc.system.items)) {
      const pairs = (sourceDoc(entry.uuid).system.rules ?? []).filter(rule => rule.type == 'SkillSubstitution' && rule.mode == 'bestOf').map(rule => `${rule.from}>${rule.to}`).sort();
      expect([entry.name, pairs]).toEqual([entry.name, ['finesse>might', 'might>finesse']]);
    }
  });

  test('the Power Rangers CRB weapon carries the book name Unarmed Combat, and so do its effects', () => {
    const doc = sourceDoc(PRINTED.prUnarmedCombat);
    expect(doc.name).toBe('Unarmed Combat');
    expect(Object.values(doc.system.items).map(entry => entry.name).sort()).toEqual([
      'Unarmed Combat Alternate Effect 1', 'Unarmed Combat Alternate Effect 2', 'Unarmed Combat Effect',
    ]);
    for (const entry of Object.values(doc.system.items)) {
      expect(sourceDoc(entry.uuid).name).toBe(entry.name);
    }
  });
});
