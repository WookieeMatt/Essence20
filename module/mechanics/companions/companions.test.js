import { jest } from '@jest/globals';
import { addNightValeAnimalPerk, animalStats, canCommand, commandDif, commandIsMove, runCompanionUse, companionDefenseBonus, companionRollSources, droneStats, isDocked, linkedBonuses, miniConStats, ponyPetStats } from './companions.mjs';
import { COMP, isCompanionUse } from './companion-uses.mjs';
import { companionsOf, isCompanionPair, ownerOf, worldActors } from './companion-link.mjs';
import { buildCommand, commandDefenseBonus, commandSources, isLive, PRESETS } from '../actions/commands.mjs';
import { bondBonuses, bondOf, bondRollSources, bondSpecializes, BOND, moduleEnergon } from './bonded-partners.mjs';
import { BFF, bffsOf, coolerAvailable, isBff, leaveItToMeFailure } from '../../items/social/best-friends-forever.mjs';
import { groupBonuses, GROUP, renderCard, tally } from '../rolls/group-tests.mjs';
import { allegianceLeft, CONTACT, contactKindOf, isContact, startingAllegiance } from './contacts.mjs';
import { BATTLIZERS, fastSummonOptions, hardTargetBonus, isBattlizer, personalVehicleEdge, racerAbandonMode, SUMMON, vehicleData, VEHICLES } from './summons.mjs';
import { carrierCapacityLeft, rightHandsDefense, teamKindOf, TEAM } from '../actions/team-actions.mjs';

let nextId = 0;
const item = (source, extra = {}) => ({
  id: extra.id ?? `i${nextId++}`, name: extra.name ?? 'Item', type: extra.type ?? 'perk',
  flags: { core: { sourceId: source }, essence20: { ...(extra.flags ?? {}) } }, system: extra.system ?? {},
});

function actor(extra = {}) {
  const items = extra.items ?? [];
  return {
    id: extra.id ?? `a${nextId++}`, uuid: extra.uuid ?? `Actor.a${nextId++}`, name: extra.name ?? 'Actor', type: extra.type ?? 'playerCharacter',
    system: { level: 5, skills: {}, actors: {}, ...(extra.system ?? {}) },
    flags: { essence20: { ...(extra.flags ?? {}) } },
    items: Object.assign([...items], { contents: items }),
    getActiveTokens: () => [],
  };
}

let actors = [];
beforeEach(() => {
  actors = [];
  global.game = {
    i18n: { localize: k => k, format: k => k },
    combat: null, user: { targets: new Set() }, settings: { get: () => 1 },
    get actors() {
      return Object.assign([...actors], { contents: actors });
    },
  };
  global.fromUuidSync = uuid => actors.find(a => a.uuid == uuid) ?? null;
  global.CONFIG = { E20: {
    skillShiftList: ['criticalSuccess', 'autoSuccess', '3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20', 'autoFail', 'fumble'],
    skillToEssence: { might: 'strength', alertness: 'smarts', science: 'smarts', targeting: 'speed' },
    skills: { might: 'Might', alertness: 'Alertness' }, defenses: { toughness: 'T', evasion: 'E', willpower: 'W', cleverness: 'C' },
  } };
  global.foundry = { utils: { randomID: () => `r${nextId++}`, hasProperty: () => false, escapeHTML: s => String(s), setProperty: (o, k, v) => {
    o[k] = v; 
  } } };
});

describe('companion link', () => {
  test('owner and companions', () => {
    const owner = actor({ uuid: 'Actor.owner' });
    const pet = actor({ uuid: 'Actor.pet', type: 'companion', system: { type: 'pet' }, flags: { companionOf: 'Actor.owner' } });
    actors.push(owner, pet);
    expect(ownerOf(pet)).toBe(owner);
    expect(companionsOf(owner)).toEqual([pet]);
    expect(companionsOf(owner, { type: 'drone' })).toEqual([]);
    expect(isCompanionPair(owner, pet)).toBe(true);
    expect(worldActors().length).toBe(2);
  });
});

