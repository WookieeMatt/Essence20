import { registerRef } from "../../formula.mjs";
import { recipients, registerStep, registerTextRef } from "../../steps.mjs";
import { fillRunText } from "../shared/run-text.mjs";

/**
 * Round 15 (items2): naming who a step would reach, a chat card only some users see, and comparisons with the target.
 *
 * - Step `listNames {to, filter?, var?, none?}` - the recipients' names, comma-joined, kept as `{var.<var>}` (default
 *   `names`; `@var.<var>Count` how many). With nobody: `none` (an E20. key is localised; default "nobody" -
 *   E20.RulesExtItems2.Nobody). Never stops the run. (Touch Move's "teammates who aren't Surprised".)
 * - Step `whisper {text, to?: user | owners}` - posts its own chat card with `text` (`{name}`, `{target}`, `{var.x}`,
 *   `{choice.x}`, `{@formula}` filled; an E20. key is localised first), whispered to this user and the GMs (`user`, the
 *   default) or to the actor's owners and the GMs (`owners`). The run's other chat lines still go on the run's card.
 * - Ref `@versus.<level | toughness | evasion | willpower | cleverness>` - how the run's first target (the roll's other
 *   party) compares with the actor: 1 higher, 0 equal, -1 lower; 0 with no target. Defenses are read the way an attack
 *   reads them (mechanics/combat/combat.mjs#getDefenseValue - a crewed vehicle's driver, Relic Key...), level is the
 *   Threat Level, else the level. (Martial Artist.)
 */

const localize = text => (/^E20\./.test(String(text)) ? globalThis.game?.i18n?.localize?.(text) ?? text : text);
const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* The heavy helper @versus reads, filled at setup (tests set it). */
export const versusHelpers = { getDefenseValue: null };
globalThis.Hooks?.once?.('setup', async () => {
  try {
    const { getDefenseValue } = await import("../../../mechanics/combat/combat.mjs");
    versusHelpers.getDefenseValue = getDefenseValue;
  } catch (error) {
    console.error('Essence20 | @versus helper failed to load', error);
  }
});

registerStep('listNames', async (step, ctx) => {
  const list = recipients(step, ctx);
  const key = String(step.var || 'names');
  ctx.vars[key] = list.length ? list.map(actor => actor?.name ?? '').join(', ') : localize(step.none ?? 'E20.RulesExtItems2.Nobody');
  ctx.vars[`${key}Count`] = list.length;
}, { errors: (step, where) => (step.var !== undefined && !/^[\w-]+$/.test(String(step.var)) ? [`${where}: var must be a plain name`] : []) });

/** The users a whisper step reaches. */
function whisperIds(step, ctx) {
  const users = globalThis.game?.users;
  const list = users?.contents ?? (users ? [...users] : []);
  const gms = list.filter(user => user?.isGM).map(user => user.id);
  if (step.to == 'owners') {
    return [...new Set([...gms, ...list.filter(user => ctx.actor?.testUserPermission?.(user, 'OWNER')).map(user => user.id)])];
  }

  return [...new Set([globalThis.game?.user?.id, ...gms].filter(Boolean))];
}

registerStep('whisper', async (step, ctx) => {
  if (!globalThis.ChatMessage?.create) {
    return;
  }

  const text = fillRunText(localize(String(step.text ?? '')), ctx);
  await globalThis.ChatMessage.create({
    speaker: globalThis.ChatMessage.getSpeaker?.({ actor: ctx.actor }),
    whisper: whisperIds(step, ctx),
    content: `<p>${escape(text)}</p>`,
  });
}, {
  errors: (step, where) => [
    ...(step.text ? [] : [`${where}: whisper needs text`]),
    ...(step.to !== undefined && !['user', 'owners'].includes(step.to) ? [`${where}: whisper to must be user or owners`] : []),
  ],
});

/**
 * Text placeholder `{markSkill.<key>}` - the Skill a mark `<key>` on the actor keeps as its text (mark {text:
 * "{var.skill}"}), by its localised name; empty with no such mark. (Not Like That, Like This!'s reminder.)
 */
registerTextRef('markSkill', (key, ctx) => {
  const text = ctx.actor?.flags?.essence20?.ruleMarks?.[key]?.text;
  if (!text) {
    return '';
  }

  const label = globalThis.CONFIG?.E20?.skills?.[text];
  return label ? globalThis.game?.i18n?.localize?.(label) ?? label : text;
});

/**
 * Text placeholder `{actor.<path>}` - a value stored on the run's actor ("{actor.system.originSkillsIncrease}" - Be an
 * Example's Origin Skill); empty when it isn't set.
 */
registerTextRef('actor', (path, ctx) => {
  const value = String(path).split('.').reduce((at, key) => (at === null || at === undefined ? at : at[key]), ctx.actor);
  return value === null || value === undefined || typeof value == 'object' ? '' : value;
});

const levelOf = actor => Number(actor?.system?.threatLevel || actor?.system?.level) || 0;

registerRef('versus', (key, scope) => {
  const mine = scope.actor;
  const theirs = scope.other;
  if (!mine || !theirs) {
    return 0;
  }

  const read = key == 'level' ? levelOf
    : ['toughness', 'evasion', 'willpower', 'cleverness'].includes(key)
      ? actor => (versusHelpers.getDefenseValue ? versusHelpers.getDefenseValue(actor, key) : Number(actor?.system?.defenses?.[key]?.total) || 0)
      : null;
  if (!read) {
    return 0;
  }

  return Math.sign((Number(read(theirs)) || 0) - (Number(read(mine)) || 0));
});
