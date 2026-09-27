import { jest } from '@jest/globals';
import { E20 } from './config.mjs';
import {
  DEFENDING_STATUS, isAutomated, runNamedAction, UNAUTOMATED_ACTIONS,
} from './named-actions.mjs';

/**
 * An actor with just enough of the real surface for these handlers: the two things they touch are
 * toggleStatusEffect and rollSkill, plus the skills they read their dataset from.
 */
function makeActor({ name = 'Duke', statuses = new Set() } = {}) {
  const actor = {
    name,
    statuses,
    toggleStatusEffect: jest.fn(async (id, { active } = {}) => {
      if (active) {
        statuses.add(id);
      } else {
        statuses.delete(id);
      }
    }),
    rollSkill: jest.fn(async () => {}),
    system: {
      skills: {
        alertness: { shift: 'd6', shiftUp: 0, shiftDown: 0, isSpecialized: false, canCritD2: false },
        infiltration: { shift: 'd8', shiftUp: 1, shiftDown: 0, isSpecialized: true, canCritD2: false },
      },
    },
  };

  return actor;
}

let ledger;

beforeEach(() => {
  ledger = { aimed: false };
  global.game = {
    i18n: { localize: jest.fn(k => k), format: jest.fn(k => k) },
    settings: { get: jest.fn(() => 'track') },
    combat: {
      combatants: {
        find: () => ({
          isOwner: true,
          getFlag: () => ledger,
          setFlag: jest.fn(async (scope, key, value) => {
            ledger = value;
          }),
        }),
      },
    },
    user: { isGM: true },
  };
});

describe('Defend', () => {
  // GI Joe CRB p.196: "all attacks against you from adversaries and effects you can see suffer a
  // Snag on their Attack Skill Test."
  test('applies the Defending Condition', async () => {
    const actor = makeActor();

    await runNamedAction(actor, 'defend');

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith(DEFENDING_STATUS, { active: true });
    expect(actor.statuses.has(DEFENDING_STATUS)).toBe(true);
  });

  test('announces it, so the table knows the Snag is live', async () => {
    const outcome = await runNamedAction(makeActor(), 'defend');

    expect(outcome.message).toBeTruthy();
  });

  // The Condition has to be a real CONFIG.statusEffects entry or toggleStatusEffect silently does
  // nothing and the attacker's roll never sees it.
  test('the Condition is registered', () => {
    expect(E20.statusEffects.map(s => s.id)).toContain(DEFENDING_STATUS);
  });
});

describe('the skill-test actions', () => {
  // "As your Standard action, you make a Infiltration Skill Test." (p.196)
  test('Hide rolls Infiltration, with the actor own shifts', async () => {
    const actor = makeActor();

    await runNamedAction(actor, 'hide');

    expect(actor.rollSkill).toHaveBeenCalledWith(expect.objectContaining({
      rollType: 'skill',
      skill: 'infiltration',
      essence: 'speed',
      shift: 'd8',
      shiftUp: 1,
      isSpecialized: true,
    }));
  });

  // "Make an Alertness Skill Test." (p.197)
  test('Search the Area rolls Alertness', async () => {
    const actor = makeActor();

    await runNamedAction(actor, 'searchTheArea');

    expect(actor.rollSkill).toHaveBeenCalledWith(expect.objectContaining({
      skill: 'alertness',
      essence: 'smarts',
      shift: 'd6',
    }));
  });

  // Reading the fields off the actor rather than restating them is what keeps these rolls
  // identical to a hand-clicked one as the skill schema grows.
  test('a skill the actor does not have is a no-op rather than a broken roll', async () => {
    const actor = makeActor();
    delete actor.system.skills.alertness;

    await expect(runNamedAction(actor, 'searchTheArea')).resolves.toBeTruthy();
    expect(actor.rollSkill).not.toHaveBeenCalled();
  });
});

describe('Lend Assistance', () => {
  // Technorganic Secrets p.47: Invisibility ends "until you take the... Lend Assistance...
  // action" - the real actor.getFlag/setFlag/toggleStatusEffect surface invisibility.mjs needs,
  // layered onto the plain makeActor() above.
  function makeInvisibleActor() {
    const actor = makeActor();
    const flags = { invisibilityActive: true };
    actor.getFlag = jest.fn((scope, key) => flags[key]);
    actor.setFlag = jest.fn(async (scope, key, value) => {
      flags[key] = value;
    });
    return actor;
  }

  test('does NOT clear Invisibility when the action is cancelled (no allies to help)', async () => {
    // No allies nearby (makeActor() has no getActiveTokens/token) - activateLendAssistance itself
    // reports {cancelled: true} without banking anything, and the action is refunded, so
    // Invisibility must NOT clear.
    const actor = makeInvisibleActor();

    await runNamedAction(actor, 'lendAssistance');

    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'invisibilityActive', false);
    expect(actor.toggleStatusEffect).not.toHaveBeenCalledWith('invisible', { active: false });
  });
});

describe('which actions are wired up', () => {
  test('the automated ones report themselves', () => {
    expect(isAutomated('defend')).toBe(true);
    expect(isAutomated('aim')).toBe(true);
    expect(isAutomated('hide')).toBe(true);
    expect(isAutomated('searchTheArea')).toBe(true);
    expect(isAutomated('sprint')).toBe(true);
    expect(isAutomated('lendAssistance')).toBe(true);
  });

  test('the cost-only ones do not', () => {
    for (const key of UNAUTOMATED_ACTIONS) {
      expect(isAutomated(key)).toBe(false);
    }
  });

  /* The split has to be exhaustive. An action in neither list is one nobody decided about - which
     is exactly the state this module exists to make impossible, since a player reading the tab
     cannot tell "not automated" from "forgotten". */
  test('every named action is either automated or listed as deliberately not', () => {
    for (const key of Object.keys(E20.namedActions)) {
      expect(isAutomated(key) || UNAUTOMATED_ACTIONS.includes(key)).toBe(true);
    }
  });

  test('nothing claims to be both', () => {
    for (const key of UNAUTOMATED_ACTIONS) {
      expect(Object.keys(E20.namedActions)).toContain(key);
    }
  });

  test('an unknown action does nothing at all', async () => {
    await expect(runNamedAction(makeActor(), 'notAnAction')).resolves.toBeNull();
  });
});
