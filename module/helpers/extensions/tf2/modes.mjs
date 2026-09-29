/**
 * The tf2 slice's reactions to things happening: derived data, chat cards with buttons, token
 * movement, Alt Modes arriving, and a few end-of-roll follow-ups.
 *
 * - Charger / Pillar / Speaker Alt Modes (Enigma of Combination, Origins, p.26-28): "Special Attack:
 *   Flyby (Driving) or Ram (Driving): Driving Skill, Reach (2 Blunt damage), Trip alternate effect"
 *   (Charger), "Special Attack: Ram (Driving): Driving Skill, Reach (1 Blunt damage), Trip alternate
 *   effect" (Pillar, Speaker). The Core Rulebook's Ram / Flyby weapon (TF CRB p.47) is given with the
 *   Alt Mode; the Charger's hits for 2. The same goes for the other printed special attacks:
 *   - the Core Rulebook's vehicle chassis (p.49-54), "Special Attack: Ram (Driving): Driving Skill,
 *     Range Reach (1 Blunt Damage, Trip)" - 2 Blunt for the Monolith, Flyby for the Seeker;
 *   - Salvaged (Decepticon Directive, p.38), "Spiked Ram: Driving skill, Reach (1 Sharp damage);
 *     Maneuver alternate effect", and the Mini-Con's Mini-Vehicle (p.36), "Ram: Driving skill, Reach
 *     (1 Blunt damage); Maneuver";
 *   - the Technorganic Secrets chassis (p.36-44) and both Monstrosity printings: "Natural Weapon
 *     (Might): Might Skill, Reach (1 Blunt or Sharp damage) Alternate Effect: Maneuver" (Finesse or
 *     Might for the Climber/Nimble), the Flora's Reach x2 one, the Flyer's Natural Weapon Flyby and
 *     the Behemoth's SMASH!. "Blunt or Sharp" and "Finesse or Might" are asked when the weapon arrives.
 * - Mode Lock (Enigma of Combination, p.49): "the character can remove the Condition by performing an
 *   Energon flush, which requires spending 1 Energon and succeeding at a DIF 12 Technology Skill Test
 *   as a Standard action." Conversion itself is already refused (sheet-handlers/transformer-handler.mjs);
 *   the flush is a button on the chat card posted when the Condition lands.
 * - Obscuring Matrix (Enigma of Combination, armor upgrade, p.55): "this bonus is negated while the
 *   wearer has the Grappled, Immobilized, Prone, or Restrained Condition." documents/item.mjs already
 *   negates it for an upgrade fitted to armor; a Cybertronian's loose (chassis) upgrade is added by
 *   documents/actor.mjs and is taken back off here.
 * - Roller Drum (p.56): "Combined Mode: You add +1 Health to your part of a combined form's Health
 *   array."
 * - Bullbar (TF CRB p.134): "Bot Mode: You're immune to effects that would shove you." Read by
 *   helpers/forced-movement.mjs (see the tf2 patch spec) off system.tf2ShoveImmune.
 * - Dust Up (Racer, 20th level, p.86): "when you use your Move action to move, you gain the benefits
 *   of Concealment until the beginning of your next turn." This system's Concealment is the Cover
 *   status (dice.mjs: "Smoke and a wall are both Cover here").
 * - For The Allspark! Roll Out (p.56): "When you roll for Initiative, if you are not surprised, you can
 *   choose to convert to your Alt Mode before combat begins without needing to spend an action."
 * - Not Like That, Like This! (Enigma of Combination, 6th level, p.30): "when a teammate within 60
 *   feet rolls a Skill Test, you can ask them to reroll any or all the dice involved, though they must
 *   accept the second result. If you do this, you must attempt a Skill Test using the same Skill that
 *   was re-rolled on your following turn, if possible. If it isn't possible, you lose your Move action
 *   for that turn."
 * - Diversion (TF CRB p.60): whether the diverted creature went for the diverter.
 * - Sustained Beam (Enigma of Combination, weapon upgrade, p.54): "Once per round on a hit, the wielder
 *   may choose to spend 1 Energon Point and a Free action to immediately attack the same target a
 *   second time with Edge".
 * - Scramble Modulator (weapon upgrade, p.53): "When successfully attacking a Combiner form and this
 *   weapon's damage is divided among its components, the component member with the highest current
 *   Health takes 1 additional Sonic damage; if multiple component members tie for the highest, they
 *   each suffer the additional damage".
 * - We Are One! (p.30-31): the chosen team's reroll Active Effects, kept in step with the holder.
 * - Lingering Side Effects (Technorganic Secrets, optional Mutant Beast Hang-Up, p.33): "Mutant Beasts
 *   may not acquire a third Alt Mode via Perks or other means".
 */
