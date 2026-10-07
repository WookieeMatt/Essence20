import { jest } from '@jest/globals';
import {
  focusSkillOptions, increaseLevels, missingFocusPickLevels, removeFocusSkillPicks, specializationRule, storedPicks, syncFocusSkillPicks,
} from './focus-skills.mjs';

/**
 * A Focus's Essence increase brings a Skill rank (mechanics/characters/focus-skills.mjs, user decision 2026-10-07).
 */

const SKILL_TO_ESSENCE = { athletics: 'strength', might: 'strength', intimidation: 'strength', finesse: 'speed', targeting: 'speed', alertness: 'smarts', science: 'smarts' };

/** An actor whose update() writes dotted paths into its own data, the way a real update would. */
function makeActor(system) {
  const actor = { system: { isLocked: false, focusEssence: 'smarts', level: 1, ...system } };
  actor.update = jest.fn(async data => {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.split('.');
      const last = keys.pop();
      let node = actor;
      for (const key of keys) {
        node = node[key] ??= {};
      }

      if (value?.constructor?.name == 'ForcedDeletion') {
        delete node[last];
      } else {
        node[last] = value;
      }
    }
  });
  return actor;
}

/** A Focus held by the actor, from `pack`. */
function makeFocus({ name = 'Artillery', pack = 'gi_joe_crb', skills = ['alertness', 'science'], essences = ['smarts'] } = {}) {
  const focus = {
    name, flags: {}, _stats: { compendiumSource: `Compendium.essence20.${pack}.Item.abc` },
    system: { skills, essences, essenceLevels: ['level1', 'level10'] },
  };
  focus.update = jest.fn(async data => {
    for (const [path, value] of Object.entries(data)) {
      const [, , flag, level] = path.split('.');
      focus.flags.essence20 ??= {};
      focus.flags.essence20[flag] ??= {};
      if (value?.constructor?.name == 'ForcedDeletion') {
        delete focus.flags.essence20[flag][level];
      } else {
        focus.flags.essence20[flag][level] = value;
      }
    }
  });
  return focus;
}

describe('which Skills an increase may go into', () => {
  test("a single-Essence Focus keeps its whole list (Presence counts Intimidation as Social)", () => {
    const focus = makeFocus({ skills: ['intimidation', 'science'], essences: ['social'] });
    expect(focusSkillOptions(focus, 'social', SKILL_TO_ESSENCE)).toEqual(['intimidation', 'science']);
  });

  test('a multi-Essence Focus offers the chosen Essence\'s listed Skills (Armiger)', () => {
    const focus = makeFocus({ skills: ['athletics', 'might', 'finesse', 'targeting'], essences: ['strength', 'speed'] });
    expect(focusSkillOptions(focus, 'speed', SKILL_TO_ESSENCE)).toEqual(['finesse', 'targeting']);
    expect(focusSkillOptions(focus, 'strength', SKILL_TO_ESSENCE)).toEqual(['athletics', 'might']);
  });

  test('a Focus listing no Skills offers every Skill of the Essence (Cyber Engineer, Mimic)', () => {
    const focus = makeFocus({ skills: [], essences: ['strength', 'speed', 'smarts', 'social'] });
    expect(focusSkillOptions(focus, 'smarts', SKILL_TO_ESSENCE)).toEqual(['alertness', 'science']);
  });
});

describe('Specializations', () => {
  test('every book but the G.I. JOE Core Rulebook: "Train or specialize"', () => {
    expect(specializationRule(makeFocus({ pack: 'tf_crb' }))).toEqual({ allowed: true, name: null });
    expect(specializationRule(makeFocus({ pack: 'cobra_codex', name: 'Rigger' }))).toEqual({ allowed: true, name: null });
  });

  test('G.I. JOE Core Rulebook: only Alert, Ordnance Expert, Mechanized Infantry and Medic allow one', () => {
    expect(specializationRule(makeFocus({ name: 'Artillery' }))).toEqual({ allowed: false, name: null });
    expect(specializationRule(makeFocus({ name: 'Heavy Ordnance' }))).toEqual({ allowed: true, name: 'Heavy Weapons' });
    expect(specializationRule(makeFocus({ name: 'Medic' }))).toEqual({ allowed: true, name: 'Medicine' });
    expect(specializationRule(makeFocus({ name: 'Bodyguard' }))).toEqual({ allowed: true, name: null });
  });
});

test('increase levels between two levels', () => {
  const focus = makeFocus();
  expect(increaseLevels(focus, 0, 1)).toEqual([1]);
  expect(increaseLevels(focus, 0, 12)).toEqual([1, 10]);
  expect(increaseLevels(focus, 9, 10)).toEqual([10]);
  expect(increaseLevels(focus, 1, 9)).toEqual([]);
});

