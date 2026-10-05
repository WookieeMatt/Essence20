import { jest } from '@jest/globals';
import { Q2 } from './common.mjs';
import {
  activeEvolution, applyMentor, effectiveAvailability, enthusiastBlocks, enthusiastPreRoll, evolutionSpecializes, isHardwareWeapon,
  isQualifiedUpgrade, onRequisitionAvailability, perkAccess, tradeSchoolPreRoll, tradeSchoolSpecializes,
  weaponIsType, WHISPER_WARRIOR_RULE,
} from './qualifications.mjs';
import { canDoOrDie, decorateDoOrDie, doOrDieCost, doOrDieDie, oldHandLevel, rescore, wildIdeaApply, wildIdeaToggles } from './old-hand.mjs';
import {
  detailOrientedLeft, FIELD_OPS_USE, isStunned, opportunistPostRoll, overchargeable, overchargeTurnEnd,
  sensitiveIgnored, sensitiveOnUpdate,
} from './field-ops.mjs';
import { carryGatedUses, isSessionReset, noteGatedUse, startNewSession } from './session.mjs';
import { registrySnapshot } from '../../extensions.mjs';

foundry.utils.flattenObject = (obj, prefix = '') => Object.entries(obj ?? {}).reduce((out, [key, value]) => {
  const path = prefix ? `${prefix}.${key}` : key;
  if (value && typeof value == 'object' && !Array.isArray(value)) {
    Object.assign(out, foundry.utils.flattenObject(value, path));
  } else {
    out[path] = value;
  }

  return out;
}, {});
foundry.utils.escapeHTML = text => text;

let nextId = 0;
function item(type, source, extra = {}) {
  nextId += 1;
  return {
    id: extra.id ?? `i${nextId}`, type, name: extra.name ?? type, uuid: `Item.i${nextId}`,
    flags: { core: { sourceId: source }, essence20: { ...(extra.flags ?? {}) } },
    system: extra.system ?? {},
    setFlag: jest.fn(async function (scope, key, value) {
      this.flags[scope][key] = value;
    }),
    unsetFlag: jest.fn(async function (scope, key) {
      delete this.flags[scope][key];
    }),
  };
}

