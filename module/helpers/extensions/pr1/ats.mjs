/**
 * Across the Stars (Power Rangers) items for the pr1 slice.
 *
 * - Be an Example (Noble Blood Origin, p.40): "You can spend a Free action to reflect on your
 *   training and traditions to gain ↑1 to the skill you chose to increase or advance as part of this
 *   Origin." A Use button (Free action) banks ↑1 on system.originSkillsIncrease for the next test.
 * - Can't Catch Me! (Origin, p.40): "As long as you are aware of an effect targeting you, you gain +1
 *   to your Evasion." The +1 is the Perk's own Active Effect (now on); an attack the defender can't
 *   be aware of (asleep, Mesmerized, or an Invisible attacker) takes it back off.
 * - Clawed Armor (Battlizer, p.85): "The internal sensors grant the wearer Edge on all Alertness Skill
 *   Tests. The anchoring boots... impose a Snag on all attempts to grapple, push, or forcefully move
 *   the wearer." (The -5ft is the item's own Active Effect.)
 * - Destiny, Hang-Up (p.45): "Once per scene, the GM can spend 1 Story Point to turn a regular
 *   failure of yours on a Skill Test into a Fumble." A GM-only button on a failed roll card.
 * - Lightspeed Boost, Zord Feature (p.103): "Increase its Health by 2 [Active Effect] and choose one of
 *   the following": Aeronautic (Aerial 40ft, +2 Evasion while in flight), Aquatic (Aquatic 40ft, +2
 *   Evasion while submerged), HAZMAT (Resistance to two or Immunity to one of Acid, Cold, Electricity,
 *   Poison, Sonic), Medical (+10ft to existing Movement, ↑2 on Science/Technology first aid or repair
 *   by the Zord or its crew), Pyrotechnic (Immunity to Fire; a Standard action extinguishes a 20x20ft
 *   area). "In flight"/"submerged" read the Zord token's elevation (above/below 0).
 * - Lightspeed Rescue Injector (p.78): "Adds ↑1 to Science (Medicine)" while carried.
 * - Nemesis (Specific Threat) (p.70) - the half helpers/nemesis.mjs leaves open: "Once per scene
 *   involving your Nemesis, you may reroll a Skill Test and choose which results to keep." A button
 *   on the roll card rerolls it and shows both results against every Difficulty.
 * - Phantom Ranger Prime (p.62) - the last bullet: "Edge on Skill Tests when using a Grid Power"
 *   while Morphed. Automatic for a Grid Power's own attack roll; a checkbox otherwise.
 * - Power Flux, Zord Feature (p.103): "After any scene involving your Zord, the piloting Power Ranger
 *   and any Power Rangers or characters possessing Personal Power in the Crew Compartment regain up
 *   to 6 Personal Power each." On the GM's "new scene", for Zords with a token in the scene.
 * - Power Wing (Battlizer, p.86): "increases the Ranger's current and maximum Personal Power Pool by
 *   2" while bonded (equipped). (The Defense bonus and 40ft Aerial are the item's own data/effect.)
 * - S.W.A.T. Upgrade, Zord Feature (p.104): Armor Up! +2 plating (Active Effect); Drop It! "The pilot
 *   may use Intimidation and Persuasion Skills through the Zord's loudspeakers, gaining Edge";
 *   Incapacitation Ammo "an alternate firing mode for any ranged attacks, changing the effect to Stun
 *   with a numerical effect 1 higher than the damage dealt"; Incarceration Protocols "answers its Call
 *   to Action with 6 containment cards... any enemy Defeated by your Zord's attacks is automatically
 *   digitally detained if there are vacant containment cards" (6 per scene here).
 * - Stand Behind Me! (Gold Ranger, p.53): "force all enemies within 60 feet to make you the target of
 *   their attacks unless they succeed on a DIF 14 Alertness Skill Test." helpers/banked-buffs.mjs
 *   spends the Power and marks the taunt; here each enemy within 60ft gets a DIF 14 Alertness button
 *   at the start of its turn, and one that failed can't attack anyone else.
 * - Tactical Size Shift, Zord Feature (p.104): "Increase Size Class by 1 category (maximum of
 *   Towering) and gain 2 Health, 1 Strength Essence (and the associated Skill Rank of your choice)" or
 *   "Decrease Size Class by 1 category (minimum of Long) and gain +10 feet of Movement, 1 Speed
 *   Essence (and the associated Skill Rank of your choice)... future choices of this Zord Feature can
 *   only be in the same direction."
 * - Warzord, Zord Feature (p.104): Titanic Size; +3 Health, +3 Strength, Edge on Initiative (Active
 *   Effects); "All the Zord's Might or Finesse-based attacks increase their base damage by 1"; a
 *   Combiner Warzord "must now spend 1 Story Point per Zord combining with it" (a reminder when it
 *   joins a Megaform).
 * - Xeno-Location Study (p.71): "Edge on Animal Handling, Deception, Insight, Persuasion, and Survival
 *   Skill Tests when in the chosen location or interacting with people from it" - a checkbox (the
 *   Culture half is dice.mjs's). This system has no Insight skill.
 */
