import { jest } from '@jest/globals';

const hooks = {};
global.Hooks = {
  on: jest.fn((name, fn) => {
    (hooks[name] ??= []).push(fn);
  }),
  once: jest.fn((name, fn) => {
    (hooks[name] ??= []).push(fn);
  }),
};

const { registrySnapshot } = await import('../../mechanics/item-hooks.mjs');
const core = await import('../../mechanics/combat/reaction-engine.mjs');
await import('../../mechanics/rolls/roll-dataset-snag.mjs');
const { IRON_BRAVADO, sharedImmunity } = await import('../defenses/iron-bravado-shared-immunity.mjs');
await import('../magic/mind-beam-calm-confused.mjs');

function flagged(obj) {
  obj.flags ??= {};
  obj.getFlag = (scope, key) => obj.flags?.[scope]?.[key];
  obj.setFlag = jest.fn(async (scope, key, value) => {
    obj.flags[scope] ??= {};
    obj.flags[scope][key] = value;
  });
  obj.unsetFlag = jest.fn(async (scope, key) => {
    delete obj.flags?.[scope]?.[key];
  });
  obj.update = jest.fn(async changes => {
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

let n = 0;
const item = (source, extra = {}) => flagged({ id: `i${n++}`, name: extra.name ?? 'Item', type: extra.type ?? 'perk', flags: { core: { sourceId: source } }, system: extra.system ?? {}, ...extra.more });

function makeActor(name, items = [], system = {}, extra = {}) {
  const list = [...items];
  const actor = flagged({
    id: name, uuid: `Actor.${name}`, name, type: extra.type ?? 'playerCharacter', isOwner: true,
    system: { level: 5, skills: {}, defenses: {}, health: { value: 5, max: 5 }, powers: { personal: { value: 3, max: 3 } }, ...system },
    items: Object.assign(list, { contents: list, get: id => list.find(i => i.id == id) }),
    statuses: new Set(extra.statuses ?? []),
    getActiveTokens: () => [],
    testUserPermission: () => true,
  });
  for (const i of list) {
    i.parent = actor;
  }

  return actor;
}

function card({ attacker, rows, total = 12, flags = {}, content = '' }) {
  return flagged({
    id: 'm1',
    content,
    rolls: [{ total, formula: '1d20 + 1d6', dice: [{ faces: 20, results: [{ result: 9, active: true }] }] }],
    speaker: { actor: attacker?.id },
    flags: { essence20: { checkResults: rows, isAttack: true, ...flags } },
    canUserModify: () => true,
  });
}

beforeEach(() => {
  global.game.user = { id: 'u1', isGM: true, targets: new Set() };
  global.game.users = { contents: [{ id: 'u1', isGM: true, active: true }], activeGM: { id: 'u1' } };
  global.game.combat = null;
  global.ChatMessage.getSpeakerActor = jest.fn(speaker => global.game.actors.find?.(a => a.id == speaker?.actor) ?? null);
  global.ChatMessage.create = jest.fn();
});

afterEach(() => {
  global.game.actors = { party: global.game.actors?.party };
});

describe('cardInfo', () => {
  test('reads rows, damage buttons and crits off a check card', () => {
    const attacker = makeActor('att');
    global.game.actors = [attacker];
    const message = card({
      attacker,
      rows: [{ targetUuid: 'Actor.t', difficulty: 10, success: true }],
      flags: { isMelee: true, attackStyle: 'melee', riderContext: { isArea: true, damageType: 'sharp' } },
      content: '<button type="button" data-action="apply-damage" data-key="Actor.t:base" data-target-uuid="Actor.t" data-damage="3" data-damage-type="sharp">'
        + '<button data-action="apply-damage" data-key="Actor.t:crit:double" data-target-uuid="Actor.t" data-damage="3">',
    });
    const info = core.cardInfo(message);
    expect(info.attacker).toBe(attacker);
    expect(info.rows[0]).toMatchObject({ damage: 3, damageType: 'sharp', isCrit: true, success: true, difficulty: 10 });
    expect(info.isMelee).toBe(true);
    expect(info.isArea).toBe(true);
    expect(info.hadEdge).toBe(false);
    expect(core.keptD20(info.roll)).toBe(9);
  });

  test('is null for a plain message', () => {
    expect(core.cardInfo({ flags: {}, rolls: [] })).toBeNull();
  });
});

describe('negateHit', () => {
  test('marks every button of that target applied', async () => {
    const message = card({
      rows: [], content: '<button data-action="apply-damage" data-key="Actor.t:base" data-target-uuid="Actor.t">'
        + '<button data-action="apply-damage" data-key="Actor.x:base" data-target-uuid="Actor.x">',
    });
    global.game.messages = { get: () => message };
    await core.negateHit(message, 'Actor.t', 'gone');
    expect(message.flags.essence20.damageAppliedKeys).toEqual(['Actor.t:base']);
    expect(core.isNegated(message, 'Actor.t')).toBe(true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test('a player posts the operation for the GM instead', async () => {
    global.game.user = { id: 'p', isGM: false };
    const message = card({ rows: [] });
    message.canUserModify = () => false;
    global.game.messages = { get: () => message };
    await core.negateHit(message, 'Actor.t', 'gone');
    expect(global.ChatMessage.create.mock.calls[0][0].flags.essence20.reactOp).toMatchObject({ kind: 'negate', messageId: 'm1' });
  });
});

describe('reactions', () => {
  test('the Contingency helpers hold in the combat they were set in (no combat: always set)', async () => {
    const actor = makeActor('par');
    global.game.combat = { id: 'c1', round: 1, turn: 0 };
    expect(core.isArmed(actor, 'x')).toBe(false);
    await core.arm(actor, 'x');
    await core.arm(actor, 'y');
    expect(core.isArmed(actor, 'x')).toBe(true);
    await core.disarm(actor, 'x');
    expect(core.isArmed(actor, 'x')).toBe(false);
    expect(core.isArmed(actor, 'y')).toBe(true);
    await core.disarm(actor);
    expect(core.isArmed(actor, 'y')).toBe(false);
    global.game.combat = null;
    expect(core.isArmed(actor, 'y')).toBe(true);
  });

  // Megaform Defender is the Trait's own Reaction rule (who: megaformPilot - module/rules/conv11-slF11.test.js).
  test('a roll whose dataset asks for a Snag (the rules roll step\'s snag) gets it once the dialog closes', async () => {
    const roll = async dataset => {
      const options = { ext: {} };
      for (const fn of registrySnapshot().applyDialog) {
        await fn(makeActor('x'), options, { dataset });
      }

      return options.snag;
    };

    expect(await roll({ snag: true })).toBe(true);
    expect(await roll({})).toBeUndefined();
  });
});

describe('late Snag', () => {
  test('keeps the lower d20', async () => {
    const OldRoll = global.Roll;
    global.Roll = class {
      evaluate() {
        return { total: 4 };
      } 
    };
    const info = { total: 15, roll: { dice: [{ faces: 20, results: [{ result: 9, active: true }] }] } };
    expect((await core.lateSnag(info)).total).toBe(10);
    global.Roll = OldRoll;
  });
});

describe('triggers', () => {
  // Agency's Fumble Story Point is a NoFumbleStoryPoint rule on the Hang-Up (rules/conv15-items2.test.js).
  // Inspirational Leader, Junker and Revengeful are rules on their items (rules/conv10-slE10.test.js).
  // All For One is a droppedToZero Trigger on its Perk (rules/conv10-slD10.test.js).
});

describe('forms', () => {
  test('Iron Bravado shares immunity with the listed allies', () => {
    const giver = makeActor('giv', [item(IRON_BRAVADO)]);
    giver.flags.essence20 = { ironBravadoShare: { conditions: ['frightened'], allies: ['Actor.ally'], combatId: null } };
    global.game.actors = [giver];
    expect(sharedImmunity({ uuid: 'Actor.ally' }, 'frightened')).toBe(giver);
    expect(sharedImmunity({ uuid: 'Actor.ally' }, 'stunned')).toBeNull();
    expect(sharedImmunity({ uuid: 'Actor.other' }, 'frightened')).toBeNull();
  });
});

// Energized, Spiked and Energy Field are incoming DialogSelect rules on their Upgrades (rules/conv10-slC10.test.js).
