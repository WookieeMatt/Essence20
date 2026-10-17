import { T } from "../shared/item-lang.mjs";
import { itemsOf } from "../shared/item-lookups.mjs";
import { onHook } from "../shared/hooks-and-clients.mjs";
import { ruleAllowsArmorPair } from "../../rules/plugins/effects/veto.mjs";

/**
 * Equipping a second set of armor warns, unless the wearer's ArmorPair rules allow that pair (Bio-Tech Armor - an
 * Organic Battledress set with a Computerized one: rules/plugins/effects/veto.mjs). Power armor never counts.
 */

onHook('preUpdateItem', (item, changes) => {
  if (item?.type != 'armor' || !foundry.utils.getProperty(changes, 'system.equipped') || item.system?.equipped) {
    return;
  }

  const other = itemsOf(item.parent).find(i => i.type == 'armor' && i.id != item.id && i.system?.equipped && !i.system?.isPowerArmor);
  if (!other || item.system?.isPowerArmor) {
    return;
  }

  if (ruleAllowsArmorPair(item.parent, item, other)) {
    return;
  }

  ui.notifications?.warn?.(T('O2TwoArmors', { name: item.parent?.name ?? '' }));
});