describe('pet and drone statistics', () => {
  test('animal pets by function, size and availability', () => {
    const attack = animalStats({ availability: 'standard', fn: 'attack', size: 'small', move: 'land' });
    expect(attack['essences.strength.max']).toBe(2);
    expect(attack['health.origin']).toBe(3);
    expect(attack['defenses.evasion.base']).toBe(11);
    expect(attack['movement.ground.base']).toBe(30);
    const utility = animalStats({ availability: 'restricted', fn: 'utility', size: 'common', move: 'air' });
    expect(utility['essences.smarts.max'] + utility['essences.social.max']).toBe(8);
    expect(utility['health.origin']).toBe(5);
    expect(utility['defenses.toughness.base']).toBe(13);
    expect(utility['movement.aerial.base']).toBe(45);
    expect(animalStats({ availability: 'limited', fn: 'sacrificial' })['health.origin']).toBe(4);
  });

  test('drones, pony pets and Mini-Cons', () => {
    expect(droneStats({ availability: 'restricted' })['essences.strength.max']).toBe(2);
    expect(droneStats({ availability: 'limited' })['essences.speed.max']).toBe(2);
    expect(droneStats({ availability: 'limited' })['health.origin']).toBe(3);
    expect(ponyPetStats()['essences.speed.max']).toBe(3);
    expect(ponyPetStats()['defenses.evasion.base']).toBe(13);
    expect(miniConStats()['movement.aerial.base']).toBe(20);
  });

  test('command DIF by availability, Agreeable and the pony books', () => {
    expect(commandDif(actor({ type: 'companion', system: { availability: 'limited' } }))).toBe(10);
    expect(commandDif(actor({ type: 'companion', system: { availability: 'restricted' }, items: [item(COMP.agreeableGij)] }))).toBe(10);
    expect(commandDif(actor({ type: 'companion', system: { availability: 'restricted' }, flags: { petBuild: { line: 'mlp' } } }))).toBe(10);
  });
});

describe('what owners and companions give each other', () => {
  test('Tough Together, Linked Health and Reinforced Bond', () => {
    const owner = actor({ uuid: 'Actor.o', items: [item(COMP.toughTogether)] });
    const pet = actor({ uuid: 'Actor.p', type: 'companion', system: { type: 'pet' }, flags: { companionOf: 'Actor.o' } });
    const mini = actor({ uuid: 'Actor.m', type: 'companion', system: { type: 'miniCon' }, flags: { companionOf: 'Actor.o', miniCon: { docked: false, defenseShift: 2 } } });
    actors.push(owner, pet, mini);
    expect(linkedBonuses(pet).health).toBe(1);
    expect(linkedBonuses(mini).defenses.toughness).toBe(2);
    expect(linkedBonuses(owner).health).toBe(2);
    expect(linkedBonuses(owner).defenses.evasion).toBe(-2);
    expect(isDocked(mini)).toBe(false);
  });

  test('Mini-Con Master and the Helper', () => {
    const owner = actor({ uuid: 'Actor.o', items: [item(COMP.miniConMaster)] });
    const make = n => actor({ uuid: `Actor.m${n}`, type: 'companion', system: { type: 'miniCon' }, flags: { companionOf: 'Actor.o', miniCon: { docked: true, altMode: 'vehicle', purposes: ['alertness'] } } });
    actors.push(owner, make(1), make(2));
    expect(linkedBonuses(owner).defenses.evasion).toBe(1);
    expect(companionRollSources(owner, null, { rolledSkill: 'alertness' }).map(s => s.id)).toContain('miniConHelper');
    expect(companionDefenseBonus(owner, 'toughness')).toBe(0);
  });
});

