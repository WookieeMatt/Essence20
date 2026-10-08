import { applyTimedCondition } from "./timed-status.mjs";
import { applyDamage } from "./combat.mjs";

/**
 * Effects every creature caught in them has to test against - DIF 15 Brawn or Prone (Bellowbreath,
 * Knights of Canterlot p.49), Athletics or Acrobatics or Prone (Power Quake, PR CRB p.100), DIF 15
 * Alertness or fall asleep (Lullaby, p.50).
 *
 * The caster's side posts one chat card listing everyone caught, each with a button that rolls that
 * creature's own Skill Test. Whoever owns the creature (or the GM) presses it; dice.mjs hands the
 * finished roll to target-riders.mjs#applyRollRiders, which applies the Condition on a failure
 * (resolveSaveRoll below). A creature that wants to fail - "A creature can also choose to fail the
 * Skill Test" (Lullaby) - can just take the Condition from its token.
 */

/**
 * @typedef {Object} SaveSpec
 * @property {String} title
 * @property {Array<String>} skills   The Skill (or Skills - "Athletics or Acrobatics") tested.
 * @property {Number} dif
 * @property {String} [status]   Condition applied on a failure.
 * @property {Number} [rounds]   How long it lasts.
 * @property {{value: Number, type: String}} [damage]   Damage dealt on a failure.
 * @property {{value: Number, type: String}} [damageAlways]   Damage dealt regardless, on the roll.
 * @property {Boolean} [removeOnSuccess]   An escape: a success ends the Condition instead.
 */

/**
 * Post a save card.
 * @param {Actor} source   Whoever caused it.
 * @param {Array<Actor>} targets
 * @param {SaveSpec} spec
 * @returns {Promise<ChatMessage|null>}
 */
export async function postSaveCard(source, targets, spec) {
  const unique = [...new Map(targets.filter(Boolean).map(t => [t.uuid, t])).values()];
  if (!unique.length) {
    ui.notifications.warn(game.i18n.format('E20.SaveNoTargets', { name: spec.title }));
    return null;
  }

  const skills = spec.skills.map(skill => game.i18n.localize(CONFIG.E20.skills?.[skill] ?? skill)).join(' / ');
  const failText = spec.status
    ? game.i18n.localize(CONFIG.statusEffects?.find?.(s => s.id == spec.status)?.name ?? spec.status)
    : '';
  const rows = unique.map(target => `<li class="e20-save-row">
      <span class="e20-save-name">${foundry.utils.escapeHTML(target.name)}</span>
      <button type="button" class="e20-chat-action-button e20-save-roll" data-target-uuid="${target.uuid}">${game.i18n.format('E20.SaveRoll', { skill: skills, dif: spec.dif })}</button>
    </li>`).join('');

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: source }),
    content: `<div class="e20-save-card"><p><strong>${foundry.utils.escapeHTML(spec.title)}</strong> - ${
      game.i18n.format(spec.removeOnSuccess ? 'E20.SaveEscapeLine' : 'E20.SaveLine', { skill: skills, dif: spec.dif, fail: failText })
    }</p><ul class="e20-save-list">${rows}</ul></div>`,
    flags: { essence20: { saveSpec: spec } },
  });
}

/**
 * Wire a save card's buttons. Each rolls the Skill for the creature it names; the owner of that
 * creature or the GM may press it.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 */
export function decorateSaveCard(message, html) {
  const spec = message?.flags?.essence20?.saveSpec;
  if (!spec) {
    return;
  }

  for (const button of html?.querySelectorAll?.('.e20-save-roll') ?? []) {
    button.disabled = false;
    button.addEventListener('click', async () => {
      const target = await fromUuid(button.dataset.targetUuid);
      const actor = target?.actor ?? target;
      if (!actor) {
        return;
      }

      if (!actor.isOwner && !game.user.isGM) {
        ui.notifications.warn(game.i18n.format('E20.SaveNotYours', { name: actor.name }));
        return;
      }

      await rollSave(actor, spec);
    });
  }
}

/**
 * Roll one creature's Skill Test for a save.
 * @param {Actor} actor
 * @param {SaveSpec} spec
 */
export async function rollSave(actor, spec) {
  let skill = spec.skills[0];
  if (spec.skills.length > 1) {
    skill = await foundry.applications.api.DialogV2.wait({
      window: { title: spec.title },
      classes: ["window-app", "e20-window"],
      content: `<p>${game.i18n.localize('E20.SavePickSkill')}</p>`,
      buttons: spec.skills.map(key => ({ action: key, label: game.i18n.localize(CONFIG.E20.skills?.[key] ?? key) })),
      rejectClose: false,
    });
    if (!skill) {
      return;
    }
  }

  const essence = CONFIG.E20.skillToEssence?.[skill] ?? essenceFor(actor, skill);
  await actor._dice?.rollSkill({
    skill, essence, shiftUp: 0, shiftDown: 0, dif: String(spec.dif),
    riderSpec: JSON.stringify({ kind: 'save', spec }),
  }, actor);
}

function essenceFor(actor, skill) {
  const essences = actor?.system?.skills?.[skill]?.essences ?? {};
  return Object.keys(essences).find(key => essences[key]) ?? 'any';
}

/**
 * What a finished save roll does - called from target-riders.mjs#applyRollRiders.
 * @param {Actor} actor   The creature that rolled.
 * @param {SaveSpec} spec
 * @param {Boolean} success
 * @returns {Promise<void>}
 */
export async function resolveSaveRoll(actor, spec, success) {
  if (spec.damageAlways?.value) {
    await applyDamage(actor, spec.damageAlways.value, spec.damageAlways.type);
  }

  if (spec.removeOnSuccess) {
    if (success && spec.status) {
      await actor.toggleStatusEffect(spec.status, { active: false });
    }

    return;
  }

  if (success) {
    return;
  }

  if (spec.status) {
    await applyTimedCondition(actor, spec.status, spec.rounds);
  }

  if (spec.damage?.value) {
    await applyDamage(actor, spec.damage.value, spec.damage.type);
  }
}
