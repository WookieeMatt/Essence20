/**
 * Power Rangers Zord Features and Role Perks for the zord2 slice.
 *
 * - Warrior Mode (PR CRB, Zord Feature, p.140): its Towering Size is the item's own Size rule (the rest
 *   live in items/zords/warrior-mode.mjs).
 * - Mesh Zord and Power Matrix (TtSG p.33-34) are their items' own rules (module/rules/ext/a/ - three picks from
 *   one list, DerivedStat / Defense / Size rules; the reserve drawn by the driver, refilled when the pilot rests).
 * - Versatile Combiner (TtSG p.35): "may combine into a Megaform with any Zord that lacks the
 *   Combiner Zord Feature without spending a Story Point. In addition, that Zord provides one of the
 *   following Megaform Trait benefits depending on its Ranger's spectrum: Black: Core Defenses;
 *   Blue: Layered Systems; Green: Enhanced Melee Attack; Pink: Move; Red: Assault Weapon; Yellow:
 *   Enhanced Ranged Attack; Other spectrums: Any of the above." The trait is the Feature's own added Trigger rule
 *   (rules/conv15-items2.test.js); what stays here is its part in combine eligibility below.
 * - Adaptable Future Tech (TtSG p.117): "Your Zord gains the Combiner Feature and may combine with
 *   other Zords that do not have the Combiner Zord Feature. When forming a Megaform that includes at
 *   least 3 Zords with this feature, it may include an ineligible vehicle or Zord."
 *   Both combine-eligibility rules feed one roster check that warns when a Zord without Combiner
 *   joins a Megaform nothing lets it into (PR CRB: Zords combine through the Combiner Feature).
 *   The Combiner Feature itself comes from Adaptable Future Tech's own Grant rule (system.rules).
 * - Zord Feature (the Ranger Roles' Zord Feature picks) and Zord Ultra Mode (Field Guide to Action & Adventure) are their
 *   items' own rules (pickGrant a Feature onto the Zord or the character; a scene mark switching the Features' Active
 *   Effects with setEffects) - rules/conv15-items2.test.js.
 * - Defender Torozord (TtSG p.24): "While in Mega Defender form, you and the Torozord are considered
 *   to have the Combiner Zord Feature with the Core Body and Defender Megaform Traits, respectively,
 *   but only to combine to create a unique Megaform known as the Defender Torozord."
 * - (Repair Zord's split healing on a combined Megaform is its pack item's own rule - healShared, rules/conv15-systems.test.js.)
 */
import { registerUse } from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import {
  holds, isCombinerForm, itemsOf, rosterOf, sourceOf, T, ZORD2,
} from "./combiner-roster-helpers.mjs";

const flagOf = (doc, key) => doc?.flags?.essence20?.[key];

/* -------------------------------------------- */
/*  Versatile Combiner, Adaptable Future Tech    */
/* -------------------------------------------- */

/**
 * Zords in a Megazord roster that nothing lets in: no Combiner Feature, not covered by a Versatile
 * Combiner partner (one each), and not carried by three or more Adaptable Future Tech Zords.
 */
export function ineligibleZords(zords) {
  const aft = zords.filter(z => holds(z, ZORD2.adaptableFutureTech)).length;
  if (aft >= 3) return [];
  let versatile = zords.filter(z => holds(z, ZORD2.versatileCombiner)).length;
  const anyAft = aft > 0;
  return zords.filter(z => !holds(z, ZORD2.combiner)).filter(() => {
    if (anyAft) return false;
    if (versatile > 0) {
      versatile -= 1;
      return false;
    }

    return true;
  });
}

/* -------------------------------------------- */
/*  Defender Torozord                            */
/* -------------------------------------------- */

export const DT_FLAG = 'zord2DefenderTorozord';

async function useDefenderTorozord(item) {
  const actor = item.parent;
  const zords = Object.values(actor.system?.actors ?? {}).filter(e => e.type == 'zord').map(e => fromUuidSync(e.uuid)).filter(Boolean);
  const megaDefender = zords.find(z => /mega\s*defender/i.test(z.name));
  const torozord = zords.find(z => z !== megaDefender);
  const existing = worldActors().find(a => a?.type == 'megaform' && flagOf(a, DT_FLAG) == actor.uuid);

  if (existing && Object.keys(existing.system?.actors ?? {}).length) {
    // Separate: the borrowed Combiner traits only ever work for this one Megaform.
    const update = {};
    for (const key of Object.keys(existing.system.actors)) update[`system.actors.-=${key}`] = null;
    await existing.update(update);
    for (const zord of zords) {
      const granted = itemsOf(zord).filter(i => flagOf(i, DT_FLAG)).map(i => i.id);
      if (granted.length) await zord.deleteEmbeddedDocuments('Item', granted);
    }

    return T('Zord2DefenderTorozordSeparated', { name: actor.name });
  }

  if (!megaDefender || !torozord) {
    ui.notifications.warn(T('Zord2DefenderTorozordNeedsForms'));
    return null;
  }

  for (const [zord, type, name] of [[megaDefender, 'coreBody', T('Zord2TraitCoreBody')], [torozord, 'defender', T('Zord2TraitDefender')]]) {
    if (!itemsOf(zord).some(i => flagOf(i, DT_FLAG))) {
      await zord.createEmbeddedDocuments('Item', [{
        name, type: 'megaformTrait', system: { type, value: 1 }, flags: { essence20: { [DT_FLAG]: true } },
      }]);
    }
  }

  const roster = Object.fromEntries([megaDefender, torozord].map(z => [foundry.utils.randomID(4), { uuid: z.uuid, img: z.img, name: z.name, type: z.type }]));
  if (existing) {
    await existing.update({ 'system.actors': roster });
  } else if (game.user.isGM || game.user.can?.('ACTOR_CREATE')) {
    await Actor.create({
      name: item.name, type: 'megaform', img: torozord.img,
      system: { subtype: ['megaformZord'], actors: roster },
      flags: { essence20: { [DT_FLAG]: actor.uuid } },
      ownership: { default: 0, [game.user.id]: 3 },
    });
  } else {
    ui.notifications.warn(T('Zord2DefenderTorozordNeedsGm'));
    return null;
  }

  return T('Zord2DefenderTorozordFormed', { name: actor.name });
}

/* -------------------------------------------- */
/*  Wiring                                       */
/* -------------------------------------------- */

registerUse({
  id: 'zord2-zord-features',
  matches: item => sourceOf(item) == ZORD2.defenderTorozord,
  run: async item => useDefenderTorozord(item),
});

if (typeof Hooks != 'undefined') {
  Hooks.on('updateActor', (actor, changes, options, userId) => {
    if (userId != game.user?.id || actor.type != 'megaform' || isCombinerForm(actor) || changes?.system?.actors === undefined) return;
    const bad = ineligibleZords(rosterOf(actor).filter(a => a.type == 'zord'));
    if (bad.length) {
      ui.notifications.warn(T('Zord2NotCombinerEligible', { names: bad.map(z => z.name).join(', ') }));
    }
  });
}
