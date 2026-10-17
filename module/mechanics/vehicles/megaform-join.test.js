import { jest } from '@jest/globals';

const announce = jest.fn();
let participants = [];
jest.unstable_mockModule('./mechanics/world/public-hooks.mjs', () => ({ announce }));
jest.unstable_mockModule('./mechanics/vehicles/megaform-participants.mjs', () => ({ getMegaformParticipants: () => participants }));
const {
  JOINED_FLAG, centerOf, joinPlacement, joinedTokenOf, joinMegaform, megaformTokens, memberTokens, separateMegaform, separatePlacement,
} = await import('./megaform-join.mjs');

const GRID = 100;

/** A token document stand-in: its data, flags, and toObject. */
function makeToken(id, actorId, x, y, { width = 1, height = 1, hidden = false, flags = {} } = {}) {
  const token = {
    id, actorId, x, y, width, height, hidden, name: `T-${id}`, actor: { id: actorId, name: `A-${actorId}` }, flags,
    getFlag: (scope, key) => token.flags?.[scope]?.[key],
    toObject: () => ({ _id: id, actorId, x, y, width, height, hidden, name: `T-${id}` }),
  };
  token._source = { x, y, width, height };
  return token;
}

/** A scene stand-in whose token creates and deletes change its token list. */
function makeScene(tokens) {
  const scene = {
    id: 'sc1', grid: { size: GRID }, tokens: { contents: tokens },
    createEmbeddedDocuments: jest.fn(async (type, list) => list.map((data, index) => {
      const made = makeToken(`new${scene.tokens.contents.length + index}`, data.actorId, data.x, data.y, { width: data.width, height: data.height, flags: data.flags });
      scene.tokens.contents.push(made);
      return made;
    })),
    deleteEmbeddedDocuments: jest.fn(async (type, ids) => {
      scene.tokens.contents = scene.tokens.contents.filter(token => !ids.includes(token.id));
    }),
  };
  return scene;
}

let combatantIds = 0;

function makeCombat(entries) {
  const combat = {
    combatants: entries,
    createEmbeddedDocuments: jest.fn(async (type, list) => {
      combat.combatants.push(...list.map(data => ({ id: `c-new${++combatantIds}`, ...data })));
    }),
    deleteEmbeddedDocuments: jest.fn(async (type, ids) => {
      combat.combatants = combat.combatants.filter(combatant => !ids.includes(combatant.id));
    }),
  };
  return combat;
}

const form = {
  id: 'mega', uuid: 'Actor.mega', name: 'Megazord', system: { subtype: ['megaformZord'] }, prototypeToken: { width: 4, height: 4 },
  getTokenDocument: jest.fn(async data => ({ toObject: () => ({ actorId: 'mega', width: 4, height: 4, ...data }) })),
};

beforeEach(() => {
  announce.mockReset();
  participants = [{ id: 'z1' }, { id: 'z2' }, { id: 'z3' }];
  global.ui = { notifications: { warn: jest.fn() } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.game = { ...(global.game ?? {}), i18n: { localize: key => key, format: key => key }, combats: [], user: { isGM: true } };
  global.foundry = { ...global.foundry, utils: { ...global.foundry?.utils, setProperty: (obj, path, value) => {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => (o[k] ??= {}), obj)[last] = value;
  } } };
});

describe('placement', () => {
  test("a token's centre, and the Megaform centred on its members' middle", () => {
    expect(centerOf({ x: 0, y: 0, width: 2, height: 1 }, GRID)).toEqual({ x: 100, y: 50 });
    const place = joinPlacement([{ x: 0, y: 0 }, { x: 400, y: 0 }], { width: 4, height: 4 }, GRID);
    expect(place).toEqual({ x: 50, y: -150, center: { x: 250, y: 50 } });
  });

  test('members go back as they were arranged, moved with the Megaform', () => {
    expect(separatePlacement([{ x: 0, y: 0, name: 'a' }, { x: 400, y: 0, name: 'b' }], { x: 250, y: 50 }, { x: 550, y: 250 }))
      .toEqual([{ x: 300, y: 200, name: 'a' }, { x: 700, y: 200, name: 'b' }]);
    expect(separatePlacement([{ x: 10, y: 10 }], { x: 0, y: 0 }, null)).toEqual([{ x: 10, y: 10 }]);
  });
});

