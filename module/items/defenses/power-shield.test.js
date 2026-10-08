import { jest } from '@jest/globals';
import { dismissShields, giveShield, SHIELD_FLAG, shieldEffectData, shieldsOf } from './power-shield.mjs';
import { isPowerShieldHandoff } from '../../mechanics/world/gm-relay.mjs';

/** Power Shield (PR CRB p.100): +2 armor to the wielder's Toughness, handed on, gone when the summoner un-Morphs. */

const summoner = { uuid: 'Actor.ranger', name: 'Red' };

function actor(uuid, effects = [], owner = true) {
  const a = {
    uuid, name: uuid, isOwner: owner, effects,
    createEmbeddedDocuments: jest.fn(async (type, list) => {
      a.effects.push(...list.map((data, i) => ({ ...data, id: `new${i}`, toObject: () => ({ ...data }) })));
    }),
    deleteEmbeddedDocuments: jest.fn(async (type, ids) => {
      a.effects = a.effects.filter(effect => !ids.includes(effect.id));
    }),
  };
  return a;
}

const shieldOn = (holder, from = summoner) => {
  const data = shieldEffectData(from);
  holder.effects.push({ ...data, id: 's1', toObject: () => ({ ...data, _id: 's1' }) });
};

test('+2 armor to Toughness whether the wielder is Morphed or not, stamped with its summoner', () => {
  const data = shieldEffectData(summoner);
  expect(data.changes.map(change => [change.key, change.value])).toEqual([
    ['system.defenses.toughness.armor', '2'], ['system.defenses.toughness.morphed', '2'],
  ]);
  expect(data.flags.essence20[SHIELD_FLAG]).toEqual({ summoner: 'Actor.ranger', summonerName: 'Red' });
});

test('finds its summoner\'s shields wherever they are, and dismisses them', async () => {
  const holder = actor('Actor.ally');
  const other = actor('Actor.other');
  shieldOn(holder);
  shieldOn(other, { uuid: 'Actor.blue', name: 'Blue' });
  expect(shieldsOf('Actor.ranger', [holder, other]).map(entry => entry.actor)).toEqual([holder]);

  global.game.actors = [holder, other];
  global.canvas = { scene: { tokens: [] } };
  await dismissShields('Actor.ranger');
  expect(holder.effects).toEqual([]);
  expect(other.effects).toHaveLength(1);
});

test('handing it on moves the effect to the recipient and posts a new card', async () => {
  const holder = actor('Actor.ranger');
  const ally = actor('Actor.ally');
  shieldOn(holder);
  global.game.actors = [holder, ally];
  global.canvas = { scene: { tokens: [] } };
  global.fromUuid = jest.fn(async () => summoner);
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  expect(await giveShield('Actor.ranger', ally)).toBe(true);
  expect(holder.effects).toEqual([]);
  expect(ally.effects[0].flags.essence20[SHIELD_FLAG].summoner).toBe('Actor.ranger');
  expect(global.ChatMessage.create).toHaveBeenCalled();
});

describe('the GM relay lets a shield change hands, and nothing else', () => {
  const user = { id: 'u1' };
  const ranger = { testUserPermission: (u, level) => u === user && level == 'OWNER' };

  test('creating or deleting a shield its player summoned (or holds) is allowed', () => {
    global.fromUuidSync = jest.fn(uuid => (uuid == 'Actor.ranger' ? ranger : null));
    global.game.actors = [];
    const ally = { documentName: 'Actor', effects: { get: () => ({ flags: { essence20: { powerShield: { summoner: 'Actor.ranger' } } } }) } };
    expect(isPowerShieldHandoff(ally, 'createEmbeddedDocuments', ['ActiveEffect', [shieldEffectData(summoner)]], user)).toBe(true);
    expect(isPowerShieldHandoff(ally, 'deleteEmbeddedDocuments', ['ActiveEffect', ['s1']], user)).toBe(true);
  });

  test('any other effect, or someone else\'s shield, is refused', () => {
    global.fromUuidSync = jest.fn(() => null);
    global.game.actors = [];
    const ally = { documentName: 'Actor', effects: { get: () => ({ flags: {} }) } };
    expect(isPowerShieldHandoff(ally, 'createEmbeddedDocuments', ['ActiveEffect', [{ name: 'Free +10', flags: {} }]], user)).toBe(false);
    expect(isPowerShieldHandoff(ally, 'createEmbeddedDocuments', ['ActiveEffect', [shieldEffectData(summoner)]], user)).toBe(false);
    expect(isPowerShieldHandoff(ally, 'deleteEmbeddedDocuments', ['ActiveEffect', ['x']], user)).toBe(false);
    expect(isPowerShieldHandoff(ally, 'update', [{}], user)).toBe(false);
  });
});
