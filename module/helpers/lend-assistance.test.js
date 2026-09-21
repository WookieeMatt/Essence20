import { jest } from '@jest/globals';
import {
  activateLendAssistance, LEND_ASSISTANCE_EDGE_FLAG, LEND_ASSISTANCE_RANGE_FEET,
  LEND_ASSISTANCE_SHIFT_FLAG,
} from './lend-assistance.mjs';

/**
 * An actor with a token on the canvas, since both the ally scan and the range check measure from
 * one. `shift` drives getSkillRanks, which is what the skill prerequisite compares.
 */
function makeActor({
  id = 'a1', name = 'Duke', disposition = 1, x = 0, targeting = 'might', shift = 'd8',
  isSpecialized = false,
} = {}) {
  const flags = {};
  const actor = {
    id,
    name,
    system: {
      skills: {
        might: { shift: targeting === 'might' ? shift : 'd20', isSpecialized },
        targeting: { shift: targeting === 'targeting' ? shift : 'd20', isSpecialized },
      },
    },
    getFlag: (scope, key) => flags[key],
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags[key];
    }),
  };

  const token = {
    name,
    actor,
    center: { x, y: 0 },
    document: { disposition },
  };
  actor.getActiveTokens = () => [token];

  return { actor, token };
}

let dialogResult;
let targets;

/**
 * Stands in for the canvas and the dialog. Distance is the x gap in feet, which is all the range
 * check needs.
 */
function setWorld({ tokens = [], combatId = 'c1' } = {}) {
  global.canvas = {
    tokens: { placeables: tokens },
    grid: {
      measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }),
    },
  };

  global.game = {
    i18n: {
      localize: jest.fn(k => k),
      format: jest.fn(k => k),
    },
    combat: { id: combatId, round: 1 },
    // A getter, so a test may call setTarget before or after this without the order mattering.
    get user() {
      return { targets };
    },
  };

  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };

  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), escapeHTML: (v) => v },
    applications: {
      api: {
        DialogV2: { wait: jest.fn(async () => dialogResult) },
      },
    },
  };
}

/**
 * game.user.targets is a Set with a first() in Foundry; only first() is used here.
 */
function setTarget(token) {
  targets = { first: () => token ?? undefined };
}

beforeEach(() => {
  dialogResult = null;
  setTarget(null);
});

