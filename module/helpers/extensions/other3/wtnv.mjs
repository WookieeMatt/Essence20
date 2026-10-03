/**
 * Welcome to Night Vale: Citizens' Guide - Gluten-Tolerant's Weird prerequisite and Gravity
 * Optional's tripled jump.
 */
import { registerApplyDialog, registerDialogToggles } from "../../extensions.mjs";
import { O3, T, has, say } from "./shared.mjs";

/*
 * Gluten-Tolerant (p.29): "You can't take the Weird General Perk, and you suffer ↓1 on Contested
 * Skill Tests against someone else's Weird Skill." The ↓1 is the Hang-Up's own rule (a Roll Options
 * Dialog switch); the prerequisite is refused here when the Perk is dropped on the sheet.
 */
export function blocksWeird(actor, data) {
  const source = data?.flags?.core?.sourceId ?? data?._stats?.compendiumSource ?? data?.flags?.essence20?.rulesSource;
  return source == O3.weird && has(actor, O3.glutenTolerant);
}

Hooks.on?.('preCreateItem', (item, data) => {
  const actor = item?.parent;
  if (actor?.documentName == 'Actor' && blocksWeird(actor, data)) {
    ui.notifications?.warn(T('O3GlutenTolerantNoWeird', { name: actor.name }));
    return false;
  }

  return undefined;
});

/*
 * Gravity Optional (p.37): "You can overcome gravity's pull when you leap, tripling the result of
 * an Athletics Skill Test to jump." The float half is already built (helpers/gravity-optional.mjs).
 * The jump is declared on the Athletics roll; the roll's own chat card is read back for its total.
 */
let pendingJump = null;

registerDialogToggles((actor, ctx) => (has(actor, O3.gravityOptional) && ctx?.rolledSkill == 'athletics'
  ? [{ name: 'o3GravityJump', label: T('O3GravityJumpToggle'), type: 'checkbox', value: false }]
  : []));

registerApplyDialog((actor, options) => {
  if (options.ext?.o3GravityJump && has(actor, O3.gravityOptional)) {
    pendingJump = { actorId: actor.id, at: Date.now() };
  }
});

export function jumpLine(actor, total) {
  return T('O3GravityJumpLine', { name: actor.name, total, tripled: total * 3 });
}

Hooks.on?.('createChatMessage', (message) => {
  if (!pendingJump || Date.now() - pendingJump.at > 30000 || message?.speaker?.actor != pendingJump.actorId) {
    return;
  }

  const author = message.author?.id ?? message.user?.id ?? message.author;
  const total = message.rolls?.[0]?.total;
  if ((author && author != game.user?.id) || !Number.isFinite(total)) {
    return;
  }

  const actor = game.actors?.get?.(pendingJump.actorId);
  pendingJump = null;
  if (actor) {
    say(actor, jumpLine(actor, total));
  }
});
