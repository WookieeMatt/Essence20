import {
  registerHitRider, registerPostRoll, registerSceneAdvanced, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { getUses, markUsed } from "../../mechanics/resources/scene-clock.mjs";
import {
  IDS, T, applyStatus, escapeHtml, isItem, itemsOf,
} from "../shared/pr-crb-ttsg-item-ids.mjs";

/**
 * Through the Shattered Grid pieces of the pr3 slice. Each rule is quoted above its code.
 */

const isAttackEffect = item => item?.type == 'weaponEffect';

/* -------------------------------------------- */
/*  Elemental Fury (Zord Feature)                */
/* -------------------------------------------- */

// Elemental Fury (TtSG, Zord Feature, p.33): "Once per scene, this Zord can unleash a powerful
// elemental ranged Attack... choose among air, earth, fire, lightning, and water. The Attack deals
// two times the normal level of damage as this Zord's strongest ranged Attack, uses its Range, and
// has the following additional characteristics according to the selected element". The Use button
// builds that Attack on the Zord for one roll (the element is picked the first time and kept on the
// Feature); it goes away once rolled, or when the scene ends.
export const FURY = {
  air: { damageType: 'sonic', status: 'impaired' },
  earth: { damageType: 'blunt', status: 'prone' },
  fire: { damageType: 'fire', bonus: 2 },
  lightning: { damageType: 'electric', status: 'stunned' },
  water: { damageType: 'cold', status: 'immobilized' },
};
const FURY_FLAG = 'pr3ElementalFury';
const FURY_USES = 'pr3ElementalFuryUses';

/** The Zord's strongest ranged Attack (the Fury's own excluded). */
export function strongestRanged(zord) {
  const ranged = itemsOf(zord).filter(item => isAttackEffect(item) && item.system?.classification?.style
    && item.system.classification.style != 'melee' && !item.flags?.essence20?.[FURY_FLAG]
    && !zord.items?.get?.(item.flags?.essence20?.parentId)?.flags?.essence20?.[FURY_FLAG]);
  return ranged.sort((a, b) => (Number(b.system?.damageValue) || 0) - (Number(a.system?.damageValue) || 0))[0] ?? null;
}

registerUse({
  id: 'pr3ElementalFury',
  matches: item => isItem(item, IDS.elementalFury),
  canUse: item => getUses(item.parent, FURY_USES, 'scene') < 1,
  run: async (item) => {
    const zord = item.parent;
    let element = item.flags?.essence20?.pr3Element;
    if (!FURY[element]) {
      const { chooseButtons } = await import("../../mechanics/resources/grants.mjs");
      element = await chooseButtons(item.name, T('Pr3FuryElementPrompt'), Object.keys(FURY).map(key => [key, T(`Pr3FuryElement.${key}`)]));
      if (!FURY[element]) {
        return null;
      }

      await item.setFlag('essence20', 'pr3Element', element);
    }

    const base = strongestRanged(zord);
    if (!base) {
      ui.notifications.warn(T('Pr3FuryNoRanged', { name: zord.name }));
      return null;
    }

    const name = `${item.name} (${T(`Pr3FuryElement.${element}`)})`;
    const [weapon] = await zord.createEmbeddedDocuments('Item', [{ name, type: 'weapon', flags: { essence20: { [FURY_FLAG]: element } }, system: {} }]);
    await zord.createEmbeddedDocuments('Item', [{
      name,
      type: 'weaponEffect',
      flags: { essence20: { parentId: weapon.id, [FURY_FLAG]: element } },
      system: {
        classification: foundry.utils.deepClone(base.system.classification),
        damageType: FURY[element].damageType,
        damageValue: 2 * (Number(base.system.damageValue) || 0),
        defenseType: base.system.defenseType ?? 'toughness',
        range: foundry.utils.deepClone(base.system.range),
      },
    }]);
    await markUsed(zord, FURY_USES, { window: 'scene' });
    return T('Pr3FuryReady', { name: escapeHtml(zord.name), attack: escapeHtml(name) });
  },
});

function furyWeapon(actor, rider) {
  const weapon = rider?.weaponId ? actor?.items?.get?.(rider.weaponId) : null;
  return weapon?.flags?.essence20?.[FURY_FLAG] ? weapon : null;
}

async function removeFury(actor) {
  const doomed = itemsOf(actor).filter(item => item.flags?.essence20?.[FURY_FLAG]).map(item => item.id);
  if (doomed.length) {
    await actor.deleteEmbeddedDocuments('Item', doomed);
  }
}

// Critical riders: Air Impaired, Earth Prone, Lightning Stunned, Water Immobilized ("until the end
// of their next turn" - one round), Fire "+2 damage".
registerHitRider(async (actor, target, result, rider, tools) => {
  const weapon = furyWeapon(actor, rider);
  const spec = FURY[weapon?.flags?.essence20?.[FURY_FLAG]];
  if (!spec || !tools?.isCrit) {
    return;
  }

  if (spec.bonus) {
    tools.damageBonusNote(result, spec.bonus, weapon.name);
  } else {
    await applyStatus(target, spec.status, spec.status == 'prone' ? null : 1);
  }
});

registerPostRoll(async (actor, results, checkContext, { rider } = {}) => {
  if (furyWeapon(actor, rider)) {
    await removeFury(actor);
  }
});

registerSceneAdvanced(async () => {
  if (!game.user?.isGM) {
    return;
  }

  for (const actor of worldActors()) {
    if (itemsOf(actor).some(item => item.flags?.essence20?.[FURY_FLAG])) {
      await removeFury(actor);
    }
  }
});

// Power Construct (TtSG, Zord Feature, p.34): its melee Alternate Effect (a hit option), the 1 Energy back at a
// melee attacker (a GM damage button) and the vanishing at 0 Health are rules on its pack item.

// (Restraining Gear is a pair of hit Triggers on the Zord Feature - its own and every Megaform it is part of -
// rules/conv10-slD10.test.js.)

/* -------------------------------------------- */
/*  Emissary's Gift                              */
/* -------------------------------------------- */

// Emissary's Gift (TtSG, General Perk) is the Perk's own Use rule: pickPerk over the PR CRB Roles (pack pr_crb) at or
// below the character's level, leaving out the excluded names.

// Morphin Navigator's Grid Power Bloom (once per mission, a Standard action, 1d2 Personal Power to
// each Party member up to their own maximum) and its Grid-navigation Edge are the item's own rules.

// Protector of Safehaven (once per mission: a Limited weapon, tracked 1 Temporary Health, or a mission-long
// mark the Edge / ↑1 Roll Options switches read) is the Perk's own rules.
