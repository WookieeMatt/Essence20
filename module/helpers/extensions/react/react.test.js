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

const { registrySnapshot } = await import('../../extensions.mjs');
const core = await import('./core.mjs');
const { REACT, megaformDefenderPilots } = await import('./reactions.mjs');
const { TRIG, lossAndGain, suppressesFumbleStoryPoint, inspiringLeaders, onCheckCard, giverFor } = await import('./triggers.mjs');
const { FORM, monsterPath, sharedImmunity } = await import('./forms.mjs');
const { AURA, isPlainReach, auraTargets } = await import('./auras.mjs');
const { inspirationalLeaderAssist } = await import('./hooks-in.mjs');

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
  test('Legendary Cruelty is offered on a miss against its holder, once per turn', () => {
    const attacker = makeActor('att');
    const baroness = makeActor('bar', [item(REACT.legendaryCruelty)]);
    global.game.actors = [attacker, baroness];
    global.fromUuidSync.mockImplementation(uuid => [attacker, baroness].find(a => a.uuid == uuid));
    const info = core.cardInfo(card({ attacker, rows: [{ targetUuid: baroness.uuid, difficulty: 15, success: false }] }));
    const offers = core.reactionsFor(info).filter(o => o.reaction.id == 'legendaryCruelty');
    expect(offers.map(o => o.reactor)).toEqual([baroness]);
    const hit = core.cardInfo(card({ attacker, rows: [{ targetUuid: baroness.uuid, difficulty: 5, success: true }] }));
    expect(core.reactionsFor(hit).some(o => o.reaction.id == 'legendaryCruelty')).toBe(false);
  });

  test('Desperate Parry needs its Contingency set during combat', async () => {
    const attacker = makeActor('att');
    const sword = item(null, { type: 'weapon', system: { equipped: true } });
    const effect = item(null, { type: 'weaponEffect', system: { classification: { skill: 'finesse' } }, more: { flags: { essence20: { parentId: sword.id } } } });
    const parrier = makeActor('par', [item(REACT.desperateParry), sword, effect]);
    global.game.actors = [attacker, parrier];
    global.fromUuidSync.mockImplementation(uuid => [attacker, parrier].find(a => a.uuid == uuid));
    global.game.combat = { id: 'c1', round: 1, turn: 0 };
    const info = core.cardInfo(card({ attacker, rows: [{ targetUuid: parrier.uuid, difficulty: 10, success: true }], flags: { isMelee: true } }));
    const offered = () => core.reactionsFor(info).some(o => o.reaction.id == 'desperateParry');
    expect(offered()).toBe(false);
    await core.arm(parrier, 'desperateParry');
    expect(offered()).toBe(true);
    await core.disarm(parrier);
    expect(offered()).toBe(false);
  });

  test('That\'s Right, Perfect is offered to an ally of the roller, once per scene', () => {
    const roller = makeActor('rol');
    const sarge = makeActor('sar', [item(REACT.thatsRight)]);
    global.game.actors = [roller, sarge];
    const info = core.cardInfo(card({ attacker: roller, rows: [{ targetUuid: null, difficulty: 10, success: true }] }));
    expect(core.reactionsFor(info).filter(o => o.reaction.id == 'thatsRight').map(o => o.reactor)).toEqual([sarge]);
    expect(core.reactionsFor(info).some(o => o.reaction.id == 'notPerfect')).toBe(false);
  });

  test('Megaform Defender finds the piloting Ranger of the participant with the Trait', () => {
    const zord = makeActor('zord', [item(null, { type: 'megaformTrait', system: { type: 'defender' } })], {}, { type: 'zord' });
    const pilot = makeActor('pilot', [], { actors: { a: { uuid: zord.uuid } } });
    const megaform = makeActor('mega', [], { actors: { a: { uuid: zord.uuid } } }, { type: 'megaform' });
    global.game.actors = [zord, pilot, megaform];
    global.fromUuidSync.mockImplementation(uuid => [zord, pilot, megaform].find(a => a.uuid == uuid));
    expect(megaformDefenderPilots(megaform)).toEqual([pilot]);
    pilot.system.powers.personal.value = 0;
    expect(megaformDefenderPilots(megaform)).toEqual([]);
  });

  test('a banked counter-attack adds its shift against that attacker only, then is spent', async () => {
    const actor = makeActor('ctr');
    await actor.setFlag('essence20', 'reactCounter', { targetUuid: 'Actor.foe', shiftDown: 1, melee: true, label: 'Counterstrike' });
    const sources = registrySnapshot().rollSources.map(fn => fn(actor, { uuid: 'Actor.foe' }, { isAttack: true, isMelee: true })).filter(Boolean);
    expect(sources.flatMap(s => s.sources).find(s => s.id == 'reactCounter')).toMatchObject({ shiftDown: 1 });
    const other = registrySnapshot().rollSources.map(fn => fn(actor, { uuid: 'Actor.x' }, { isAttack: true, isMelee: true })).filter(Boolean);
    expect(other.flatMap(s => s.sources).some(s => s.id == 'reactCounter')).toBe(false);
    global.fromUuid.mockResolvedValue(actor);
    await registrySnapshot().consumers.reactCounter({ actorUuid: actor.uuid });
    expect(actor.getFlag('essence20', 'reactCounter')).toBeUndefined();
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
  test('Loss and Gain grows at 6th, 11th and 16th level', () => {
    expect(lossAndGain(makeActor('a', [], { level: 1 }))).toBe(1);
    expect(lossAndGain(makeActor('a', [], { level: 11 }))).toBe(3);
    expect(lossAndGain(makeActor('a', [item(TRIG.lossAndGain, { type: 'rolePoints', system: { bonus: { value: 4 } } })], { level: 2 }))).toBe(4);
  });

  test('Their Loss, My Gain heals on a nearby Fumble', async () => {
    const roller = makeActor('rol');
    const thorns = makeActor('tho', [item(TRIG.theirLoss)], { level: 6, health: { value: 1, max: 5 } });
    global.game.actors = [roller, thorns];
    await onCheckCard(card({ attacker: roller, rows: [{ targetUuid: null, difficulty: 10, success: false }], flags: { isFumble: true, rollFailed: true, isAttack: false } }));
    expect(thorns.system.health.value).toBe(1);
    global.canvas = { grid: { measurePath: () => ({ distance: 30 }) } };
    roller.getActiveTokens = () => [{ center: {}, document: {} }];
    thorns.getActiveTokens = () => [{ center: {}, document: {} }];
    await onCheckCard(card({ attacker: roller, rows: [{ targetUuid: null, difficulty: 10, success: false }], flags: { isFumble: true, rollFailed: true, isAttack: false } }));
    expect(thorns.system.health.value).toBe(3);
    global.canvas = undefined;
  });

  test('Agency drops the Fumble Story Point only for its own skill', () => {
    const agent = makeActor('age', [item(TRIG.agencyHangUp, { type: 'hangUp' }), item(TRIG.agencyPerk, { system: { choice: 'technology' } })]);
    expect(suppressesFumbleStoryPoint(agent, 'technology')).toBe(true);
    expect(suppressesFumbleStoryPoint(agent, 'might')).toBe(false);
    expect(suppressesFumbleStoryPoint(makeActor('x'), 'technology')).toBe(false);
  });

  test('Inspirational Leader lifts allies on the same skill this round', () => {
    const leader = makeActor('lea', [item(TRIG.inspirationalLeader)]);
    const ally = makeActor('all');
    global.game.actors = [leader, ally];
    global.game.combat = { id: 'c1', round: 2 };
    leader.flags.essence20 = { inspiringSkill: { skill: 'might', combatId: 'c1', round: 2 } };
    expect(inspiringLeaders(ally, 'might')).toEqual([leader]);
    expect(inspiringLeaders(ally, 'finesse')).toEqual([]);
    expect(inspiringLeaders(leader, 'might')).toEqual([]);
    expect(inspirationalLeaderAssist(leader)).toBe(false);
    global.game.combat = null;
    expect(inspirationalLeaderAssist(leader)).toBe(true);
  });

  test('All For One gives from the user\'s own character', () => {
    const recipient = makeActor('rec');
    const own = makeActor('own');
    global.game.user = { id: 'p', isGM: false, character: own };
    expect(giverFor(recipient)).toBe(own);
  });

  test('Junker holders get a Snag after gear breaks in combat', async () => {
    const junker = makeActor('jun', [item(TRIG.junker, { type: 'hangUp' })]);
    global.game.actors = [junker];
    global.game.combat = { id: 'c1' };
    const { noteBroken } = await import('./triggers.mjs');
    await noteBroken();
    expect(junker.getFlag('essence20', 'junkerSnag')).toBe(true);
    const sources = registrySnapshot().rollSources.map(fn => fn(junker, null, {})).filter(Boolean).flatMap(s => s.sources);
    expect(sources.find(s => s.id == 'reactJunker')).toMatchObject({ snag: true });
  });
});

