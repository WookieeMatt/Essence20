import { jest } from '@jest/globals';
import {
  activateLendAssistance, canAssistWithSkill, getAssistEdge, getAssistShiftUp, LEND_ASSISTANCE_EDGE_FLAG,
  LEND_ASSISTANCE_RANGE_FEET, LEND_ASSISTANCE_SHIFT_FLAG, lendAssistanceSkill,
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

  test('refuses outright for an actor blocked by Fun Exhaustion', async () => {
    const me = makeActor({ id: 'me' });
    const ally = makeActor({ id: 'ally', x: 10 });
    setWorld({ tokens: [me.token, ally.token] });
    await me.actor.setFlag('essence20', 'funExhaustionBlocked', { epoch: 1 });

    const outcome = await activateLendAssistance(me.actor);

    expect(outcome).toEqual({ cancelled: true });
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  test('excludes an ally blocked by Fun Exhaustion from the candidate list', async () => {
    const me = makeActor({ id: 'me' });
    const blockedAlly = makeActor({ id: 'blocked', name: 'Pinkie', x: 10 });
    const okAlly = makeActor({ id: 'ok', name: 'Rarity', x: 10 });
    setWorld({ tokens: [me.token, blockedAlly.token, okAlly.token] });
    await blockedAlly.actor.setFlag('essence20', 'funExhaustionBlocked', { epoch: 1 });
    dialogResult = { allyId: 'ok', mode: 'skill', skill: 'might' };

    await activateLendAssistance(me.actor);

    const content = global.foundry.applications.api.DialogV2.wait.mock.calls[0][0].content;
    expect(content).toContain('Rarity');
    expect(content).not.toContain('Pinkie');
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

  test('One Pony Show lets the actor pick themselves as the ally, even with nobody else nearby', async () => {
    const ONE_PONY_SHOW_ID = "Compendium.essence20.mlp_crb.Item.8Idk7YjylEf8c43U";
    const me = withItems(makeActor({ id: 'me', shift: 'd10' }), perk(ONE_PONY_SHOW_ID));
    setWorld({ tokens: [me.token] });
    dialogResult = { allyId: 'me', mode: 'skill', skill: 'might' };

    const result = await activateLendAssistance(me.actor);

    expect(result.cancelled).toBeUndefined();
    expect(me.actor.getFlag('essence20', LEND_ASSISTANCE_SHIFT_FLAG))
      .toEqual(expect.objectContaining({ skill: 'might', shiftUp: 1 }));
  });

  test('refuses outright for a Treacherous actor, before even checking for allies', async () => {
    const me = withItems(makeActor({ id: 'me' }), hangUp("Compendium.essence20.tf_crb.Item.KwvsyHeuUqRbto9u"));
    const ally = makeActor({ id: 'ally', x: 10 });
    setWorld({ tokens: [me.token, ally.token] });
    dialogResult = { allyId: 'ally', mode: 'skill', skill: 'might' };

    const outcome = await activateLendAssistance(me.actor);

    expect(outcome).toEqual({ cancelled: true });
    expect(global.ui.notifications.warn).toHaveBeenCalled();
    expect(global.foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
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

/* Perks that change the action - see the ids' own comments in lend-assistance.mjs. Ported from the
   2026-09-15 suite onto this file's fixtures. */
const perk = id => ({ type: 'perk', flags: { core: { sourceId: id } } });
const hangUp = id => ({ type: 'hangUp', flags: { core: { sourceId: id } } });
const withItems = (made, ...items) => {
  made.actor.items = items;
  return made;
};

const PUTTING_OTHERS_ID = "Compendium.essence20.mlp_crb.Item.ZZTzjEEMljWoVJu6";
const BETTER_TOGETHER_JTT_ID = "Compendium.essence20.jump_through_time.Item.8ZGmg1hrNDmbO1B7";
const MANY_MINDS_ID = "Compendium.essence20.dark_skies_over_equestria.Item.D24JO5W03Amwwvzy";
const SHIPS_CREW_ID = "Compendium.essence20.across_the_stars.Item.HPEU2YVjQM6pEZ3i";
const CONNIVING_HANGUP_ID = "Compendium.essence20.cobra_codex.Item.w8yTnTpOIUdFVm8u";
const GREENSHIRT_PERK_ID = "Compendium.essence20.gi_joe_crb.Item.XVu6skoSL0A3Hnve";
const GREENSHIRT_HANGUP_ID = "Compendium.essence20.gi_joe_crb.Item.Exn9xZtJ9qoCNnZ8";
const BUREAUCRAT_TF_ID = "Compendium.essence20.tf_crb.Item.7XR1us1Zm4dKDrwW";
const TEACHER_ID = "Compendium.essence20.pr_crb.Item.kqkyJy7sEjBmmOp3";
const LACKEY_ID = "Compendium.essence20.decepticon_directive.Item.dXZpwsbvn6Jdgpsn";
const SKEPTICAL_HANGUP_ID = "Compendium.essence20.tf_crb.Item.yoyifVDjpnLloHbK";
const TREACHEROUS_HANGUP_ID = "Compendium.essence20.tf_crb.Item.KwvsyHeuUqRbto9u";

describe('canAssistWithSkill', () => {
  beforeEach(() => setWorld());

  test('refuses an ally with the Conniving Hang-Up, whatever the ranks', () => {
    const { actor } = makeActor({ shift: 'd10' });
    const { actor: ally } = withItems(makeActor({ id: 'al', shift: 'd4' }), hangUp(CONNIVING_HANGUP_ID));
    expect(canAssistWithSkill(actor, ally, 'might')).toBe(false);
  });

  test('refuses an ally with the Skeptical Hang-Up, whatever the ranks', () => {
    const { actor } = makeActor({ shift: 'd10' });
    const { actor: ally } = withItems(makeActor({ id: 'al', shift: 'd4' }), hangUp(SKEPTICAL_HANGUP_ID));
    expect(canAssistWithSkill(actor, ally, 'might')).toBe(false);
  });

  test('refuses an ally with the Show Off Hang-Up, whatever the ranks', () => {
    const SHOW_OFF_HANGUP_ID = "Compendium.essence20.wtnv_citizens_guide.Item.R7DMglLJxy9d9und";
    const { actor } = makeActor({ shift: 'd10' });
    const { actor: ally } = withItems(makeActor({ id: 'al', shift: 'd4' }), hangUp(SHOW_OFF_HANGUP_ID));
    expect(canAssistWithSkill(actor, ally, 'might')).toBe(false);
  });

  test('Acrobatic Outlook refuses the ASSISTER on Speed based Skill Tests only', () => {
    const ACROBATIC_OUTLOOK_HANGUP_ID = "Compendium.essence20.mlp_crb.Item.rLku8lFIvdPxDC2D";
    // High enough ranks in both to pass the base rank gate on its own - isolates the Hang-Up.
    const { actor } = withItems(makeActor({ shift: 'd12', targeting: 'targeting' }), hangUp(ACROBATIC_OUTLOOK_HANGUP_ID));
    actor.system.skills.might = { shift: 'd12', isSpecialized: false };
    const { actor: ally } = makeActor({ id: 'al', shift: 'd4', targeting: 'targeting' });
    ally.system.skills.might = { shift: 'd4', isSpecialized: false };

    expect(canAssistWithSkill(actor, ally, 'targeting')).toBe(false); // Speed-essence skill
    expect(canAssistWithSkill(actor, ally, 'might')).toBe(true); // Strength-essence skill, unaffected
  });

  test('the Greenshirt Hang-Up refuses ordinary Joes but not a fellow Greenshirt', () => {
    const { actor: ally } = withItems(makeActor({ id: 'al', shift: 'd4' }), hangUp(GREENSHIRT_HANGUP_ID));
    expect(canAssistWithSkill(makeActor({ shift: 'd10' }).actor, ally, 'might')).toBe(false);

    const { actor: greenshirt } = withItems(makeActor({ shift: 'd10' }), perk(GREENSHIRT_PERK_ID));
    expect(canAssistWithSkill(greenshirt, ally, 'might')).toBe(true);
  });

  test('Many Minds Make Light Work lifts the rank gate when trained in Persuasion and the skill', () => {
    const made = withItems(makeActor({ shift: 'd4' }), perk(MANY_MINDS_ID));
    const { actor: ally } = makeActor({ id: 'al', shift: 'd10' });
    expect(canAssistWithSkill(made.actor, ally, 'might')).toBe(false);

    made.actor.system.skills.persuasion = { shift: 'd6' };
    expect(canAssistWithSkill(made.actor, ally, 'might')).toBe(true);
  });

  test("Voice of Primus's banked Persuasion success lifts the rank gate on any skill", () => {
    const { actor } = makeActor({ shift: 'd20', targeting: 'might' });
    const { actor: ally } = makeActor({ id: 'al', shift: 'd10' });
    actor.getFlag = jest.fn(() => ({ combatId: null, round: null }));

    expect(canAssistWithSkill(actor, ally, 'might')).toBe(true);
  });

  test("Walk Them Through It lifts the rank gate on Technology/Science for the ally who holds it, only", () => {
    const WALK_THEM_THROUGH_IT_ID = "Compendium.essence20.tf_crb.Item.7eWiN6w2TIBeSMoi";
    const { actor } = makeActor({ shift: 'd20', targeting: 'might' }); // untrained (0 ranks) in everything else
    const { actor: ally } = withItems(makeActor({ id: 'al', shift: 'd4' }), perk(WALK_THEM_THROUGH_IT_ID));
    ally.system.skills.technology = { shift: 'd6', isSpecialized: false }; // outranks the untrained actor

    expect(canAssistWithSkill(actor, ally, 'technology')).toBe(true);
    // The rank gate still applies on any other skill - the bypass is Technology/Science only.
    expect(canAssistWithSkill(actor, ally, 'might')).toBe(false);
  });

  test("Technological Assistance lifts the rank gate on Driving/Targeting/Technology for the assister who holds it, only", () => {
    const TECHNOLOGICAL_ASSISTANCE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.7b01zSdekhUugIod";
    const { actor } = withItems(makeActor({ shift: 'd20' }), perk(TECHNOLOGICAL_ASSISTANCE_ID)); // untrained in everything
    const { actor: ally } = makeActor({ id: 'al', shift: 'd4' });
    // Give the ally a real outranking rank in each of the 3 skills (an untrained-vs-untrained tie
    // would already pass the ordinary rank gate and not actually exercise the bypass).
    ally.system.skills.targeting = { shift: 'd6', isSpecialized: false };
    ally.system.skills.driving = { shift: 'd6', isSpecialized: false };
    ally.system.skills.technology = { shift: 'd6', isSpecialized: false };

    expect(canAssistWithSkill(actor, ally, 'targeting')).toBe(true);
    expect(canAssistWithSkill(actor, ally, 'driving')).toBe(true);
    expect(canAssistWithSkill(actor, ally, 'technology')).toBe(true);
    // The rank gate still applies on any other skill - the bypass is Driving/Targeting/Technology only.
    expect(canAssistWithSkill(actor, ally, 'might')).toBe(false);

    // Without the Perk, the ordinary rank gate applies even on those 3 skills.
    const { actor: noPerk } = makeActor({ shift: 'd20' });
    expect(canAssistWithSkill(noPerk, ally, 'targeting')).toBe(false);
  });

  test("Ship's Crew lifts the rank gate only while aboard a vehicle", () => {
    const made = withItems(makeActor({ shift: 'd20' }), perk(SHIPS_CREW_ID));
    made.actor.uuid = 'Actor.me';
    const { actor: ally } = makeActor({ id: 'al', shift: 'd12' });

    game.actors = [];
    expect(canAssistWithSkill(made.actor, ally, 'might')).toBe(false);

    game.actors = [{ type: 'vehicle', system: { actors: { c1: { uuid: 'Actor.me' } } } }];
    expect(canAssistWithSkill(made.actor, ally, 'might')).toBe(true);
  });
});

describe('getAssistShiftUp', () => {
  beforeEach(() => setWorld());
  const ally = () => makeActor({ id: 'al', shift: 'd6' }).actor;

  test('1 by default, 2 with Putting Others Before Yourself', () => {
    expect(getAssistShiftUp(makeActor({ shift: 'd10' }).actor, ally(), 'might')).toBe(1);
    const { actor } = withItems(makeActor({ shift: 'd6' }), perk(PUTTING_OTHERS_ID));
    expect(getAssistShiftUp(actor, ally(), 'might')).toBe(2);
  });

  test('Psychological Sway also grants ↑2 instead of the normal ↑1', () => {
    const PSYCHOLOGICAL_SWAY_ID = "Compendium.essence20.enigma_of_combination.Item.whz44n9XJNJQIVVt";
    const { actor } = withItems(makeActor({ shift: 'd6' }), perk(PSYCHOLOGICAL_SWAY_ID));
    expect(getAssistShiftUp(actor, ally(), 'might')).toBe(2);
  });

  test('Armchair General adds an additional ↑1 while in combat, stacking with other bonuses', () => {
    const ARMCHAIR_GENERAL_ID = "Compendium.essence20.field_guide_action_adventure.Item.YPzpjKFz1yrwPHN6";
    const { actor } = withItems(makeActor({ shift: 'd10' }), perk(ARMCHAIR_GENERAL_ID));
    expect(getAssistShiftUp(actor, ally(), 'might')).toBe(2); // 1 base + 1 Armchair General

    game.combat = null;
    expect(getAssistShiftUp(actor, ally(), 'might')).toBe(1); // no bonus outside combat

    game.combat = { id: 'c1', round: 1 };
    const stacked = withItems(makeActor({ shift: 'd6' }), perk(PUTTING_OTHERS_ID), perk(ARMCHAIR_GENERAL_ID)).actor;
    expect(getAssistShiftUp(stacked, ally(), 'might')).toBe(3); // 2 Putting Others + 1 Armchair General
  });

  test('Better Together gives 2, or 3 from 13th level, only when strictly outranking', () => {
    const low = withItems(makeActor({ shift: 'd10' }), perk(BETTER_TOGETHER_JTT_ID)).actor;
    low.system.level = 5;
    expect(getAssistShiftUp(low, ally(), 'might')).toBe(2);

    const high = withItems(makeActor({ shift: 'd10' }), perk(BETTER_TOGETHER_JTT_ID)).actor;
    high.system.level = 13;
    expect(getAssistShiftUp(high, ally(), 'might')).toBe(3);

    const equal = withItems(makeActor({ shift: 'd6' }), perk(BETTER_TOGETHER_JTT_ID)).actor;
    equal.system.level = 13;
    expect(getAssistShiftUp(equal, ally(), 'might')).toBe(1);
  });
});

describe('getAssistEdge', () => {
  test('Bureaucrat always; Teacher only outside combat', () => {
    setWorld();
    expect(getAssistEdge(withItems(makeActor(), perk(BUREAUCRAT_TF_ID)).actor)).toBe(true);
    expect(getAssistEdge(withItems(makeActor(), perk(TEACHER_ID)).actor)).toBe(false);
    game.combat = null;
    expect(getAssistEdge(withItems(makeActor(), perk(TEACHER_ID)).actor)).toBe(true);
    expect(getAssistEdge(makeActor().actor)).toBe(false);
  });
});

describe('the skill half with Perks', () => {
  test("banks the assister's shift size and Edge on the ally", async () => {
    const me = withItems(makeActor({ id: 'me', shift: 'd10' }), perk(BUREAUCRAT_TF_ID), perk(PUTTING_OTHERS_ID));
    const ally = makeActor({ id: 'al', name: 'Scarlett', x: 10, shift: 'd6' });
    setWorld({ tokens: [me.token, ally.token] });
    dialogResult = { allyId: 'al', mode: 'skill', skill: 'might' };

    const result = await activateLendAssistance(me.actor);

    expect(result.cancelled).toBeUndefined();
    expect(ally.actor.getFlag('essence20', LEND_ASSISTANCE_SHIFT_FLAG))
      .toEqual(expect.objectContaining({ skill: 'might', shiftUp: 2, edge: true }));
  });

  test("Voice of Primus's banked Persuasion success lets an unqualified assist through, then clears", async () => {
    const me = makeActor({ id: 'me', shift: 'd20' }); // untrained - would normally be refused
    me.actor.getFlag = jest.fn((scope, key) => (
      key == 'voiceOfPrimusAssistReady' ? { combatId: null, round: null } : undefined
    ));
    const ally = makeActor({ id: 'al', x: 10, shift: 'd10' });
    setWorld({ tokens: [me.token, ally.token] });
    dialogResult = { allyId: 'al', mode: 'skill', skill: 'might' };

    const result = await activateLendAssistance(me.actor);

    expect(result.cancelled).toBeUndefined();
    expect(ally.actor.getFlag('essence20', LEND_ASSISTANCE_SHIFT_FLAG))
      .toEqual(expect.objectContaining({ skill: 'might', shiftUp: 1 }));
    expect(me.actor.unsetFlag).toHaveBeenCalledWith('essence20', 'voiceOfPrimusAssistReady');
  });
});

describe('lendAssistanceSkill', () => {
  test('reaches only as far as the radius it is given', async () => {
    const me = makeActor({ id: 'me', shift: 'd10' });
    const ally = makeActor({ id: 'al', x: 30, shift: 'd6' });
    setWorld({ tokens: [me.token, ally.token] });
    dialogResult = { allyId: 'al', mode: 'skill', skill: 'might' };

    expect(await lendAssistanceSkill(me.actor, { radiusFeet: 15 })).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.LendAssistanceNoAllies');

    expect(await lendAssistanceSkill(me.actor)).toBe(true);
    expect(ally.actor.getFlag('essence20', LEND_ASSISTANCE_SHIFT_FLAG)).toEqual(expect.objectContaining({ shiftUp: 1 }));
  });

  test('refuses outright for a Treacherous actor', async () => {
    const me = withItems(makeActor({ id: 'me', shift: 'd10' }), hangUp(TREACHEROUS_HANGUP_ID));
    const ally = makeActor({ id: 'al', x: 10, shift: 'd6' });
    setWorld({ tokens: [me.token, ally.token] });
    dialogResult = { allyId: 'al', mode: 'skill', skill: 'might' };

    expect(await lendAssistanceSkill(me.actor)).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(ally.actor.setFlag).not.toHaveBeenCalled();
  });

  test('an ally holding Lackey is offered at any distance', async () => {
    const me = makeActor({ id: 'me', shift: 'd10' });
    const ally = withItems(makeActor({ id: 'al', x: 500, shift: 'd6' }), perk(LACKEY_ID));
    setWorld({ tokens: [me.token, ally.token] });
    dialogResult = { allyId: 'al', mode: 'skill', skill: 'might' };

    expect(await lendAssistanceSkill(me.actor, { radiusFeet: 15 })).toBe(true);
  });
});

describe("Those Who Know, Teach (MLP CRB, Mentor Influence, p.53)", () => {
  const THOSE_WHO_KNOW_TEACH_ID = "Compendium.essence20.mlp_crb.Item.Xi0qQqfZQJh0MBTu";

  beforeEach(() => setWorld());

  test("banks a persistent grant (not cleared on consumption) while uses remain", async () => {
    const me = withItems(makeActor({ id: 'me', shift: 'd10' }), perk(THOSE_WHO_KNOW_TEACH_ID));
    const ally = makeActor({ id: 'al', x: 10, shift: 'd6' });
    setWorld({ tokens: [me.token, ally.token] });
    dialogResult = { allyId: 'al', mode: 'skill', skill: 'might' };

    await activateLendAssistance(me.actor);

    expect(ally.actor.getFlag('essence20', LEND_ASSISTANCE_SHIFT_FLAG)).toEqual(
      expect.objectContaining({ shiftUp: 1, persistent: true }),
    );
    expect(me.actor.getFlag('essence20', 'thoseWhoKnowTeachUsedThisScene')).toEqual(
      expect.objectContaining({ count: 1 }),
    );
  });

  test("stops banking persistent grants once the 3/scene cap is used up", async () => {
    const me = withItems(makeActor({ id: 'me', shift: 'd10' }), perk(THOSE_WHO_KNOW_TEACH_ID));
    setWorld();
    me.actor.setFlag('essence20', 'thoseWhoKnowTeachUsedThisScene', { epoch: 1, window: 'scene', count: 3 });
    const ally = makeActor({ id: 'al', x: 10, shift: 'd6' });
    setWorld({ tokens: [me.token, ally.token] });
    me.actor.getFlag = (scope, key) => (
      key == 'thoseWhoKnowTeachUsedThisScene' ? { epoch: 1, window: 'scene', count: 3 } : undefined
    );
    dialogResult = { allyId: 'al', mode: 'skill', skill: 'might' };

    await activateLendAssistance(me.actor);

    expect(ally.actor.getFlag('essence20', LEND_ASSISTANCE_SHIFT_FLAG)).toEqual(
      expect.objectContaining({ shiftUp: 1, persistent: false }),
    );
  });

  test("without the Perk, an ordinary assist is not persistent", async () => {
    const me = makeActor({ id: 'me', shift: 'd10' });
    const ally = makeActor({ id: 'al', x: 10, shift: 'd6' });
    setWorld({ tokens: [me.token, ally.token] });
    dialogResult = { allyId: 'al', mode: 'skill', skill: 'might' };

    await activateLendAssistance(me.actor);

    expect(ally.actor.getFlag('essence20', LEND_ASSISTANCE_SHIFT_FLAG)).toEqual(
      expect.objectContaining({ persistent: false }),
    );
  });
});
