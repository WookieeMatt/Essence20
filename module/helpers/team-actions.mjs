import { worldActors } from "./companion-link.mjs";
import { getSceneEpoch, getUses, markUsed } from "./scene-clock.mjs";

/**
 * Perks that reach across the team - handing something to an ally, or acting together.
 *
 * - Team Player (PR CRB, Green Ranger, p.45): pass a Survival Boon to a Morphed teammate.
 * - Renegade Commander (Sgt Slaughter Sourcebook p.12): give an ally Reckless Abandon.
 * - Try Me (Sgt Slaughter Sourcebook p.11): a challenge to a fist fight.
 * - Let's Bring 'Em Together! (PR CRB, Red Ranger, p.53): the combined Power Weapon attack.
 * - In The Right Hands (Decepticon Directive p.33): an Alt Mode someone else wields or wears.
 * - Carrier (PR CRB, Zord Feature, p.136), Spirit's Host (Through the Shattered Grid p.118) and Rally
 *   Guardians' Features (p.72).
 * - Morphin Pet (Field Guide p.71): the pet Morphs too, for 1 Personal Power.
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const TEAM = {
  teamPlayer: uuid('pr_crb', 'b4OEl1hxeFXcAAy8'),
  renegadeCommander: uuid('sgt_slaughter_sourcebook', 'JgJRqxXzTPBOlOBz'),
  tryMe: uuid('sgt_slaughter_sourcebook', 'ZyWXJTkPqv8S6K3b'),
  letsBringEmTogether: uuid('pr_crb', '6Jf4hI8PmVctLex1'),
  inTheRightHands: uuid('decepticon_directive', 'z5xX6kylwvCblYkl'),
  conniving: uuid('cobra_codex', 'dJoVvMG3wjowbWJ8'),
  carrier: uuid('pr_crb', 'h1b0cjGJP1xqtfVv'),
  spiritsHost: uuid('through_the_shattered_grid', 'HQaLM23Y7hnKbLFQ'),
  rallyGuardiansFeatures: uuid('through_the_shattered_grid', 'vJYXOqRQIDEUmuDE'),
  morphinPet: uuid('field_guide_action_adventure', 'TgrFrV09NhlXIxom'),
  recklessAbandon: uuid('gi_joe_crb', '84d0XTJwKCYMJUgY'),
};

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
}

function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  return Array.isArray(items.contents) ? items.contents : (typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

const has = (actor, id) => itemsOf(actor).some(item => sourceOf(item) == id);

const USE_KINDS = ['teamPlayer', 'renegadeCommander', 'tryMe', 'letsBringEmTogether', 'inTheRightHands', 'rallyGuardiansFeatures', 'spiritsHost'];
const BY_SOURCE = Object.fromEntries(USE_KINDS.map(kind => [TEAM[kind], kind]));

export function teamKindOf(item) {
  return BY_SOURCE[sourceOf(item)] ?? null;
}

function allyTokens(actor, feet = Infinity) {
  const mine = actor?.getActiveTokens?.()?.[0];
  if (!mine || !canvas?.tokens) {
    return [];
  }

  return canvas.tokens.placeables.filter(t => t !== mine && t.actor && t.document.disposition == mine.document.disposition
    && (feet == Infinity || canvas.grid.measurePath([mine.center, t.center]).distance <= feet));
}

function enemyTokens(actor, feet) {
  const mine = actor?.getActiveTokens?.()?.[0];
  if (!mine || !canvas?.tokens) {
    return [];
  }

  return canvas.tokens.placeables.filter(t => t.actor && t.document.disposition == -mine.document.disposition
    && canvas.grid.measurePath([mine.center, t.center]).distance <= feet);
}

async function pickToken(title, prompt, tokens) {
  if (!tokens.length) {
    ui.notifications.warn(T('E20.NoOneInRange'));
    return null;
  }

  const { chooseSelect } = await import("./grants.mjs");
  const picked = tokens.length == 1 ? tokens[0].id : await chooseSelect(title, prompt, tokens.map(t => ({ value: t.id, label: t.name })));
  return tokens.find(t => t.id == picked) ?? null;
}

/* -------------------------------------------- */
/*  Team Player                                  */
/* -------------------------------------------- */

