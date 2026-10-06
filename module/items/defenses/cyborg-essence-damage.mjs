import { registerDamageModifier } from "../../mechanics/item-hooks.mjs";
import { essenceDamageOf } from "../../mechanics/combat/essence-damage.mjs";
import {
  choose, confirm, esc, holds, say,
} from "../../mechanics/combat/reaction-engine.mjs";
import { T } from "../shared/item-lang.mjs";

export const CYBORG = "Compendium.essence20.beneath_the_helmet.Item.rqCybOrg7Bth48Pk";

// Cyborg (Beneath the Helmet, 1st level alternate Spectrum Perk, p.48): "Whenever you take damage,
// you may instead have the damage applied as Essence damage. While this may temporarily give you a
// boost in combat, you may not recover any lost Health until your Essence damage is healed." Asked
// where damage lands (the GM's Apply Damage); the Health lock is a preUpdateActor guard.
registerDamageModifier(async (actor, amount) => {
  if (!(amount > 0) || !holds(actor, CYBORG) || !game.user?.isGM) {
    return amount;
  }

  const essences = Object.entries(actor.system?.essences ?? {}).filter(([, e]) => Number(e?.value) > 0);
  if (!essences.length || !(await confirm(T('ReactCyborg'), T('ReactCyborgAsk', { name: esc(actor.name), amount })))) {
    return amount;
  }

  const essence = await choose(T('ReactCyborg'), T('ReactCyborgPick'),
    essences.map(([key]) => [key, game.i18n.localize(CONFIG.E20?.essences?.[key] ?? key)]));
  if (!essence) {
    return amount;
  }

  const current = Number(actor.system.essences[essence].value) || 0;
  const taken = Math.min(current, amount);
  await actor.update({ [`system.essences.${essence}.value`]: current - taken });
  await say(actor, T('ReactCyborgTaken', { name: esc(actor.name), amount: taken, essence: game.i18n.localize(CONFIG.E20?.essences?.[essence] ?? essence) }));
  return amount - taken;
});

globalThis.Hooks?.on('preUpdateActor', (actor, changes) => {
  const next = foundry.utils.getProperty(changes, 'system.health.value');
  if (next === undefined || !holds(actor, CYBORG) || !(Number(next) > Number(actor.system?.health?.value ?? 0))) {
    return true;
  }

  if (essenceDamageOf(actor) > 0) {
    delete changes.system.health.value;
    ui.notifications?.warn(T('ReactCyborgNoHeal', { name: actor.name }));
  }

  return true;
});
