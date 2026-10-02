import { jest } from '@jest/globals';
import { TF3 } from './common.mjs';
import {
  BREAKDOWN_FLAG, consumeBreakdown, HOLO_FLAG, MARTYR_FLAG, stoicDefense, tf3ApplyDialog, tf3Derived, tf3RollSources, tf3Toggles, UNEXPECTED_FLAG,
} from './rolls.mjs';
import { useHoloDoubles, useRightOfAll, useStoic } from './uses.mjs';
import {
  onKitPrerequisite, onMovementUsed, onRequisitionAccess, tf3AfterDamage, tf3PostRoll, tf3TurnStart, thirdDimensionUsed, unexpectedUpdates,
} from './reactions.mjs';

function flagged(obj) {
  obj.flags ??= {};
  obj.flags.essence20 ??= {};
  obj.getFlag = (scope, key) => obj.flags?.[scope]?.[key];
  obj.setFlag = jest.fn(async (scope, key, value) => {
    obj.flags[scope] ??= {};
    obj.flags[scope][key] = value;
  });
  obj.unsetFlag = jest.fn(async (scope, key) => {
    delete obj.flags?.[scope]?.[key];
  });
  obj.update = jest.fn(async (changes) => {
    for (const [key, value] of Object.entries(changes)) {
      const parts = key.split('.');
      let target = obj;
      for (const part of parts.slice(0, -1)) {
        target[part] ??= {};
        target = target[part];
      }

      target[parts.at(-1)] = value;
    }
  });
  return obj;
}

const item = (uuid, extra = {}) => flagged({
  id: extra.id ?? uuid.slice(-6), name: extra.name ?? 'Item', type: extra.type ?? 'perk', system: extra.system ?? {},
  flags: { core: { sourceId: uuid }, essence20: extra.flags ?? {} },
});
const actor = (items = [], extra = {}) => {
  const a = flagged({
    id: extra.id ?? 'a', uuid: extra.uuid ?? `Actor.${extra.id ?? 'a'}`, name: extra.name ?? 'A', type: extra.type ?? 'playerCharacter',
    system: extra.system ?? {}, flags: { essence20: extra.flags ?? {} }, items: { contents: items }, isOwner: true,
  });
  items.forEach(i => (i.parent = a));
  return a;
};

