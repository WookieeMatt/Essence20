import { jest } from '@jest/globals';

/** Riding a creature (homebrew mounts) - mounts.mjs and its rule tags. */

const spend = jest.fn(async () => ({ blocked: false }));
jest.unstable_mockModule('./mechanics/actions/action-economy.mjs', () => ({ spend, setNextTurn: jest.fn(), grantBonusAttack: jest.fn(), getLedger: () => null, isTracking: () => true }));
const createViaGm = jest.fn(async () => true);
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ createViaGm, needsGmRelay: () => false, relayToGm: jest.fn() }));
jest.unstable_mockModule('./mechanics/vehicles/zord-recall.mjs', () => ({
  disembarkPositions: (token, count) => Array.from({ length: count }, (_, i) => ({ x: token.x + 200 + i * 100, y: token.y })),
}));

await import('../../rules/plugins/index.mjs');
const { evaluate, contextFor } = await import('../../rules/predicate.mjs');
const mounts = await import('./mounts.mjs');

let nextId = 1;
const byUuid = new Map();
function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  const at = keys.reduce((node, k) => (node[k] ??= {}), object);
  if (last.startsWith('-=') || value instanceof foundry.data.operators.ForcedDeletion) {
    delete at[last.replace(/^-=/, '')];
  } else {
    at[last] = value;
  }
}

function makeActor({ name = 'Hero', type = 'playerCharacter', size = 'common', rideable = false, riders = 1, owner = true } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, documentName: 'Actor', isOwner: owner, img: `${name}.png`,
    flags: { essence20: {} }, items: { contents: [], [Symbol.iterator]: () => [][Symbol.iterator]() },
    system: { size, mount: { rideable, riders } },
    getActiveTokens: () => [],
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    testUserPermission: () => owner,
  };
  actor.uuid = `Actor.${actor.id}`;
  byUuid.set(actor.uuid, actor);
  game.actors.contents.push(actor);
  return actor;
}

const cat = (options = {}) => makeActor({ name: 'Battle Cat', type: 'companion', size: 'large', rideable: true, ...options });

beforeEach(() => {
  byUuid.clear();
  [spend, createViaGm].forEach(fn => fn.mockClear());
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: { isSelf: true } },
    actors: { contents: [] }, i18n: { localize: k => k, format: k => k, has: () => false }, settings: { get: () => 1 },
  };
  global.canvas = { tokens: { placeables: [] }, scene: null };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuidSync = uuid => byUuid.get(uuid) ?? null;
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), randomID: () => `k${nextId++}` },
    data: { operators: { ForcedDeletion: class ForcedDeletion {} } },
  };
});

const warned = () => ui.notifications.warn.mock.calls.map(([text]) => text.split(' ')[0]);

test('only a creature with "Can be ridden" is a mount; it carries at least one', () => {
  expect(mounts.isRideable(cat())).toBe(true);
  expect(mounts.isRideable(makeActor())).toBe(false);
  expect(mounts.riderLimit(cat({ riders: 3 }))).toBe(3);
  expect(mounts.riderLimit(cat({ riders: 0 }))).toBe(1);
  expect(mounts.riderLimit(makeActor())).toBe(0);
});

test('who may not get on: not a mount, itself, already riding, ridden itself, too big, no room', async () => {
  const mount = cat();
  const heMan = makeActor({ name: 'He-Man' });
  expect(mounts.mountRefusal(makeActor({ name: 'Rock' }), heMan)).toBe('NotRideable');
  expect(mounts.mountRefusal(mount, mount)).toBe('NoRider');
  expect(mounts.mountRefusal(mount, null)).toBe('NoRider');
  expect(mounts.mountRefusal(mount, makeActor({ name: 'Ogre', size: 'large' }))).toBe('TooBig');
  expect(mounts.mountRefusal(mount, makeActor({ name: 'Wagon', size: 'long' }))).toBe('TooBig');
  expect(mounts.mountRefusal(mount, heMan)).toBeNull();

  await mounts.mountUp(mount, heMan);
  expect(mounts.mountRefusal(mount, heMan)).toBe('AlreadyRiding');
  expect(mounts.mountRefusal(cat({ name: 'Panthor' }), heMan)).toBe('RidingOther');
  expect(mounts.mountRefusal(mount, makeActor({ name: 'Teela' }))).toBe('Full');
  // A mount with its own rider can't climb onto a bigger one.
  expect(mounts.mountRefusal(makeActor({ name: 'Dragon', size: 'huge', rideable: true }), mount)).toBe('HasRiders');
});