describe('join and separate', () => {
  test("joining: the Megaform's token where its members stood, they leave, the turn order follows, the hook fires", async () => {
    const tokens = [makeToken('t1', 'z1', 0, 0), makeToken('t2', 'z2', 400, 0), makeToken('other', 'stranger', 900, 900)];
    const scene = makeScene(tokens);
    const combat = makeCombat([{ id: 'c1', tokenId: 't1', initiative: 12 }, { id: 'c2', tokenId: 't2', initiative: 17 }]);
    game.combats = [combat];
    expect(memberTokens(form, scene).map(token => token.id)).toEqual(['t1', 't2']);

    const token = await joinMegaform(form, { scene });
    expect(token.actorId).toBe('mega');
    expect([token.x, token.y]).toEqual([50, -150]);
    const joined = token.getFlag('essence20', JOINED_FLAG);
    expect(joined.center).toEqual({ x: 250, y: 50 });
    expect(joined.members.map(entry => [entry.data._id, entry.initiative, entry.inCombat])).toEqual([['t1', 12, true], ['t2', 17, true]]);
    expect(scene.tokens.contents.map(t => t.id)).toEqual(['other', token.id]);
    expect(combat.combatants.map(c => [c.tokenId, c.initiative])).toEqual([[token.id, 17]]);
    expect(announce).toHaveBeenCalledWith('megaformFormed', expect.objectContaining({ form, token, from: [{ x: 50, y: 50 }, { x: 450, y: 50 }] }));
    expect(joinedTokenOf(form, scene)).toBe(token);

    // Joined already: refused.
    expect(await joinMegaform(form, { scene })).toBeNull();
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.MegaformJoinAlready');
  });

  test('separating: the members come back around where the Megaform is now, with their initiative; the hook says so', async () => {
    const scene = makeScene([makeToken('t1', 'z1', 0, 0), makeToken('t2', 'z2', 400, 0)]);
    const combat = makeCombat([{ id: 'c1', tokenId: 't1', initiative: 12 }, { id: 'c2', tokenId: 't2', initiative: null }]);
    game.combats = [combat];
    const token = await joinMegaform(form, { scene });
    // The Megaform moves 300px right before splitting.
    token.x += 300;
    token._source.x += 300;

    const back = await separateMegaform(form, { scene });
    expect(back.map(t => [t.actorId, t.x, t.y])).toEqual([['z1', 300, 0], ['z2', 700, 0]]);
    expect(scene.tokens.contents.some(t => t.actorId == 'mega')).toBe(false);
    expect(combat.combatants.map(c => [c.actorId, c.initiative])).toEqual([['z1', 12], ['z2', 12]]);
    expect(announce).toHaveBeenLastCalledWith('megaformSplit', expect.objectContaining({ form, voluntary: true, isCombiner: false, at: { x: 550, y: 50, w: 400 }, to: [{ x: 350, y: 50 }, { x: 750, y: 50 }] }));
    expect(ChatMessage.create).toHaveBeenCalledTimes(2);
  });

  test('breaking apart (not voluntary) restores the tokens without its own hook or chat; nothing joined does nothing', async () => {
    const scene = makeScene([makeToken('t1', 'z1', 0, 0)]);
    await joinMegaform(form, { scene });
    announce.mockReset();
    ChatMessage.create.mockReset();
    expect((await separateMegaform(form, { scene, voluntary: false })).length).toBe(1);
    expect(announce).not.toHaveBeenCalled();
    expect(ChatMessage.create).not.toHaveBeenCalled();
    expect(await separateMegaform(form, { scene, voluntary: false })).toEqual([]);
    expect(ui.notifications.warn).not.toHaveBeenCalled();
    expect(await separateMegaform(form, { scene })).toEqual([]);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.MegaformSeparateNothing');
  });

  test('no member tokens on the scene: nothing joins', async () => {
    const scene = makeScene([makeToken('x', 'stranger', 0, 0)]);
    expect(await joinMegaform(form, { scene })).toBeNull();
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.MegaformJoinNoTokens');
    expect(await joinMegaform(null, { scene })).toBeNull();
  });

  test('a player without token permissions asks the GM', async () => {
    global.canvas = { scene: makeScene([]) };
    game.user = { isGM: false, can: () => false };
    const createViaGm = jest.fn(async () => true);
    jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ createViaGm }));
    // megaformTokens imports gm-relay lazily, so the mock registered here is the one it gets.
    await megaformTokens('join', form);
    await megaformTokens('separate', form);
    expect(createViaGm.mock.calls.map(call => call[0])).toEqual(['megaformJoin', 'megaformSeparate']);
    expect(createViaGm).toHaveBeenCalledWith('megaformJoin', { actorUuid: 'Actor.mega', sceneId: 'sc1' });
    delete global.canvas;
  });
});