import {
  registerChatButton, registerChatDecorator, registerDerived, registerPostRoll, registerTurnEnd, registerTurnStart, registerUse,
} from "../../extensions.mjs";
import { hasUsedThisRound, markUsedThisRound } from "../../perks.mjs";
import {
  ALT_MODES, T, TF2, feetBetween, has, isOwnTurn, isResponsible, itemsOf, nameOf, say, sourceOf, upgradesOn, worldActors,
} from "./common.mjs";
import { MARK, SUSTAINED_BEAM_EDGE, addMarkTo, marksOf } from "./rolls.mjs";
import { WE_ARE_ONE_FLAG } from "./uses.mjs";

const NEGATING = ['grappled', 'immobilized', 'prone', 'restrained'];
const DUST_UP_FLAG = 'tf2DustUp';
const OWED_FLAG = 'tf2NotLikeThatOwed';
const FOLLOW_UP_FLAG = 'tf2SustainedBeamFollowUp';
const WE_ARE_ONE_BY = 'tf2WeAreOneBy';

const escape = text => foundry.utils.escapeHTML(String(text ?? ''));
const energonOf = actor => Number(actor?.system?.energon?.normal?.value) || 0;

function resolve(uuid) {
  try {
    return uuid && typeof fromUuidSync == 'function' ? fromUuidSync(uuid) : null;
  } catch (error) {
    return null;
  }
}

async function payAction(actor, type, source) {
  if (!globalThis.game?.combat) {
    return true;
  }

  const { spend } = await import("../../action-economy.mjs");
  const result = await spend(actor, type, { source });
  return !result?.blocked;
}

