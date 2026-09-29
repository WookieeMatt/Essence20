/**
 * Welcome to Night Vale: Citizens' Guide - Dazed and Naive (Defense formula Hang-Ups), Gluten-
 * Tolerant, and Gravity Optional's tripled jump.
 */
import { registerApplyDialog, registerDerived, registerDialogToggles } from "../../extensions.mjs";
import { O3, T, has, say } from "./shared.mjs";

/*
 * Dazed (p.29): "Your Evasion Defense is 9 + your Speed Essence."
 * Naive (p.29): "Your Willpower Defense is 9 + your Smarts Essence."
 * Every other part of the Defense (armor, bonuses, Perks) still adds on top - the Hang-Up replaces
 * the base the Essence is added to, so the total moves by (9 - base) and the breakdown says why.
 */
export const DEFENSE_OVERRIDES = [
  { id: O3.dazed, defense: 'evasion', essence: 'speed', base: 9, label: 'Dazed' },
  { id: O3.naive, defense: 'willpower', essence: 'smarts', base: 9, label: 'Naive' },
];

export function applyDefenseOverrides(actor) {
  const defenses = actor?.system?.defenses;
  if (!defenses) {
    return;
  }

  for (const rule of DEFENSE_OVERRIDES) {
    const defense = defenses[rule.defense];
    if (!defense || !has(actor, rule.id)) {
      continue;
    }

    // The Essence the Hang-Up names, in case a Perk has moved which Essence this Defense uses.
    const essences = actor.system.essences ?? {};
    const current = Number(essences[defense.essence]?.max ?? essences[defense.essence]?.value) || 0;
    const wanted = Number(essences[rule.essence]?.max ?? essences[rule.essence]?.value) || 0;
    const delta = (rule.base - (Number(defense.base) || 0)) + (wanted - current);
    if (!delta) {
      continue;
    }

    defense.total = (Number(defense.total) || 0) + delta;
    defense.string = `${defense.string ?? ''} ${delta < 0 ? '-' : '+'} ${Math.abs(delta)} (${rule.label})`;
  }
}

registerDerived(applyDefenseOverrides);

/*
 * Gluten-Tolerant (p.29): "You can't take the Weird General Perk, and you suffer ↓1 on Contested
 * Skill Tests against someone else's Weird Skill." The contest itself is two ordinary rolls in this
 * system, so the holder declares it on the Roll Options Dialog; the prerequisite is refused when the
 * Perk is dropped on the sheet.
 */
registerDialogToggles((actor) => (has(actor, O3.glutenTolerant)
  ? [{ name: 'o3GlutenTolerant', label: T('O3GlutenTolerantToggle'), type: 'checkbox', value: false }]
  : []));

registerApplyDialog((actor, options) => {
  if (options.ext?.o3GlutenTolerant && has(actor, O3.glutenTolerant)) {
    options.shiftDown = (Number(options.shiftDown) || 0) + 1;
  }
});

export function blocksWeird(actor, data) {
  const source = data?.flags?.core?.sourceId ?? data?._stats?.compendiumSource;
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
