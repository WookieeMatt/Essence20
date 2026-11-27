import { jest } from '@jest/globals';
import {
  baubleAttacks, baubleCost, baubleDataFromSpell, baubleForm, baubleRolls, craftMagicBauble, craftTerms, pendingCraft,
  slowRecovery, spellcastingOnRest, stepDown, useMagicBauble,
} from './magic-baubles.mjs';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import '../../rules/plugins/index.mjs';
import { validateRule } from '../../rules/types.mjs';

function actorWith({ shift = 'd8', shiftDown = 0, flags = {}, rollSuccess = true } = {}) {
  const actor = {
    name: 'Twilight', flags,
    system: { skills: { spellcasting: { shift, shiftDown, shiftUp: 0, isSpecialized: false } } },
    items: { contents: [], get: () => null },
    _dice: { rollSkill: jest.fn(async () => ({ success: rollSuccess, outcomes: [{ results: [{ multiplier: 1, total: 15 }] }] })) },
    update: jest.fn(async update => {
      for (const [path, value] of Object.entries(update)) {
        const parts = path.split('.');
        let at = actor;
        for (const part of parts.slice(0, -1)) {
          at[part] ??= {};
          at = at[part];
        }

        at[parts.at(-1)] = value;
      }
    }),
    createEmbeddedDocuments: jest.fn(async (type, data) => data.map(d => ({ ...d, id: 'new' }))),
  };
  return actor;
}

const spell = (system = {}) => ({ id: 's1', uuid: 'Actor.a.Item.s1', name: 'Mind Beam', img: 'beam.svg', type: 'spell', system: { tier: 'superior', cost: 3, range: '60ft', defenseType: 'willpower', damageValue: 0, ...system } });