describe('forms', () => {
  test('Monster Form path and Stone Resistance', () => {
    const role = item('Compendium.essence20.finster_s_monster_matic_cookbook.Item.TEjkVjIEFEbRI736', { type: 'role' });
    const stone = makeActor('sto', [role]);
    expect(monsterPath(stone)).toBeNull();
    stone.flags.essence20 = { monsterFormActive: true };
    expect(monsterPath(stone)).toBe('stone');
    const attack = type => registrySnapshot().rollSources.map(fn => fn(makeActor('a'), stone, { isAttack: true, item: { system: { damageType: type } } }))
      .filter(Boolean).flatMap(s => s.sources).some(s => s.id == 'reactStoneForm');
    expect(attack('blunt')).toBe(true);
    expect(attack('psychic')).toBe(false);
  });

  test('Iron Bravado shares immunity with the listed allies', () => {
    const giver = makeActor('giv', [item(FORM.ironBravado)]);
    giver.flags.essence20 = { ironBravadoShare: { conditions: ['frightened'], allies: ['Actor.ally'], combatId: null } };
    global.game.actors = [giver];
    expect(sharedImmunity({ uuid: 'Actor.ally' }, 'frightened')).toBe(giver);
    expect(sharedImmunity({ uuid: 'Actor.ally' }, 'stunned')).toBeNull();
    expect(sharedImmunity({ uuid: 'Actor.other' }, 'frightened')).toBeNull();
  });
});