function card(actor, text, button = null) {
  const extra = button
    ? `<button type="button" data-e20-ext="${button.key}"${Object.entries(button.data ?? {}).map(([k, v]) => ` data-${k}="${escape(v)}"`).join('')}>${escape(button.label)}</button>`
    : '';
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${text}</p>${extra}` });
}

/* -------------------------------------------- */
/*  Derived data                                 */
/* -------------------------------------------- */

function adjustDefense(system, type, amount, label) {
  const defense = system?.defenses?.[type];
  if (!defense || !amount) {
    return;
  }

  defense.total = (defense.total ?? 0) + amount;
  if (typeof defense.string == 'string') {
    defense.string += ` ${amount < 0 ? '-' : '+'} ${Math.abs(amount)} (${label})`;
  }
}

/** The Evasion a loose Obscuring Matrix gives right now, that the wearer's Conditions negate. */
export function negatedObscuringMatrix(actor) {
  const system = actor?.system;
  const statuses = actor?.statuses;
  if (!system?.canTransform || !statuses?.has || !NEGATING.some(status => statuses.has(status))) {
    return { amount: 0, label: null };
  }

  const matrices = itemsOf(actor).filter(item => item.type == 'upgrade' && item.system?.type == 'armor'
    && !item.flags?.essence20?.parentId && item.system?.armorBonus?.defense == 'evasion'
    && [TF2.obscuringMatrixBasic, TF2.obscuringMatrixAdvanced].includes(sourceOf(item)));
  const amount = matrices.reduce((sum, item) => sum + (Number(item.system.armorBonus.value) || 0), 0);
  return { amount, label: matrices[0]?.name ?? null };
}

const componentsOf = form => Object.values(form?.system?.actors ?? {}).map(entry => resolve(entry?.uuid))
  .filter(member => member && !['zord', 'vehicle', 'megaform'].includes(member.type));
const isCombinerForm = form => form?.type == 'megaform' && !!form.system?.subtype?.includes?.('megaformCombiner');

export function tf2Derived(actor) {
  const system = actor?.system;
  if (!system) {
    return;
  }

  const { amount, label } = negatedObscuringMatrix(actor);
  if (amount) {
    adjustDefense(system, 'evasion', -amount, label);
  }

  system.tf2ShoveImmune = !!(system.canTransform && !system.isTransformed && has(actor, TF2.bullbar));

  if (isCombinerForm(actor)) {
    for (const component of componentsOf(actor).filter(member => has(member, TF2.rollerDrum))) {
      const row = (system.participantHealth ?? []).find(entry => entry.name == component.name);
      if (row) {
        row.max += 1;
        row.value += 1;
      }

      system.combinedHealthMax = (system.combinedHealthMax ?? 0) + 1;
      system.combinedHealthValue = (system.combinedHealthValue ?? 0) + 1;
      if (system.health) {
        system.health.max = (system.health.max ?? 0) + 1;
        system.health.value = (system.health.value ?? 0) + 1;
      }
    }
  }
}

/* -------------------------------------------- */
/*  Alt Modes: special attacks                   */
/* -------------------------------------------- */

// damage: the Blunt hit's value when the chassis prints more than the weapon's own; types / skills: the
// chassis prints a choice ("1 Blunt or Sharp", "Finesse or Might"), asked when the weapon arrives.
const BLUNT_OR_SHARP = ['blunt', 'sharp'];
const FINESSE_OR_MIGHT = ['finesse', 'might'];
const each = (uuids, spec) => Object.fromEntries(uuids.map(uuid => [uuid, spec]));

export const SPECIAL_ATTACKS = {
  [TF2.charger]: { attacks: [TF2.ram, TF2.flyby], damage: 2 },
  [TF2.pillarExtended]: { attacks: [TF2.ram], damage: 1 },
  [TF2.pillarLong]: { attacks: [TF2.ram], damage: 1 },
  [TF2.speakerAerial]: { attacks: [TF2.ram], damage: 1 },
  [TF2.speakerGround]: { attacks: [TF2.ram], damage: 1 },
  [TF2.speakerLongAerial]: { attacks: [TF2.ram], damage: 1 },
  [TF2.speakerLongGround]: { attacks: [TF2.ram], damage: 1 },
  ...each(ALT_MODES.crbRam, { attacks: [TF2.ram], damage: 1 }),
  [ALT_MODES.monolith]: { attacks: [TF2.ram], damage: 2 },
  [ALT_MODES.seeker]: { attacks: [TF2.flyby], damage: 1 },
  [ALT_MODES.salvaged]: { attacks: [TF2.spikedRam] },
  ...each(ALT_MODES.miniVehicle, { attacks: [TF2.miniVehicleRam] }),
  ...each([...ALT_MODES.natural, ...ALT_MODES.monstrosity], { attacks: [TF2.naturalWeapon], types: BLUNT_OR_SHARP }),
  ...each(ALT_MODES.climber, { attacks: [TF2.naturalWeapon], types: BLUNT_OR_SHARP, skills: FINESSE_OR_MIGHT }),
  ...each(ALT_MODES.flora, { attacks: [TF2.floraWeapon], skills: FINESSE_OR_MIGHT }),
  ...each(ALT_MODES.flyer, { attacks: [TF2.naturalFlyby], types: BLUNT_OR_SHARP }),
  ...each(ALT_MODES.behemoth, { attacks: [TF2.smash] }),
};

/** The special attacks this Alt Mode brings that the actor doesn't have yet. */
export function missingSpecialAttacks(actor, altMode) {
  const spec = SPECIAL_ATTACKS[sourceOf(altMode)];
  if (!spec) {
    return [];
  }

  const held = new Set(itemsOf(actor).map(sourceOf));
  return spec.attacks.filter(uuid => !held.has(uuid));
}

/**
 * The updates that fit a freshly granted special-attack weapon to its chassis: the Blunt hit's
 * damage and type (the alternate effects are left alone) and the rolled Skill of every effect using
 * one of the offered Skills. `effects` are the weapon's embedded weaponEffect items.
 */
export function specialAttackUpdates(weapon, effects, { damage = null, type = null, skill = null, skills = [] } = {}) {
  const patch = system => {
    const out = {};
    if (system?.damageType == 'blunt') {
      if (damage != null && damage != system.damageValue) {
        out.damageValue = damage;
      }

      if (type && type != 'blunt') {
        out.damageType = type;
      }
    }

    if (skill && skills.includes(system?.classification?.skill) && system.classification.skill != skill) {
      out['classification.skill'] = skill;
    }

    return out;
  };

  const effectUpdates = effects.map(effect => ({ _id: effect.id, ...Object.fromEntries(Object.entries(patch(effect.system)).map(([k, v]) => [`system.${k}`, v])) }))
    .filter(update => Object.keys(update).length > 1);
  const weaponUpdate = {};
  for (const [key, entry] of Object.entries(weapon?.system?.items ?? {})) {
    if (entry?.type == 'weaponEffect') {
      for (const [path, value] of Object.entries(patch(entry))) {
        weaponUpdate[`system.items.${key}.${path}`] = value;
      }
    }
  }

  const traits = weapon?.system?.traits;
  if (type && type != 'blunt' && Array.isArray(traits) && traits.includes('blunt')) {
    weaponUpdate['system.traits'] = [...new Set(traits.map(trait => (trait == 'blunt' ? type : trait)))];
  }

  return { effectUpdates, weaponUpdate };
}

const LABELS = { blunt: 'E20.DamageBlunt', sharp: 'E20.DamageSharp', finesse: 'E20.SkillFinesse', might: 'E20.SkillMight' };

async function askChoice(altMode, weapon, key, values) {
  if (!values?.length) {
    return null;
  }

  const { chooseButtons } = await import("../../grants.mjs");
  const choice = await chooseButtons(altMode.name, T(key, { mode: altMode.name, weapon: weapon.name }),
    values.map(value => [value, globalThis.game.i18n.localize(LABELS[value] ?? value)]));
  return values.includes(choice) ? choice : null;
}

export async function grantSpecialAttacks(actor, altMode) {
  const spec = SPECIAL_ATTACKS[sourceOf(altMode)];
  const missing = missingSpecialAttacks(actor, altMode);
  if (!spec || !missing.length) {
    return [];
  }

  const { grantCopy } = await import("../../grants.mjs");
  const granted = [];
  for (const uuid of missing) {
    const weapon = await grantCopy(actor, uuid, { grantedBy: altMode });
    if (!weapon) {
      continue;
    }

    granted.push(weapon.name);
    const type = await askChoice(altMode, weapon, 'Tf2SpecialAttackType', spec.types);
    const skill = await askChoice(altMode, weapon, 'Tf2SpecialAttackSkill', spec.skills);
    const effects = itemsOf(actor).filter(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id);
    const { effectUpdates, weaponUpdate } = specialAttackUpdates(weapon, effects, { damage: spec.damage ?? null, type, skill, skills: spec.skills ?? [] });
    if (effectUpdates.length) {
      await actor.updateEmbeddedDocuments('Item', effectUpdates);
    }

    if (Object.keys(weaponUpdate).length) {
      await weapon.update(weaponUpdate);
    }
  }

  return granted;
}

registerUse({
  id: 'tf2AltModeAttacks', matches: item => item?.type == 'altMode' && !!SPECIAL_ATTACKS[sourceOf(item)],
  canUse: item => missingSpecialAttacks(item.parent, item).length > 0,
  async run(item) {
    const granted = await grantSpecialAttacks(item.parent, item);
    return granted.length ? T('Tf2SpecialAttackGranted', { name: item.parent.name, mode: item.name, attacks: granted.join(', ') }) : null;
  },
});

/* -------------------------------------------- */
/*  Mode Lock                                    */
/* -------------------------------------------- */

registerChatButton('tf2EnergonFlush', async (message, button) => {
  const actor = resolve(button.dataset.actorUuid);
  if (!actor?.isOwner) {
    return;
  }

  if (!actor.statuses?.has?.('modeLock')) {
    ui.notifications.warn(T('Tf2NotModeLocked', { name: actor.name }));
    return;
  }

  if (energonOf(actor) < 1) {
    ui.notifications.warn(T('Tf2NoEnergon', { name: actor.name }));
    return;
  }

  if (!(await payAction(actor, 'standard', T('Tf2EnergonFlush')))) {
    return;
  }

  await actor.update({ 'system.energon.normal.value': energonOf(actor) - 1 });
  const { rollTest } = await import("../../grants.mjs");
  const { success } = await rollTest(actor, 'technology', 12);
  if (success) {
    await actor.toggleStatusEffect('modeLock', { active: false });
  }

  await say(actor, T(success ? 'Tf2EnergonFlushDone' : 'Tf2EnergonFlushFailed', { name: actor.name }));
});

/* -------------------------------------------- */
/*  Not Like That, Like This!                    */
/* -------------------------------------------- */

/** The actors this user plays that could call for the reroll on this roller's test. */
export function notLikeThatHolders(roller) {
  // A player's character offers it to that player; the GM only sees it for characters no player has.
  const isGm = !!globalThis.game?.user?.isGM;
  return worldActors().filter(actor => actor?.uuid != roller?.uuid && actor.isOwner && (!isGm || !actor.hasPlayerOwner)
    && has(actor, TF2.notLikeThat) && (feetBetween(actor, roller) ?? 0) <= 60);
}

export function notLikeThatDecorator(message, element) {
  const flags = message?.flags?.essence20;
  if (!flags?.skill || flags.tf2NotLikeThat || !message.rolls?.length || element?.querySelector?.('[data-e20-ext="tf2NotLikeThat"]')) {
    return;
  }

  const roller = ChatMessage.getSpeakerActor?.(message.speaker);
  if (!roller) {
    return;
  }

  const holders = notLikeThatHolders(roller);
  if (!holders.length) {
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'e20-reroll-buttons';
  for (const holder of holders) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.e20Ext = 'tf2NotLikeThat';
    button.dataset.holderUuid = holder.uuid;
    button.textContent = T('Tf2NotLikeThatButton', { name: holder.name, perk: nameOf(holder, TF2.notLikeThat, 'Not Like That, Like This!') });
    wrap.append(button);
  }

  const diceRoll = element.querySelector?.('.dice-roll');
  if (diceRoll?.parentElement) {
    diceRoll.parentElement.insertBefore(wrap, diceRoll.nextSibling);
  } else {
    (element.querySelector?.('.message-content') ?? element).append(wrap);
  }
}

registerChatDecorator(notLikeThatDecorator);

registerChatButton('tf2NotLikeThat', async (message, button) => {
  const holder = resolve(button.dataset.holderUuid);
  const roller = ChatMessage.getSpeakerActor?.(message.speaker);
  if (!holder?.isOwner || !roller) {
    return;
  }

  const used = holder.flags?.essence20?.tf2NotLikeThatUsed ?? [];
  if (used.includes(message.id)) {
    ui.notifications.warn(T('Tf2AlreadyRerolled'));
    return;
  }

  const { applyReroll } = await import("../../reroll.mjs");
  const roll = Roll.fromData(message.rolls[0].toJSON());
  if (!(await applyReroll(roll, { mode: 'all', target: 'allDice', values: [], recursive: false }))) {
    return;
  }

  const { buildCheckChatData } = await import("../../combat.mjs");
  const chatData = await buildCheckChatData(roll, {
    flavor: T('Tf2NotLikeThatFlavor', { name: roller.name, holder: holder.name }),
    results: [], speaker: message.speaker, canCritD2: !!message.flags?.essence20?.canCritD2,
  });
  foundry.utils.setProperty(chatData, 'flags.essence20.tf2NotLikeThat', true);
  await ChatMessage.create(chatData);

  const skill = message.flags.essence20.skill;
  const update = { 'flags.essence20.tf2NotLikeThatUsed': [...used.slice(-20), message.id] };
  if (game.combat) {
    update[`flags.essence20.${OWED_FLAG}`] = { skill, combatId: game.combat.id, reminded: false };
  }

  await holder.update(update);
});

registerChatButton('tf2NotLikeThatForfeit', async (message, button) => {
  const actor = resolve(button.dataset.actorUuid);
  if (!actor?.isOwner || !actor.flags?.essence20?.[OWED_FLAG]) {
    return;
  }

  await payAction(actor, 'move', T('Tf2NotLikeThatForfeitSource'));
  await actor.unsetFlag('essence20', OWED_FLAG);
  await say(actor, T('Tf2NotLikeThatForfeited', { name: actor.name }));
});

registerTurnStart(async (actor, combat) => {
  // Not Like That, Like This!: the reminder of what's owed this turn.
  const owed = actor?.flags?.essence20?.[OWED_FLAG];
  if (owed && owed.combatId == combat?.id && !owed.reminded) {
    await actor.update({ [`flags.essence20.${OWED_FLAG}.reminded`]: true });
    const skill = game.i18n.localize(CONFIG.E20?.skills?.[owed.skill] ?? owed.skill);
    await card(actor, T('Tf2NotLikeThatOwed', { name: actor.name, skill }), {
      key: 'tf2NotLikeThatForfeit', label: T('Tf2NotLikeThatForfeit'), data: { 'actor-uuid': actor.uuid },
    });
  } else if (owed && owed.combatId != combat?.id) {
    await actor.unsetFlag('essence20', OWED_FLAG);
  }

  // Dust Up: the Concealment ends at the beginning of the next turn.
  const dust = actor?.flags?.essence20?.[DUST_UP_FLAG];
  if (dust) {
    if (dust.applied && actor.statuses?.has?.('cover')) {
      await actor.toggleStatusEffect('cover', { active: false });
    }

    await actor.unsetFlag('essence20', DUST_UP_FLAG);
  }
});

registerTurnEnd(async actor => {
  const owed = actor?.flags?.essence20?.[OWED_FLAG];
  if (owed?.reminded) {
    await actor.unsetFlag('essence20', OWED_FLAG);
  }
});

/* -------------------------------------------- */
/*  After a roll                                 */
/* -------------------------------------------- */

export async function tf2PostRoll(actor, results, checkContext, { hits = [], rider = {} } = {}) {
  // Not Like That, Like This!: the owed Skill Test was made.
  const owed = actor?.flags?.essence20?.[OWED_FLAG];
  const skill = rider?.skill ?? checkContext?.skill;
  if (owed && skill && skill == owed.skill) {
    await actor.unsetFlag('essence20', OWED_FLAG);
  }

  const isAttack = checkContext?.isAttack !== false && !!rider?.itemUuid && hits.length > 0;
  if (!isAttack) {
    return;
  }

  // Diversion: the diverted creature attacked the one who diverted it, so the allies' Edge is off.
  for (const mark of marksOf(actor, MARK.diversion)) {
    if (!mark.attackedHolder && hits.some(h => h.target?.uuid == mark.by)) {
      await addMarkTo(actor, { ...mark, attackedHolder: true });
    }
  }

  const weapon = rider.weaponId ? itemsOf(actor).find(item => item.id == rider.weaponId) : null;

  // Sustained Beam - offered once per round on a hit, never off the follow-up itself.
  if (actor.flags?.essence20?.[FOLLOW_UP_FLAG]) {
    await actor.unsetFlag('essence20', FOLLOW_UP_FLAG);
  } else if (upgradesOn(actor, weapon, TF2.sustainedBeam).length && !hasUsedThisRound(actor, 'tf2SustainedBeam')) {
    const hit = hits.find(h => h.hit);
    if (hit) {
      const upgrade = upgradesOn(actor, weapon, TF2.sustainedBeam)[0];
      await card(actor, T('Tf2SustainedBeamOffer', { name: actor.name, upgrade: upgrade.name, target: hit.target.name }), {
        key: 'tf2SustainedBeam', label: T('Tf2SustainedBeamButton'),
        data: { 'actor-uuid': actor.uuid, 'item-uuid': rider.itemUuid, 'target-uuid': hit.target.uuid, label: upgrade.name },
      });
    }
  }

  // Scramble Modulator, on a hit against a Combiner form.
  const scramble = upgradesOn(actor, weapon, TF2.scrambleModulator)[0];
  for (const { target } of hits.filter(h => h.hit && isCombinerForm(h.target))) {
    if (scramble) {
      await card(actor, T('Tf2ScrambleOffer', { upgrade: scramble.name, target: target.name }), {
        key: 'tf2Scramble', label: T('Tf2ScrambleButton'), data: { 'form-uuid': target.uuid },
      });
    }
  }
}

registerPostRoll(tf2PostRoll);

registerChatButton('tf2SustainedBeam', async (message, button) => {
  const actor = resolve(button.dataset.actorUuid);
  const item = resolve(button.dataset.itemUuid);
  const target = resolve(button.dataset.targetUuid);
  if (!actor?.isOwner || !item) {
    return;
  }

  if (hasUsedThisRound(actor, 'tf2SustainedBeam')) {
    ui.notifications.warn(T('Tf2OncePerRound'));
    return;
  }

  if (energonOf(actor) < 1) {
    ui.notifications.warn(T('Tf2NoEnergon', { name: actor.name }));
    return;
  }

  if (!(await payAction(actor, 'free', button.dataset.label ?? 'Sustained Beam'))) {
    return;
  }

  await actor.update({
    'system.energon.normal.value': energonOf(actor) - 1,
    [`flags.essence20.${SUSTAINED_BEAM_EDGE}`]: { label: button.dataset.label ?? 'Sustained Beam' },
    [`flags.essence20.${FOLLOW_UP_FLAG}`]: true,
  });
  await markUsedThisRound(actor, 'tf2SustainedBeam');
  target?.getActiveTokens?.()?.[0]?.setTarget?.(true, { releaseOthers: true });
  await item.roll({ bypassEconomy: true }, actor);
});

/** Who the Scramble Modulator's extra Sonic lands on: the active component(s) with the most Health. */
export function scrambleVictims(form) {
  const active = componentsOf(form).filter(member => (Number(member.system?.health?.value) || 0) > 0);
  const top = Math.max(...active.map(member => Number(member.system.health.value) || 0));
  return active.filter(member => (Number(member.system.health.value) || 0) == top);
}

registerChatButton('tf2Scramble', async (message, button) => {
  const form = resolve(button.dataset.formUuid);
  if (!form) {
    return;
  }

  if (!game.user?.isGM) {
    ui.notifications.warn(T('Tf2GmApplies'));
    return;
  }

  const { applyDamage } = await import("../../combat.mjs");
  const victims = scrambleVictims(form);
  for (const victim of victims) {
    await applyDamage(victim, 1, 'sonic');
  }

  await say(null, T('Tf2ScrambleDone', { names: victims.map(v => v.name).join(', ') }));
});

/* -------------------------------------------- */
/*  We Are One!                                  */
/* -------------------------------------------- */

/** The reroll grant We Are One! gives every team member. */
export function weAreOneEffect(holder, team) {
  return {
    name: team.label ?? 'We Are One!',
    img: 'icons/svg/dice-target.svg',
    type: 'base',
    transfer: false,
    disabled: false,
    changes: [],
    system: { reroll: { enabled: true, mode: 'ones', target: 'skillDice', reset: 'none', maxUses: 0, skills: team.skills, recursive: false } },
    flags: { essence20: { [WE_ARE_ONE_BY]: holder.uuid, tf2Skills: team.skills.join(',') } },
  };
}

export async function syncWeAreOne(holder) {
  const team = has(holder, TF2.weAreOne) ? holder.flags?.essence20?.[WE_ARE_ONE_FLAG] : null;
  const wanted = team ? [holder.uuid, ...(team.members ?? [])] : [];
  const skills = (team?.skills ?? []).join(',');
  for (const actor of worldActors()) {
    const mine = (actor.effects?.contents ?? [...(actor.effects ?? [])]).filter(effect => effect.flags?.essence20?.[WE_ARE_ONE_BY] == holder.uuid);
    const stale = mine.filter(effect => !wanted.includes(actor.uuid) || effect.flags.essence20.tf2Skills != skills);
    if (stale.length) {
      await actor.deleteEmbeddedDocuments('ActiveEffect', stale.map(effect => effect.id));
    }

    if (wanted.includes(actor.uuid) && mine.length == stale.length) {
      await actor.createEmbeddedDocuments('ActiveEffect', [weAreOneEffect(holder, team)]);
    }
  }
}

/* -------------------------------------------- */
/*  Foundry hooks                                */
/* -------------------------------------------- */

const H = globalThis.Hooks;

// An Alt Mode arrives: its special attacks come with it; a third one breaks Lingering Side Effects.
H?.on?.('createItem', async (item, options, userId) => {
  const actor = item?.parent;
  if (userId != globalThis.game?.user?.id || item?.type != 'altMode' || actor?.documentName != 'Actor') {
    return;
  }

  if (SPECIAL_ATTACKS[sourceOf(item)]) {
    await grantSpecialAttacks(actor, item);
  }

  if (has(actor, TF2.lingeringSideEffects) && itemsOf(actor).filter(other => other.type == 'altMode').length > 2) {
    ui.notifications?.warn?.(T('Tf2LingeringWarn', { name: actor.name }));
    await say(actor, T('Tf2LingeringWarn', { name: actor.name }));
  }
});

// Mode Lock lands: offer the Energon flush.
H?.on?.('createActiveEffect', async (effect, options, userId) => {
  const actor = effect?.parent;
  if (userId != globalThis.game?.user?.id || actor?.documentName != 'Actor' || !effect.statuses?.has?.('modeLock')) {
    return;
  }

  await card(actor, T('Tf2ModeLocked', { name: actor.name }), {
    key: 'tf2EnergonFlush', label: T('Tf2EnergonFlush'), data: { 'actor-uuid': actor.uuid },
  });
});

// Dust Up: moving on your own turn gives Concealment (the Cover status) until your next turn begins.
H?.on?.('updateToken', async (tokenDoc, changes, options, userId) => {
  const actor = tokenDoc?.actor;
  const combat = globalThis.game?.combat;
  if (userId != globalThis.game?.user?.id || !('x' in (changes ?? {}) || 'y' in (changes ?? {})) || !combat?.started
    || !has(actor, TF2.dustUp) || !isOwnTurn(actor) || actor.flags?.essence20?.[DUST_UP_FLAG]) {
    return;
  }

  const hadCover = !!actor.statuses?.has?.('cover');
  if (!hadCover) {
    await actor.toggleStatusEffect('cover', { active: true });
  }

  await actor.setFlag('essence20', DUST_UP_FLAG, { combatId: combat.id, round: combat.round, applied: !hadCover });
});

// Roll Out: converting to Alt Mode for free when Initiative is rolled.
H?.on?.('updateCombatant', async (combatant, changes, options, userId) => {
  const actor = combatant?.actor;
  const combat = combatant?.parent ?? combatant?.combat;
  if (userId != globalThis.game?.user?.id || changes?.initiative == null || (combat?.round ?? 0) > 1
    || !has(actor, TF2.forTheAllspark) || !actor.system?.canTransform || actor.system?.isTransformed
    || actor.statuses?.has?.('surprised') || actor.statuses?.has?.('modeLock')) {
    return;
  }

  const altModes = itemsOf(actor).filter(item => item.type == 'altMode');
  if (!altModes.length) {
    return;
  }

  const { chooseSelect } = await import("../../grants.mjs");
  const id = await chooseSelect(nameOf(actor, TF2.forTheAllspark, 'For The Allspark!'), T('Tf2RollOutPrompt', { name: actor.name }),
    altModes.map(mode => ({ value: mode.id, label: mode.name })));
  const mode = altModes.find(item => item.id == id);
  if (mode) {
    await actor.transform(mode.uuid);
    await say(actor, T('Tf2RolledOut', { name: actor.name, mode: mode.name }));
  }
});

// We Are One!: the team's Active Effects follow the holder's choice (written by one client only).
H?.on?.('updateActor', async (actor, changes) => {
  if (foundry.utils.hasProperty(changes ?? {}, `flags.essence20.${WE_ARE_ONE_FLAG}`) && isResponsible(actor)) {
    await syncWeAreOne(actor);
  }
});

registerDerived(tf2Derived);