describe('Issue Command', () => {
  test('a Fire command boosts ranged attacks and lasts until the commander\'s next turn', () => {
    const commander = actor({ uuid: 'Actor.c', items: [] });
    const command = buildCommand(commander, { preset: 'fire', harmless: 'no' });
    expect(command.kind).toBe(PRESETS.fire.kind);
    expect(isLive(command)).toBe(true);
    commander.flags.essence20.issuedCommands = [command];
    commander.prototypeToken = { disposition: 1 };
    const ally = actor({ uuid: 'Actor.a' });
    ally.prototypeToken = { disposition: 1 };
    actors.push(commander, ally);
    expect(commandSources(ally, { isAttack: true, isRanged: true })[0].shiftUp).toBe(1);
    expect(commandSources(ally, { isAttack: true, isRanged: false })).toEqual([]);
  });

  test('Minimize Casualties doubles a harmless command in combat; a Defense command raises the Defense', () => {
    global.game.combat = { id: 'c1', round: 1, turn: 0, turns: [] };
    const commander = actor({ uuid: 'Actor.c', items: [item('Compendium.essence20.tf_crb.Item.72O6Oz5cBJwpkD3u')] });
    const command = buildCommand(commander, { preset: 'holdTheLine', harmless: 'yes' });
    expect(command.value).toBe(2);
    commander.flags.essence20.issuedCommands = [command];
    const ally = actor({ uuid: 'Actor.a' });
    actors.push(commander, ally);
    expect(commandDefenseBonus(ally, 'toughness')).toBe(2);
    expect(commandDefenseBonus(ally, 'evasion')).toBe(0);
  });
});

describe('bonded partners', () => {
  test('Advanced Link, Armored Connection and Bonded Proficiency', () => {
    const partner = actor({ uuid: 'Actor.p', system: { skills: { science: { shift: 'd6', isSpecialized: true } } } });
    const holder = actor({ uuid: 'Actor.h', items: [item(BOND.advancedLink), item(BOND.armoredConnection), item(BOND.bondedProficiency)], flags: { bond: { partner: 'Actor.p', linked: true } } });
    actors.push(partner, holder);
    expect(bondOf(partner).holder).toBe(holder);
    expect(bondBonuses(partner).health).toBe(1);
    expect(bondBonuses(holder).defenses.toughness).toBe(2);
    expect(bondSpecializes(holder, 'science')).toBe(true);
    expect(moduleEnergon(holder)).toBe(3);
  });

  test('Headmaster Head makes attackers suffer ↓2', () => {
    const body = actor({ uuid: 'Actor.b', system: { isTransformed: false } });
    const head = actor({ uuid: 'Actor.h', items: [item(BOND.headmasterHead)], flags: { bond: { partner: 'Actor.b', linked: true } } });
    const attacker = actor({ uuid: 'Actor.x' });
    actors.push(body, head, attacker);
    expect(bondRollSources(attacker, head, { isAttack: true })[0]).toMatchObject({ id: 'headmasterHead', shiftDown: 2 });
  });
});

describe('BFFs', () => {
  test('About Twenty-Percent Cooler and Leave It To Me', () => {
    const friend = actor({ uuid: 'Actor.f', system: { skills: { might: { shift: 'd4' } } }, flags: { failedOnTurn: { skill: 'might', scene: 1, id: 'x' } } });
    const pony = actor({ uuid: 'Actor.p', items: [item(BFF.bff), item(BFF.twentyPercentCooler), item(BFF.leaveItToMe)], flags: { bffs: ['Actor.f'] } });
    actors.push(friend, pony);
    expect(bffsOf(pony)).toEqual(['Actor.f']);
    expect(isBff(pony, friend)).toBe(true);
    expect(coolerAvailable(pony, 'might')).toBe(true);
    expect(coolerAvailable(pony, 'alertness')).toBe(false);
    expect(leaveItToMeFailure(pony, 'might')?.id).toBe('x');
  });
});

describe('Group Skill Tests', () => {
  test('half or more succeed, and the Perks that help', () => {
    const a = actor({ uuid: 'Actor.1', items: [item(GROUP.caretaker)], flags: { groupTest: { id: 't', success: true } } });
    const b = actor({ uuid: 'Actor.2', items: [item(GROUP.bowlingTeam)], flags: { groupTest: { id: 't', success: false } } });
    actors.push(a, b);
    const test = { id: 't', skill: 'might', dif: 10, leader: 'Actor.2', participants: ['Actor.1', 'Actor.2'] };
    expect(tally(test)).toMatchObject({ successes: 1, done: true, success: true });
    expect(groupBonuses(a, test)).toMatchObject({ edge: true, shiftUp: 1 });
    expect(renderCard(test)).toContain('E20.GroupTestGroupSucceeded');
  });
});

