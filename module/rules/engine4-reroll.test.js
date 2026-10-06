import { jest } from '@jest/globals';

// Round-4 engine: the rerollCard step (a Reaction's card reroll), with the reroll engine mocked.

let rerollTo = 5;
jest.unstable_mockModule('./mechanics/rolls/reroll.mjs', () => ({
  normalizeRerollConfig: config => ({ ...config }),
  applyReroll: jest.fn(async (roll, config) => {
    roll.total = rerollTo;
    roll.config = config;
    return true;
  }),
}));

const { runSteps, stepContext, stepErrors } = await import('./steps.mjs');

/** foundry.utils.setProperty, for plain objects. */
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

let nextId = 1;
function makeActor(name) {
  const actor = { id: `a${nextId++}`, name, flags: { essence20: {} }, isOwner: true, items: { contents: [] } };
  actor.uuid = `Actor.${actor.id}`;
  return actor;
}

beforeEach(() => {
  global.game = { user: { id: 'u', isGM: true, targets: new Set() }, i18n: { localize: key => key, format: key => key } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = { ...(global.foundry ?? {}), utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath } };
});

describe('rerollCard', () => {
  test('rerolls the card d20: rows the new total misses are cancelled, rows it now reaches become hits', async () => {
    const { cardInfo } = await import('../mechanics/combat/reaction-engine.mjs');
    const attacker = makeActor('Goon');
    const near = makeActor('Near');
    const far = makeActor('Far');
    const byUuid = new Map([attacker, near, far].map(a => [a.uuid, a]));
    global.fromUuidSync = uuid => byUuid.get(uuid) ?? null;
    global.fromUuid = async uuid => byUuid.get(uuid) ?? null;
    global.game.actors = { get: id => [attacker, near, far].find(a => a.id == id) ?? null };
    const flags = {};
    const roll = { total: 15, formula: '1d20', dice: [], toJSON: () => ({}) };
    const message = {
      id: 'm1', speaker: { actor: attacker.id }, rolls: [roll],
      flags: { essence20: { isAttack: false, checkResults: [{ targetUuid: near.uuid, difficulty: 12, success: true }, { targetUuid: far.uuid, difficulty: 18, success: false }] } },
      content: '', getFlag: (scope, key) => flags[key], async setFlag(scope, key, value) {
        flags[key] = value;
      },
    };
    global.game.messages = { get: () => message };
    global.Roll = { fromData: () => ({ toMessage: jest.fn() }) };
    const info = cardInfo(message);
    const ctx = stepContext({ actor: makeActor('Friend'), item: { name: 'Best-Laid Plans' }, targets: [] });
    ctx.card = { info, row: null };
    rerollTo = 5;
    await runSteps([{ do: 'rerollCard', rows: 'all' }], ctx);
    expect(flags.reactNegated).toEqual([near.uuid]);
    expect(info.total).toBe(5);
    expect(stepErrors([{ do: 'rerollCard', target: 'd12' }])).toHaveLength(1);
    delete global.Roll;
    delete global.fromUuidSync;
    delete global.fromUuid;
  });
});
