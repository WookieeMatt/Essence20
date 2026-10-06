import { worldActors } from "../companions/companion-link.mjs";
import { getSceneEpoch } from "../resources/scene-clock.mjs";
import { itemsOf, sourceOfOrUndefined as sourceOf } from "../../items/shared/item-lookups.mjs";

/**
 * Perks that reach across the team - handing something to an ally, or acting together.
 *
 * - Team Player (PR CRB, Green Ranger, p.45): pass a Survival Boon to a Morphed teammate.
 * - Let's Bring 'Em Together! (PR CRB, Red Ranger, p.53): the combined Power Weapon attack.
 * - Carrier (PR CRB, Zord Feature, p.136).
 * - Morphin Pet (Field Guide p.71): the pet Morphs too, for 1 Personal Power.
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const TEAM = {
  teamPlayer: uuid('pr_crb', 'b4OEl1hxeFXcAAy8'),
  letsBringEmTogether: uuid('pr_crb', '6Jf4hI8PmVctLex1'),
  carrier: uuid('pr_crb', 'h1b0cjGJP1xqtfVv'),
  morphinPet: uuid('field_guide_action_adventure', 'TgrFrV09NhlXIxom'),
};

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

const has = (actor, id) => itemsOf(actor).some(item => sourceOf(item) == id);

const USE_KINDS = ['teamPlayer', 'letsBringEmTogether'];
const BY_SOURCE = Object.fromEntries(USE_KINDS.map(kind => [TEAM[kind], kind]));

export function teamKindOf(item) {
  return BY_SOURCE[sourceOf(item)] ?? null;
}

/* -------------------------------------------- */
/*  Team Player                                  */
/* -------------------------------------------- */

/**
 * Team Player (PR CRB, Green Ranger 10th): two Morphed Rangers in contact each spend 1 Personal Power
 * and the holder passes one Survival Boon to the teammate; it lasts until both unmorph and is back
 * with the holder at their next It's Morphin Time!.
 *
 * The giver's Boon comes off their sheet and a copy is offered on a card; the teammate takes it
 * (spending their own Personal Power). It goes back on the giver's next Morph, and leaves the teammate
 * when they unmorph.
 */
