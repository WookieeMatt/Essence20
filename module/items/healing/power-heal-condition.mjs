import { registerUse } from "../../mechanics/item-hooks.mjs";
import { IDS } from "../shared/pr-crb-ttsg-item-ids.mjs";
import { TSafe as T } from "../shared/item-lang.mjs";
import { escapeMarkup as escapeHtml } from "../shared/chat-lines.mjs";
import { isItem } from "../shared/item-lookups.mjs";
import { personalPower, spendPower } from "../shared/personal-power-and-ranger-weapons.mjs";
import { writeDoc as writeActor } from "../shared/relayed-writes.mjs";

/**
 * Power Heal (PR CRB, Grid Power, p.100): "While Morphed, you can spend Power while touching an
 * injured living creature. Each Power spent heals 1 damage or removes one negative condition." The
 * Power's one Use button asks which: healing is its activation (power-handler.mjs#powerCost ->
 * items/healing/power-heal.mjs); removing a Condition is 1 Power, a creature within 5 feet (or yourself),
 * one of its negative Conditions.
 */
const NOT_NEGATIVE = new Set(['morphed', 'altMode', 'defending', 'cover', 'totalCover', 'invisible', 'defeated']);

export function negativeStatuses(actor) {
  return [...(actor?.statuses ?? [])].filter(id => !NOT_NEGATIVE.has(id));
}

function statusLabel(id) {
  const effect = (CONFIG.statusEffects ?? []).find(e => e.id == id);
  return game.i18n.localize(effect?.name ?? effect?.label ?? id);
}

registerUse({
  id: 'pr3PowerHealCondition',
  matches: item => isItem(item, IDS.powerHeal),
  canUse: item => !!item.parent?.system?.isMorphed && personalPower(item.parent) >= 1,
  run: async (item) => {
    const actor = item.parent;
    const { chooseButtons } = await import("../../mechanics/resources/grants.mjs");
    const mode = await chooseButtons(item.name, T('Pr3PowerHealPrompt'), [['heal', T('Pr3PowerHealHeal')], ['condition', T('Pr3PowerHealCondition')]]);
    if (mode == 'heal') {
      const { powerCost } = await import("../../sheet-handlers/power-handler.mjs");
      await powerCost(actor, item);
      return null;
    }

    if (mode != 'condition') {
      return null;
    }

    const { getNearbyAllyTokens } = await import("../../mechanics/combat/nearby-allies.mjs");
    const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
    const candidates = [actor, ...getNearbyAllyTokens(actor, 5).map(token => token.actor).filter(Boolean)]
      .filter(a => negativeStatuses(a).length);
    if (!candidates.length) {
      ui.notifications.info(T('Pr3PowerHealNothing'));
      return null;
    }

    const targetUuid = candidates.length == 1 ? candidates[0].uuid
      : await chooseSelect(item.name, T('Pr3PowerHealWho'), candidates.map(a => ({ value: a.uuid, label: a.name })));
    const target = candidates.find(a => a.uuid == targetUuid);
    if (!target) {
      return null;
    }

    const status = await chooseSelect(item.name, T('Pr3PowerHealWhich'), negativeStatuses(target).map(id => ({ value: id, label: statusLabel(id) })));
    if (!status || !(await spendPower(actor, 1))) {
      return null;
    }

    await writeActor(target, 'toggleStatusEffect', [status, { active: false }]);
    return T('Pr3PowerHealRemoved', { name: escapeHtml(actor.name), target: escapeHtml(target.name), status: escapeHtml(statusLabel(status)) });
  },
});