import {
  registerApplyDialog, registerAfterDamage, registerChatButton, registerChatDecorator, registerDefenseAdjust,
  registerDerived, registerDialogToggles, registerHitRider, registerRollSources, registerSceneAdvanced,
  registerTurnStart, registerUse, registerPreRoll,
} from "../../extensions.mjs";
import { getSceneEpoch, getUses, markUsed } from "../../scene-clock.mjs";
import { worldActors } from "../../companion-link.mjs";
import {
  PR1, T, allSourced, crewOf, equipped, feetBetween, findSourced, flagOf, giveEdge, has, isEnemyOf,
  isItem, isRanged, kept, num, pending, postLine, seatsOf, setPending, tokenOf, writeDoc,
} from "./common.mjs";

const pushTo = (list, entry) => {
  list.push({ shiftUp: 0, shiftDown: 0, edge: false, snag: false, ...entry });
};

/* -------------------------------------------- */
/*  Be an Example                                */
/* -------------------------------------------- */

const EXAMPLE_FLAG = 'pr1BeAnExample';

export function originSkillOf(actor) {
  const skill = actor?.system?.originSkillsIncrease;
  return skill && actor.system?.skills?.[skill] ? skill : null;
}

registerUse({
  id: 'pr1-be-an-example',
  matches: item => isItem(item, PR1.beAnExample),
  canUse: item => !flagOf(item.parent, EXAMPLE_FLAG),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    let skill = originSkillOf(actor);
    if (!skill) {
      const { chooseSelect } = await import("../../grants.mjs");
      skill = await chooseSelect(item.name, T('Pr1BeAnExamplePick'), Object.keys(actor.system?.skills ?? {})
        .filter(key => CONFIG.E20?.skills?.[key])
        .map(key => ({ value: key, label: game.i18n.localize(CONFIG.E20.skills[key]) })));
    }

    if (!skill || !(await pay('free'))) {
      return null;
    }

    await actor.setFlag('essence20', EXAMPLE_FLAG, { skill });
    return T('Pr1BeAnExampleLine', { name: actor.name, skill: game.i18n.localize(CONFIG.E20?.skills?.[skill] ?? skill) });
  },
});

/* -------------------------------------------- */
/*  Can't Catch Me!                              */
/* -------------------------------------------- */

const UNAWARE = ['asleep', 'mesmerized', 'unconscious', 'defeated'];

export function cantCatchMeAdjust(attacker, defender, defenseType) {
  if (defenseType != 'evasion' || !has(defender, PR1.cantCatchMe)) {
    return 0;
  }

  const unaware = UNAWARE.some(s => defender.statuses?.has?.(s)) || attacker?.statuses?.has?.('invisible');
  return unaware ? -1 : 0;
}

/* -------------------------------------------- */
/*  Clawed Armor                                 */
/* -------------------------------------------- */

const MOVING = ['grapple', 'maneuver', 'knocProne'];
const MOVING_TRAITS = ['grapple', 'shove', 'trip'];

export function isForcedMoveAttempt(actor, item, isShove) {
  if (isShove) {
    return true;
  }

  if (item?.type != 'weaponEffect') {
    return false;
  }

  const parentId = item.flags?.essence20?.parentId;
  const traits = parentId ? actor?.items?.get?.(parentId)?.system?.traits ?? [] : [];
  return MOVING.includes(item.system?.damageType) || traits.some(t => MOVING_TRAITS.includes(t));
}

/* -------------------------------------------- */
/*  Destiny Hang-Up                              */
/* -------------------------------------------- */

const DESTINY_FLAG = 'pr1DestinyFumble';