async function teamPlayer(actor, item) {
  if (!actor.system?.isMorphed) {
    ui.notifications.warn(T('E20.MustBeMorphed', { name: actor.name }));
    return null;
  }

  const boons = itemsOf(actor).filter(i => i.type == 'perk' && i.system?.type == 'role' && i.id != item.id && !i.flags?.essence20?.teamPlayerFrom);
  const { chooseSelect } = await import("../resources/grants.mjs");
  const picked = await chooseSelect(item.name, T('E20.TeamPlayerPick'), boons.map(b => ({ value: b.id, label: b.name })));
  const boon = picked ? actor.items.get(picked) : null;
  const power = actor.system?.powers?.personal;
  if (!boon || !power || power.value < 1) {
    if (boon) {
      ui.notifications.warn(T('E20.NoPower', { name: actor.name }));
    }

    return null;
  }

  const data = boon.toObject();
  const lent = [...(actor.flags?.essence20?.teamPlayerLent ?? []), data];
  await actor.update({ 'system.powers.personal.value': power.value - 1, 'flags.essence20.teamPlayerLent': lent });
  await boon.delete();
  delete data._id;
  foundry.utils.setProperty(data, 'flags.essence20.teamPlayerFrom', actor.uuid);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p>${T('E20.TeamPlayerOffered', { name: actor.name, boon: boon.name })}</p><button type="button" data-e20-social="teamPlayerTake">${T('E20.TeamPlayerTake')}</button>`,
    flags: { essence20: { teamPlayerBoon: data } },
  });
  return null;
}

/** The teammate taking the Boon from the card. */
export async function onTeamPlayerTake(message) {
  const data = message?.flags?.essence20?.teamPlayerBoon;
  const actor = canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character;
  if (!data || !actor?.isOwner || message.flags.essence20.teamPlayerTaken) {
    return;
  }

  const power = actor.system?.powers?.personal;
  if (!actor.system?.isMorphed || !power || power.value < 1) {
    ui.notifications.warn(T('E20.TeamPlayerCannotTake', { name: actor.name }));
    return;
  }

  await actor.update({ 'system.powers.personal.value': power.value - 1 });
  await actor.createEmbeddedDocuments('Item', [data]);
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: T('E20.TeamPlayerTaken', { name: actor.name, boon: data.name }) });
}

/**
 * Morph and unmorph: a lent Boon comes home on the giver's next Morph, and leaves a teammate who
 * unmorphs. Morphin Pet's pet Morphs with its owner. Called from mechanics/characters/morph-state.mjs's update hook.
 * @param {Actor} actor
 * @param {Boolean} morphed   The new state.
 */
export async function onMorphChanged(actor, morphed) {
  if (!actor?.isOwner) {
    return;
  }

  if (morphed && actor.flags?.essence20?.teamPlayerLent?.length) {
    const back = actor.flags.essence20.teamPlayerLent.map(data => {
      const copy = foundry.utils.deepClone(data);
      delete copy._id;
      return copy;
    });
    await actor.createEmbeddedDocuments('Item', back);
    await actor.unsetFlag('essence20', 'teamPlayerLent');
  }

  if (!morphed) {
    const borrowed = itemsOf(actor).filter(i => i.flags?.essence20?.teamPlayerFrom).map(i => i.id);
    if (borrowed.length) {
      await actor.deleteEmbeddedDocuments('Item', borrowed);
    }
  }

  // Morphin Pet: 1 Personal Power at It's Morphin Time! Morphs the pet too.
  if (has(actor, TEAM.morphinPet)) {
    const { companionsOf } = await import("../companions/companion-link.mjs");
    const pets = companionsOf(actor).filter(p => p.type == 'companion' && p.system?.type == 'pet' && p.isOwner);
    for (const pet of pets) {
      if (!morphed && pet.system?.isMorphed) {
        await pet.update({ 'system.isMorphed': false });
      } else if (morphed && !pet.system?.isMorphed && (actor.system?.powers?.personal?.value ?? 0) >= 1) {
        const yes = await foundry.applications.api.DialogV2.confirm({
          window: { title: T('E20.MorphinPet') }, content: `<p>${T('E20.MorphinPetPrompt', { pet: pet.name })}</p>`, rejectClose: false,
        });
        if (yes) {
          await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
          await pet.update({ 'system.isMorphed': true });
        }
      }
    }
  }
}

// (Renegade Commander is a Use rule on the Perk: pickAlly, addEffect until scene - rules/conv18-convB.test.js.)

// (Try Me is a Use rule and a CardButtons rule on the Perk - placeBeside, contest: rules/conv16-b.test.js.)

/* -------------------------------------------- */
/*  Let's Bring 'Em Together!                    */
/* -------------------------------------------- */

/**
 * Let's Bring 'Em Together! (Red Ranger 5th): a Standard action and 1 Personal Power start it; each
 * teammate moves adjacent and names the same Contingency trigger, then one combined Power Weapon
 * attack goes off - range 100/250, ↑2 on the holder's attack, 1 damage per participant on a hit.
 */
async function letsBringEmTogether(actor, item, pay) {
  const power = actor.system?.powers?.personal;
  if (!power || power.value < 1) {
    ui.notifications.warn(T('E20.NoPower', { name: actor.name }));
    return null;
  }

  if (!(await pay('standard'))) {
    return null;
  }

  await actor.update({ 'system.powers.personal.value': power.value - 1 });
  const target = game.user?.targets?.first?.()?.actor;
  await actor.setFlag('essence20', 'combinedAttack', { scene: getSceneEpoch(), target: target?.uuid ?? null, joined: [actor.uuid] });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p>${T('E20.CombinedAttackStarted', { name: actor.name, target: target?.name ?? '?' })}</p>
      <button type="button" data-e20-social="combinedJoin" data-leader="${actor.uuid}">${T('E20.CombinedAttackJoin')}</button>
      <button type="button" data-e20-social="combinedFire" data-leader="${actor.uuid}">${T('E20.CombinedAttackFire')}</button>`,
  });
  return null;
}

