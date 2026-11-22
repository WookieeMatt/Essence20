import { registerRest } from "../../mechanics/item-hooks.mjs";
import { T } from "../shared/item-lang.mjs";
import { num } from "../shared/numbers.mjs";

/**
 * Magic Baubles (My Little Pony CRB, Magic Items, p.140-142): using one in each of its three forms, and making one from
 * a Mastered spell.
 *
 * Using (p.141): a Standard action, and it's used up either way (documents/item.mjs counts the quantity down).
 * - Scroll: cast as if Mastered - a Spellcasting Skill Test at the user's rank or the scroll's, whichever is higher.
 * - Potion: affects whoever drinks it; no Spellcasting Skill Test, so no cost, and it always works.
 * - Talisman: no Spellcasting Skill Test, but the user pays the spell's casting cost as a Spellcasting downshift.
 * A bauble that holds an attack (its defenseType set - one crafted from an attack spell) still rolls that attack against
 * its targets; a potion never does (it only affects the drinker). Every use fires the `baubleUsed` Trigger event on the
 * user (rules/plugins/resources/bauble-used.mjs) with @var.succeeded 1 (0 for a failed scroll / attack).
 *
 * Making (p.141-142), from a spell on the character's sheet (a spell a character has is one they've Mastered):
 * pay the spell's cost as usual, but Spellcasting comes back only 1 step an hour, not each round, until a full night's
 * rest; the bauble's Spellcasting rank is the caster's after paying; then 6 / 12 / 24 hours of work (Elementary /
 * Superior / Virtuoso) and a DIF 12 / 16 / 20 Spellcasting Skill Test. A failure means the time again and another
 * test - the attempt is kept (flags.essence20.baubleCraft.pending) so the next try costs nothing more, until the
 * crafter gives up.
 */

export const CRAFT_FLAG = 'baubleCraft';

/** DIF of the crafting test, by the spell's tier. */
export const CRAFT_DIF = { elementary: 12, superior: 16, virtuoso: 20 };

/** Hours of work before the crafting test, by the spell's tier. */
export const CRAFT_HOURS = { elementary: 6, superior: 12, virtuoso: 24 };

/** The bauble's form, scroll when unset (what every bauble did before forms existed). */
export function baubleForm(bauble) {
  const form = bauble?.system?.form;
  return ['scroll', 'potion', 'talisman'].includes(form) ? form : 'scroll';
}

/** Whether a bauble holds an attack (rolled against targets). */
export function baubleAttacks(bauble) {
  return !!bauble?.system?.defenseType;
}

/**
 * Whether using the bauble rolls: a scroll always; a talisman only for its attack; a potion never.
 * @param {Item} bauble
 * @returns {Boolean}
 */
export function baubleRolls(bauble) {
  const form = baubleForm(bauble);
  return form == 'scroll' || (form == 'talisman' && baubleAttacks(bauble));
}

/** The Spellcasting downshift using the bauble costs: a talisman's casting cost, nothing for the others. */
export function baubleCost(bauble) {
  return baubleForm(bauble) == 'talisman' ? Math.max(0, num(bauble?.system?.castingCost)) : 0;
}

/**
 * A shift stepped down n times along the ladder, stopping at d20 (untrained) - a bauble's rank is a rollable die.
 * @param {String} shift
 * @param {Number} n
 * @param {String[]} [ladder]   E20.skillShiftList.
 * @returns {String}
 */
export function stepDown(shift, n, ladder = globalThis.CONFIG?.E20?.skillShiftList ?? []) {
  const at = ladder.indexOf(shift);
  const floor = ladder.indexOf('d20');
  if (at < 0) {
    return shift;
  }

  return ladder[Math.min(at + Math.max(0, num(n)), floor >= 0 ? floor : ladder.length - 1)];
}

/** The crafting test's DIF and hours for a spell. */
export function craftTerms(spell) {
  const tier = spell?.system?.tier in CRAFT_DIF ? spell.system.tier : 'elementary';
  return { tier, dif: CRAFT_DIF[tier], hours: CRAFT_HOURS[tier] };
}

/**
 * The bauble a spell makes: its range, duration, attack and area; the given form and rank; a talisman carries the
 * spell's cost.
 * @param {Item} spell
 * @param {{form: String, rank: String, name?: String}} options
 * @returns {Object}   magicBauble Item data.
 */