function addButton(element, key, label, data = {}) {
  const container = element?.querySelector?.('.message-content') ?? element;
  if (!container || element.querySelector?.(`[data-e20-ext="${key}"]`)) {
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'e20-chat-action-button';
  button.dataset.e20Ext = key;
  for (const [name, value] of Object.entries(data)) {
    button.dataset[name] = value;
  }

  button.textContent = label;
  container.appendChild(button);
}

const speakerOf = message => (message?.speaker ? ChatMessage.getSpeakerActor?.(message.speaker) : null);

export function destinyOffer(message, actor, isGM) {
  const flags = message?.flags?.essence20 ?? {};
  return !!isGM && !!actor && has(actor, PR1.destinyHangUp) && flags.rollFailed === true && !flags.isFumble
    && !flags.pr1DestinyFumbled && !getUses(actor, DESTINY_FLAG, 'scene');
}

registerChatButton('pr1DestinyFumble', async (message) => {
  const actor = speakerOf(message);
  if (!destinyOffer(message, actor, game.user?.isGM)) {
    return;
  }

  const { getGmPoints, requestStoryPointSpend, requestStoryPointGrant } = await import("../../story-points.mjs");
  if (getGmPoints() < 1) {
    ui.notifications.warn(T('Pr1DestinyNoPoints'));
    return;
  }

  await requestStoryPointSpend(null, 1, { pool: 'gm', announce: false });
  await markUsed(actor, DESTINY_FLAG, { window: 'scene' });
  await message.setFlag('essence20', 'pr1DestinyFumbled', true);
  // A Fumble is a failure that also "gains a Story Point" for the team (core rule, PR CRB p.91).
  await requestStoryPointGrant(actor);
  await postLine(actor, T('Pr1DestinyLine', { name: actor.name }));
});

/* -------------------------------------------- */
/*  Nemesis (Specific Threat) - the reroll       */
/* -------------------------------------------- */

const NEMESIS_REROLL = 'pr1NemesisReroll';

export function nemesisInvolved(actor, message) {
  const nemesis = actor?.getFlag?.('essence20', 'nemesisUuid');
  if (!nemesis || !has(actor, PR1.nemesis)) {
    return false;
  }

  const targeted = (message?.flags?.essence20?.checkResults ?? []).some(r => r?.targetUuid && r.targetUuid == nemesis);
  const present = (globalThis.canvas?.tokens?.placeables ?? []).some(token => token.actor?.uuid && token.actor.uuid == nemesis);
  return targeted || present;
}

/** Which Difficulties a total meets. */
export function outcomesFor(total, checkResults = []) {
  return checkResults.map(entry => ({ ...entry, success: Number.isFinite(entry?.difficulty) ? total >= entry.difficulty : null }));
}

registerChatButton(NEMESIS_REROLL, async (message) => {
  const actor = speakerOf(message);
  if (!actor || !nemesisInvolved(actor, message) || getUses(actor, NEMESIS_REROLL, 'scene') || !message.rolls?.[0]) {
    return;
  }

  await markUsed(actor, NEMESIS_REROLL, { window: 'scene' });
  const roll = await new Roll(message.rolls[0].formula).evaluate();
  const outcomes = outcomesFor(roll.total, message.flags?.essence20?.checkResults ?? []);
  const lines = outcomes.map(o => {
    const name = o.targetUuid ? (globalThis.fromUuidSync?.(o.targetUuid)?.name ?? '?') : T('Pr1Difficulty');
    return `<li>${name} (${o.difficulty}): ${o.success ? T('Pr1Success') : T('Pr1Failure')}</li>`;
  }).join('');
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `${T('Pr1NemesisFlavor', { name: actor.name, old: message.rolls[0].total, total: roll.total })}${lines ? `<ul>${lines}</ul>` : ''}`,
  });
});

registerChatDecorator((message, element) => {
  const actor = speakerOf(message);
  if (!actor || !message?.rolls?.length || !message.flags?.essence20) {
    return;
  }

  if (destinyOffer(message, actor, game.user?.isGM)) {
    addButton(element, 'pr1DestinyFumble', T('Pr1DestinyButton'));
  }

  if ((actor.isOwner || game.user?.isGM) && !message.flags.essence20.pr1NemesisReroll
    && !getUses(actor, NEMESIS_REROLL, 'scene') && nemesisInvolved(actor, message)) {
    addButton(element, NEMESIS_REROLL, T('Pr1NemesisButton'));
  }
});

/* -------------------------------------------- */
/*  Lightspeed Boost                             */
/* -------------------------------------------- */

const LIGHTSPEED_FLAG = 'pr1LightspeedBoost';
export const LIGHTSPEED_OPTIONS = ['aeronautic', 'aquatic', 'hazmat', 'medical', 'pyrotechnic'];
const HAZMAT_TYPES = ['acid', 'cold', 'electric', 'poison', 'sonic'];

