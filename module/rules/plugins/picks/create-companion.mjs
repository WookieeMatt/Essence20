import { registerRecipient, registerStep } from "../../steps.mjs";
import { escape } from "../shared/chat-speaker-helpers.mjs";

/**
 * Step `createCompanion {name, system?}` (round 15, uses) - a new companion Actor for the actor, made the way the sheet's
 * companion tools make one (mechanics/companions/companions.mjs#createCompanion: the owner's ownership copied, linked to
 * the owner, through the GM when the player can't create actors). `name` may hold {name} (the owner's name); `system`
 * is its system data ({type: drone, availability: limited}). The run keeps it: recipient `created` is that companion
 * (later grant / pickGrant steps put things on it), `{var.createdName}` its name. Nothing made stops the run.
 * Primary Tech / Secondary Tech (the drone).
 */

const localize = key => {
  const text = globalThis.game?.i18n?.localize?.(key);
  return text && text != key ? text : key;
};

registerStep('createCompanion', async (step, ctx) => {
  const owner = ctx.actor;
  if (!owner) {
    return false;
  }

  const name = localize(String(step.name ?? '{name}')).replace(/\{name\}/g, owner.name ?? '');
  const { createCompanion } = await import("../../../mechanics/companions/companions.mjs");
  const made = await createCompanion(owner, { name, system: { ...(step.system ?? {}) } }, ctx.item ?? null);
  if (!made) {
    return false;
  }

  ctx.vars.created = made;
  ctx.vars.createdName = made.name;
  ctx.chat.push(`${escape(owner.name)}: ${escape(made.name)}`);
}, {
  errors: (step, where) => (step.system !== undefined && (typeof step.system != 'object' || Array.isArray(step.system)) ? [`${where}: system must be an object`] : []),
});

registerRecipient('created', (match, ctx) => (ctx.vars?.created ? [ctx.vars.created] : []));