export function baubleDataFromSpell(spell, { form, rank, name = '' }) {
  const s = spell?.system ?? {};
  const fields = {};
  for (const key of ['range', 'duration', 'actionType', 'damageType', 'damageValue', 'defenseType', 'numTargets', 'shape', 'radius']) {
    if (s[key] !== undefined) {
      fields[key] = s[key];
    }
  }

  // A potion only ever affects whoever drinks it - it carries no attack.
  if (form == 'potion') {
    Object.assign(fields, { defenseType: null, damageValue: 0, damageType: null, shape: null, radius: 0 });
  }

  return {
    name: name || T('BaubleCraftDefaultName', { spell: spell?.name ?? '', form: T(`BaubleForm${form[0].toUpperCase()}${form.slice(1)}`) }),
    type: 'magicBauble',
    img: spell?.img,
    system: {
      ...fields,
      description: s.description ?? '',
      form,
      castingCost: form == 'talisman' ? Math.max(0, num(s.cost)) : 0,
      spellcastingShift: rank,
      quantity: 1,
    },
    flags: { essence20: { [CRAFT_FLAG]: { spellUuid: spell?.uuid ?? null, spellName: spell?.name ?? '' } } },
  };
}

/* -------------------------------------------- */
/*  Using a bauble                               */
/* -------------------------------------------- */

async function postNoTestCard(actor, bauble, form, cost) {
  const lines = [T(form == 'potion' ? 'MagicBaubleUsedPotion' : 'MagicBaubleUsedTalisman', { actor: actor.name, item: bauble.name, cost })];
  const description = bauble.system?.description;
  await globalThis.ChatMessage?.create?.({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `${T('RollTypeMagicBauble')} - ${bauble.name}`,
    content: `<p>${lines.join('</p><p>')}</p>${description ? `<div>${description}</div>` : ''}`,
  });
}

async function fireBaubleUsed(actor, bauble, succeeded) {
  const { fireBaubleUsed: fire } = await import("../../rules/plugins/resources/bauble-used.mjs");
  await fire(actor, bauble, succeeded);
}

/**
 * Use a bauble from the sheet (documents/item.mjs's magicBauble branch, after the action is paid).
 * @param {Item} bauble
 * @param {Object} dataset          The sheet click's dataset.
 * @param {Function} rollWith       (dataset) => the item's _rollWithRefund result.
 * @returns {Promise<{cancelled: Boolean}>}   cancelled: the roll was backed out of - nothing is used up.
 */
export async function useMagicBauble(bauble, dataset, rollWith) {
  const actor = bauble.actor;
  const form = baubleForm(bauble);
  const cost = baubleCost(bauble);
  let succeeded = true;

  if (baubleRolls(bauble)) {
    const { betterShift } = await import("../../util/utils.mjs");
    const spellcasting = actor.system.skills.spellcasting;
    // A scroll: "your own Spellcasting Skill, or the Spellcasting Skill noted on the Magic Bauble (whichever is
    // higher)". The bauble only ever helps; any downshift already lingering still applies on top.
    const shift = betterShift(spellcasting.shift, bauble.system.spellcastingShift);
    if (bauble.system.shape) {
      const { placeAoeTemplate } = await import("../../mechanics/combat/aoe-targeting.mjs");
      await placeAoeTemplate(actor, bauble);
    }

    const result = await rollWith({ ...dataset, essence: 'any', skill: 'spellcasting', shift, shiftDown: spellcasting.shiftDown });
    if (result?.cancelled) {
      return { cancelled: true };
    }

    succeeded = !!result?.success || result?.success === undefined;
  } else {
    await postNoTestCard(actor, bauble, form, cost);
  }

  // A talisman "draws its power from those who wield it": the spell's cost, as if they'd cast it.
  if (cost > 0) {
    await actor.update({ 'system.skills.spellcasting.shiftDown': num(actor.system.skills.spellcasting.shiftDown) + cost });
  }

  await fireBaubleUsed(actor, bauble, succeeded);
  return { cancelled: false };
}

/* -------------------------------------------- */
/*  Making a bauble                              */
/* -------------------------------------------- */

/** The crafter's attempt in progress (a failed test to try again), or null. */
export function pendingCraft(actor) {
  return actor?.flags?.essence20?.[CRAFT_FLAG]?.pending ?? null;
}

