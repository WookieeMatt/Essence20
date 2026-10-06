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
 *   Enhanced Ranged Attack; Other spectrums: Any of the above." Granted as the real megaformTrait.
 * - Adaptable Future Tech (TtSG p.117): "Your Zord gains the Combiner Feature and may combine with
 *   other Zords that do not have the Combiner Zord Feature. When forming a Megaform that includes at
 *   least 3 Zords with this feature, it may include an ineligible vehicle or Zord."
 *   Both combine-eligibility rules feed one roster check that warns when a Zord without Combiner
 *   joins a Megaform nothing lets it into (PR CRB: Zords combine through the Combiner Feature).
 *   The Combiner Feature itself comes from Adaptable Future Tech's own Grant rule (system.rules).
 * - Zord Feature (PR CRB Ranger Roles, 6th/10th/14th/17th level, e.g. Black Ranger p.32): the
 *   Ranger's Zord gains a Zord Feature of their choice - the same picker Torozord Feature uses
 *   (items/zords/torozord-feature.mjs), onto the Ranger's own Zord (or onto themselves with Zord Ultra
 *   Mode, whose Zord Features "apply to your Zord Ultra Mode").
 * - Zord Ultra Mode (Field Guide to Action & Adventure, p.72): "Once per scene while Morphed, you
 *   can spend 1 Personal Power to convert to Zord Ultra Mode... When you convert to Zord Ultra Mode,
 *   you gain the benefits of your Zord Features... Zord Ultra Mode lasts until you are Defeated or
 *   until the end of the scene." The Zord Features sit on the character; their Active Effects are
 *   switched on only while the Mode lasts.
 * - Defender Torozord (TtSG p.24): "While in Mega Defender form, you and the Torozord are considered
 *   to have the Combiner Zord Feature with the Core Body and Defender Megaform Traits, respectively,
 *   but only to combine to create a unique Megaform known as the Defender Torozord."
 * - Repair Zord (PR CRB, Grid Power, p.101): "If healing a combined Megaform, the cost of this Grid
 *   Power increases by 1, but the amount healed is divided evenly amongst all combined parts
 *   (minimum of 1)." items/healing/repair-zord.mjs hands over to repairCombinedMegaform when the piloted
 *   Zord is part of a Megaform (patch spec zord2-patch.cjs).
 */