describe('Contacts', () => {
  test('Allegiance Points and the Contact Perks with Use buttons', () => {
    const contact = actor({ type: 'npc', system: { isContact: true, allegiancePoints: 3 } });
    expect(isContact(contact)).toBe(true);
    expect(startingAllegiance(contact)).toBe(3);
    expect(allegianceLeft(contact)).toBe(3);
    contact.flags.essence20.contact = { left: 1, mission: 1 };
    expect(allegianceLeft(contact)).toBe(1);
    expect(contactKindOf(item(CONTACT.trustedContact))).toBe('trustedContact');
  });
});

describe('summons', () => {
  test('vehicle stat blocks', () => {
    const data = vehicleData(VEHICLES.jetJammer);
    expect(data.type).toBe('vehicle');
    expect(data.system.essences.strength.value).toBe(7);
    expect(data.system.defenses.toughness.armor).toBe(1);
    expect(data.items.filter(i => i.type == 'weaponEffect').length).toBe(2);
  });

  test('Battlizers, Edge while riding, Hard Target and Racer Abandon', () => {
    expect(isBattlizer(item(SUMMON.triassic, { type: 'armor' }))).toBe(true);
    expect(BATTLIZERS[SUMMON.triassic].cost).toBe(3);
    // Quantum Mega Battle Armor (A Jump Through Time): 5 Personal Power, three attacks.
    expect(SUMMON.quantumMega).toBe('Compendium.essence20.jump_through_time.Item.WiaxmqhCQSYpJIeK');
    expect(isBattlizer(item(SUMMON.quantumMega, { type: 'armor' }))).toBe(true);
    expect(BATTLIZERS[SUMMON.quantumMega].cost).toBe(5);
    expect(BATTLIZERS[SUMMON.quantumMega].attacks.map(a => a.name)).toEqual(['Wing Blades', 'Wing Blaster', 'Energy Sword Time Strike']);
    const rider = actor({ uuid: 'Actor.r', items: [item(SUMMON.hardTarget), item(SUMMON.racerAbandon)] });
    const cycle = actor({ type: 'vehicle', flags: { personalVehicle: 'sharkCycle', companionOf: 'Actor.r' } });
    expect(personalVehicleEdge(rider, 'driving', cycle)).toBe(true);
    expect(personalVehicleEdge(rider, 'might', cycle)).toBe(false);
    const jetPack = actor({ type: 'vehicle', flags: { personalVehicle: 'jetPack' } });
    expect(hardTargetBonus(rider, jetPack)).toEqual({ health: 2, defenses: { toughness: 2 } });
    expect(racerAbandonMode(rider, cycle)).toEqual({ vehicle: true, self: false });
    const zord = actor({ type: 'zord', items: [item(SUMMON.manifestedZord)] });
    expect(fastSummonOptions(rider, zord).map(o => o.key)).toEqual(['manifested']);
  });
});

describe('team Perks', () => {
  test('Use kinds, Carrier capacity and In The Right Hands', () => {
    expect(teamKindOf(item(TEAM.tryMe))).toBe('tryMe');
    expect(carrierCapacityLeft(actor({ type: 'zord', system: { actors: { a: { type: 'zord' } } } }))).toBe(4);
    const armor = actor({ uuid: 'Actor.arm', system: { isTransformed: true }, items: [item(TEAM.inTheRightHands)], flags: { rightHands: { kind: 'bodyArmor', wielder: 'Actor.w' } } });
    const wearer = actor({ uuid: 'Actor.w' });
    actors.push(armor, wearer);
    expect(rightHandsDefense(wearer, 'toughness')).toBe(2);
    expect(rightHandsDefense(armor, 'evasion')).toBe(2);
    expect(rightHandsDefense(wearer, 'willpower')).toBe(0);
  });
});

void jest;