/** A teammate joins: they're adjacent and spend 1 Personal Power. */
export async function onCombinedJoin(button) {
  const leader = await fromUuid(button.dataset.leader);
  const actor = canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character;
  const state = leader?.flags?.essence20?.combinedAttack;
  if (!state || !actor?.isOwner || state.joined.includes(actor.uuid)) {
    return;
  }

  const power = actor.system?.powers?.personal;
  if (!power || power.value < 1) {
    ui.notifications.warn(T('E20.NoPower', { name: actor.name }));
    return;
  }

  await actor.update({ 'system.powers.personal.value': power.value - 1 });
  const { needsGmRelay, relayToGm } = await import("../world/gm-relay.mjs");
  const next = { ...state, joined: [...state.joined, actor.uuid] };
  if (needsGmRelay(leader)) {
    await relayToGm(leader, 'setFlag', ['essence20', 'combinedAttack', next]);
  } else {
    await leader.setFlag('essence20', 'combinedAttack', next);
  }

  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: T('E20.CombinedAttackJoined', { name: actor.name, count: next.joined.length }) });
}

/** The leader fires: a temporary ranged attack at ↑2 dealing 1 per member. */
export async function onCombinedFire(button) {
  const leader = await fromUuid(button.dataset.leader);
  const state = leader?.flags?.essence20?.combinedAttack;
  if (!leader?.isOwner || !state) {
    return;
  }

  const members = state.joined.length;
  const { temporary } = await import("../resources/grants.mjs");
  const stamp = temporary('turn');
  const [weapon] = await leader.createEmbeddedDocuments('Item', [{
    name: T('E20.CombinedAttackWeapon'), type: 'weapon',
    system: { classification: { size: 'medium' }, availability: 'standard', equipped: true, hardpoint: { type: 'none' } },
    flags: { essence20: { temporary: stamp } },
  }]);
  const [effect] = await leader.createEmbeddedDocuments('Item', [{
    name: T('E20.CombinedAttackWeapon'), type: 'weaponEffect',
    system: { classification: { skill: 'targeting', style: 'energy' }, damageType: 'energy', damageValue: members, numTargets: 1, numHands: '0', range: { value: 100, long: 250 } },
    // The ↑2 rides a flag items/social/social-rolls.mjs reads.
    flags: { essence20: { parentId: weapon.id, temporary: stamp, bonusShiftUp: 2 } },
  }]);
  await leader.unsetFlag('essence20', 'combinedAttack');
  await effect.roll?.({ rollType: 'weaponEffect' });
}

// (In The Right Hands is a Use rule plus rules its rightHands mark carries onto the wielder - rules/conv16-b.test.js.)

/* -------------------------------------------- */
/*  Zords: Carrier, the Guardians                */
/* -------------------------------------------- */

/**
 * Carrier (PR CRB p.136): holds up to five Vehicular-Scale Zords and their Crew, unharmable until
 * released with an action, and all released when the Carrier hits 0 Health. A Zord listed on a Carrier's sheet is carried.
 */
export function carrierOf(zord) {
  if (zord?.type != 'zord') {
    return null;
  }

  return worldActors().find(a => a.type == 'zord' && a.uuid != zord.uuid && has(a, TEAM.carrier)
    && (a.system?.health?.value ?? 0) > 0 && Object.values(a.system?.actors ?? {}).some(e => e?.uuid == zord.uuid)) ?? null;
}

export function isCarried(zord) {
  return !!carrierOf(zord);
}

export function carrierCapacityLeft(carrier) {
  const carried = Object.values(carrier?.system?.actors ?? {}).filter(e => e?.type == 'zord').length;
  return 5 - carried;
}

// (Spirit's Host - the Persuasion test at the pilot's turn start and the Use button's Essences - is a Trigger and a
// Use rule on the Feature.)

// (Rally Guardians Features' due Zord Features are a Use rule on the Feature - rules/conv16-b.test.js.)

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

const HANDLERS = { teamPlayer, letsBringEmTogether };

export async function runTeamUse(item, economy) {
  const kind = teamKindOf(item);
  const actor = item?.parent;
  if (!kind || !actor) {
    return null;
  }

  const pay = async (cost) => {
    if (!cost || !game.combat || !economy) {
      return true;
    }

    const paid = await economy.spend(actor, cost, { source: item.name });
    return !paid.blocked;
  };

  return HANDLERS[kind](actor, item, pay);
}