function makeActor(items = [], extra = {}) {
  const list = [...items];
  const actor = {
    id: extra.id ?? 'a1', uuid: `Actor.${extra.id ?? 'a1'}`, name: extra.name ?? 'Tester', type: extra.type ?? 'playerCharacter',
    flags: { essence20: { ...(extra.flags ?? {}) } },
    system: { skills: {}, level: 1, ...(extra.system ?? {}) },
    statuses: new Set(extra.statuses ?? []),
    effects: extra.effects ?? [],
    items: Object.assign(list, { contents: list, get: id => list.find(i => i.id == id) }),
    getFlag: (scope, key) => actor.flags[scope]?.[key],
    setFlag: jest.fn(async (scope, key, value) => {
      actor.flags[scope] ??= {};
      actor.flags[scope][key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete actor.flags[scope][key];
    }),
    update: jest.fn(async () => {}),
    isOwner: true,
  };
  for (const entry of list) {
    entry.parent = actor;
  }

  return actor;
}

const weapon = (extra = {}) => item('weapon', extra.source ?? null, extra);

beforeEach(() => {
  game.actors = [];
  game.actors.party = null;
  game.user = { id: 'u1', isGM: true, isActiveGM: true, targets: new Set() };
});

describe('requisition access', () => {
  test('Whisper Warrior needs both Martial Arts and Silent', () => {
    const actor = makeActor([item('perk', Q2.whisperWarrior)]);
    expect(perkAccess(actor, weapon({ system: { availability: 'restricted', traits: ['martialArts', 'silent'] } }))).toBe('qualified');
    expect(perkAccess(actor, weapon({ system: { traits: ['silent'] } }))).toBeNull();
  });

  test('Hardware Training: Restricted two-handed ballistic', () => {
    const big = weapon({ system: { availability: 'restricted', traits: ['ballistic'], items: { a: { type: 'weaponEffect', numHands: 2 } } } });
    const small = weapon({ system: { availability: 'restricted', traits: ['ballistic'], items: { a: { type: 'weaponEffect', numHands: 1 } } } });
    expect(isHardwareWeapon(big)).toBe(true);
    expect(isHardwareWeapon(small)).toBe(false);
    expect(perkAccess(makeActor([item('perk', Q2.hardwareTraining)]), big)).toBe('qualified');
  });

  test('Weapon Enthusiast: the chosen Limited type', () => {
    const actor = makeActor([item('perk', Q2.weaponEnthusiast, { flags: { q2WeaponType: 'shotguns' } })]);
    expect(perkAccess(actor, weapon({ name: 'Combat Shotgun', system: { availability: 'limited' } }))).toBe('qualified');
    expect(perkAccess(actor, weapon({ name: 'Rifle', system: { availability: 'limited' } }))).toBeNull();
    expect(weaponIsType(weapon({ system: { traits: ['stun'] } }), 'stun')).toBe(true);
    expect(weaponIsType(weapon({ flags: { q2WeaponType: 'thrown' } }), 'thrown')).toBe(true);
  });

  test('a granted qualified copy is qualified', () => {
    expect(perkAccess(makeActor([]), weapon({ flags: { qualified: true } }))).toBe('qualified');
  });

  test('qualified upgrades drop out of the Availability stacking', () => {
    CONFIG.E20.upgradeAvailabilityMatrix = { standard: { standard: 'standard', restricted: 'restricted' }, restricted: { standard: 'restricted' } };
    const training = item('perk', Q2.upgradeTraining, { flags: { q2Chosen: [{ uuid: 'Compendium.x.Item.up1', name: 'Scope' }] } });
    const actor = makeActor([training]);
    const gun = weapon({ system: { availability: 'standard', totalAvailability: 'restricted', items: { u: { type: 'upgrade', uuid: 'Compendium.x.Item.up1', availability: 'restricted' } } } });
    expect(isQualifiedUpgrade(actor, { uuid: 'Compendium.x.Item.up1' })).toBe(true);
    expect(effectiveAvailability(actor, gun)).toBe('standard');
    const out = { availability: 'restricted' };
    onRequisitionAvailability(actor, gun, out);
    expect(out.availability).toBe('standard');
  });
});

describe('Whisper Warrior Defend', () => {
  test('free only while wielding a Silent Martial Arts weapon', () => {
    const armed = makeActor([item('perk', Q2.whisperWarrior), weapon({ system: { equipped: true, traits: ['martialArts', 'silent'] } })]);
    const bare = makeActor([item('perk', Q2.whisperWarrior)]);
    expect(WHISPER_WARRIOR_RULE.has(armed)).toBe(true);
    expect(WHISPER_WARRIOR_RULE.has(bare)).toBe(false);
    expect(WHISPER_WARRIOR_RULE.matches({ key: 'defend' })).toBe(true);
    expect(WHISPER_WARRIOR_RULE.to()).toBe('free');
  });
});

describe('Training Evolution, Mentor, Trade School, Enthusiast Hang-Up', () => {
  test('Training Evolution specializes the chosen weapon this mission', () => {
    const perk = item('perk', Q2.trainingEvolution, { flags: { q2Evolution: { kind: 'weapon', uuid: 'Compendium.x.Item.gun', name: 'Rifle', mission: 1 } } });
    const gun = weapon({ id: 'g1', source: 'Compendium.x.Item.gun' });
    const effect = item('weaponEffect', null, { flags: { parentId: 'g1' } });
    const actor = makeActor([perk, gun, effect]);
    expect(activeEvolution(actor)).toBeTruthy();
    expect(evolutionSpecializes(actor, 'targeting', effect)).toBe(true);
    perk.flags.essence20.q2Evolution.mission = 0;
    expect(evolutionSpecializes(actor, 'targeting', effect)).toBe(false);
  });

  test('Mentor adds an Essence to a Skill', () => {
    const actor = makeActor([item('perk', Q2.mentor, { flags: { q2Mentor: { skill: 'intimidation', essence: 'social' } } })],
      { system: { skills: { intimidation: { essences: { strength: true, social: false } } } } });
    applyMentor(actor);
    expect(actor.system.skills.intimidation.essences.social).toBe(true);
  });

  test('Trade School lends the coach\'s Technology die for the scene', async () => {
    const coach = makeActor([], { id: 'coach', system: { skills: { technology: { shift: 'd8', isSpecialized: true } } } });
    const ally = makeActor([], { id: 'ally', flags: { pendingTradeSchool: { granterId: 'coach' } } });
    game.actors = [coach, ally];
    const dataset = { skill: 'technology', shift: 'd2' };
    await tradeSchoolPreRoll(ally, dataset);
    expect(dataset.shift).toBe('d8');
    expect(tradeSchoolSpecializes(ally, 'technology')).toBe(true);
    delete ally.flags.essence20.pendingTradeSchool;
    const again = { skill: 'technology', shift: 'd2' };
    await tradeSchoolPreRoll(ally, again);
    expect(again.shift).toBe('d8');
  });

  test('Weapon Enthusiast Hang-Up sets Lend Assistance aside for that weapon', async () => {
    const gun = weapon({ id: 'g2', name: 'Pump Shotgun' });
    const effect = item('weaponEffect', null, { flags: { parentId: 'g2' } });
    const actor = makeActor([item('hangUp', Q2.weaponEnthusiastHangUp, { flags: { q2WeaponType: 'shotguns' } }), gun, effect],
      { flags: { pendingLendAssistanceShift: { skill: 'targeting' } } });
    expect(enthusiastBlocks(actor, effect)).toBe(true);
    await enthusiastPreRoll(actor, {}, effect);
    expect(actor.flags.essence20.pendingLendAssistanceShift).toBeUndefined();
    await enthusiastPreRoll(actor, {}, null);
    expect(actor.flags.essence20.pendingLendAssistanceShift).toEqual({ skill: 'targeting' });
  });
});

describe('Old Hand', () => {
  const moxie = value => ({ type: 'rolePoints', name: 'Moxie', system: { resource: { value } }, update: jest.fn() });

  test('die size by Old Hand level', () => {
    expect(doOrDieDie(makeActor([], { system: { level: 5, oldHandTransitionLevel: 5 } }))).toBe('d2');
    expect(oldHandLevel(makeActor([], { system: { level: 15, oldHandTransitionLevel: 5 } }))).toBe(11);
    expect(doOrDieDie(makeActor([], { system: { level: 15, oldHandTransitionLevel: 5 } }))).toBe('d6');
    expect(doOrDieDie(makeActor([], { system: { level: 20, oldHandTransitionLevel: 5 } }))).toBe('d8');
  });

  test('rescore adds the die to every compared entry', () => {
    const out = rescore(9, 3, [{ difficulty: 10 }, { difficulty: 6 }], (t, d) => (t >= d ? Math.max(1, Math.floor(t / d)) : 0));
    expect(out.map(e => [e.before, e.after])).toEqual([[0, 1], [1, 2]]);
  });

  test('Do Or Die needs Moxie; decorates a check card', () => {
    const actor = makeActor([item('perk', Q2.doOrDie), moxie(1)]);
    expect(canDoOrDie(actor)).toBe(true);
    expect(doOrDieCost(actor)).toBe(1);
    expect(canDoOrDie(makeActor([item('perk', Q2.doOrDie), moxie(0)]))).toBe(false);
    game.actors = Object.assign([actor], { get: id => (id == actor.id ? actor : null) });
    const appended = [];
    const card = { append: node => appended.push(node) };
    global.document = { createElement: () => ({ dataset: {} }) };
    decorateDoOrDie({ flags: { essence20: { checkResults: [{ difficulty: 10 }] } }, rolls: [{ total: 8 }], speaker: { actor: actor.id } },
      { querySelector: sel => (sel == '.e20-check-card' ? card : null) });
    expect(appended).toHaveLength(1);
    expect(appended[0].dataset.e20Ext).toBe('q2DoOrDie');
  });

  test('Wild Idea adds the bonus pool die and spends Moxie', async () => {
    const points = moxie(2);
    const actor = makeActor([item('perk', Q2.doOrDie), item('perk', Q2.wildIdea), points], { system: { level: 10 } });
    expect(wildIdeaToggles(actor)).toHaveLength(1);
    const options = { ext: { q2WildIdea: true } };
    await wildIdeaApply(actor, options);
    expect(options.extBonusPoolDie).toBe('d4');
    expect(points.update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
  });
});

describe('field ops', () => {
  test('Opportunist extends Stun on a hit', async () => {
    global.ChatMessage.create = jest.fn();
    const actor = makeActor([item('perk', Q2.opportunist)]);
    const target = makeActor([], { id: 't', system: { stun: { value: 2 } } });
    expect(isStunned(target)).toBe(true);
    await opportunistPostRoll(actor, [], { isAttack: true }, { hits: [{ target, hit: true }] });
    expect(target.update).toHaveBeenCalledWith({ 'system.stun.value': 3 });
    const timed = { statuses: new Set(['stunned']), duration: { rounds: 1 }, update: jest.fn() };
    const other = makeActor([], { id: 't2', statuses: ['stunned'], effects: [timed] });
    await opportunistPostRoll(actor, [], { isAttack: true }, { hits: [{ target: other, hit: true }] });
    expect(timed.update).toHaveBeenCalledWith({ 'duration.rounds': 2 });
  });

  test('Sensitive: a Detail Oriented use ignores the Snag this round', async () => {
    game.combat = { id: 'c1', round: 2 };
    const hangUp = item('hangUp', Q2.sensitive);
    const actor = makeActor([hangUp, item('perk', Q2.detailOriented)], { flags: { pendingSensitiveSnag: { snag: true } } });
    expect(detailOrientedLeft(actor)).toBe(3);
    expect(FIELD_OPS_USE.matches(hangUp)).toBe(true);
    await FIELD_OPS_USE.run(hangUp, null, async () => true);
    expect(actor.flags.essence20.pendingSensitiveSnag).toBeUndefined();
    expect(actor.flags.essence20.actionPerkDailyUses.detailOriented).toBe(1);
    expect(sensitiveIgnored(actor)).toBe(true);
    actor.flags.essence20.pendingSensitiveSnag = { snag: true };
    await sensitiveOnUpdate(actor, { flags: { essence20: { pendingSensitiveSnag: { snag: true } } } }, {}, 'u1');
    expect(actor.flags.essence20.pendingSensitiveSnag).toBeUndefined();
    game.combat = null;
  });

  test('Destructive Overcharge comes due at the end of the next turn', async () => {
    global.ChatMessage.create = jest.fn();
    expect(overchargeable(weapon({ system: { traits: ['computerized'] } }))).toBe(true);
    const actor = makeActor([], { flags: { q2Overcharges: [{ id: 'r', name: 'Rifle', combatId: 'c', turnEnds: 0 }] } });
    await overchargeTurnEnd(actor, { id: 'c' });
    expect(ChatMessage.create).not.toHaveBeenCalled();
    await overchargeTurnEnd(actor, { id: 'c' });
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
  });
});

describe('sessions', () => {
  test('recognises the New Session reset', () => {
    expect(isSessionReset({ type: 'party' }, { system: { storyPoints: 4, gmPoints: 4 } })).toBe(true);
    expect(isSessionReset({ type: 'party' }, { system: { storyPoints: 3 } })).toBe(false);
  });

  test('a session-gated use survives the next encounter and clears with the session', async () => {
    const actor = makeActor([item('perk', Q2.everythingIsInspiration)], { flags: { timelineAnomalyUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 } } });
    game.actors = [actor];
    game.settings.set = jest.fn();
    await noteGatedUse(actor, { flags: { essence20: { timelineAnomalyUsedThisEncounter: { epoch: 1 } } } }, {}, 'u1');
    expect(actor.flags.essence20.q2SessionUses).toEqual({ timelineAnomalyUsedThisEncounter: 1 });
    await carryGatedUses(2);
    expect(actor.flags.essence20.timelineAnomalyUsedThisEncounter.epoch).toBe(2);
    global.ChatMessage.create = jest.fn();
    game.socket = { emit: jest.fn() };
    await startNewSession();
    expect(game.socket.emit).toHaveBeenCalled();
    expect(actor.flags.essence20.timelineAnomalyUsedThisEncounter).toBeUndefined();
    expect(game.settings.set).toHaveBeenCalled();
  });
});

test('registers its hooks', () => {
  const registry = registrySnapshot();
  expect(registry.chatButtons.q2DoOrDie).toBeDefined();
  expect(registry.chatButtons.q2Overcharge).toBeDefined();
  expect(registry.uses.some(use => use.id == 'q2Qualify')).toBe(true);
  expect(registry.costRules.some(rule => rule.id == 'q2WhisperWarrior')).toBe(true);
});