export const lightspeedOf = zord => allSourced(zord, PR1.lightspeedBoost).map(f => flagOf(f, LIGHTSPEED_FLAG)).filter(Boolean);

async function pickLightspeed(feature) {
  const { chooseSelect, chooseButtons } = await import("../../grants.mjs");
  const option = await chooseSelect(feature.name, T('Pr1LightspeedPick'),
    LIGHTSPEED_OPTIONS.map(value => ({ value, label: T(`Pr1Lightspeed.${value}`) })));
  if (!option) {
    return null;
  }

  const choice = { option };
  if (option == 'hazmat') {
    const label = t => game.i18n.localize(CONFIG.E20?.damageTypes?.[t] ?? t);
    const how = await chooseButtons(feature.name, T('Pr1HazmatHow'), [['resist', T('Pr1HazmatResist')], ['immune', T('Pr1HazmatImmune')]]);
    if (!how) {
      return null;
    }

    const types = [];
    for (let i = 0; i < (how == 'resist' ? 2 : 1); i++) {
      const type = await chooseSelect(feature.name, T('Pr1HazmatType'),
        HAZMAT_TYPES.filter(t => !types.includes(t)).map(value => ({ value, label: label(value) })));
      if (!type) {
        return null;
      }

      types.push(type);
    }

    Object.assign(choice, { how, types });
  }

  await feature.setFlag('essence20', LIGHTSPEED_FLAG, choice);
  return T('Pr1LightspeedChosen', { name: feature.parent?.name ?? '', option: T(`Pr1Lightspeed.${option}`) });
}

export function lightspeedDerived(actor) {
  const system = actor?.system;
  if (actor?.type != 'zord' || !system) {
    return;
  }

  for (const choice of lightspeedOf(actor)) {
    const movement = system.movement ?? {};
    switch (choice.option) {
    case 'aeronautic':
      if (movement.aerial) movement.aerial.total = Math.max(num(movement.aerial.total), 40);
      break;
    case 'aquatic':
      if (movement.swim) movement.swim.total = Math.max(num(movement.swim.total), 40);
      break;
    case 'hazmat':
      for (const type of choice.types ?? []) {
        const bucket = choice.how == 'immune' ? system.immunities : system.resistances;
        if (bucket && type in bucket) bucket[type] = true;
      }

      break;
    case 'medical':
      for (const entry of Object.values(movement)) {
        if (entry && num(entry.total) > 0) entry.total = num(entry.total) + 10;
      }

      break;
    case 'pyrotechnic':
      if (system.immunities) system.immunities.fire = true;
      break;
    }
  }
}

export function elevationOf(actor) {
  const doc = tokenOf(actor)?.document;
  return num(doc?.elevation);
}

export function lightspeedDefenseAdjust(defender, defenseType) {
  if (defenseType != 'evasion' || defender?.type != 'zord') {
    return 0;
  }

  const options = lightspeedOf(defender).map(c => c.option);
  const elevation = elevationOf(defender);
  if ((options.includes('aeronautic') && elevation > 0) || (options.includes('aquatic') && elevation < 0)) {
    return 2;
  }

  return 0;
}

registerUse({
  id: 'pr1-lightspeed-boost',
  matches: item => isItem(item, PR1.lightspeedBoost),
  canUse: item => !flagOf(item, LIGHTSPEED_FLAG) || flagOf(item, LIGHTSPEED_FLAG)?.option == 'pyrotechnic',
  run: async (item, economy, pay) => {
    if (!flagOf(item, LIGHTSPEED_FLAG)) {
      return pickLightspeed(item);
    }

    // Pyrotechnic: "can use a Standard action to extinguish a 20 foot × 20 foot area of burning
    // targets or materials automatically."
    if (!(await pay('standard'))) {
      return null;
    }

    return T('Pr1PyrotechnicLine', { name: item.parent?.name ?? '' });
  },
});

/* -------------------------------------------- */
/*  Power Flux                                   */
/* -------------------------------------------- */

export function powerFluxGains(zord) {
  return crewOf(zord).map(({ actor }) => {
    const personal = actor.system?.powers?.personal;
    const max = num(personal?.max);
    const gain = max > 0 ? Math.max(0, Math.min(6, max - num(personal.value))) : 0;
    return { actor, gain };
  }).filter(entry => entry.gain > 0);
}

