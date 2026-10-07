import { jest } from '@jest/globals';
import {
  MORPHED_TOUGHNESS_RULES, legacyRerollRule, migrateDetailsFields, migrateItemData, migrateMorphedToughness, migratePerkCanActivate,
  migratePerkValue, roleOfActorData, migrateRerollFields, migrateUpgradeAimBonus, perkValueRules, resetMigrationCaches,
  migratePrerequisiteText, PREREQUISITE_ASK_MAX,
} from './migration.mjs';

/**
 * A pack index entry lookup, the shape compendiumActionType reads.
 */
function setPacks(entriesByPack = {}) {
  resetMigrationCaches();
  global.game = {
    ...(global.game ?? {}),
    packs: {
      get: jest.fn((name) => {
        const key = name.replace('essence20.', '');
        if (!(key in entriesByPack)) {
          return null;
        }

        return {
          getIndex: jest.fn(async () => ({
            get: (id) => entriesByPack[key][id] ?? null,
          })),
        };
      }),
    },
  };
}

/**
 * An embedded item, as migrateItemData receives it - source data, not a document.
 */
function makeItem({ type = 'perk', actionType = 'none', source = null } = {}) {
  const item = { type, name: 'Takedown', system: { actionType } };
  if (source) {
    item._stats = { compendiumSource: source };
  }

  return item;
}

const TAKEDOWN = 'Compendium.essence20.gi_joe_crb.Item.Yev7VrgEKtsTGdrx';

/* Embedded items are snapshots: whatever the compendium said the day they were dropped onto a
   character is what they still say. When a pass gives ~280 Perks an action cost, every character
   built before it keeps a copy that costs nothing. */
describe('action-cost drift from the compendium', () => {
  test('adopts a cost the compendium has since been given', async () => {
    setPacks({ gi_joe_crb: { Yev7VrgEKtsTGdrx: { system: { actionType: 'standard' } } } });

    const update = await migrateItemData(makeItem({ source: TAKEDOWN }));

    expect(update['system.actionType']).toBe('standard');
  });

  /* Only ever none -> something. A value already set is either one this migration applied or one a
     GM chose deliberately, and there is no way to tell those apart - so it is left alone. */
  test('never overwrites a cost the item already carries', async () => {
    setPacks({ gi_joe_crb: { Yev7VrgEKtsTGdrx: { system: { actionType: 'standard' } } } });

    const update = await migrateItemData(makeItem({ source: TAKEDOWN, actionType: 'free' }));

    expect(update['system.actionType']).toBeUndefined();
  });

  test('is a no-op when the compendium also says none', async () => {
    setPacks({ gi_joe_crb: { Yev7VrgEKtsTGdrx: { system: { actionType: 'none' } } } });

    const update = await migrateItemData(makeItem({ source: TAKEDOWN }));

    expect(update['system.actionType']).toBeUndefined();
  });

  // Value-matched, so running it twice changes nothing the second time.
  test('is a no-op on a second run', async () => {
    setPacks({ gi_joe_crb: { Yev7VrgEKtsTGdrx: { system: { actionType: 'standard' } } } });
    const item = makeItem({ source: TAKEDOWN });

    const first = await migrateItemData(item);
    item.system.actionType = first['system.actionType'];
    const second = await migrateItemData(item);

    expect(second['system.actionType']).toBeUndefined();
  });

  test('leaves a hand-made item with no compendium original alone', async () => {
    setPacks({ gi_joe_crb: {} });

    const update = await migrateItemData(makeItem());

    expect(update['system.actionType']).toBeUndefined();
  });

  // A game line this world does not have installed must not throw.
  test('survives a pack that is not present', async () => {
    setPacks({});

    const update = await migrateItemData(makeItem({ source: TAKEDOWN }));

    expect(update['system.actionType']).toBeUndefined();
  });

  test('survives an entry since deleted from its pack', async () => {
    setPacks({ gi_joe_crb: {} });

    const update = await migrateItemData(makeItem({ source: TAKEDOWN }));

    expect(update['system.actionType']).toBeUndefined();
  });

  /* The weaponEffect rule is the fallback for an effect with no compendium original - a GM's own,
     born None under the old schema default. Where the compendium HAS an answer, that wins. */
  test('a hand-made weapon effect still falls back to Standard', async () => {
    setPacks({});

    const update = await migrateItemData(makeItem({ type: 'weaponEffect' }));

    expect(update['system.actionType']).toBe('standard');
  });

  test('a compendium weapon effect takes the cost its pack gives it', async () => {
    setPacks({ gi_joe_crb: { Yev7VrgEKtsTGdrx: { system: { actionType: 'free' } } } });

    const update = await migrateItemData(makeItem({ type: 'weaponEffect', source: TAKEDOWN }));

    expect(update['system.actionType']).toBe('free');
  });
});

