import { jest } from '@jest/globals';
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({ setEntryAndAddItem: jest.fn(async () => 'key1') }));
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({ applyDamage: jest.fn(async () => 1) }));
const {
  afterMutatedAttack, attachTemporaryUpgrade, getMutation, isExpired, isGridShellActive, resolveWeaponChangesAfterAttack,
  spendUntilUsed, sweepTemporary,
} = await import('./weapon-perk-uses.mjs');
const { applyDamage } = await import('../../mechanics/combat/combat.mjs');
const { bombKind, checkTimeBombs, detonateBomb, getPlantedBombs, plantBomb, tokensInBlast } = await import('./planted-bombs.mjs');

const wait = jest.fn();
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
    escapeHTML: s => s,
    randomID: () => 'bomb1',
  },
  applications: { api: { DialogV2: { wait } } },
};

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
  return obj;
}

function makeActor(items = [], system = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id == id);
  const actor = flagged({
    id: 'a1', uuid: 'Actor.a1', name: 'Duke', isOwner: true, items: list, system: { level: 12, energon: { normal: { value: 2 } }, ...system },
    update: jest.fn(async function (data) {
      if (data['system.energon.normal.value'] !== undefined) this.system.energon.normal.value = data['system.energon.normal.value'];
    }),
    createEmbeddedDocuments: jest.fn(async (type, data) => data.map((d, i) => flagged({ ...d, id: `c${i}` }))),
    deleteEmbeddedDocuments: jest.fn(async () => {}),
    getActiveTokens: () => [{ center: { x: 50, y: 50 } }],
  });
  for (const item of list) {
    item.parent = actor;
  }

  return actor;
}

const weapon = (id, extra = {}) => flagged({ id, type: 'weapon', name: `W-${id}`, system: { items: {}, classification: { size: 'long' } }, update: jest.fn(), ...extra });

let scene = 1;
beforeEach(() => {
  wait.mockReset();
  applyDamage.mockClear();
  global.ui = { notifications: { warn: jest.fn() } };
  global.CONFIG = { E20: { damageTypes: { cold: 'Cold', fire: 'Fire', acid: 'Acid', electric: 'E', emp: 'EMP', laser: 'L', sonic: 'S', blunt: 'B', sharp: 'Sh' }, weaponTraits: { antiTank: 'AT', armorPiercing: 'AP', wrecker: 'W' }, skills: { might: 'Might' }, availabilities: { standard: 'Standard' }, availabilityDifficulties: { standard: 0, limited: 10 } } };
  global.game = {
    i18n: { localize: k => k, format: k => k },
    settings: { get: () => scene },
    combat: { id: 'c1', round: 2, turn: 1 },
    packs: [],
  };
  global.fromUuid = jest.fn();
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
});

describe("mutations", () => {
  test("the one-shot parts of a mutation go after the next attack; a Fumble ends it all", async () => {
    const gun = weapon('g');
    gun.flags.essence20 = { mutation: { explosiveAmmo: true, blastSet: 10, tripleNext: true, airburstNext: true, untilFumble: true } };
    await afterMutatedAttack(gun, false);
    expect(getMutation(gun)).toMatchObject({ explosiveAmmo: true, blastSet: 10, tripleNext: false, airburstNext: false });
    await afterMutatedAttack(gun, true);
    expect(getMutation(gun)).toBeNull();
    await afterMutatedAttack(weapon('h'), true);
  });

  test("Backblast burns everyone near - or the attacker on a Fumble; Airburst knocks down or Impairs", async () => {
    const gun = weapon('g', {});
    gun.flags = { essence20: { mutation: { backblast: true, airburstNext: true } } };
    flagged(gun);
    const actor = makeActor([gun]);
    const hit = { toggleStatusEffect: jest.fn() };
    const missed = { toggleStatusEffect: jest.fn() };
    global.canvas = { grid: { measurePath: () => ({ distance: 5 }) }, tokens: { placeables: [] } };
    fromUuid.mockImplementation(async uuid => (uuid == 'hit' ? hit : missed));

    await resolveWeaponChangesAfterAttack(actor, gun, { outcomes: [{ isFumble: true, results: [{ targetUuid: 'hit', success: true }, { targetUuid: 'miss', success: false }] }] });

    expect(applyDamage).toHaveBeenCalledWith(actor, 1, 'fire');
    expect(hit.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });
    expect(missed.toggleStatusEffect).toHaveBeenCalledWith('impaired', { active: true });
    expect(getMutation(gun)).toBeNull();
  });
});