registerSceneAdvanced(async () => {
  if (!game.user?.isGM) {
    return;
  }

  for (const zord of worldActors()) {
    if (zord?.type != 'zord' || !has(zord, PR1.powerFlux) || !(zord.getActiveTokens?.() ?? []).length) {
      continue;
    }

    for (const { actor, gain } of powerFluxGains(zord)) {
      await actor.update({ 'system.powers.personal.value': num(actor.system.powers.personal.value) + gain });
      await postLine(actor, T('Pr1PowerFluxLine', { name: actor.name, zord: zord.name, n: gain }));
    }
  }
});

/* -------------------------------------------- */
/*  Power Wing                                   */
/* -------------------------------------------- */

export function powerWingDerived(actor) {
  const personal = actor?.system?.powers?.personal;
  if (personal && equipped(actor, PR1.powerWing)) {
    personal.max = num(personal.max) + 2;
  }
}

globalThis.Hooks?.on?.('updateItem', async (item, changes, options, userId) => {
  if (userId != globalThis.game?.user?.id || !isItem(item, PR1.powerWing) || changes?.system?.equipped === undefined) {
    return;
  }

  const actor = item.parent;
  const personal = actor?.system?.powers?.personal;
  if (!personal) {
    return;
  }

  const value = num(personal.value);
  await actor.update({ 'system.powers.personal.value': changes.system.equipped ? value + 2 : Math.max(0, value - 2) });
});

/* -------------------------------------------- */
/*  S.W.A.T. Upgrade                             */
/* -------------------------------------------- */

const SWAT_CARDS = 'pr1SwatCards';
const SWAT_LAST = 'pr1SwatLastTarget';

export function swatCards(zord) {
  const record = flagOf(zord, SWAT_CARDS);
  return record?.scene == getSceneEpoch() ? num(record.left) : 6;
}

export function swatPilotZord(actor) {
  return seatsOf(actor).find(({ vehicle, role }) => role == 'driver' && has(vehicle, PR1.swatUpgrade))?.vehicle ?? null;
}

registerAfterDamage(async (actor, dealt, damageType, { newValue, wasAlreadyDefeated } = {}) => {
  if (wasAlreadyDefeated || num(newValue) > 0 || !actor?.uuid) {
    return;
  }

  const zord = worldActors().find(z => z?.type == 'zord' && has(z, PR1.swatUpgrade) && flagOf(z, SWAT_LAST) == actor.uuid);
  // "any ENEMY Defeated by your Zord's attacks" - when both are on the canvas, check the sides.
  if (!zord || (tokenOf(zord) && tokenOf(actor) && !isEnemyOf(zord, actor))) {
    return;
  }

  const left = swatCards(zord);
  await writeDoc(zord, 'unsetFlag', 'essence20', SWAT_LAST);
  if (left < 1) {
    return;
  }

  await writeDoc(zord, 'setFlag', 'essence20', SWAT_CARDS, { scene: getSceneEpoch(), left: left - 1 });
  await postLine(zord, T('Pr1SwatDetained', { name: actor.name, zord: zord.name, n: left - 1 }));
});

/* -------------------------------------------- */
/*  Stand Behind Me!                             */
/* -------------------------------------------- */

const TAUNT_FLAG = 'standBehindMeActive';
const TAUNTED_FLAG = 'pr1Taunted';

export function tauntLive(record) {
  const combat = game.combat;
  return !!record && !!combat && record.combatId == combat.id && combat.round - num(record.round) <= 1;
}

export function tauntersNear(actor) {
  return worldActors().filter(other => other?.uuid != actor?.uuid && has(other, PR1.standBehindMe)
    && tauntLive(flagOf(other, TAUNT_FLAG)) && isEnemyOf(other, actor)
    && (feetBetween(other, actor) ?? Infinity) <= 60);
}

registerTurnStart(async (actor) => {
  const record = flagOf(actor, TAUNTED_FLAG);
  for (const taunter of tauntersNear(actor)) {
    if (record?.by == taunter.uuid && tauntLive(record)) {
      continue;
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: taunter }),
      whisper: game.users?.filter?.(u => u.isGM).map(u => u.id) ?? [],
      content: `<p>${T('Pr1TauntCard', { name: actor.name, taunter: taunter.name })}</p>`
        + `<button type="button" class="e20-chat-action-button" data-e20-ext="pr1TauntTest" data-actor="${actor.uuid}" data-taunter="${taunter.uuid}">${T('Pr1TauntButton')}</button>`,
    });
  }
});