/** Whether the actor's Spellcasting is recovering only 1 step an hour (after making a bauble) until a full rest. */
export function slowRecovery(actor) {
  return !!actor?.flags?.essence20?.[CRAFT_FLAG]?.slowRecovery;
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

async function askCraft(actor, spell, terms, rank, pending) {
  const forms = Object.entries(CONFIG.E20.baubleForms).map(([key, label]) => `<option value="${key}"${pending?.form == key ? ' selected' : ''}>${game.i18n.localize(label)}</option>`).join('');
  const intro = pending
    ? T('BaubleCraftRetryIntro', { hours: terms.hours, dif: terms.dif })
    : T('BaubleCraftIntro', { cost: num(spell.system.cost), rank, hours: terms.hours, dif: terms.dif });
  const content = `
    <p>${intro}</p>
    <p class="hint">${T('BaubleCraftVenue')}</p>
    <div class="form-group"><label>${T('BaubleCraftForm')}</label><select name="form"${pending ? ' disabled' : ''}>${forms}</select></div>
    <div class="form-group"><label>${T('BaubleCraftName')}</label><input type="text" name="name" value="${escapeHtml(pending?.name ?? '')}"${pending ? ' disabled' : ''}/></div>`;
  const buttons = [{ action: 'craft', label: T(pending ? 'BaubleCraftRetry' : 'BaubleCraftStart'), default: true, callback: (event, button) => ({ action: 'craft', form: button.form.elements.form.value, name: button.form.elements.name.value.trim() }) }];
  if (pending) {
    buttons.push({ action: 'giveUp', label: T('BaubleCraftGiveUp'), callback: () => ({ action: 'giveUp' }) });
  }

  buttons.push({ action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') });
  const answer = await foundry.applications.api.DialogV2.wait({
    window: { title: T('BaubleCraftTitle', { spell: spell.name }) },
    // A fixed width: with none, the long intro paragraph stretches the dialog across the screen.
    position: { width: 460 },
    classes: ["window-app", "e20-window"],
    content,
    buttons,
    rejectClose: false,
  });
  return answer && typeof answer == 'object' ? answer : null;
}

/**
 * Make a Magic Bauble from one of the actor's spells (the spell row's flask button). The first attempt pays the cost
 * and fixes the bauble's rank; a failed test keeps the attempt for a free retry (the time again) or giving up.
 * @param {Actor} actor
 * @param {Item} spell
 * @returns {Promise<Item|null>}   The bauble made, or null.
 */
export async function craftMagicBauble(actor, spell) {
  if (!actor || spell?.type != 'spell') {
    return null;
  }

  const terms = craftTerms(spell);
  const spellcasting = actor.system.skills.spellcasting;
  const cost = Math.max(0, num(spell.system.cost));
  const pending = pendingCraft(actor)?.spellId == spell.id ? pendingCraft(actor) : null;
  const rank = pending?.rank ?? stepDown(spellcasting.shift, num(spellcasting.shiftDown) + cost);
  const answer = await askCraft(actor, spell, terms, rank, pending);
  if (!answer || answer.action == 'cancel') {
    return null;
  }

  if (answer.action == 'giveUp') {
    await actor.update({ [`flags.essence20.${CRAFT_FLAG}.pending`]: null });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${T('BaubleCraftGaveUpChat', { actor: actor.name, spell: spell.name })}</p>` });
    return null;
  }

  const attempt = pending ?? { spellId: spell.id, form: answer.form, name: answer.name, rank };
  if (!pending) {
    // Cover the cost: paid like a cast, and Spellcasting now recovers only 1 step an hour until a full rest.
    await actor.update({
      'system.skills.spellcasting.shiftDown': num(spellcasting.shiftDown) + cost,
      [`flags.essence20.${CRAFT_FLAG}.slowRecovery`]: true,
      [`flags.essence20.${CRAFT_FLAG}.pending`]: attempt,
    });
  }

  const { rollTest } = await import("../../mechanics/resources/grants.mjs");
  const fields = actor.system.skills.spellcasting;
  const result = await rollTest(actor, 'spellcasting', terms.dif, { rollType: 'skill', shift: fields.shift, shiftUp: fields.shiftUp ?? 0, shiftDown: fields.shiftDown ?? 0, isSpecialized: fields.isSpecialized });
  if (!result?.success) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${T('BaubleCraftFailedChat', { actor: actor.name, spell: spell.name, hours: terms.hours })}</p>` });
    return null;
  }

  const [bauble] = await actor.createEmbeddedDocuments('Item', [baubleDataFromSpell(spell, attempt)]);
  await actor.update({ [`flags.essence20.${CRAFT_FLAG}.pending`]: null });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${T('BaubleCraftMadeChat', { actor: actor.name, item: bauble?.name ?? attempt.name, rank: attempt.rank })}</p>` });
  return bauble ?? null;
}

/**
 * A full night's rest returns Spellcasting to its usual rank (p.142, "until you have had a full night's rest and
 * returned your Spellcasting Skill to its usual rank") and ends the slow recovery making a bauble caused.
 */
export async function spellcastingOnRest(actor) {
  const update = {};
  if (num(actor?.system?.skills?.spellcasting?.shiftDown) > 0) {
    update['system.skills.spellcasting.shiftDown'] = 0;
  }

  if (slowRecovery(actor)) {
    update[`flags.essence20.${CRAFT_FLAG}.slowRecovery`] = false;
  }

  if (Object.keys(update).length) {
    await actor.update(update);
  }
}

registerRest(actor => spellcastingOnRest(actor));