test('getting on and off: the row on the mount, a chat line, a hook - and a Move action in a fight', async () => {
  const hooks = jest.spyOn(Hooks, 'callAll');
  const mount = cat({ riders: 2 });
  const heMan = makeActor({ name: 'He-Man' });
  expect(await mounts.mountUp(mount, heMan)).toBe(true);
  expect(mounts.riderEntries(mount).map(entry => entry.name)).toEqual(['He-Man']);
  expect(mounts.mountOf(heMan)?.mount).toBe(mount);
  expect(mounts.ridersOf(mount)).toEqual([heMan]);
  expect(spend).not.toHaveBeenCalled();
  expect(ChatMessage.create.mock.calls[0][0].content).toMatch(/^<p>Mounted /);
  expect(hooks).toHaveBeenCalledWith('essence20.mounted', { mount, rider: heMan });

  game.combat = { started: true, combatants: [{ actor: heMan }] };
  expect(await mounts.dismount(mount, heMan)).toBe(true);
  expect(spend).toHaveBeenCalledWith(heMan, 'move', { source: expect.stringMatching(/^DismountSource/) });
  expect(mounts.mountOf(heMan)).toBeNull();
  expect(hooks).toHaveBeenCalledWith('essence20.dismounted', { mount, rider: heMan });

  // Backing out of the Move action leaves them where they are.
  spend.mockResolvedValueOnce({ blocked: true });
  expect(await mounts.mountUp(mount, heMan)).toBe(false);
  expect(mounts.riderEntries(mount)).toEqual([]);
  expect(await mounts.dismount(mount, heMan)).toBe(false);
  expect(warned()).toEqual(['NotRiding']);
  hooks.mockRestore();
});

test('a refusal is said, and getting on needs the two tokens side by side', async () => {
  const mount = cat();
  const heMan = makeActor({ name: 'He-Man' });
  expect(await mounts.mountUp(mount, mount)).toBe(false);
  const tokenFor = (actor, x) => ({ id: `t${actor.id}`, actorLink: true, actorId: actor.id, x, y: 0, width: actor == mount ? 2 : 1, height: 1 });
  const tokens = [tokenFor(mount, 0), tokenFor(heMan, 500)];
  canvas.scene = { tokens, grid: { size: 100 } };
  tokens.forEach(token => (token.parent = canvas.scene));
  expect(await mounts.mountUp(mount, heMan)).toBe(false);
  expect(warned()).toEqual(['NoRider', 'NotInReach']);
  tokens[1].x = 200;
  expect(await mounts.mountUp(mount, heMan)).toBe(true);
});

test("a player getting on someone else's mount goes through the GM, who checks it's theirs to do", async () => {
  const mount = cat({ owner: false });
  const heMan = makeActor({ name: 'He-Man' });
  game.user.isGM = false;
  expect(await mounts.mountUp(mount, heMan)).toBe(true);
  const [kind, payload] = createViaGm.mock.calls[0];
  expect(kind).toBe('mountRider');
  expect(payload).toMatchObject({ actorUuid: mount.uuid, riderUuid: heMan.uuid, entry: { uuid: heMan.uuid } });

  const player = { isGM: false };
  expect(mounts.relayedRiderAllowed(payload, player)).toBe(true);
  expect(mounts.relayedRiderAllowed({ ...payload, entry: { uuid: 'Actor.someoneElse' } }, player)).toBe(false);
  const stranger = makeActor({ name: 'Skeletor', owner: false });
  expect(mounts.relayedRiderAllowed({ ...payload, riderUuid: stranger.uuid, entry: { uuid: stranger.uuid } }, player)).toBe(false);
  expect(mounts.relayedRiderAllowed({ ...payload, riderUuid: stranger.uuid, entry: { uuid: stranger.uuid } }, { isGM: true })).toBe(true);
  expect(mounts.relayedRiderAllowed({ actorUuid: makeActor({ name: 'Rock' }).uuid, riderUuid: heMan.uuid }, player)).toBe(false);

  await mounts.applyRelayedRider(payload);
  expect(mounts.riderEntries(mount).map(entry => entry.uuid)).toEqual([heMan.uuid]);
});