registerChatButton('pr1TauntTest', async (message, button) => {
  const actor = await fromUuid(button.dataset.actor);
  const taunter = await fromUuid(button.dataset.taunter);
  if (!actor || !taunter || button.dataset.done) {
    return;
  }

  button.dataset.done = '1';
  button.disabled = true;
  const { rollTest } = await import("../../grants.mjs");
  const { success } = await rollTest(actor, 'alertness', 14);
  const combat = game.combat;
  await writeDoc(actor, 'setFlag', 'essence20', TAUNTED_FLAG, {
    by: taunter.uuid, combatId: combat?.id ?? null, round: combat?.round ?? 0, resisted: success,
  });
  await postLine(actor, T(success ? 'Pr1TauntResisted' : 'Pr1TauntForced', { name: actor.name, taunter: taunter.name }));
});

/** An attack by a creature forced to target the taunter, at someone else. */
export function tauntBlocks(actor, item, targets) {
  const record = flagOf(actor, TAUNTED_FLAG);
  if (item?.type != 'weaponEffect' || !record || record.resisted || !tauntLive(record)) {
    return null;
  }

  const taunter = globalThis.fromUuidSync?.(record.by);
  if (!taunter || !tauntLive(flagOf(taunter, TAUNT_FLAG))) {
    return null;
  }

  return targets.length && targets.every(t => t?.uuid == taunter.uuid) ? null : taunter;
}

registerPreRoll((actor, dataset, item) => {
  const targets = [...(game.user?.targets ?? [])].map(token => token.actor).filter(Boolean);
  const taunter = tauntBlocks(actor, item, targets);
  if (taunter) {
    ui.notifications.warn(T('Pr1TauntBlocked', { name: actor.name, taunter: taunter.name }));
    dataset.cancelRoll = true;
  }
});

/* -------------------------------------------- */
/*  Tactical Size Shift                          */
/* -------------------------------------------- */

const SIZE_FLAG = 'pr1SizeShift';

export function sizeShiftDirection(zord) {
  return allSourced(zord, PR1.tacticalSizeShift).map(f => flagOf(f, SIZE_FLAG)?.direction).find(Boolean) ?? null;
}

export function shiftedSize(size, steps) {
  const sizes = Object.keys(CONFIG.E20?.actorSizes ?? {});
  const index = sizes.indexOf(size);
  if (index < 0 || !steps) {
    return size;
  }

  const min = sizes.indexOf('long');
  const max = sizes.indexOf('towering');
  const target = index + steps;
  // Never past the printed limits - and never back across them for a Zord already beyond one.
  const clamped = steps > 0 ? Math.min(target, Math.max(max, index)) : Math.max(target, Math.min(min, index));
  return sizes[clamped] ?? size;
}

async function pickSizeShift(feature) {
  const zord = feature.parent;
  const { chooseButtons, chooseSelect } = await import("../../grants.mjs");
  const locked = allSourced(zord, PR1.tacticalSizeShift).filter(f => f.id != feature.id).map(f => flagOf(f, SIZE_FLAG)?.direction).find(Boolean);
  const direction = locked ?? await chooseButtons(feature.name, T('Pr1SizeShiftPick'), [['larger', T('Pr1SizeShiftLarger')], ['smaller', T('Pr1SizeShiftSmaller')]]);
  if (!direction) {
    return null;
  }

  const essence = direction == 'larger' ? 'strength' : 'speed';
  const skills = (CONFIG.E20?.skillsByEssence?.[essence] ?? []).filter(s => zord.system?.skills?.[s]);
  const skill = await chooseSelect(feature.name, T('Pr1SizeShiftSkill'), skills.map(value => ({ value, label: game.i18n.localize(CONFIG.E20.skills[value]) })));
  if (!skill) {
    return null;
  }

  const changes = [{ key: `system.essences.${essence}.value`, mode: 2, value: '1' }];
  if (direction == 'larger') {
    changes.push({ key: 'system.health.bonus', mode: 2, value: '2' });
  } else {
    for (const [type, movement] of Object.entries(zord.system?.movement ?? {})) {
      if (num(movement?.base) > 0) changes.push({ key: `system.movement.${type}.bonus`, mode: 2, value: '10' });
    }
  }

  await feature.createEmbeddedDocuments('ActiveEffect', [{ name: feature.name, img: 'icons/svg/aura.svg', transfer: true, disabled: false, changes }]);

  // "the associated Skill Rank of your choice" - one step up that skill's die, undone if the Feature goes.
  const list = CONFIG.E20?.skillShiftList ?? [];
  const previous = zord.system.skills[skill].shift;
  const index = list.indexOf(previous);
  const next = index > 0 ? list[Math.max(list.indexOf('d12'), index - 1)] : previous;
  await zord.update({ [`system.skills.${skill}.shift`]: next });
  await feature.setFlag('essence20', SIZE_FLAG, { direction, skill, previous });
  return T('Pr1SizeShiftChosen', { name: zord.name, direction: T(direction == 'larger' ? 'Pr1SizeShiftLarger' : 'Pr1SizeShiftSmaller') });
}