beforeEach(() => {
  global.game = {
    i18n: { localize: k => k, format: k => k }, user: { id: 'u1', targets: new Set() }, actors: [], combat: null,
    users: { contents: [], activeGM: { id: 'u1' } },
  };
  global.CONFIG = {
    E20: {
      skillShiftList: ['criticalSuccess', 'autoSuccess', '3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20', 'autoFail', 'fumble'],
      actorReach: { common: 5 }, skillToEssence: {}, defenses: {},
    },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.fromUuid = jest.fn(async uuid => game.actors.find(a => a.uuid == uuid) ?? null);
  global.foundry = { utils: { escapeHTML: s => s } };
});

describe('roll sources', () => {
  test('Holographic Doubles: ↓1 per double on attacks against the holder, this scene only', () => {
    const holder = actor([item(TF3.holographicDoubles)], { flags: { [HOLO_FLAG]: { count: 3, scene: 1 } } });
    const attacker = actor();
    expect(tf3RollSources(attacker, holder, { isAttack: true }).sources[0]).toMatchObject({ shiftDown: 3 });
    expect(tf3RollSources(attacker, holder, { isAttack: false }).sources).toEqual([]);
    holder.flags.essence20[HOLO_FLAG].scene = 0;
    expect(tf3RollSources(attacker, holder, { isAttack: true }).sources).toEqual([]);
  });

  test('Siren ↑2 Intimidation in Bot Mode only', () => {
    const bot = actor([item(TF3.siren, { type: 'gear' })], { system: { canTransform: true, isTransformed: false } });
    expect(tf3RollSources(bot, null, { rolledSkill: 'intimidation' }).sources[0].shiftUp).toBe(2);
    bot.system.isTransformed = true;
    expect(tf3RollSources(bot, null, { rolledSkill: 'intimidation' }).sources).toEqual([]);
  });

  test('Martyr gives allies Edge for the rest of the combat', () => {
    const martyr = actor([item(TF3.martyr)], { id: 'm', flags: { [MARTYR_FLAG]: 'c1' } });
    const ally = actor([], { id: 'b' });
    const enemy = actor([], { id: 'e', type: 'npc' });
    game.combat = { id: 'c1', combatants: { contents: [{ actor: martyr }, { actor: ally }, { actor: enemy }] } };
    expect(tf3RollSources(ally, null, {}).sources[0].edge).toBe(true);
    expect(tf3RollSources(enemy, null, {}).sources).toEqual([]);
    game.combat.id = 'c2';
    expect(tf3RollSources(ally, null, {}).sources).toEqual([]);
  });

  test('Unexpected Alternative: Edge on the surprised enemy only', () => {
    const holder = actor([item(TF3.unexpectedAlternative)], { flags: { [UNEXPECTED_FLAG]: { targets: ['Actor.e'], stamp: { scene: 1 } } } });
    expect(tf3RollSources(holder, { uuid: 'Actor.e' }, {}).sources[0].edge).toBe(true);
    expect(tf3RollSources(holder, { uuid: 'Actor.f' }, {}).sources).toEqual([]);
  });

  test('Target Breakdown: banked ↑ on attacks against that target, spent by the attack', async () => {
    const ally = actor([], { id: 'b', flags: { [BREAKDOWN_FLAG]: [{ targetUuid: 'Actor.e', shiftUp: 2, by: 'Perceptor' }] } });
    game.actors = [ally];
    const result = tf3RollSources(ally, { uuid: 'Actor.e' }, { isAttack: true });
    expect(result.sources[0].shiftUp).toBe(2);
    await consumeBreakdown(result.consumes[0]);
    expect(ally.flags.essence20[BREAKDOWN_FLAG]).toEqual([]);
  });

  test('Rotor Blades ↑1 when trained with a Close Combat Heavy Blade', () => {
    const gear = item(TF3.rotorBlades, { id: 'g1', type: 'gear' });
    const weapon = item('Compendium.essence20.tf_crb.Item.PFuzUrcYw14JRLf9', { id: 'w1', type: 'weapon', flags: { grantedBy: 'g1' } });
    const effect = item('x', { id: 'e1', type: 'weaponEffect', flags: { parentId: 'w1' } });
    const holder = actor([gear, weapon, effect], { system: { trained: { weapons: { closeCombatHeavyBlade: true } } } });
    expect(tf3RollSources(holder, null, { item: effect, isAttack: true, rolledSkill: 'finesse' }).sources[0].shiftUp).toBe(1);
    holder.system.trained.weapons.closeCombatHeavyBlade = false;
    expect(tf3RollSources(holder, null, { item: effect, isAttack: true, rolledSkill: 'finesse' }).sources).toEqual([]);
  });
});

describe('dialog toggles', () => {
  test('Nose for Trouble rolls Streetwise for a search, and Edge on traps', async () => {
    const holder = actor([item(TF3.noseForTrouble)], { system: { skills: { alertness: { shift: 'd4' }, streetwise: { shift: 'd8' } } } });
    const names = tf3Toggles(holder, { rolledSkill: 'alertness' }).map(t => t.name);
    expect(names).toEqual(expect.arrayContaining(['tf3NoseSearch', 'tf3NoseTrap']));
    const options = { shiftUp: 0, shiftDown: 0, ext: { tf3NoseSearch: true, tf3NoseTrap: true } };
    await tf3ApplyDialog(holder, options);
    expect(options).toMatchObject({ shiftUp: 2, shiftDown: 0, edge: true });
  });

  test('Hindsight, Mimicry Vocoder and Subordinate', async () => {
    const holder = actor([item(TF3.hindsight), item(TF3.mimicryVocoder), item(TF3.subordinate, { type: 'hangUp' })]);
    expect(tf3Toggles(holder, { rolledSkill: 'alertness' }).map(t => t.name)).toEqual(expect.arrayContaining(['tf3Hindsight', 'tf3Subordinate']));
    expect(tf3Toggles(holder, { rolledSkill: 'deception' }).map(t => t.name)).toContain('tf3Mimicry');
    const options = { shiftUp: 0, shiftDown: 0, snag: true, ext: { tf3Hindsight: true, tf3Subordinate: true } };
    await tf3ApplyDialog(holder, options);
    expect(options).toMatchObject({ snag: false, shiftDown: 1 });
  });

  test("Ladder: an ally's extended ladder gives ↑2 on Athletics", async () => {
    const truck = actor([item(TF3.ladder, { type: 'gear' })], { id: 't', system: { isTransformed: true, size: 'large' }, flags: { tf3LadderOut: { scene: 1 } } });
    const climber = actor([], { id: 'c', system: { size: 'common' } });
    game.actors = [truck, climber];
    expect(tf3Toggles(climber, { rolledSkill: 'athletics' }).map(t => t.name)).toContain('tf3Ladder');
    truck.system.isTransformed = false;
    expect(tf3Toggles(climber, { rolledSkill: 'athletics' }).map(t => t.name)).not.toContain('tf3Ladder');
  });
});

describe('defenses and derived data', () => {
  test('Stoic lowers Evasion and meets Toughness attacks with it', () => {
    game.combat = { id: 'c1' };
    const holder = actor([item(TF3.stoic)], {
      flags: { tf3Stoic: { penalty: 2, combatId: 'c1' } },
      system: { defenses: { evasion: { total: 14, string: '14' }, toughness: { total: 16, string: '16' } } },
    });
    tf3Derived(holder);
    expect(holder.system.defenses.evasion.total).toBe(12);
    expect(stoicDefense(null, holder, 'toughness')).toBe(-4);
    expect(stoicDefense(null, holder, 'evasion')).toBe(0);
  });

  test('Rotor Blades Aerial, Ladder reach and the one-hardpoint Water Cannon', () => {
    const cannon = item(TF3.waterCannon, { id: 'wc', type: 'gear' });
    const rifle = item('r', { id: 'w', type: 'weapon', system: { equipped: true, derivedHands: 2, hardpoint: { type: 'external' } }, flags: { grantedBy: 'wc' } });
    const fist = item('f', { id: 'f', type: 'weaponEffect', system: { classification: { style: 'melee' }, totalReach: 5 } });
    const bot = actor([item(TF3.rotorBlades, { type: 'gear' }), item(TF3.ladder, { type: 'gear' }), cannon, rifle, fist], {
      system: {
        canTransform: true, isTransformed: false, size: 'common', movement: { ground: { total: 50 }, aerial: { total: 0 } },
        hardpoints: { external: { used: 3, max: 2, over: true } },
      },
    });
    tf3Derived(bot);
    expect(fist.system.totalReach).toBe(10);
    expect(bot.system.movement.aerial.total).toBe(0);
    expect(bot.system.hardpoints.external).toMatchObject({ used: 2, over: false });
    bot.system.isTransformed = true;
    tf3Derived(bot);
    expect(bot.system.movement.aerial.total).toBe(25);
  });
});

describe('requisition and movement', () => {
  const weapon = (availability, hands) => ({ type: 'weapon', name: 'W', uuid: 'Item.w', system: { availability, items: { a: { type: 'weaponEffect', numHands: hands } } } });

  test('Unassuming qualifies one-handed Limited weapons; Training Through Familiarity trains Limited', () => {
    const out = { access: 'unknown' };
    onRequisitionAccess(actor([item(TF3.unassuming)]), weapon('limited', '1'), out);
    expect(out.access).toBe('qualified');
    const two = { access: 'unknown' };
    onRequisitionAccess(actor([item(TF3.unassuming)]), weapon('limited', '2'), two);
    expect(two.access).toBe('unknown');
    onRequisitionAccess(actor([item(TF3.trainingThroughFamiliarity)]), weapon('limited', '2'), two);
    expect(two.access).toBe('trained');
  });

  test('One Bot Over Another qualifies the weapons picked on it', () => {
    const perk = item(TF3.oneBotOverAnother, { flags: { tf3Chosen: [{ uuid: 'Compendium.x.Item.y', name: 'Energon Axe' }] } });
    const out = { access: 'none' };
    onRequisitionAccess(actor([perk]), { type: 'weapon', name: 'Other', flags: { core: { sourceId: 'Compendium.x.Item.y' } }, system: {} }, out);
    expect(out.access).toBe('qualified');
  });

  test('Training Through Familiarity waives Standard/Limited kit prerequisites', () => {
    const out = { need: 'd6' };
    onKitPrerequisite(actor([item(TF3.trainingThroughFamiliarity)]), { tier: 'limited' }, out);
    expect(out.need).toBe('d20');
    const restricted = { need: 'd8' };
    onKitPrerequisite(actor([item(TF3.trainingThroughFamiliarity)]), { tier: 'restricted' }, restricted);
    expect(restricted.need).toBe('d8');
  });

  test('Third Dimension counts only the distance since the last change of movement type', () => {
    const movement = {
      history: { recorded: { waypoints: [{ action: 'walk', cost: 0 }, { action: 'walk', cost: 20 }] } },
      passed: { waypoints: [{ action: 'fly', cost: 15 }] }, pending: { waypoints: [] },
    };
    expect(thirdDimensionUsed(movement)).toBe(15);
    const out = { used: 35 };
    onMovementUsed(actor([item(TF3.thirdDimension)]), movement, out);
    expect(out.used).toBe(15);
    const plain = { used: 35 };
    onMovementUsed(actor(), movement, plain);
    expect(plain.used).toBe(35);
  });
});

describe('reactions', () => {
  test('Unexpected Alternative: an enemy who saw only the other Alt Mode', () => {
    const holder = actor([item(TF3.unexpectedAlternative)], { flags: { tf3SeenModes: { 'Actor-e': ['car'], 'Actor-f': ['jet'] } } });
    const updates = unexpectedUpdates(holder, 'jet', [{ uuid: 'Actor.e' }, { uuid: 'Actor.f' }, { uuid: 'Actor.g' }]);
    expect(updates['flags.essence20.tf3UnexpectedEdge'].targets).toEqual(['Actor.e']);
    expect(updates['flags.essence20.tf3SeenModes']).toMatchObject({ 'Actor-e': ['car', 'jet'], 'Actor-g': ['jet'] });
  });

  test('Martyr is remembered on Defeat; Holographic doubles pop on a roll', async () => {
    game.combat = { id: 'c1' };
    const martyr = actor([item(TF3.martyr)]);
    await tf3AfterDamage(martyr, 3, 'blunt', { newValue: 0, wasAlreadyDefeated: false });
    expect(martyr.flags.essence20[MARTYR_FLAG]).toBe('c1');

    game.combat = null;
    const holo = actor([item(TF3.holographicDoubles)], { flags: { [HOLO_FLAG]: { count: 2, scene: 1 } } });
    await tf3PostRoll(holo, [{ success: true }], {});
    expect(holo.flags.essence20[HOLO_FLAG].count).toBe(1);
  });

  test('Stoic ends at the start of the next turn', async () => {
    const holder = actor([item(TF3.stoic)], { flags: { tf3Stoic: { penalty: 1, combatId: 'c1' } } });
    await tf3TurnStart(holder, { id: 'c1' });
    expect(holder.flags.essence20.tf3Stoic).toBeUndefined();
  });
});

describe('Use buttons', () => {
  test('Holographic Doubles: Standard action for the first, Free for each more', async () => {
    const perk = item(TF3.holographicDoubles);
    const holder = actor([perk]);
    const pay = jest.fn(async () => true);
    await useHoloDoubles(perk, null, pay);
    await useHoloDoubles(perk, null, pay);
    expect(pay.mock.calls.map(c => c[0])).toEqual(['standard', 'free']);
    expect(holder.flags.essence20[HOLO_FLAG]).toEqual({ count: 2, scene: 1 });
  });

  test('The Right Of All Sentient Beings needs a combat', async () => {
    const perk = item(TF3.rightOfAll);
    const holder = actor([perk]);
    global.ui = { notifications: { warn: jest.fn() } };
    expect(await useRightOfAll(perk)).toBeNull();
    game.combat = { id: 'c9' };
    await useRightOfAll(perk);
    expect(holder.flags.essence20.tf3RightOfAllFallen).toBe('c9');
    expect(tf3RollSources(holder, null, {}).sources[0].edge).toBe(true);
  });

  test('Stoic outside combat does nothing', async () => {
    const perk = item(TF3.stoic);
    actor([perk]);
    global.ui = { notifications: { warn: jest.fn() } };
    expect(await useStoic(perk, null, jest.fn())).toBeNull();
  });
});
