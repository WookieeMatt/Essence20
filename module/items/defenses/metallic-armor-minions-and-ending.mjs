/**
 * Power Rangers - Through the Shattered Grid's Metallic Armor Power Up!, the parts beyond its activation and
 * upkeep (./metallic-armor.mjs): the minion damage cut, its endings and its Use button.
 */
import {
  registerAfterDamage, registerHitRider, registerPostRoll, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { O3 } from "../shared/mlp-pr-tf-ids-and-skill-total.mjs";
import { T } from "../shared/item-lang.mjs";
import { escapeHtml as escape, say } from "../shared/chat-lines.mjs";
import { isItem } from "../shared/item-lookups.mjs";
import { num } from "../shared/numbers.mjs";
import { writeDocResult as writeActor } from "../shared/relayed-writes.mjs";

/*
 * Metallic Armor Power Up! (Through the Shattered Grid, p.26) - the +3 temporary Health and upkeep
 * are items/defenses/metallic-armor.mjs. The rest: "You reduce the damage dealt to you by minion and foot
 * soldier enemies by 1 to a minimum of 0." and "It lasts until you choose to end it, you cannot pay
 * the Personal Power to continue using it, you suffer a Critical Success on an Attack by a non-minion
 * Threat, or you are Defeated." A minion is an NPC tagged minion / foot soldier / mook / grunt
 * (mechanics/characters/creature-tags.mjs), or a Putty or Tenga.
 */
const METALLIC_FLAG = 'metallicArmorActive';
const MINION_TAGS = ['minion', 'minions', 'foot soldier', 'footsoldier', 'foot-soldier', 'mook', 'grunt'];

export async function isMinion(actor) {
  if (!actor || actor.type == 'playerCharacter') {
    return false;
  }

  const tags = await import("../../mechanics/characters/creature-tags.mjs");
  const list = tags.creatureTagsOf(actor);
  return MINION_TAGS.some(tag => list.has(tag)) || !!tags.isPuttyOrTenga?.(actor);
}

async function endMetallicArmor(actor) {
  if (!actor?.flags?.essence20?.[METALLIC_FLAG]) {
    return;
  }

  await writeActor(actor, 'update', [{
    [`flags.essence20.${METALLIC_FLAG}`]: false,
    'system.health.bonus': Math.max(0, num(actor.system?.health?.bonus) - 3),
  }]);
  await say(actor, T('O3MetallicArmorEnds', { name: escape(actor.name) }));
}

registerHitRider(async (attacker, target, result, rider, tools) => {
  if (target?.flags?.essence20?.[METALLIC_FLAG] && num(result?.damageValue) > 0 && await isMinion(attacker)) {
    tools.damageBonusNote(result, -1, 'Metallic Armor');
  }
});

registerPostRoll(async (attacker, results, checkContext, { isCrit, hits } = {}) => {
  if (!isCrit || !checkContext?.isAttack || await isMinion(attacker)) {
    return;
  }

  for (const { target, hit } of hits ?? []) {
    if (hit && target?.flags?.essence20?.[METALLIC_FLAG]) {
      await endMetallicArmor(target);
    }
  }
});

registerAfterDamage(async (actor, dealt, damageType, { newValue } = {}) => {
  if (num(newValue) <= 0 && actor?.flags?.essence20?.[METALLIC_FLAG] && actor.isOwner) {
    await endMetallicArmor(actor);
  }
});

// The Power's one Use button: switches it on (its activation - power-handler.mjs#powerCost ->
// items/defenses/metallic-armor.mjs) or, while it's on, ends it.
registerUse({
  id: 'o3MetallicArmorEnd',
  matches: item => isItem(item, O3.metallicArmor),
  canUse: item => !!item.parent?.flags?.essence20?.[METALLIC_FLAG] || !!item.system?.canActivate,
  run: async (item) => {
    if (item.parent?.flags?.essence20?.[METALLIC_FLAG]) {
      await endMetallicArmor(item.parent);
      return null;
    }

    const { powerCost } = await import("../../sheet-handlers/power-handler.mjs");
    await powerCost(item.parent, item);
    return null;
  },
});

// Solarix Shard (Through the Shattered Grid, gear, p.76): its Power Weapon pick, the +1 Fire hit option and the
// Personal Power discount are rules on its pack item.