registerUse({
  id: 'pr1-tactical-size-shift',
  matches: item => isItem(item, PR1.tacticalSizeShift) && item.parent?.type == 'zord',
  canUse: item => !flagOf(item, SIZE_FLAG),
  run: item => pickSizeShift(item),
});

globalThis.Hooks?.on?.('deleteItem', async (item, options, userId) => {
  const record = flagOf(item, SIZE_FLAG);
  const zord = item.parent;
  if (userId != globalThis.game?.user?.id || !isItem(item, PR1.tacticalSizeShift) || !record?.skill || !zord?.system?.skills?.[record.skill]) {
    return;
  }

  await zord.update({ [`system.skills.${record.skill}.shift`]: record.previous });
});

export function sizeShiftDerived(actor) {
  if (actor?.type != 'zord' || !actor.system) {
    return;
  }

  const steps = allSourced(actor, PR1.tacticalSizeShift).reduce((n, f) => {
    const direction = flagOf(f, SIZE_FLAG)?.direction;
    return n + (direction == 'larger' ? 1 : direction == 'smaller' ? -1 : 0);
  }, 0);
  if (steps) {
    actor.system.size = shiftedSize(actor.system.size, steps);
  }

  // Warzord: "The Zord is now of Titanic Size."
  if (has(actor, PR1.warzord)) {
    actor.system.size = 'titanic';
  }
}

/* -------------------------------------------- */
/*  Warzord - the Combiner cost                  */
/* -------------------------------------------- */

globalThis.Hooks?.on?.('updateActor', async (actor, changes, options, userId) => {
  if (userId != globalThis.game?.user?.id || actor?.type != 'megaform' || !changes?.system?.actors) {
    return;
  }

  const zords = Object.values(actor.system?.actors ?? {}).map(e => globalThis.fromUuidSync?.(e.uuid)).filter(z => z?.type == 'zord');
  const warzord = zords.find(z => has(z, PR1.warzord) && has(z, PR1.combiner));
  if (!warzord || flagOf(actor, 'pr1WarzordReminded') == getSceneEpoch()) {
    return;
  }

  await actor.setFlag('essence20', 'pr1WarzordReminded', getSceneEpoch());
  await postLine(actor, T('Pr1WarzordCombine', { name: warzord.name, n: Math.max(0, zords.length - 1) }));
});

/* -------------------------------------------- */
/*  Roll sources, dialog, riders                 */
/* -------------------------------------------- */

const XENO_SKILLS = ['animalHandling', 'deception', 'persuasion', 'survival'];

export function atsSources(actor, target, ctx = {}) {
  const sources = [];
  const { rolledSkill, item } = ctx;

  const example = flagOf(actor, EXAMPLE_FLAG);
  if (example?.skill && example.skill == rolledSkill) {
    pushTo(sources, { id: 'pr1BeAnExample', label: findSourced(actor, PR1.beAnExample)?.name ?? 'Be an Example', shiftUp: 1 });
  }

  if (rolledSkill == 'alertness' && equipped(actor, PR1.clawedArmor)) {
    pushTo(sources, { id: 'pr1ClawedArmor', label: equipped(actor, PR1.clawedArmor).name, edge: true });
  }

  if (target && equipped(target, PR1.clawedArmor) && isForcedMoveAttempt(actor, item, ctx.isShove)) {
    pushTo(sources, { id: 'pr1ClawedAnchor', label: equipped(target, PR1.clawedArmor).name, snag: true });
  }

  if (rolledSkill == 'science' && equipped(actor, PR1.rescueInjector)) {
    pushTo(sources, { id: 'pr1RescueInjector', label: T('Pr1RescueInjectorLabel', { name: equipped(actor, PR1.rescueInjector).name }), shiftUp: 1 });
  }

  // Phantom Ranger Prime - a Grid Power's own attack.
  if (actor?.system?.isMorphed && has(actor, PR1.phantomRangerPrime) && item?.type == 'power' && (item.system?.type ?? 'grid') == 'grid') {
    pushTo(sources, { id: 'pr1PhantomPrime', label: findSourced(actor, PR1.phantomRangerPrime).name, edge: true });
  }

  // Lightspeed Boost (Medical): the Zord itself, or anyone seated in it.
  if (['science', 'technology'].includes(rolledSkill)) {
    const zord = actor?.type == 'zord' ? actor : seatsOf(actor).map(s => s.vehicle).find(v => lightspeedOf(v).some(c => c.option == 'medical'));
    if (zord && lightspeedOf(zord).some(c => c.option == 'medical')) {
      pushTo(sources, { id: 'pr1LightspeedMedical', label: T('Pr1LightspeedMedicalLabel'), shiftUp: 2 });
    }
  }

  return sources;
}