/* -------------------------------------------- */
/*  Details-tab fields moved into rules          */
/* -------------------------------------------- */

/* 2026-10-07 (docs/rules-batches/details-cleanup.md): a Perk's canActivate, a Perk's / Power's reroll,
   a Perk's hasMorphedToughnessBonus and value, an Upgrade's aimShiftBonus. */
describe('Details-tab fields moved into rules', () => {
  // The deprecated fields stay in the data model until 6.1, so the migration resets them to their defaults (false / 0 /
  // the reroll block switched off) - v14 refuses to delete a field the model still has.
  const isForced = value => value instanceof foundry.data.operators.ForcedDeletion;
  const isDeleted = value => isForced(value) || value === false || value === 0 || (!!value && typeof value == 'object' && value.enabled === false);

  // An update applied to an item's source - what the next migration run sees.
  function applied(item, update) {
    const next = JSON.parse(JSON.stringify(item));
    for (const [path, value] of Object.entries(update)) {
      const keys = path.split('.');
      const last = keys.pop();
      const parent = keys.reduce((at, key) => (at[key] ??= {}), next);
      if (isForced(value)) {
        delete parent[last];
      } else {
        parent[last] = value;
      }
    }

    return next;
  }

  const SOURCE = 'Compendium.essence20.pr_crb.Item.orig0000000000ab';
  const perk = (system = {}, extra = {}) => ({ type: 'perk', name: 'Perk', flags: {}, system, ...extra });

  beforeEach(() => setPacks({}));

  describe('canActivate', () => {
    test('a Perk\'s stored true is deleted; a second run does nothing', () => {
      const item = perk({ canActivate: true });
      const update = migratePerkCanActivate(item);
      expect(isDeleted(update['system.canActivate'])).toBe(true);
      expect(migratePerkCanActivate(applied(item, update))).toEqual({});
    });

    test('false, and a Power\'s (which the Use button reads), are left alone', () => {
      expect(migratePerkCanActivate(perk({ canActivate: false }))).toEqual({});
      expect(migratePerkCanActivate({ type: 'power', system: { canActivate: true } })).toEqual({});
    });

    test('a document is read from its source', () => {
      expect(Object.keys(migratePerkCanActivate({ type: 'perk', system: { canActivate: false }, _source: { system: { canActivate: true } } }))).toEqual(['system.canActivate']);
    });
  });

  describe('reroll -> a Reroll rule', () => {
    const LUCK = { enabled: true, mode: 'ones', target: 'skillDice', minDieFaces: 4, recursive: false, maxUses: 0, reset: 'none' };
    const LUCK_RULE = { type: 'Reroll', mode: 'ones', target: 'skillDice', reset: 'none', maxUses: 0, recursive: false, minDieFaces: 4 };

    test('legacyRerollRule keeps the settings and leaves out what the defaults fill in', () => {
      expect(legacyRerollRule({ reroll: LUCK })).toEqual(LUCK_RULE);
      expect(legacyRerollRule({ reroll: {
        enabled: true, mode: 'all', target: 'allDice', reset: 'none', maxUses: 0, condition: 'rollFailed', skills: ['deception'], essence: 'any',
        cost: { resourcePath: 'system.energon.normal.value', amount: 1, worldStoryPoints: 0, rolePointsName: '' }, recursive: true, keepBetter: false,
      } })).toEqual({
        type: 'Reroll', mode: 'all', target: 'allDice', reset: 'none', maxUses: 0, condition: 'rollFailed', skills: ['deception'],
        cost: { resourcePath: 'system.energon.normal.value', amount: 1 },
      });
      expect(legacyRerollRule({ reroll: { enabled: false, mode: 'ones' } })).toBeNull();
      expect(legacyRerollRule({})).toBeNull();
    });

    test('a hand-made Perk gets the rule and loses the block; a second run does nothing', async () => {
      const item = perk({ reroll: LUCK });
      const update = await migrateRerollFields(item);
      expect(update['system.rules']).toEqual([LUCK_RULE]);
      expect(isDeleted(update['system.reroll'])).toBe(true);
      expect(await migrateRerollFields(applied(item, update))).toEqual({});
    });

    test('a copy whose compendium original already has the rule only loses the block (it inherits the rule)', async () => {
      setPacks({ pr_crb: { orig0000000000ab: { system: { rules: [{ type: 'Use' }, LUCK_RULE] } } } });
      const update = await migrateRerollFields(perk({ reroll: LUCK }, { _stats: { compendiumSource: SOURCE } }));
      expect(update['system.rules']).toBeUndefined();
      expect(isDeleted(update['system.reroll'])).toBe(true);
    });

    test('a copy whose original lacks it keeps the original\'s rules as its own, plus the new one', async () => {
      setPacks({ pr_crb: { orig0000000000ab: { system: { rules: [{ type: 'Use', label: 'Go' }] } } } });
      const update = await migrateRerollFields(perk({ reroll: LUCK }, { flags: { core: { sourceId: SOURCE } } }));
      expect(update['system.rules']).toEqual([{ type: 'Use', label: 'Go' }, LUCK_RULE]);
    });

    test('rules of its own that already reroll: only the block goes', async () => {
      const update = await migrateRerollFields(perk({ reroll: LUCK, rules: [{ type: 'Reroll', mode: 'all' }] }));
      expect(update['system.rules']).toBeUndefined();
      expect(isDeleted(update['system.reroll'])).toBe(true);
    });

    test('in a compendium, a copy never inherits - the rule is written onto it', async () => {
      setPacks({ pr_crb: { orig0000000000ab: { system: { rules: [LUCK_RULE] } } } });
      const update = await migrateRerollFields(perk({ reroll: LUCK }, { _stats: { compendiumSource: SOURCE } }), { inPack: true });
      expect(update['system.rules']).toEqual([LUCK_RULE]);
    });

    test('Power Infusion: the advances-driven reroll becomes an upTo rule with its cost and condition', async () => {
      const item = perk({ advances: { type: 'rerolls' }, reroll: { enabled: false, cost: { resourcePath: 'system.powers.personal.value', amount: 1 }, condition: 'morphed' } });
      const update = await migrateRerollFields(item);
      expect(update['system.rules']).toEqual([{
        type: 'Reroll', mode: 'all', target: 'allDice', reset: 'scene', maxUses: 1, upTo: '@item.system.advances.currentValue',
        cost: { resourcePath: 'system.powers.personal.value', amount: 1 }, condition: 'morphed',
      }]);
      expect(isDeleted(update['system.reroll'])).toBe(true);
      // The block's defaults come back on the next load - a second run still has nothing to do.
      const next = applied(item, update);
      next.system.reroll = { enabled: false, cost: { resourcePath: '', amount: 0 }, condition: 'none' };
      expect(await migrateRerollFields(next)).toEqual({});
    });

    test('a Power (Temporal Awareness) is moved the same way; other item types are not', async () => {
      expect((await migrateRerollFields({ type: 'power', system: { reroll: LUCK } }))['system.rules']).toEqual([LUCK_RULE]);
      expect(await migrateRerollFields({ type: 'armor', system: { reroll: LUCK } })).toEqual({});
    });

    test('a switched-off block is left alone', async () => {
      expect(await migrateRerollFields(perk({ reroll: { ...LUCK, enabled: false } }))).toEqual({});
    });

    test('the run-time-switched ones keep their state instead of becoming a rule', async () => {
      const guilt = await migrateRerollFields(perk({ reroll: { enabled: true, mode: 'ones', target: 'd20' } }, { flags: { core: { sourceId: 'Compendium.essence20.jump_through_time.Item.bWAncoQxwfCLtn2v' } } }));
      expect(Object.keys(guilt)).toEqual(['system.reroll']);

      const charm = await migrateRerollFields({ type: 'power', flags: {}, _stats: { compendiumSource: 'Compendium.essence20.finster_s_monster_matic_cookbook.Item.Rv3Bhyeo4XBxHLpX' }, system: { reroll: { ...LUCK } } });
      expect(charm['flags.essence20.rules.toggles.luckyCharm']).toBe(true);
      expect(charm['system.rules']).toBeUndefined();

      const vision = await migrateRerollFields({ type: 'power', flags: {}, _stats: { compendiumSource: 'Compendium.essence20.jump_through_time.Item.z9ZMxCd5DZDHlDYL' }, system: { reroll: { enabled: true, maxUses: 2 } } });
      expect(vision).toMatchObject({ 'flags.essence20.rules.toggles.futureVision': true, 'flags.essence20.futureVisionUses': 2 });

      // Not switched on yet: nothing to carry over.
      expect(await migrateRerollFields({ type: 'power', flags: {}, _stats: { compendiumSource: 'Compendium.essence20.jump_through_time.Item.z9ZMxCd5DZDHlDYL' }, system: { reroll: { enabled: false } } })).toEqual({});
    });
  });

  describe('hasMorphedToughnessBonus -> added / removed Triggers', () => {
    test('both Triggers are added and the flag goes; a second run does nothing', async () => {
      const item = perk({ hasMorphedToughnessBonus: true, rules: [{ type: 'Trigger', event: 'roleDropped', steps: [{ do: 'refreshMorphedToughness' }] }] });
      const update = await migrateMorphedToughness(item);
      expect(update['system.rules'].map(rule => rule.event)).toEqual(['roleDropped', 'added', 'removed']);
      expect(update['system.rules'][1].steps).toEqual([{ do: 'refreshMorphedToughness' }]);
      expect(update['system.rules'][2].steps).toEqual([{ do: 'updateActor', set: { 'system.canSetToughnessBonus': false, 'system.defenses.toughness.morphed': 0 } }]);
      expect(isDeleted(update['system.hasMorphedToughnessBonus'])).toBe(true);
      expect(await migrateMorphedToughness(applied(item, update))).toEqual({});
    });

    test('a Trigger already there isn\'t added twice', async () => {
      const update = await migrateMorphedToughness(perk({ hasMorphedToughnessBonus: true, rules: [MORPHED_TOUGHNESS_RULES[0].rule] }));
      expect(update['system.rules'].map(rule => rule.event)).toEqual(['added', 'removed']);
    });

    test('false is left alone', async () => {
      expect(await migrateMorphedToughness(perk({ hasMorphedToughnessBonus: false }))).toEqual({});
    });
  });

  describe('aimShiftBonus -> an AimBonus rule on the host weapon', () => {
    test('the Laser Sight\'s +1 becomes AimBonus scope host; a second run does nothing', async () => {
      const item = { type: 'upgrade', flags: {}, system: { type: 'weapon', aimShiftBonus: 1 } };
      const update = await migrateUpgradeAimBonus(item);
      expect(update['system.rules']).toEqual([{ type: 'AimBonus', label: 'Aim +1', scope: 'host', extra: 1 }]);
      expect(isDeleted(update['system.aimShiftBonus'])).toBe(true);
      expect(await migrateUpgradeAimBonus(applied(item, update))).toEqual({});
    });

    test('0 is left alone', async () => {
      expect(await migrateUpgradeAimBonus({ type: 'upgrade', system: { aimShiftBonus: 0 } })).toEqual({});
    });
  });

  describe('value -> Movement / DerivedStat rules, taken back out of the actor', () => {
    const fast = (extra = {}) => perk({ choiceType: 'movement', choice: 'ground', value: 10 }, extra);
    const expertise = (extra = {}) => perk({ choiceType: 'skills', choice: 'athletics', value: 2 }, extra);

    test('a world Fast gets a Movement rule per type (stage bonus, for flagged copies) and loses its value', async () => {
      const item = fast();
      const { update, actorUpdate } = await migratePerkValue(item);
      expect(update['system.rules']).toHaveLength(5);
      expect(update['system.rules'][3]).toEqual({
        type: 'Movement', label: '+10 ft ground', movement: 'ground', stage: 'bonus', op: 'add', value: 10,
        when: ['rule:data:system.choice=ground', 'rule:data:flags.essence20.perkValueRule'],
      });
      expect(update['flags.essence20.perkValueRule']).toBe(true);
      expect(isDeleted(update['system.value'])).toBe(true);
      expect(actorUpdate).toEqual({});
      expect(await migratePerkValue(applied(item, update))).toEqual({ update: {}, actorUpdate: {} });
    });

    test('on an actor, what the drop wrote in comes back off - once per copy, never below 0', async () => {
      const actorSystem = { movement: { ground: { bonus: 25 }, aerial: { bonus: 5 } }, skills: { athletics: { shiftUp: 3 } } };
      const totals = {};
      const one = await migratePerkValue(fast(), { actorSystem, totals });
      const two = await migratePerkValue(fast(), { actorSystem, totals });
      expect(one.actorUpdate).toEqual({ 'system.movement.ground.bonus': 15 });
      expect(two.actorUpdate).toEqual({ 'system.movement.ground.bonus': 5 });
      expect((await migratePerkValue(fast({ system: { choiceType: 'movement', choice: 'aerial', value: 10 } }), { actorSystem, totals })).actorUpdate)
        .toEqual({ 'system.movement.aerial.bonus': 0 });
      expect((await migratePerkValue(expertise(), { actorSystem, totals })).actorUpdate).toEqual({ 'system.skills.athletics.shiftUp': 1 });
    });

    test('GI Joe Expertise gets the DerivedStat on the picked Skill', async () => {
      const { update } = await migratePerkValue(expertise());
      expect(update['system.rules']).toEqual([{
        type: 'DerivedStat', label: 'Up 2 on the picked Skill', path: 'system.skills.{item.choice}.shiftUp', op: 'add', value: 2,
        when: ['rule:data:flags.essence20.perkValueRule'],
      }]);
    });

    test('a copy with no pick had nothing written in: flagged, nothing taken off', async () => {
      const { update, actorUpdate } = await migratePerkValue(fast({ system: { choiceType: 'movement', choice: null, value: 10 } }), { actorSystem: { movement: { ground: { bonus: 10 } } } });
      expect(update['flags.essence20.perkValueRule']).toBe(true);
      expect(actorUpdate).toEqual({});
    });

    test('a flagged copy (dropped since) and the unread values (Transmetal, MLP Attack) are left alone', async () => {
      expect(await migratePerkValue(fast({ flags: { essence20: { perkValueRule: true } } }), { actorSystem: { movement: { ground: { bonus: 10 } } } }))
        .toEqual({ update: {}, actorUpdate: {} });
      expect(await migratePerkValue(perk({ choiceType: 'altModeMovement', choice: 'ground', value: 40 }))).toEqual({ update: {}, actorUpdate: {} });
      expect(await migratePerkValue(perk({ choiceType: 'none', value: 1 }))).toEqual({ update: {}, actorUpdate: {} });
    });

    test('a copy of the pack Fast inherits its rules - only the flag and the value change', async () => {
      setPacks({ pr_crb: { orig0000000000ab: { system: { rules: perkValueRules('movement', 10).map(({ rule }) => rule) } } } });
      const { update } = await migratePerkValue(fast({ _stats: { compendiumSource: SOURCE } }));
      expect(update['system.rules']).toBeUndefined();
      expect(update['flags.essence20.perkValueRule']).toBe(true);
    });

    test('rules already pending on the item are built on, not replaced', async () => {
      const pending = [{ type: 'Use' }];
      const { update } = await migratePerkValue(expertise(), { rules: pending });
      expect(update['system.rules'].map(rule => rule.type)).toEqual(['Use', 'DerivedStat']);
    });
  });

  describe('migrateItemData', () => {
    test('runs them all on a world item, the rules built up across them', async () => {
      const update = await migrateItemData(perk({
        canActivate: true, hasMorphedToughnessBonus: true, reroll: { enabled: true, mode: 'ones', maxUses: 0 }, choiceType: 'movement', choice: 'ground', value: 10,
      }));
      expect(update['system.rules'].map(rule => rule.type)).toEqual(['Reroll', 'Trigger', 'Trigger', 'Movement', 'Movement', 'Movement', 'Movement', 'Movement']);
      for (const key of ['system.canActivate', 'system.reroll', 'system.hasMorphedToughnessBonus', 'system.value']) {
        expect(isDeleted(update[key])).toBe(true);
      }
    });

    test('an embedded Perk\'s value waits for migrateActorData (which also fixes the actor)', async () => {
      const update = await migrateItemData(perk({ choiceType: 'movement', choice: 'ground', value: 10 }), { _id: 'actor' });
      expect(update['system.value']).toBeUndefined();
      expect(update['flags.essence20.perkValueRule']).toBeUndefined();
    });

    test('an item with none of the old fields gets nothing', async () => {
      expect(await migrateDetailsFields(perk({ canActivate: false, value: 0 }))).toEqual({});
    });
  });
});