describe('Magic Bauble forms (MLP CRB p.141)', () => {
  test('a scroll rolls; a potion never; a talisman only for an attack', () => {
    expect(baubleForm({ system: {} })).toBe('scroll');
    expect(baubleRolls({ system: { form: 'scroll' } })).toBe(true);
    expect(baubleRolls({ system: { form: 'potion', defenseType: 'toughness' } })).toBe(false);
    expect(baubleRolls({ system: { form: 'talisman' } })).toBe(false);
    expect(baubleRolls({ system: { form: 'talisman', defenseType: 'toughness' } })).toBe(true);
    expect(baubleAttacks({ system: { defenseType: null } })).toBe(false);
  });

  test('only a talisman costs its user the spell\'s downshift', () => {
    expect(baubleCost({ system: { form: 'talisman', castingCost: 3 } })).toBe(3);
    expect(baubleCost({ system: { form: 'potion', castingCost: 3 } })).toBe(0);
    expect(baubleCost({ system: { form: 'scroll', castingCost: 3 } })).toBe(0);
  });

  test('a potion is used with no test: a chat card, used up by the caller', async () => {
    const actor = actorWith();
    const rollWith = jest.fn();
    ChatMessage.create.mockClear();
    const result = await useMagicBauble({ actor, name: 'Salve', system: { form: 'potion', description: '' } }, {}, rollWith);
    expect(result).toEqual({ cancelled: false });
    expect(rollWith).not.toHaveBeenCalled();
    expect(ChatMessage.create).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test('a talisman downshifts its user by the spell\'s cost', async () => {
    const actor = actorWith({ shiftDown: 1 });
    await useMagicBauble({ actor, name: 'Watch', system: { form: 'talisman', castingCost: 3 } }, {}, jest.fn());
    expect(actor.system.skills.spellcasting.shiftDown).toBe(4);
  });

  test('a scroll rolls at the better rank; backing out uses nothing', async () => {
    const actor = actorWith({ shift: 'd4', shiftDown: 1 });
    const rollWith = jest.fn(async () => ({ success: true }));
    await useMagicBauble({ actor, name: 'Scroll', system: { form: 'scroll', spellcastingShift: 'd8' } }, { rollType: 'magicBauble' }, rollWith);
    expect(rollWith).toHaveBeenCalledWith(expect.objectContaining({ skill: 'spellcasting', shift: 'd8', shiftDown: 1 }));
    const cancelled = await useMagicBauble({ actor, name: 'Scroll', system: { form: 'scroll', spellcastingShift: 'd2' } }, {}, async () => ({ cancelled: true }));
    expect(cancelled).toEqual({ cancelled: true });
  });
});

describe('making a Magic Bauble (MLP CRB p.141-142)', () => {
  test('the test and the hours go by the spell\'s tier', () => {
    expect(craftTerms({ system: { tier: 'elementary' } })).toEqual({ tier: 'elementary', dif: 12, hours: 6 });
    expect(craftTerms({ system: { tier: 'superior' } })).toMatchObject({ dif: 16, hours: 12 });
    expect(craftTerms({ system: { tier: 'virtuoso' } })).toMatchObject({ dif: 20, hours: 24 });
  });

  test('the rank is the caster\'s after paying, never below d20', () => {
    expect(stepDown('d8', 2)).toBe('d4');
    expect(stepDown('d4', 5)).toBe('d20');
    expect(stepDown('d8', 0)).toBe('d8');
    expect(stepDown('odd', 1)).toBe('odd');
  });

  test('the bauble carries the spell; a potion drops the attack, a talisman keeps the cost', () => {
    const talisman = baubleDataFromSpell(spell(), { form: 'talisman', rank: 'd4' });
    expect(talisman).toMatchObject({ type: 'magicBauble', system: { form: 'talisman', castingCost: 3, spellcastingShift: 'd4', range: '60ft', defenseType: 'willpower', quantity: 1 } });
    const potion = baubleDataFromSpell(spell(), { form: 'potion', rank: 'd4', name: 'Tonic' });
    expect(potion.name).toBe('Tonic');
    expect(potion.system).toMatchObject({ defenseType: null, castingCost: 0 });
  });

  function answer(value) {
    foundry.applications = { api: { DialogV2: { wait: jest.fn(async () => value) } } };
  }

  test('a success pays the cost, slows recovery and makes the bauble', async () => {
    const actor = actorWith({ shift: 'd8' });
    answer({ action: 'craft', form: 'scroll', name: '' });
    const made = await craftMagicBauble(actor, spell());
    expect(made).toMatchObject({ type: 'magicBauble', system: { spellcastingShift: 'd2', form: 'scroll' } });
    expect(actor.system.skills.spellcasting.shiftDown).toBe(3);
    expect(slowRecovery(actor)).toBe(true);
    expect(pendingCraft(actor)).toBe(null);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'spellcasting', dif: '16', shiftDown: 3 }), actor);
  });

  test('a failure keeps the attempt; trying again costs nothing more; giving up drops it', async () => {
    const actor = actorWith({ shift: 'd8', rollSuccess: false });
    answer({ action: 'craft', form: 'potion', name: 'Tonic' });
    expect(await craftMagicBauble(actor, spell())).toBe(null);
    expect(pendingCraft(actor)).toMatchObject({ spellId: 's1', form: 'potion', rank: 'd2' });
    expect(actor.system.skills.spellcasting.shiftDown).toBe(3);

    actor._dice.rollSkill.mockResolvedValueOnce({ success: true, outcomes: [] });
    const made = await craftMagicBauble(actor, spell());
    expect(made.system).toMatchObject({ form: 'potion', spellcastingShift: 'd2' });
    expect(actor.system.skills.spellcasting.shiftDown).toBe(3);

    answer({ action: 'craft', form: 'scroll', name: '' });
    await craftMagicBauble(actor, spell());
    answer({ action: 'giveUp' });
    await craftMagicBauble(actor, spell());
    expect(pendingCraft(actor)).toBe(null);
    answer(null);
    expect(await craftMagicBauble(actor, spell())).toBe(null);
    expect(await craftMagicBauble(actor, { type: 'perk' })).toBe(null);
  });

  test('a full rest restores Spellcasting and ends the slow recovery', async () => {
    const actor = actorWith({ shiftDown: 2, flags: { essence20: { baubleCraft: { slowRecovery: true } } } });
    await spellcastingOnRest(actor);
    expect(actor.system.skills.spellcasting.shiftDown).toBe(0);
    expect(slowRecovery(actor)).toBe(false);
    const fresh = actorWith();
    await spellcastingOnRest(fresh);
    expect(fresh.update).not.toHaveBeenCalled();
  });
});

describe('compendium baubles', () => {
  const root = join(process.cwd(), 'packs');
  const baubles = [];
  for (const pack of readdirSync(root)) {
    let files = [];
    try {
      files = readdirSync(join(root, pack, '_source'));
    } catch {
      continue;
    }

    for (const file of files.filter(f => f.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(root, pack, '_source', file), 'utf8'));
      if (doc.type == 'magicBauble') {
        baubles.push(doc);
      }
    }
  }

  test('every one has a form, and its rules validate', () => {
    expect(baubles.length).toBeGreaterThanOrEqual(13);
    for (const doc of baubles) {
      expect(['scroll', 'potion', 'talisman']).toContain(doc.system.form);
      for (const rule of doc.system.rules ?? []) {
        expect(validateRule(rule)).toEqual([]);
      }
    }
  });

  test('a potion\'s effect runs on use, not on a roll it doesn\'t make', () => {
    for (const doc of baubles.filter(d => d.system.form == 'potion')) {
      for (const rule of doc.system.rules ?? []) {
        expect(rule.event).not.toBe('afterRoll');
      }
    }
  });
});