registerRollSources((actor, target, ctx) => ({ sources: atsSources(actor, target, ctx) }));

registerDefenseAdjust((attacker, defender, defenseType) => cantCatchMeAdjust(attacker, defender, defenseType)
  + lightspeedDefenseAdjust(defender, defenseType));

registerDialogToggles((actor, { item, rolledSkill } = {}) => {
  const toggles = [];
  if (actor?.system?.isMorphed && has(actor, PR1.phantomRangerPrime) && item?.type != 'power') {
    toggles.push({ name: 'pr1PhantomGrid', label: T('Pr1PhantomGridToggle'), type: 'checkbox', value: false });
  }

  if (has(actor, PR1.xenoLocationStudy) && XENO_SKILLS.includes(rolledSkill)) {
    toggles.push({ name: 'pr1Xeno', label: T('Pr1XenoToggle'), type: 'checkbox', value: false });
  }

  if (['intimidation', 'persuasion'].includes(rolledSkill) && swatPilotZord(actor)) {
    toggles.push({ name: 'pr1SwatLoudspeaker', label: T('Pr1SwatLoudspeakerToggle'), type: 'checkbox', value: true });
  }

  if (actor?.type == 'zord' && has(actor, PR1.swatUpgrade) && isRanged(item)) {
    toggles.push({ name: 'pr1SwatStun', label: T('Pr1SwatStunToggle'), type: 'checkbox', value: false });
  }

  return toggles;
});

registerApplyDialog(async (actor, options) => {
  const ext = options.ext ?? {};
  if (ext.pr1PhantomGrid || ext.pr1Xeno || ext.pr1SwatLoudspeaker) {
    giveEdge(options);
  }

  if (ext.pr1SwatStun) {
    setPending(actor, { swatStun: true });
  }
});

registerApplyDialog(async (actor, options, ctx = {}) => {
  const example = flagOf(actor, EXAMPLE_FLAG);
  if (example?.skill && example.skill == ctx.rolledSkill && kept(options, 'pr1BeAnExample')) {
    await actor.unsetFlag('essence20', EXAMPLE_FLAG);
  }
});

registerHitRider(async (actor, target, result, rider, tools) => {
  const effect = rider?.itemUuid ? globalThis.fromUuidSync?.(rider.itemUuid) : null;

  // Warzord: "All the Zord's Might or Finesse-based attacks increase their base damage by 1."
  if (actor?.type == 'zord' && has(actor, PR1.warzord) && result?.damageValue
    && ['might', 'finesse'].includes(effect?.system?.classification?.skill)) {
    tools.damageBonusNote(result, 1, findSourced(actor, PR1.warzord).name);
  }

  // Incapacitation Ammo: Stun, one higher than the damage.
  if (pending(actor).swatStun && result?.damageValue) {
    tools.addRiderOption(result, { key: 'pr1SwatStun', label: T('Pr1SwatStunApply'), damageValue: num(result.damageValue) + 1, damageType: 'stun' });
  }

  // Incarceration Protocols: remember who the Zord just hit.
  if (actor?.type == 'zord' && has(actor, PR1.swatUpgrade) && target?.uuid) {
    await writeDoc(actor, 'setFlag', 'essence20', SWAT_LAST, target.uuid);
  }
});

registerDerived(actor => {
  lightspeedDerived(actor);
  powerWingDerived(actor);
  sizeShiftDerived(actor);
});

// A Feature that needs a choice asks for it the moment it lands on a Zord, for whoever dropped it.
globalThis.Hooks?.on?.('createItem', async (item, options, userId) => {
  if (userId != globalThis.game?.user?.id || item.parent?.type != 'zord') {
    return;
  }

  let line = null;
  if (isItem(item, PR1.lightspeedBoost) && !flagOf(item, LIGHTSPEED_FLAG)) {
    line = await pickLightspeed(item);
  } else if (isItem(item, PR1.tacticalSizeShift) && !flagOf(item, SIZE_FLAG)) {
    line = await pickSizeShift(item);
  }

  if (line) {
    await postLine(item.parent, line);
  }
});