describe('placing and taking back', () => {
  beforeEach(() => {
    global.ui.notifications.info = jest.fn();
  });

  test('the drop asks for each increase reached and trains the pick one step', async () => {
    const actor = makeActor({ level: 10, skills: { science: { shift: 'd4' }, alertness: { shift: 'd20' } } });
    const focus = makeFocus();
    const ask = jest.fn(async () => ({ kind: 'train', skill: 'science' }));
    await syncFocusSkillPicks(actor, focus, 10, 0, { ask });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(actor.system.skills.science.shift).toBe('d8');
    expect(Object.keys(storedPicks(focus)).sort()).toEqual(['level1', 'level10']);
  });

  test('levelling down past 10th takes that rank back off; deleting the Focus takes the rest', async () => {
    const actor = makeActor({ level: 10, skills: { science: { shift: 'd4' } } });
    const focus = makeFocus();
    await syncFocusSkillPicks(actor, focus, 10, 0, { ask: async () => ({ kind: 'train', skill: 'science' }) });
    await syncFocusSkillPicks(actor, focus, 9, 10, { ask: jest.fn() });
    expect(actor.system.skills.science.shift).toBe('d6');
    expect(Object.keys(storedPicks(focus))).toEqual(['level1']);
    await removeFocusSkillPicks(actor, focus);
    expect(actor.system.skills.science.shift).toBe('d4');
  });

  test('a Specialization pick adds one, and taking it back removes exactly that one', async () => {
    const actor = makeActor({ skills: { targeting: { shift: 'd6', specializations: {} } } });
    const focus = makeFocus({ name: 'Heavy Ordnance', skills: ['targeting'], essences: ['speed'] });
    actor.system.focusEssence = 'speed';
    await syncFocusSkillPicks(actor, focus, 1, 0, { ask: async () => ({ kind: 'specialize', skill: 'targeting', name: 'Heavy Weapons' }) });
    const [key] = Object.keys(actor.system.skills.targeting.specializations);
    expect(actor.system.skills.targeting.specializations[key].name).toBe('Heavy Weapons');
    expect(storedPicks(focus).level1).toEqual(expect.objectContaining({ kind: 'specialize', key }));
    await removeFocusSkillPicks(actor, focus);
    expect(actor.system.skills.targeting.specializations[key]).toBeUndefined();
  });

  test('a cancelled pick places nothing and says to use the Skill Picker; a level already picked is not asked again', async () => {
    const actor = makeActor({ skills: { science: { shift: 'd4' } } });
    const focus = makeFocus();
    await syncFocusSkillPicks(actor, focus, 1, 0, { ask: async () => null });
    expect(actor.update).not.toHaveBeenCalled();
    expect(global.ui.notifications.info).toHaveBeenCalled();

    await syncFocusSkillPicks(actor, focus, 1, 0, { ask: async () => ({ kind: 'train', skill: 'science' }) });
    const ask = jest.fn();
    await syncFocusSkillPicks(actor, focus, 1, 0, { ask });
    expect(ask).not.toHaveBeenCalled();
  });

  test('no Essence increase (no focusEssence): nothing asked', async () => {
    const actor = makeActor({ focusEssence: null });
    const ask = jest.fn();
    await syncFocusSkillPicks(actor, makeFocus(), 1, 0, { ask });
    expect(ask).not.toHaveBeenCalled();
  });
});

describe("characters made before the prompt existed", () => {
  test("the Focus row lists the increases reached with nothing recorded", async () => {
    const actor = makeActor({ level: 12, skills: { science: { shift: 'd4' } } });
    const focus = makeFocus();
    expect(missingFocusPickLevels(actor, focus)).toEqual([1, 10]);
    await syncFocusSkillPicks(actor, focus, 12, 0, { ask: async (a, f, level) => (level == 1 ? { kind: 'train', skill: 'science' } : null) });
    expect(missingFocusPickLevels(actor, focus)).toEqual([10]);
    expect(missingFocusPickLevels({ system: { focusEssence: null, level: 12 } }, focus)).toEqual([]);
  });

  test("Already placed by hand: recorded, Skills untouched, and deleting the Focus leaves that rank alone", async () => {
    const actor = makeActor({ skills: { science: { shift: 'd6' } } });
    const focus = makeFocus();
    await syncFocusSkillPicks(actor, focus, 1, 0, { ask: async () => ({ kind: 'manual' }) });
    expect(actor.update).not.toHaveBeenCalled();
    expect(storedPicks(focus).level1).toEqual({ kind: 'manual' });
    expect(missingFocusPickLevels(actor, focus)).toEqual([]);
    await removeFocusSkillPicks(actor, focus);
    expect(actor.system.skills.science.shift).toBe('d6');
  });
});