describe('typed prerequisite text retired (2026-10-07)', () => {
  const item = (system, type = 'perk') => ({ type, name: 'Item', flags: {}, system });
  // An update applied to the item's source - what the next run sees.
  const applied = (source, update) => {
    const next = JSON.parse(JSON.stringify(source));
    for (const [path, value] of Object.entries(update)) {
      const keys = path.split('.');
      const last = keys.pop();
      keys.reduce((at, key) => (at[key] ??= {}), next)[last] = value;
    }

    return next;
  };

  beforeEach(() => setPacks({}));

  test('text with no tags becomes one ask: tag, then resets to the schema default (null, never a deletion)', () => {
    const source = item({ prerequisite: '  Must have  a\nstarship ', prerequisites: {} });
    const update = migratePrerequisiteText(source);
    expect(update['system.prerequisites']).toEqual({ when: ['ask:Must have a starship'] });
    expect(update['system.prerequisite']).toBeNull();
    expect(update['system.prerequisite'] instanceof foundry.data.operators.ForcedDeletion).toBe(false);
    expect(migratePrerequisiteText(applied(source, update))).toEqual({});
  });

  test('an item that has tags keeps them, and only loses the text', () => {
    const source = item({ prerequisite: 'Level 5', prerequisites: { when: ['self:level>=5'] } }, 'upgrade');
    const update = migratePrerequisiteText(source);
    expect(update).toEqual({ 'system.prerequisite': null });
    expect(migratePrerequisiteText(applied(source, update))).toEqual({});
  });

  test('a schema field that is not nullable resets to its own initial value', () => {
    const source = { ...item({ prerequisite: 'x', prerequisites: { when: ['ask:x'] } }), system: { prerequisite: 'x', prerequisites: { when: ['ask:x'] }, schema: { getField: () => ({ initial: '' }) } } };
    expect(migratePrerequisiteText(source)).toEqual({ 'system.prerequisite': '' });
  });

  test('a copy of Acute Senses (its text was a note about its choice) only loses the text', () => {
    const source = { ...item({ prerequisite: 'a note', prerequisites: {} }), _stats: { compendiumSource: 'Compendium.essence20.wtnv_citizens_guide.Item.ygxNBnUhFIfqg349' } };
    expect(migratePrerequisiteText(source)).toEqual({ 'system.prerequisite': null });
  });

  test('empty, null, missing and whitespace-only text', () => {
    expect(migratePrerequisiteText(item({ prerequisite: '' }))).toEqual({});
    expect(migratePrerequisiteText(item({ prerequisite: null }))).toEqual({});
    expect(migratePrerequisiteText(item({}, 'weapon'))).toEqual({});
    // Whitespace only: no tag, but the text still resets.
    expect(migratePrerequisiteText(item({ prerequisite: '   ' }))).toEqual({ 'system.prerequisite': null });
  });

  test('long text is cut at a word, with an ellipsis', () => {
    const update = migratePrerequisiteText(item({ prerequisite: 'word '.repeat(100) }));
    const tag = update['system.prerequisites'].when[0];
    expect(tag.length).toBeLessThanOrEqual(PREREQUISITE_ASK_MAX + 'ask:'.length);
    expect(tag.endsWith('word…')).toBe(true);
  });

  test('migrateItemData runs it on world and actor-embedded items, and a re-run does nothing more', async () => {
    const source = item({ prerequisite: 'GM approval', prerequisites: {} });
    for (const actor of [undefined, { _id: 'actor' }]) {
      const update = await migrateItemData(source, actor);
      expect(update['system.prerequisites']).toEqual({ when: ['ask:GM approval'] });
      expect(update['system.prerequisite']).toBeNull();
      const again = await migrateItemData(applied(source, update), actor);
      expect(again['system.prerequisite']).toBeUndefined();
      expect(again['system.prerequisites']).toBeUndefined();
    }
  });
});

describe('roleOfActorData', () => {
  test('reads the Role from a document or from plain data, as migrateWorld passes it (2026-10-07)', () => {
    const role = { type: 'role', name: 'Commando' };
    expect(roleOfActorData({ items: [{ type: 'perk' }, role] })).toBe(role);
    expect(roleOfActorData({ items: { documentsByType: { role: [role] } } })).toBe(role);
    expect(roleOfActorData({ items: [] })).toBeNull();
    expect(roleOfActorData({})).toBeNull();
  });
});