import {
  registerAfterDamage, registerSceneAdvanced, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { activateForWindow, getUses, isActiveForWindow, markUsed } from "../../mechanics/resources/scene-clock.mjs";
import {
  holds, isCombinerForm, itemsOf, megaformsContaining, rosterOf, sourceOf, T, writeDoc, ZORD2,
} from "./combiner-roster-helpers.mjs";

const flagOf = (doc, key) => doc?.flags?.essence20?.[key];

/* -------------------------------------------- */
/*  Versatile Combiner, Adaptable Future Tech    */
/* -------------------------------------------- */

export const SPECTRUM_TRAITS = {
  black: ZORD2.prCoreDefenses,
  blue: ZORD2.layeredSystems,
  green: ZORD2.enhancedMeleeAttack,
  pink: ZORD2.prMove,
  red: ZORD2.assaultWeapon,
  yellow: ZORD2.enhancedRangedAttack,
};

/** The Ranger a Zord belongs to: the character whose roster lists it. */
export function zordOwner(zord) {
  return worldActors().find(a => ['playerCharacter', 'npc'].includes(a?.type)
    && Object.values(a.system?.actors ?? {}).some(e => e?.uuid == zord?.uuid)) ?? null;
}

/** A Ranger's spectrum colour, from their Role's name ("Black Ranger" -> 'black'), or null. */
export function spectrumOf(actor) {
  const role = itemsOf(actor).find(i => i.type == 'role');
  const match = /\b(black|blue|green|pink|red|yellow)\b/i.exec(role?.name ?? '');
  return match ? match[1].toLowerCase() : null;
}

async function grantVersatileTrait(feature) {
  const zord = feature.parent;
  let spectrum = spectrumOf(zordOwner(zord));
  if (!spectrum) {
    const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
    spectrum = await chooseSelect(feature.name, T('Zord2PickSpectrum'),
      Object.keys(SPECTRUM_TRAITS).map(value => ({ value, label: T(`Zord2Spectrum.${value}`) })));
  }

  const uuid = SPECTRUM_TRAITS[spectrum];
  if (!uuid || holds(zord, uuid)) return;
  const { grantCopy } = await import("../../mechanics/resources/grants.mjs");
  await grantCopy(zord, uuid, { grantedBy: feature });
}

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
/*  Zord Feature slots, Zord Ultra Mode          */
/* -------------------------------------------- */

async function pickZordFeature(actor, perk) {
  const target = holds(actor, ZORD2.zordUltraMode) ? actor : (await import("../../mechanics/combat/combat.mjs")).getOwnedZord(actor);
  if (!target) {
    ui.notifications.warn(T('Zord2NoZord'));
    return;
  }

  const { buildTorozordFeatureChoices } = await import("./torozord-feature.mjs");
  const choices = await buildTorozordFeatureChoices(target);
  if (!Object.keys(choices).length) {
    ui.notifications.error(game.i18n.localize('E20.NoChoicesError'));
    return;
  }

  const { default: ChoicesSelector } = await import("../../apps/choices-selector.mjs");
  await new ChoicesSelector(choices, target, T('Zord2PickZordFeature'), T('Zord2ZordFeatureTitle', { name: target.name }),
    perk, null, null, null, null, null, 'rolePerk').render(true);
}

export const ULTRA_FLAG = 'zord2UltraMode';
export const ULTRA_USED = 'zord2UltraModeUsed';
export const isUltraActive = actor => isActiveForWindow(actor, ULTRA_FLAG, 'scene') && (actor.system?.health?.value ?? 1) > 0;

/** Zord Features on a Zord Ultra Mode character only work while the Mode lasts. */
export async function syncUltraEffects(actor) {
  if (!holds(actor, ZORD2.zordUltraMode)) return;
  const active = isUltraActive(actor);
  for (const feature of itemsOf(actor).filter(i => i.type == 'feature')) {
    const effects = Array.from(feature.effects ?? []);
    const updates = effects.filter(e => !!e.disabled == active).map(e => ({ _id: e.id, disabled: !active }));
    if (updates.length) {
      await feature.updateEmbeddedDocuments('ActiveEffect', updates);
    }
  }
}

async function useUltraMode(item, economy, pay) {
  const actor = item.parent;
  const { chooseButtons } = await import("../../mechanics/resources/grants.mjs");
  const choice = await chooseButtons(item.name, T('Zord2UltraPrompt'), [
    ['convert', T('Zord2UltraConvert')], ['feature', T('Zord2UltraAddFeature')],
  ]);
  if (choice == 'feature') {
    await pickZordFeature(actor, item);
    return null;
  }

  if (choice != 'convert') return null;
  if (!actor.system?.isMorphed) {
    ui.notifications.warn(T('Zord2UltraNeedsMorph'));
    return null;
  }

  if (getUses(actor, ULTRA_USED, 'scene') >= 1) {
    ui.notifications.warn(T('Zord2OncePerScene', { name: item.name }));
    return null;
  }

  const power = actor.system?.powers?.personal?.value ?? 0;
  if (power < 1) {
    ui.notifications.warn(T('Zord2NotEnoughPower', { cost: 1 }));
    return null;
  }

  if (!(await pay('standard'))) return null;
  await actor.update({ 'system.powers.personal.value': power - 1 });
  await markUsed(actor, ULTRA_USED, { window: 'scene' });
  await activateForWindow(actor, ULTRA_FLAG, 'scene');
  await syncUltraEffects(actor);
  return T('Zord2UltraActivated', { name: actor.name });
}

registerSceneAdvanced(async () => {
  for (const actor of worldActors().filter(a => holds(a, ZORD2.zordUltraMode))) {
    await syncUltraEffects(actor);
  }
});

registerAfterDamage(async (actor) => {
  if ((actor.system?.health?.value ?? 1) <= 0 && holds(actor, ZORD2.zordUltraMode) && flagOf(actor, ULTRA_FLAG)) {
    await actor.unsetFlag('essence20', ULTRA_FLAG);
    await syncUltraEffects(actor);
  }
});

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
/*  Repair Zord on a Megaform                    */
/* -------------------------------------------- */

/**
 * Repair Zord for a Zord that is part of a Megazord: one more Power, the 1d2s divided evenly
 * (minimum 1) among the parts. Returns the total healed, or null when the Zord isn't combined.
 */
export async function repairCombinedMegaform(zord, amountSpent) {
  const megaform = megaformsContaining(zord).find(m => !isCombinerForm(m));
  if (!megaform) return null;
  const dice = Math.floor(Math.max(0, (amountSpent || 0) - 1) / 2);
  const parts = rosterOf(megaform).filter(a => a.type == 'zord');
  if (dice <= 0 || !parts.length) return 0;

  const roll = await new Roll(`${dice}d2`).evaluate();
  const share = Math.max(1, Math.floor(roll.total / parts.length));
  let healed = 0;
  for (const part of parts) {
    const health = part.system?.health;
    if (!health) continue;
    const next = Math.min(health.max, health.value + share);
    healed += next - health.value;
    await writeDoc(part, 'update', { 'system.health.value': next });
  }

  return healed;
}

/* -------------------------------------------- */
/*  Wiring                                       */
/* -------------------------------------------- */

registerUse({
  id: 'zord2-zord-features',
  matches: item => [ZORD2.zordUltraMode, ZORD2.defenderTorozord].includes(sourceOf(item)),
  run: async (item, economy, pay) => {
    const source = sourceOf(item);
    if (source == ZORD2.zordUltraMode) return useUltraMode(item, economy, pay);
    return useDefenderTorozord(item);
  },
});

export async function onCreateItem(item, options, userId) {
  if (userId != game.user?.id || !item?.parent) return;
  const source = sourceOf(item);
  const actor = item.parent;
  if (source == ZORD2.zordFeatureSlot) {
    await pickZordFeature(actor, item);
  } else if (source == ZORD2.versatileCombiner && actor.type == 'zord') {
    await grantVersatileTrait(item);
  } else if (item.type == 'feature' && holds(actor, ZORD2.zordUltraMode)) {
    await syncUltraEffects(actor);
  } else if (source == ZORD2.zordUltraMode) {
    await syncUltraEffects(actor);
  }
}

if (typeof Hooks != 'undefined') {
  Hooks.on('createItem', (...args) => onCreateItem(...args).catch(error => console.error('Essence20 | zord2', error)));
  Hooks.on('updateActor', (actor, changes, options, userId) => {
    if (userId != game.user?.id || actor.type != 'megaform' || isCombinerForm(actor) || changes?.system?.actors === undefined) return;
    const bad = ineligibleZords(rosterOf(actor).filter(a => a.type == 'zord'));
    if (bad.length) {
      ui.notifications.warn(T('Zord2NotCombinerEligible', { names: bad.map(z => z.name).join(', ') }));
    }
  });
}