/**
 * Team Player (PR CRB, Green Ranger 10th): "you can transfer your unique Survival Boons to your Power
 * Ranger teammates. By making contact between your Morphed form and a teammate's Morphed form, and both
 * of you spend 1 Personal Power ... you may choose one of your current Survival Boons to pass to that
 * teammate. This transfer lasts until both of you return to your normal form; the next time you use
 * It's Morphin Time!, all transferred Survival Boons will have been returned to you."
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
  const { chooseSelect } = await import("./grants.mjs");
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
 * unmorphs. Morphin Pet's pet Morphs with its owner. Called from helpers/morph-state.mjs's update hook.
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

  // Morphin Pet: "When you use It's Morphin Time!, you can spend 1 Personal Power to grant your pet the
  // same benefits."
  if (has(actor, TEAM.morphinPet)) {
    const { companionsOf } = await import("./companion-link.mjs");
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

/* -------------------------------------------- */
/*  Renegade Commander                           */
/* -------------------------------------------- */

/**
 * Renegade Commander: "As a Standard action, you can grant an ally in Light or no armor who can see and
 * hear you the benefits of Reckless Abandon. You can use this ability a number of times in a day equal
 * to the Reckless Abandon Uses column". The uses are the Commander's own Role resource; the ally gets
 * the ↑2 on Strength tests and the Bonus Health as a scene-long effect. At 9th level the Commander can
 * pick themselves.
 */
async function renegadeCommander(actor, item, pay) {
  const rolePoints = actor._getBaseRolePoints?.();
  const resource = rolePoints?.system?.resource;
  if (!resource || (resource.value ?? 0) < 1) {
    ui.notifications.warn(T('E20.RenegadeCommanderNoUses', { name: actor.name }));
    return null;
  }

  const tokens = allyTokens(actor);
  if ((Number(actor.system?.level) || 1) >= 9) {
    const own = actor.getActiveTokens?.()?.[0];
    if (own) {
      tokens.unshift(own);
    }
  }

  const token = await pickToken(item.name, T('E20.RenegadeCommanderPick'), tokens);
  const ally = token?.actor;
  if (!ally) {
    return null;
  }

  const heavy = itemsOf(ally).some(i => i.type == 'armor' && i.system?.equipped && !['light'].includes(i.system?.classification));
  if (heavy) {
    ui.notifications.warn(T('E20.RenegadeCommanderArmor', { name: ally.name }));
    return null;
  }

  if (!(await pay('standard'))) {
    return null;
  }

  await rolePoints.update({ 'system.resource.value': resource.value - 1 });
  const level = Number(actor.system?.level) || 1;
  const bonusHealth = Number(rolePoints.system?.bonus?.[level == 20 ? 'level20Value' : 'value']) || 0;
  const effect = {
    name: T('E20.RenegadeCommanderEffect', { name: actor.name }), img: item.img,
    flags: { essence20: { renegadeCommander: getSceneEpoch() } },
    changes: [
      { key: 'system.essenceShifts.strength.shiftUp', mode: 2, value: '2' },
      ...(bonusHealth ? [{ key: 'system.health.bonus', mode: 2, value: String(bonusHealth) }] : []),
    ],
  };
  const { needsGmRelay } = await import("./gm-relay.mjs");
  if (needsGmRelay(ally)) {
    ui.notifications.warn(T('E20.RenegadeCommanderNeedsOwner', { name: ally.name }));
    return null;
  }

  await ally.createEmbeddedDocuments('ActiveEffect', [effect]);
  return T('E20.RenegadeCommanderGiven', { name: actor.name, ally: ally.name });
}

/** Renegade Commander's grant, like the scene's other summons, ends with the scene. */
export async function endSceneTeamEffects(actor) {
  const ids = [...(actor?.effects ?? [])].filter(e => e.flags?.essence20?.renegadeCommander != null
    && e.flags.essence20.renegadeCommander != getSceneEpoch()).map(e => e.id);
  if (ids.length && actor.isOwner) {
    await actor.deleteEmbeddedDocuments('ActiveEffect', ids);
  }
}

/* -------------------------------------------- */
/*  Try Me                                       */
/* -------------------------------------------- */