describe('who can be helped', () => {
  test('refuses when there is nobody nearby', async () => {
    const me = makeActor({ id: 'me' });
    setWorld({ tokens: [me.token] });

    const outcome = await activateLendAssistance(me.actor);

    expect(outcome).toEqual({ cancelled: true });
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  // Allies are same-disposition tokens, the system's own ally proxy - see helpers/allies.mjs.
  test('offers only allies, never the enemy being targeted', async () => {
    const me = makeActor({ id: 'me', disposition: 1 });
    const ally = makeActor({ id: 'ally', name: 'Scarlett', disposition: 1, x: 10 });
    const enemy = makeActor({ id: 'enemy', name: 'Cobra', disposition: -1, x: 20 });
    setWorld({ tokens: [me.token, ally.token, enemy.token] });
    setTarget(enemy.token);
    dialogResult = { allyId: 'ally', mode: 'attack', skill: 'might' };

    await activateLendAssistance(me.actor);

    const content = global.foundry.applications.api.DialogV2.wait.mock.calls[0][0].content;
    expect(content).toContain('Scarlett');
    expect(content).not.toContain('Cobra');
  });

  test('banks nothing when the picker is cancelled', async () => {
    const me = makeActor({ id: 'me' });
    const ally = makeActor({ id: 'ally', x: 10 });
    setWorld({ tokens: [me.token, ally.token] });
    dialogResult = null;

    const outcome = await activateLendAssistance(me.actor);

    expect(outcome).toEqual({ cancelled: true });
    expect(ally.actor.setFlag).not.toHaveBeenCalled();
  });
});

describe('the attack half', () => {
  /* "Until the beginning of your next turn, the first attack against the specific target gains an
     Edge" - banked on the ALLY, scoped to the target the assister named. */
  test('banks an Edge on the ally, scoped to the target', async () => {
    const me = makeActor({ id: 'me' });
    const ally = makeActor({ id: 'ally', x: 10 });
    const enemy = makeActor({ id: 'enemy', disposition: -1, x: 20 });
    setWorld({ tokens: [me.token, ally.token, enemy.token] });
    setTarget(enemy.token);
    dialogResult = { allyId: 'ally', mode: 'attack', skill: 'might' };

    const outcome = await activateLendAssistance(me.actor);

    expect(ally.actor.setFlag).toHaveBeenCalledWith('essence20', LEND_ASSISTANCE_EDGE_FLAG,
      expect.objectContaining({ targetId: 'enemy', edge: true }));
    expect(outcome.message).toBeTruthy();
  });

  /* "a specific target within 50 ft". Past that the attack option is simply not offered, rather
     than the whole action being refused - the skill half has no range at all. */
  test('drops the attack option for a target past 50 ft', async () => {
    const me = makeActor({ id: 'me' });
    const ally = makeActor({ id: 'ally', x: 10 });
    const far = makeActor({ id: 'far', disposition: -1, x: LEND_ASSISTANCE_RANGE_FEET + 5 });
    setWorld({ tokens: [me.token, ally.token, far.token] });
    setTarget(far.token);
    dialogResult = { allyId: 'ally', mode: 'skill', skill: 'might' };

    await activateLendAssistance(me.actor);

    const content = global.foundry.applications.api.DialogV2.wait.mock.calls[0][0].content;
    expect(content).not.toContain('LendAssistanceModeAttack');
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  test('a target exactly at the limit is still in range', async () => {
    const me = makeActor({ id: 'me' });
    const ally = makeActor({ id: 'ally', x: 10 });
    const edge = makeActor({ id: 'edge', disposition: -1, x: LEND_ASSISTANCE_RANGE_FEET });
    setWorld({ tokens: [me.token, ally.token, edge.token] });
    setTarget(edge.token);
    dialogResult = { allyId: 'ally', mode: 'attack', skill: 'might' };

    await activateLendAssistance(me.actor);

    const content = global.foundry.applications.api.DialogV2.wait.mock.calls[0][0].content;
    expect(content).toContain('LendAssistanceModeAttack');
  });

  // With nobody targeted the attack option cannot be offered, but the skill half still works.
  test('offers only the skill option with no target', async () => {
    const me = makeActor({ id: 'me' });
    const ally = makeActor({ id: 'ally', x: 10 });
    setWorld({ tokens: [me.token, ally.token] });
    dialogResult = { allyId: 'ally', mode: 'skill', skill: 'might' };

    await activateLendAssistance(me.actor);

    const content = global.foundry.applications.api.DialogV2.wait.mock.calls[0][0].content;
    expect(content).not.toContain('LendAssistanceModeAttack');
    expect(content).toContain('LendAssistanceModeSkill');
  });
});

describe('the skill half', () => {
  /* "if a character has at least as many levels in a given skill as their ally" - the one hard
     numeric prerequisite in the action, so it is enforced rather than left to the table. */
  test('banks the shift when the assister is at least as skilled', async () => {
    const me = makeActor({ id: 'me', shift: 'd8' });
    const ally = makeActor({ id: 'ally', x: 10, shift: 'd4' });
    setWorld({ tokens: [me.token, ally.token] });
    dialogResult = { allyId: 'ally', mode: 'skill', skill: 'might' };

    const outcome = await activateLendAssistance(me.actor);

    expect(ally.actor.setFlag).toHaveBeenCalledWith('essence20', LEND_ASSISTANCE_SHIFT_FLAG,
      expect.objectContaining({ skill: 'might', shiftUp: 1 }));
    expect(outcome.message).toBeTruthy();
  });

  test('equal skill is enough - "at least as many"', async () => {
    const me = makeActor({ id: 'me', shift: 'd6' });
    const ally = makeActor({ id: 'ally', x: 10, shift: 'd6' });
    setWorld({ tokens: [me.token, ally.token] });
    dialogResult = { allyId: 'ally', mode: 'skill', skill: 'might' };

    await activateLendAssistance(me.actor);

    expect(ally.actor.setFlag).toHaveBeenCalled();
  });

  test('refuses when the ally is the better of the two', async () => {
    const me = makeActor({ id: 'me', shift: 'd4' });
    const ally = makeActor({ id: 'ally', x: 10, shift: 'd12' });
    setWorld({ tokens: [me.token, ally.token] });
    dialogResult = { allyId: 'ally', mode: 'skill', skill: 'might' };

    const outcome = await activateLendAssistance(me.actor);

    expect(outcome).toEqual({ cancelled: true });
    expect(ally.actor.setFlag).not.toHaveBeenCalled();
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  // A Specialization counts as a rank, so it can be what tips the comparison either way.
  test('a Specialization counts toward the comparison', async () => {
    const me = makeActor({ id: 'me', shift: 'd6' });
    const ally = makeActor({ id: 'ally', x: 10, shift: 'd6', isSpecialized: true });
    setWorld({ tokens: [me.token, ally.token] });
    dialogResult = { allyId: 'ally', mode: 'skill', skill: 'might' };

    const outcome = await activateLendAssistance(me.actor);

    expect(outcome).toEqual({ cancelled: true });
  });
});