test("dragging a rider moves the mount by as much; a mount's riders beside it", () => {
  const rider = { x: 150, y: 50 };
  const mountToken = { x: 100, y: 0 };
  expect(mounts.mountMoveFor(rider, { x: 350 }, mountToken)).toEqual({ x: 300, y: 0 });
  expect(mounts.mountMoveFor(rider, { x: 150, y: 50 }, mountToken)).toBeNull();
  expect(mounts.mountMoveFor(rider, { hidden: true }, mountToken)).toBeNull();
  expect(mounts.mountMoveFor(rider, { x: 1 }, null)).toBeNull();

  const mount = cat();
  const heMan = makeActor({ name: 'He-Man' });
  const scene = { grid: { size: 100 }, tokens: [] };
  const token = (actor, x) => ({ id: `t${actor.id}`, actor, x, y: 0, width: 1, height: 1, parent: scene });
  scene.tokens.push(token(mount, 100), token(heMan, 0), token(cat({ name: 'Far' }), 900));
  expect(mounts.mountsBeside(scene.tokens[1]).map(other => other.actor.name)).toEqual(['Battle Cat']);
  expect(mounts.mountsBeside(scene.tokens[0])).toEqual([]);
});

test('the rule tags: self:mounted on the rider, self:ridden on the mount', async () => {
  const mount = cat();
  const heMan = makeActor({ name: 'He-Man' });
  expect(evaluate(['self:mounted'], contextFor({ self: heMan }))).toBe(false);
  expect(evaluate(['self:ridden'], contextFor({ self: mount }))).toBe(false);
  await mounts.mountUp(mount, heMan);
  expect(evaluate(['self:mounted'], contextFor({ self: heMan }))).toBe(true);
  expect(evaluate(['self:ridden'], contextFor({ self: mount }))).toBe(true);
  expect(evaluate(['target:mounted'], contextFor({ self: mount, other: heMan }))).toBe(true);
  expect(evaluate(['target:ridden'], contextFor({ self: heMan, other: mount }))).toBe(true);
});

test("the sheets' lines: the rider's mount, the mount's riders and room", async () => {
  const mount = cat({ riders: 2 });
  const heMan = makeActor({ name: 'He-Man' });
  expect(mounts.ridingSheetContext(heMan)).toBeNull();
  expect(mounts.ridersSheetContext(makeActor())).toBeNull();
  expect(mounts.ridersSheetContext(mount)).toMatchObject({ riders: [], limit: 2, full: false });
  await mounts.mountUp(mount, heMan);
  expect(mounts.ridingSheetContext(heMan)).toEqual({ mountName: 'Battle Cat', mountUuid: mount.uuid });
  expect(mounts.ridersSheetContext(mount)).toMatchObject({ limit: 2, full: false, riders: [{ name: 'He-Man' }] });
});

test("the GM's tokens: a rider's sits centred on the mount, drawn above it; one who got off goes beside it", async () => {
  const mount = cat();
  const heMan = makeActor({ name: 'He-Man' });
  const updates = [];
  const scene = { grid: { size: 100 }, tokens: [], updateEmbeddedDocuments: jest.fn(async (type, data) => updates.push(...data)) };
  const token = (actor, x, extra = {}) => ({ id: `t${actor.id}`, actorLink: true, actorId: actor.id, actor, x, y: 0, width: actor == mount ? 2 : 1, height: actor == mount ? 2 : 1, sort: 0, parent: scene, flags: {}, ...extra });
  scene.tokens.push(token(mount, 0, { sort: 3 }), token(heMan, 200));
  await mounts.mountUp(mount, heMan);
  await mounts.syncRiderTokens(mount, scene);
  expect(updates[0]).toMatchObject({ _id: `t${heMan.id}`, x: 50, y: 50, sort: 4, 'flags.essence20.ridingOn': mount.uuid });

  updates.length = 0;
  scene.tokens[1].flags = { essence20: { ridingOn: mount.uuid } };
  await mounts.dismount(mount, heMan);
  await mounts.syncRiderTokens(mount, scene);
  expect(updates[0]).toMatchObject({ _id: `t${heMan.id}`, x: 200, y: 0, 'flags.essence20.-=ridingOn': null });
});