describe('Night Vale Community Adoption Center', () => {
  test('improving a pet adds one Animal Perk from the Citizens Guide, not an Availability tier', async () => {
    const pet = actor({ uuid: 'Actor.pet', name: 'Khoshekh', type: 'companion', system: { type: 'pet', availability: 'standard' } });
    pet.createEmbeddedDocuments = jest.fn(async (type, data) => data.map(d => ({ ...d, id: 'new' })));
    const wtnvUuid = id => `Compendium.essence20.wtnv_citizens_guide.Item.${id}`;
    const entries = [
      { uuid: wtnvUuid('xNiPMhVMQQUzlRg8'), name: 'Animal', type: 'perk', folder: 'f1' },
      { uuid: wtnvUuid('aaaa'), name: 'Quills', type: 'perk', folder: 'f1' },
      { uuid: wtnvUuid('bbbb'), name: 'Hat', type: 'gear', folder: 'f2' },
    ];
    global.game.packs = { get: () => ({ folders: [{ id: 'f1', name: 'Animal Perks' }, { id: 'f2', name: 'Gear' }], getIndex: async () => new Map(entries.map(e => [e.uuid, e])) }) };
    const offered = [];
    global.foundry.applications = { api: { DialogV2: { wait: jest.fn() } } };
    await addNightValeAnimalPerk([pet], { name: 'Night Vale Community Adoption Center' }, async (title, rows) => {
      offered.push(...rows);
      return null;
    });
    // Only Animal Perks other than the base Animal Perk are offered.
    expect(offered.map(r => r.name)).toEqual(['Quills']);
  });
});

describe('designated commanders and Favorite Command', () => {
  function dialogAnswer(answer) {
    global.foundry.applications = { api: { DialogV2: { wait: jest.fn(async ({ buttons }) => buttons[0].callback(null, { form: { elements: answer } })) } } };
  }

  function withSetFlag(it) {
    it.setFlag = jest.fn(async (scope, key, value) => {
      it.flags.essence20[key] = value;
    });
    return it;
  }

  test('Backup Master / Extra Friend: the Use button designates who else may command the pet', async () => {
    const owner = actor({ uuid: 'Actor.owner', name: 'Owner' });
    const friend = actor({ uuid: 'Actor.friend', name: 'Friend' });
    for (const source of [COMP.backupMaster, COMP.extraFriend]) {
      const perk = withSetFlag(item(source, { name: 'Backup Master' }));
      const pet = actor({ uuid: 'Actor.pet', type: 'companion', system: { type: 'pet' }, flags: { companionOf: 'Actor.owner' }, items: [perk] });
      perk.parent = pet;
      actors.splice(0, actors.length, owner, friend, pet);
      expect(isCompanionUse(perk)).toBe(true);
      expect(canCommand(friend, pet)).toBe(false);
      dialogAnswer({ designee: { value: 'Actor.friend' } });

      await runCompanionUse(perk, null);

      expect(perk.flags.essence20.designee).toBe('Actor.friend');
      expect(canCommand(friend, pet)).toBe(true);
      expect(canCommand(owner, pet)).toBe(true);
    }
  });

  test('Favorite Command: the Skill picked on the Perk makes commanding the pet a Move action', async () => {
    const owner = actor({ uuid: 'Actor.owner' });
    const perk = withSetFlag(item(COMP.favoriteCommandMlp, { name: 'Favorite Command' }));
    const pet = actor({ uuid: 'Actor.pet', type: 'companion', system: { type: 'pet' }, flags: { companionOf: 'Actor.owner' }, items: [perk] });
    perk.parent = pet;
    actors.push(owner, pet);
    expect(commandIsMove(owner)).toBe(false);

    // The Perk's own Skill picker (system.choice) counts...
    perk.system.choice = 'alertness';
    expect(commandIsMove(owner)).toBe(true);

    // ...and so does the Use button's pick.
    perk.system.choice = '';
    dialogAnswer({ skill: { value: 'might' } });
    await runCompanionUse(perk, null);
    expect(perk.flags.essence20.favoriteSkill).toBe('might');
    expect(commandIsMove(owner)).toBe(true);
  });
});
