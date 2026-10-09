import { jest } from '@jest/globals';
import {
  absorbBonusHealth, addParticipantBonus, bonusLeft, finishParticipantHealth, pruneBonusHealth, resetParticipantBonuses,
} from './megaform-bonus-health.mjs';
import { canBeParticipant, getMegaformParticipants, isGuestComponent } from './megaform-participants.mjs';
import { splitShares } from './megaform-damage.mjs';

/**
 * Megaform review (2026-10-07): extra Health that really soaks damage, who can join which Megaform, and the Combiner's
 * own damage split.
 */

const part = (name, value, max, extra = {}) => ({ name, uuid: `Actor.${name}`, type: 'zord', system: { health: { value, max } }, ...extra });

function form(subtype = 'megaformZord', flags = {}) {
  const megaform = {
    name: 'Form', type: 'megaform', flags: { essence20: flags },
    system: { subtype: [subtype], actors: {}, health: { bonus: 0 } },
    update: jest.fn(async update => {
      for (const [path, value] of Object.entries(update)) {
        const key = path.split('.').pop();
        megaform.flags.essence20.bonusHealthTaken ??= {};
        megaform.flags.essence20.bonusHealthTaken[key] = value;
      }
    }),
  };
  return megaform;
}

describe('Megaform-only extra Health (Core Body, Layered Systems, Tenacious Bonds, Roller Drum)', () => {
  test('rows are own Health plus the bonus, and damage shows once (not doubled)', () => {
    const megaform = form();
    const core = part('Core', 3, 6);
    const plain = part('Plain', 4, 4);
    resetParticipantBonuses(megaform);
    addParticipantBonus(megaform, core, 6);
    finishParticipantHealth(megaform, [core, plain]);
    expect(megaform.system.participantHealth).toEqual([{ name: 'Core', value: 9, max: 12 }, { name: 'Plain', value: 4, max: 4 }]);
    expect(megaform.system.health).toMatchObject({ max: 16, value: 13 });
  });

  test('damage through the Megaform comes off the bonus first', async () => {
    globalThis.game.user ??= {};
    const megaform = form();
    const core = part('Core', 6, 6);
    addParticipantBonus(megaform, core, 6);
    expect(await absorbBonusHealth(megaform, core, 4)).toBe(4);
    expect(bonusLeft(megaform, core)).toBe(2);
    expect(await absorbBonusHealth(megaform, core, 5)).toBe(2);
    expect(bonusLeft(megaform, core)).toBe(0);
  });

  test('a participant that left keeps no used bonus', () => {
    const megaform = form('megaformZord', { bonusHealthTaken: { Actor_Gone: 3, Actor_Here: 1 } });
    expect(pruneBonusHealth(megaform, [part('Here', 1, 1)])).toEqual({ 'flags.essence20.bonusHealthTaken.Actor_Gone': expect.any(foundry.data.operators.ForcedDeletion) });
    expect(pruneBonusHealth(megaform, [part('Gone', 1, 1), part('Here', 1, 1)])).toBeNull();
  });
});

describe('who can join (Field Guide to Action and Adventure p.134)', () => {
  const zord = { type: 'zord', system: {} };
  const bot = { type: 'playerCharacter', system: { canTransform: true } };
  const human = { type: 'playerCharacter', system: {} };
  const vehicle = { type: 'vehicle', system: { canTransform: true } };

  test('a Megazord takes Zords and Cybertronians, nothing else', () => {
    const megazord = form('megaformZord');
    expect([zord, bot, human, vehicle].map(actor => canBeParticipant(megazord, actor))).toEqual([true, true, false, false]);
    expect(isGuestComponent(megazord, bot)).toBe(true);
    expect(isGuestComponent(megazord, zord)).toBe(false);
  });

  test('a Combiner takes characters, never a Zord', () => {
    const combiner = form('megaformCombiner');
    expect([zord, bot, human, vehicle].map(actor => canBeParticipant(combiner, actor))).toEqual([false, true, true, false]);
  });

  test('a caller that knows the kind wins over the subtype', () => {
    const megaform = form('megaformZord');
    megaform.system.actors = { a: { uuid: 'Z' }, b: { uuid: 'H' } };
    globalThis.fromUuidSync = jest.fn(uuid => (uuid == 'Z' ? zord : human));
    expect(getMegaformParticipants(megaform)).toEqual([zord]);
    expect(getMegaformParticipants(megaform, 'combiner')).toEqual([human]);
  });
});

describe('splitting a hit on the whole form', () => {
  const members = ['A', 'B', 'C', 'D', 'E'].map(name => part(name, 5, 5));

  test('a Megazord: an even split rounded up, at least 1 each (PR CRB p.140)', () => {
    expect(splitShares(form('megaformZord'), members.slice(0, 3), 4).map(([, share]) => share)).toEqual([2, 2, 2]);
  });

  test('a Combiner: the total itself, leftovers to random members, one each first (EoC p.45)', () => {
    const shares = splitShares(form('megaformCombiner'), members, 3, () => 0).map(([, share]) => share);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(3);
    expect(Math.max(...shares)).toBe(1);
    const seven = splitShares(form('megaformCombiner'), members, 7, () => 0.99).map(([, share]) => share);
    expect(seven.reduce((a, b) => a + b, 0)).toBe(7);
    expect(seven.sort()).toEqual([1, 1, 1, 2, 2]);
  });
});

describe('changing a Megaform\'s subtype with people in it', () => {
  test('a mixed Megazord can\'t become a Combiner; a pure-Cybertronian one can', async () => {
    const { subtypeChangeBlockers } = await import('./megaform-participants.mjs');
    const zordActor = { name: 'Tyranno', type: 'zord', system: {} };
    const botActor = { name: 'Ironhide', type: 'playerCharacter', system: { canTransform: true } };
    const humanActor = { name: 'Spike', type: 'playerCharacter', system: {} };
    globalThis.fromUuidSync = jest.fn(uuid => ({ Z: zordActor, B: botActor, H: humanActor })[uuid]);
    const mixed = form('megaformZord');
    mixed.system.actors = { a: { uuid: 'Z' }, b: { uuid: 'B' } };
    expect(subtypeChangeBlockers(mixed, ['megaformCombiner'])).toEqual([zordActor]);
    mixed.system.actors = { b: { uuid: 'B' } };
    expect(subtypeChangeBlockers(mixed, ['megaformCombiner'])).toEqual([]);

    const combiner = form('megaformCombiner');
    combiner.system.actors = { b: { uuid: 'B' }, h: { uuid: 'H' } };
    expect(subtypeChangeBlockers(combiner, ['megaformZord'])).toEqual([humanActor]);
  });
});

test("a new Megaform's type follows the game line: Power Rangers - a Megazord, anything else - a Combiner", async () => {
  const { defaultMegaformSubtype } = await import('../../documents/actor.mjs');
  expect(defaultMegaformSubtype('powerRangers')).toBe('megaformZord');
  expect(['transformers', '', 'giJoe'].map(defaultMegaformSubtype)).toEqual(['megaformCombiner', 'megaformCombiner', 'megaformCombiner']);
});