describe('auras', () => {
  test('only plain Reach melee attacks trigger an aura', () => {
    const actor = makeActor('att', [], { size: 'common' });
    CONFIG.E20.actorReach ??= { common: 5 };
    expect(isPlainReach(actor, { type: 'weaponEffect', system: { classification: { style: 'melee' }, range: {}, totalReach: 5 } })).toBe(true);
    expect(isPlainReach(actor, { type: 'weaponEffect', system: { classification: { style: 'melee' }, range: { reachMultiplier: 2 } } })).toBe(false);
    expect(isPlainReach(actor, { type: 'weaponEffect', system: { classification: { style: 'projectile' }, range: {} } })).toBe(false);
  });

  test('a targeted wearer of Spiked is found; unworn Upgrades are not', () => {
    const armor = item(null, { type: 'armor', system: { equipped: true } });
    const spikes = item(AURA[1].uuid, { type: 'upgrade', name: 'Spiked', more: { flags: { core: { sourceId: AURA[1].uuid }, essence20: { parentId: armor.id } } } });
    const wearer = makeActor('wea', [armor, spikes]);
    const attacker = makeActor('att', [], { size: 'common' });
    global.game.user.targets = new Set([{ actor: wearer }]);
    const melee = { type: 'weaponEffect', system: { classification: { style: 'melee' }, range: {} } };
    expect(auraTargets(attacker, melee).map(e => e.aura.shiftDown)).toEqual([1]);
    armor.system.equipped = false;
    expect(auraTargets(attacker, melee)).toEqual([]);
  });
});