describe("temporary upgrades", () => {
  test("expiry by kind", () => {
    expect(isExpired({ kind: 'turn', combatId: 'c1', round: 2, turn: 1 })).toBe(false);
    expect(isExpired({ kind: 'turn', combatId: 'c1', round: 2, turn: 0 })).toBe(true);
    expect(isExpired({ kind: 'nextTurn', combatId: 'c1', round: 1, turn: 1 })).toBe(false);
    expect(isExpired({ kind: 'nextTurn', combatId: 'c1', round: 1, turn: 0 })).toBe(true);
    expect(isExpired({ kind: 'rounds', rounds: 10, combatId: 'c1', round: 1 })).toBe(false);
    expect(isExpired({ kind: 'scene', scene: 1 })).toBe(false);
    expect(isExpired({ kind: 'scene', scene: 0 })).toBe(true);
    expect(isExpired({ kind: 'untilUsed' })).toBe(false);
    expect(isExpired(null)).toBe(false);
  });

  test("attaching, sweeping and a one-use trap", async () => {
    const gun = weapon('g');
    const actor = makeActor([gun]);
    fromUuid.mockResolvedValue({ toObject: () => ({ _id: 'x', name: 'Scope', type: 'upgrade', system: {} }) });

    const created = await attachTemporaryUpgrade(actor, gun, 'Compendium.x', { kind: 'untilUsed' });
    expect(created.flags.essence20.parentId).toBe('g');
    expect(created.setFlag).toHaveBeenCalledWith('essence20', 'collectionId', 'key1');

    actor.items.push({ id: 'old', flags: { essence20: { parentId: 'g', collectionId: 'k', temporary: { kind: 'turn', combatId: 'c1', round: 1, turn: 0 } } } });
    gun.system.items = { k: {} };
    expect(await sweepTemporary(actor)).toBe(1);
    expect(gun.update).toHaveBeenCalledWith({ 'system.items.-=k': null });

    actor.items.push({ id: 'trap', flags: { essence20: { parentId: 'g', temporary: { kind: 'untilUsed' } } } });
    await spendUntilUsed(actor, gun);
    expect(actor.deleteEmbeddedDocuments).toHaveBeenLastCalledWith('Item', ['trap']);
  });

  test("the Grid shell is its Use rule's gridShell mark, for the scene", async () => {
    const actor = makeActor();
    expect(isGridShellActive(actor)).toBe(false);
    actor.flags = { ...(actor.flags ?? {}), essence20: { ...(actor.flags?.essence20 ?? {}), ruleMarks: { gridShell: { by: actor.uuid, until: 'scene', stamp: { epoch: 1 } } } } };
    expect(isGridShellActive(actor)).toBe(true);
    scene = 2;
    expect(isGridShellActive(actor)).toBe(false);
    scene = 1;
  });
});

describe("planted bombs", () => {
  test("rolling a bomb plants it; a time bomb comes due; detonating attacks everyone in the blast", async () => {
    const bombWeapon = weapon('b');
    const actor = makeActor([bombWeapon, { type: 'upgrade', flags: { core: { sourceId: 'Compendium.essence20.pr_crb.Item.VMZ8PDom0sJGyofl' }, essence20: { parentId: 'b' } }, system: {} }]);
    const effect = { id: 'fx', system: { radius: 10 }, roll: jest.fn() };
    actor.items.push(effect);
    game.user = { targets: { first: () => null }, isActiveGM: true };
    game.actors = { contents: [actor] };
    game.combat = { id: 'c1', round: 2, turn: 1, combatants: [], combatant: { initiative: 5 } };
    global.canvas = { scene: { id: 's1' }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) }, tokens: { placeables: [{ id: 't1', actor: {}, center: { x: 55, y: 50 } }, { id: 't2', actor: {}, center: { x: 500, y: 50 } }], setTargets: jest.fn() } };
    wait.mockResolvedValueOnce(1);

    expect(bombKind(bombWeapon)).toBe('time');
    const bomb = await plantBomb(actor, effect, bombWeapon);
    expect(bomb).toMatchObject({ kind: 'time', dueRound: 3, radius: 10 });
    expect(tokensInBlast(bomb).map(t => t.id)).toEqual(['t1']);

    await checkTimeBombs(game.combat);
    expect(getPlantedBombs(actor)[0].announced).toBeFalsy();
    game.combat.round = 3;
    await checkTimeBombs(game.combat);
    expect(getPlantedBombs(actor)[0].announced).toBe(true);

    await detonateBomb(actor, 'bomb1');
    expect(canvas.tokens.setTargets).toHaveBeenCalledWith(['t1']);
    expect(effect.roll).toHaveBeenCalledWith({ bombDetonation: true, bypassEconomy: true, skillOverride: 'technology' });
    expect(getPlantedBombs(actor)).toEqual([]);
  });
});