/**
 * Try Me: "Once per combat, as a Standard action, you can challenge enemies within 20 feet ... Enemies
 * who accept can move to a space adjacent to you ... you and your enemy roll a contested Skill Test
 * using whatever skill they would use for an unarmed combat Attack ... The loser takes the effect of
 * the winner's unarmed combat Attack." The GM ticks who accepts on the card.
 */
async function tryMe(actor, item, pay) {
  if (getUses(actor, 'tryMe', 'encounter') >= 1) {
    ui.notifications.warn(T('E20.OncePerCombat'));
    return null;
  }

  const enemies = enemyTokens(actor, 20);
  if (!enemies.length) {
    ui.notifications.warn(T('E20.NoOneInRange'));
    return null;
  }

  if (!(await pay('standard'))) {
    return null;
  }

  await markUsed(actor, 'tryMe', { window: 'encounter' });
  const rows = enemies.map(t => `<li class="flexrow">${foundry.utils.escapeHTML(t.name)} <button type="button" data-e20-social="tryMeAccept" data-challenger="${actor.uuid}" data-token="${t.document.uuid}">${T('E20.TryMeAccept')}</button></li>`).join('');
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${T('E20.TryMeIssued', { name: actor.name })}</p><ul>${rows}</ul>` });
  return null;
}

/** An enemy accepting (the GM clicks): move them adjacent, and both roll. */
export async function onTryMeAccept(button) {
  if (!game.user?.isGM) {
    ui.notifications.warn(T('E20.GmOnly'));
    return;
  }

  const challenger = await fromUuid(button.dataset.challenger);
  const tokenDoc = await fromUuid(button.dataset.token);
  const enemy = tokenDoc?.actor;
  const mine = challenger?.getActiveTokens?.()?.[0];
  if (!enemy || !mine) {
    return;
  }

  const size = canvas.grid?.size ?? 100;
  await tokenDoc.update({ x: mine.document.x + (mine.document.width ?? 1) * size, y: mine.document.y });
  const skillOf = a => {
    const might = CONFIG.E20.skillShiftList.indexOf(a.system?.skills?.might?.shift ?? 'd20');
    const finesse = CONFIG.E20.skillShiftList.indexOf(a.system?.skills?.finesse?.shift ?? 'd20');
    return finesse < might ? 'finesse' : 'might';
  };

  const roll = async a => {
    const skill = skillOf(a);
    const result = await a._dice?.rollSkill({ skill, essence: CONFIG.E20.skillToEssence[skill], shiftUp: 0, shiftDown: 0 }, a);
    return Number(result?.outcomes?.[0]?.results?.[0]?.total ?? result?.total ?? 0);
  };

  const mineTotal = await roll(challenger);
  const theirTotal = await roll(enemy);
  const winner = mineTotal >= theirTotal ? challenger : enemy;
  const loser = winner == challenger ? enemy : challenger;
  ChatMessage.create({ content: T('E20.TryMeResult', { winner: winner.name, loser: loser.name, mine: mineTotal, theirs: theirTotal }) });
}

/* -------------------------------------------- */
/*  Let's Bring 'Em Together!                    */
/* -------------------------------------------- */

/**
 * Let's Bring 'Em Together! (Red Ranger 5th): "as a standard action, spend 1 Personal Power to begin
 * ... each other teammate must move to be adjacent to you and name the same Contingency action trigger
 * ... the combined Power weapon attack takes place. The ranged attack has a Reach of 100/250, gains an
 * additional ↑2 to hit using your attack traits and abilities, but inflicts 1 Damage upon a successful
 * hit per participating member."
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
  const { needsGmRelay, relayToGm } = await import("./gm-relay.mjs");
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
  const { temporary } = await import("./grants.mjs");
  const stamp = temporary('turn');
  const [weapon] = await leader.createEmbeddedDocuments('Item', [{
    name: T('E20.CombinedAttackWeapon'), type: 'weapon',
    system: { classification: { size: 'medium' }, availability: 'standard', equipped: true, hardpoint: { type: 'none' } },
    flags: { essence20: { temporary: stamp } },
  }]);
  const [effect] = await leader.createEmbeddedDocuments('Item', [{
    name: T('E20.CombinedAttackWeapon'), type: 'weaponEffect',
    system: { classification: { skill: 'targeting', style: 'energy' }, damageType: 'energy', damageValue: members, numTargets: 1, numHands: '0', range: { value: 100, long: 250 } },
    // The ↑2 rides a flag helpers/social-rolls.mjs reads.
    flags: { essence20: { parentId: weapon.id, temporary: stamp, bonusShiftUp: 2 } },
  }]);
  await leader.unsetFlag('essence20', 'combinedAttack');
  await effect.roll?.({ rollType: 'weaponEffect' });
}

/* -------------------------------------------- */
/*  In The Right Hands                           */
/* -------------------------------------------- */

const RIGHT_HANDS = {
  // "Body Armor Segment: You and your wearer gain a +2 deflective bonus to both Toughness and Evasion
  // Defenses; Brawn • Energy Firearm: None; Alertness • Handheld Shield: Impose Snag on first attack
  // targeting wielder each turn; Might (Push/Shove only) • Melee Weapon: None; Intimidation".
  bodyArmor: { skill: 'brawn', defenses: 2 },
  firearm: { skill: 'alertness' },
  shield: { skill: 'might', shoveOnly: true, shield: true },
  melee: { skill: 'intimidation' },
};

async function inTheRightHands(actor, item) {
  const { chooseSelect } = await import("./grants.mjs");
  const kind = await chooseSelect(item.name, T('E20.RightHandsKind'), Object.keys(RIGHT_HANDS).map(k => ({ value: k, label: T(`E20.RightHands.${k}`) })));
  if (!kind) {
    return null;
  }

  const tokens = allyTokens(actor);
  const token = await pickToken(item.name, T('E20.RightHandsWielder'), tokens);
  await actor.setFlag('essence20', 'rightHands', { kind, wielder: token?.actor?.uuid ?? null });
  return T('E20.RightHandsSet', { name: actor.name, kind: T(`E20.RightHands.${kind}`), wielder: token?.actor?.name ?? T('E20.None') });
}

/** Who wields which In The Right Hands Alt Mode right now (the Cybertronian must be in Alt Mode). */
function rightHandsFor(wielder) {
  const out = [];
  for (const actor of worldActors()) {
    const state = actor.flags?.essence20?.rightHands;
    if (state?.wielder == wielder?.uuid && actor.system?.isTransformed && has(actor, TEAM.inTheRightHands)) {
      out.push({ actor, ...RIGHT_HANDS[state.kind], kind: state.kind });
    }
  }

  return out;
}

/**
 * "you automatically grant the benefits of Lend Assistance to your wielder/wearer with the skill
 * listed in the Alt Mode choices below; this takes no action on your part." ↑1 on that Skill.
 */
export function rightHandsSources(actor, { rolledSkill, isShove }) {
  return rightHandsFor(actor).filter(r => r.skill == rolledSkill && (!r.shoveOnly || isShove)).map(r => ({
    id: `rightHands-${r.actor.id}`, label: r.actor.name, shiftUp: 1, shiftDown: 0, edge: false, snag: false,
  }));
}

/** Body Armor Segment: "+2 deflective bonus to both Toughness and Evasion" for the wearer and the Cybertronian. */
export function rightHandsDefense(actor, defense) {
  if (!['toughness', 'evasion'].includes(defense)) {
    return 0;
  }

  const own = actor?.flags?.essence20?.rightHands;
  const mine = own?.kind == 'bodyArmor' && own.wielder && actor.system?.isTransformed ? 2 : 0;
  const worn = rightHandsFor(actor).some(r => r.kind == 'bodyArmor') ? 2 : 0;
  return Math.max(mine, worn);
}

/** Handheld Shield: "Impose Snag on first attack targeting wielder each turn." */
export function rightHandsShieldSnag(target) {
  if (!rightHandsFor(target).some(r => r.shield)) {
    return false;
  }

  const combat = game?.combat;
  const used = target.flags?.essence20?.rightHandsShieldUsed;
  return !combat || !used || used.combatId != combat.id || used.round != combat.round || used.turn != combat.turn;
}

export async function markRightHandsShield(target) {
  const combat = game?.combat;
  if (combat) {
    const { needsGmRelay, relayToGm } = await import("./gm-relay.mjs");
    const value = { combatId: combat.id, round: combat.round, turn: combat.turn };
    if (needsGmRelay(target)) {
      await relayToGm(target, 'setFlag', ['essence20', 'rightHandsShieldUsed', value]);
    } else {
      await target.setFlag('essence20', 'rightHandsShieldUsed', value);
    }
  }
}

/* -------------------------------------------- */
/*  Zords: Carrier, Spirit's Host, the Guardians */
/* -------------------------------------------- */

/**
 * Carrier: "Contains a metaphysical space that holds up to five Vehicular Scale Zords and their Crew
 * inside itself; carried Zords may not be harmed until released as an action • Automatically releases
 * all carried Zords upon reaching 0 Health". A Zord listed on a Carrier's sheet is carried.
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

/**
 * Spirit's Host: "At the start of your turn, you must succeed on a DIF 10 Persuasion Skill Test, or the
 * creature takes control of the Zord for this round. Roll a d4 ... 1 It moves half the Zord's speed in a
 * random direction. 2 It makes a melee attack against a creature. 3 It makes a ranged attack against a
 * creature. 4 It Lends Assistance to another creature."
 */
export async function onSpiritsHostTurn(actor) {
  const zords = actor?.type == 'zord' ? [actor] : Object.values(actor?.system?.actors ?? {})
    .map(e => globalThis.fromUuidSync?.(e?.uuid)).filter(z => z?.type == 'zord');
  const host = zords.find(z => has(z, TEAM.spiritsHost));
  const pilot = actor?.type == 'zord' ? null : actor;
  if (!host || !pilot?.isOwner) {
    return;
  }

  const { rollTest } = await import("./grants.mjs");
  const { success } = await rollTest(pilot, 'persuasion', 10);
  if (success) {
    return;
  }

  const roll = await new Roll('1d4').evaluate();
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: host }), content: T('E20.SpiritsHostTakes', { zord: host.name, action: T(`E20.SpiritsHostAction.${roll.total}`) }) });
}

/**
 * Rally Guardians Feature (Guardian of Eltar 6, 10, 14, 17): "Your company of Guardians gains Zord
 * Features at the Levels indicated ... it cannot take the Combiner or Zord-Mega Weapon System Zord
 * Features nor any feature that has Combiner as a prerequisite."
 */
async function rallyGuardiansFeatures(actor, item) {
  const { companionsOf } = await import("./companion-link.mjs");
  const company = companionsOf(actor).find(a => a.flags?.essence20?.guardians);
  if (!company) {
    ui.notifications.warn(T('E20.GuardianCompanyNone'));
    return null;
  }

  const due = [6, 10, 14, 17].filter(l => (Number(actor.system?.level) || 1) >= l).length;
  const taken = Number(item.flags?.essence20?.guardianFeatures) || 0;
  if (taken >= due) {
    ui.notifications.info(T('E20.GrantAlready'));
    return null;
  }

  const { pickAndGrant } = await import("./grants.mjs");
  const got = await pickAndGrant(company, item, item.name, {
    type: 'feature', matches: e => !/combiner|mega weapon/i.test(`${e.name} ${e.system?.prerequisite ?? ''}`),
  });
  if (got) {
    await item.setFlag('essence20', 'guardianFeatures', taken + 1);
  }

  return got ? T('E20.GrantGained', { name: company.name, item: item.name, what: got.name }) : null;
}

async function spiritsHost(actor, item) {
  if (item.flags?.essence20?.granted) {
    ui.notifications.info(T('E20.GrantAlready'));
    return null;
  }

  // "Your Zord gains a Essence Smarts Score of 3 and Social Essence of 1."
  await actor.update({ 'system.essences.smarts.value': 3, 'system.essences.social.value': 1 });
  await item.setFlag('essence20', 'granted', true);
  return T('E20.SpiritsHostSet', { zord: actor.name });
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

const HANDLERS = { teamPlayer, renegadeCommander, tryMe, letsBringEmTogether, inTheRightHands, rallyGuardiansFeatures, spiritsHost };

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
