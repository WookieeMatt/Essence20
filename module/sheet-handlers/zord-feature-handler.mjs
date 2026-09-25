/**
 * Drop-time behaviour for the Zord Features that configure something rather than carrying a flat
 * bonus. Most Features are one of two already-working kinds: a static compendium Active Effect
 * (Heavy Chassis, Hardened Chassis, Auxiliary Zord, ...) or a live roll-time check keyed on the
 * Feature's own compendium id (Martial Zord, the Ninja Powered variants, Relic Key, ...). The three
 * handled here are neither - RAW has the player CHOOSE something when the Feature is taken ("choose
 * one of the Zord's methods of attack", "choose either a basic melee or ranged attack"), and that
 * choice lands on one of the Zord's own weapon items, not on the actor. Dropping them previously
 * added an inert item and changed nothing at all.
 *
 * Each of these applies its choice as a one-time mutation of the chosen weapon/weaponEffect, the
 * same idiom helpers/weapon-conversion.mjs#convertWeapon already uses for Weapon Conversion ("pick
 * an eligible weapon, permanently rewrite these fields"), rather than inventing a per-item Active
 * Effect mechanism this system doesn't have (effects target the ACTOR, never one owned item).
 */

import {
  MEGA_WEAPON_DAMAGE, MEGA_WEAPON_EFFECT_FLAG, MEGA_WEAPON_ID,
} from "../helpers/zord-mega-weapon.mjs";

const PR_CRB = "Compendium.essence20.pr_crb.Item.";
const ENHANCE_ATTACK_ID = `${PR_CRB}OibmwLDNcXE6eJIO`;
const ADDITIONAL_ATTACK_TYPE_ID = `${PR_CRB}j5arWXvkd5fHbe0Q`;
const BLAST_ATTACK_ID = `${PR_CRB}Wb8UARwQKKyiwy77`;
// Increase (Essence) (PR CRB, Zord Feature, p.137): "This Zord Feature increases one of these two
// ability scores [Strength or Speed] by +2." The compendium item ships both bonuses as its own
// Active Effects, one per Essence, both disabled - the exact "prompt, then enable the matching
// bundled Active Effect" shape helpers/speak-your-truth.mjs#grantSpeakYourTruthEssence already
// uses for a Perk; this is that idiom's Zord Feature equivalent, run after dropFunc() (unlike
// Speak Your Truth, which runs on an already-embedded Perk) since a dropped Feature is still the
// compendium source item at this point - see this file's own dropFunc-last idiom above.
const INCREASE_ESSENCE_ID = `${PR_CRB}oKGzWCOUCuefWuqD`;

// Light Chassis (PR CRB, Zord Feature, p.137, 2nd ptg): "increases the Zord's Speed by 1 and adds
// 10 feet [to] one of the Zord's movement types." The Speed+1 (and the Megaform Initiative
// carry-over - see documents/actor.mjs's own hasLightChassisInitiativeUpshift) are already a
// plain always-on AE; only the movement pick, among the compendium item's own 4 disabled
// +10ft-per-type AEs, needed a picker.
const LIGHT_CHASSIS_ID = `${PR_CRB}rVW7mvnV4MbGuxoq`;
// Movement Booster (PR CRB, Zord Feature, p.137, 2nd ptg): "adds 30 feet to one of the Zord's
// movement types or creates a new kind of movement type... at 45 feet." Same picker shape as
// Light Chassis just above, but with a twist RAW itself calls out: the compendium item only ships
// disabled +30ft AEs for the 4 movement types a Zord might already possess (matching Light
// Chassis/Fast's own idiom), so choosing one the Zord DOESN'T already have (base 0, e.g. Burrow
// for a non-burrowing Zord) creates a brand new +45ft AE instead of enabling a nonexistent one.
const MOVEMENT_BOOSTER_ID = `${PR_CRB}9YQmZGdNCmtXLAd4`;

const THROUGH_THE_SHATTERED_GRID = "Compendium.essence20.through_the_shattered_grid.Item.";
// Multi-Limb Attack (Through the Shattered Grid, Zord Feature, p.118): "Choose one of your Zord's
// melee attacks. The attack gains Multi-Weapon (3)." Same "choose an attack, mutate its
// weaponEffect" shape as Enhance (Attack)'s own 'multiWeapon' option (a flat 2 the first time,
// +1 per repeat) - this Feature is a fixed (3) grant instead, so it doesn't stack additively with
// itself or with Enhance Attack the way that repeatable option does; Math.max keeps a lower
// existing value from clobbering a higher one either way, matching Enhance Attack's own guard.
const MULTI_LIMB_ATTACK_ID = `${THROUGH_THE_SHATTERED_GRID}cRtPjBG1OoXwKJ0b`;
// Restraining Chains (Through the Shattered Grid, Zord Feature, p.35): "Your Zord gains a ranged
// Attack with a normal range of 30 feet and a long range of 65 feet that Grapples the target if
// successful." A fixed, pre-configured attack (unlike Additional Attack Type's own melee/ranged +
// damage-type picker) - built straight from BASELINE_ATTACKS.ranged with no dialog needed, damage
// replaced by the Grapple damageType (Wrestler/Kung Fu Grip's own real, existing damageType
// proxy) rather than a numeric damage value - a successful Grapple attack applies the Grapple
// damageType's own existing "target is Grappled" handling, not raw damage.
const RESTRAINING_CHAINS_ID = `${THROUGH_THE_SHATTERED_GRID}AVXOwNhDWQJewKAl`;

/**
 * Baseline Zord attack statistics (PR CRB p.134's own Baseline Zord stat block):
 * "Melee Weapon Attack (Might): +d6 or pilot's Driving, Reach (2 Blunt/Sharp damage)" /
 * "Ranged Weapon Attack (Targeting): +d6 or pilot's Driving, Range 50ft/120ft (2 Energy damage)".
 * Additional Attack Type grants exactly one more of these, so it builds from the same numbers
 * rather than copying whatever the Zord's existing attack happens to have been edited to.
 */
const BASELINE_ATTACKS = {
  melee: {
    labelKey: 'E20.ZordFeatureAttackMelee',
    classification: { skill: 'might', style: 'melee' },
    damageValue: 2,
    range: { min: null, reachMultiplier: 1, long: null, value: null },
  },
  ranged: {
    labelKey: 'E20.ZordFeatureAttackRanged',
    classification: { skill: 'targeting', style: 'projectile' },
    damageValue: 2,
    range: { min: null, reachMultiplier: 1, long: 120, value: 50 },
  },
};

/**
 * Resolves the compendium id a dropped Feature came from. A drop straight off a compendium hands us
 * the compendium document itself (its uuid IS the compendium uuid); a copy already living in the
 * world carries it on _stats.compendiumSource instead (or flags.core.sourceId on documents created
 * before v12) - the same dual lookup helpers/zord-features.mjs#actorHasZordFeature does.
 * @param {Item} item
 * @returns {String|null}
 */
function featureSourceId(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.uuid ?? null;
}

/**
 * Every attack the Zord can currently make, as {effect, weapon} pairs. A weaponEffect carries the
 * numbers (damage, range, targets) while its parent weapon carries the display name and the traits
 * array, so both are needed to describe one attack or to modify it.
 * @param {Actor} actor
 * @returns {Array<{effect: Item, weapon: Item|null, label: String}>}
 */
function getAttacks(actor) {
  return actor.items.filter(item => item.type == 'weaponEffect').map(effect => {
    const weapon = actor.items.get(effect.flags?.essence20?.parentId) ?? null;
    return { effect, weapon, label: weapon ? `${weapon.name} - ${effect.name}` : effect.name };
  });
}

/**
 * One-of-many picker. Returns the chosen key, or null if the dialog was dismissed - every caller
 * treats null as "cancel the whole drop", so a Feature is never added with its choice unmade.
 * @param {String} title
 * @param {String} prompt
 * @param {Object} choices   key -> display label
 * @returns {Promise<String|null>}
 */
async function pickOne(title, prompt, choices) {
  const options = Object.entries(choices)
    .map(([key, label]) => `<option value="${key}">${foundry.utils.escapeHTML(label)}</option>`)
    .join('');

  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${prompt}</label><select name="choice">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.choice.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Enhance (Attack) (PR CRB, Zord Feature, p.137): "Choose one of the Zord's methods of attack.
 * Choose either to add Accurate (1) to the attack, add 1 damage, or apply one special effect from
 * the list below."
 *
 * Six of the eight options are a field on the chosen weaponEffect (or, for Accurate, a trait on its
 * parent weapon, now that dice.mjs reads accurate/inaccurate) and are applied here. The remaining
 * two - "Ignores Armor Bonus to Toughness" and "Reduces target's Speed by 1d2" - have no field to
 * write: the first needs a weapon-trait-driven route into getDefenseValue's ignoreArmor option
 * (E20.weaponTraits.armorPiercing/antiTank are config labels only, same gap), the second an on-hit
 * effect application. Both are still offered, so the Feature can record what was chosen, but say
 * plainly that they're GM-adjudicated rather than silently doing nothing.
 * @param {Actor} actor
 * @param {Function} dropFunc
 * @returns {Promise<Array<Item>|null>}
 */
async function onEnhanceAttackDrop(actor, dropFunc) {
  const attacks = getAttacks(actor);
  if (!attacks.length) {
    ui.notifications.warn(game.i18n.localize('E20.ZordFeatureNoAttacks'));
    return null;
  }

  const attackChoices = Object.fromEntries(attacks.map((a, i) => [String(i), a.label]));
  const attackIndex = await pickOne(
    game.i18n.localize('E20.ZordFeatureEnhanceTitle'),
    game.i18n.localize('E20.ZordFeatureEnhancePickAttack'),
    attackChoices,
  );
  if (attackIndex === null) return null;

  const { effect, weapon } = attacks[Number(attackIndex)];
  const enhancement = await pickOne(
    game.i18n.localize('E20.ZordFeatureEnhanceTitle'),
    game.i18n.localize('E20.ZordFeatureEnhancePickOption'),
    {
      accurate: game.i18n.localize('E20.ZordFeatureEnhanceAccurate'),
      damage: game.i18n.localize('E20.ZordFeatureEnhanceDamage'),
      reach: game.i18n.localize('E20.ZordFeatureEnhanceReach'),
      range: game.i18n.localize('E20.ZordFeatureEnhanceRange'),
      multiWeapon: game.i18n.localize('E20.ZordFeatureEnhanceMultiWeapon'),
      damageType: game.i18n.localize('E20.ZordFeatureEnhanceDamageType'),
      ignoreArmor: game.i18n.localize('E20.ZordFeatureEnhanceIgnoreArmor'),
      reduceSpeed: game.i18n.localize('E20.ZordFeatureEnhanceReduceSpeed'),
    },
  );
  if (enhancement === null) return null;

  const update = {};
  let summaryKey = null;

  switch (enhancement) {
  case 'accurate': {
    // Lives on the parent weapon's traits array, not the effect - that's where dice.mjs reads it
    // from (see _getAutomaticCombatModifiers' accurate/inaccurate check).
    if (!weapon) {
      ui.notifications.warn(game.i18n.localize('E20.ZordFeatureEnhanceNoParentWeapon'));
      return null;
    }

    const traits = weapon.system.traits ?? [];
    if (!traits.includes('accurate')) {
      await weapon.update({ 'system.traits': [...traits, 'accurate'] });
    }

    summaryKey = 'E20.ZordFeatureEnhanceAccurate';
    break;
  }

  case 'damage':
    update['system.damageValue'] = (effect.system.damageValue ?? 0) + 1;
    summaryKey = 'E20.ZordFeatureEnhanceDamage';
    break;
  case 'reach':
    // "Doubles Melee Reach" - reachMultiplier is what weapon-effect.mjs multiplies the actor's own
    // size-derived reach by (see its prepareDerivedData), so doubling it is literally the rule.
    update['system.range.reachMultiplier'] = (effect.system.range?.reachMultiplier || 1) * 2;
    summaryKey = 'E20.ZordFeatureEnhanceReach';
    break;
  case 'range':
    update['system.range.value'] = (effect.system.range?.value ?? 0) + 30;
    update['system.range.long'] = (effect.system.range?.long ?? 0) + 60;
    summaryKey = 'E20.ZordFeatureEnhanceRange';
    break;
  case 'multiWeapon':
    // "Gain Multi-Weapon (2) (or add +1 if taken multiple times)" - 2 the first time, then +1.
    update['system.numTargets'] = Math.max(2, (effect.system.numTargets ?? 1) + 1);
    summaryKey = 'E20.ZordFeatureEnhanceMultiWeapon';
    break;
  case 'damageType': {
    const damageType = await pickOne(
      game.i18n.localize('E20.ZordFeatureEnhanceTitle'),
      game.i18n.localize('E20.ZordFeatureEnhancePickDamageType'),
      Object.fromEntries(Object.entries(CONFIG.E20.damageTypes)
        .map(([key, label]) => [key, game.i18n.localize(label)])),
    );
    if (damageType === null) return null;

    update['system.damageType'] = damageType;
    summaryKey = 'E20.ZordFeatureEnhanceDamageType';
    break;
  }

  default:
    // ignoreArmor / reduceSpeed - recorded on the sheet, applied by the GM.
    ui.notifications.info(game.i18n.localize('E20.ZordFeatureEnhanceManual'));
  }

  if (!foundry.utils.isEmpty(update)) {
    await effect.update(update);
  }

  if (summaryKey) {
    ui.notifications.info(game.i18n.format('E20.ZordFeatureEnhanceApplied', {
      option: game.i18n.localize(summaryKey),
      attack: effect.name,
    }));
  }

  return dropFunc();
}

/**
 * Additional Attack Type (PR CRB, Zord Feature, p.136): "You may choose to add either a basic melee
 * or ranged attack to your Zord, using the baseline Zord attack statistics and choosing the details
 * (damage type, description, etc.)." Builds a real weapon + weaponEffect pair on the Zord from
 * BASELINE_ATTACKS above, linked by the same flags.essence20.parentId attachment every other
 * weapon/weaponEffect pair uses, so the new attack is immediately rollable from the sheet.
 * @param {Actor} actor
 * @param {Function} dropFunc
 * @returns {Promise<Array<Item>|null>}
 */
async function onAdditionalAttackTypeDrop(actor, dropFunc) {
  const style = await pickOne(
    game.i18n.localize('E20.ZordFeatureAttackTypeTitle'),
    game.i18n.localize('E20.ZordFeatureAttackTypePickStyle'),
    {
      melee: game.i18n.localize(BASELINE_ATTACKS.melee.labelKey),
      ranged: game.i18n.localize(BASELINE_ATTACKS.ranged.labelKey),
    },
  );
  if (style === null) return null;

  const damageType = await pickOne(
    game.i18n.localize('E20.ZordFeatureAttackTypeTitle'),
    game.i18n.localize('E20.ZordFeatureEnhancePickDamageType'),
    Object.fromEntries(Object.entries(CONFIG.E20.damageTypes)
      .map(([key, label]) => [key, game.i18n.localize(label)])),
  );
  if (damageType === null) return null;

  const baseline = BASELINE_ATTACKS[style];
  const attackName = game.i18n.localize(baseline.labelKey);

  const [weapon] = await actor.createEmbeddedDocuments('Item', [{
    name: attackName,
    type: 'weapon',
    system: { traits: [damageType].filter(t => CONFIG.E20.weaponTraits[t]) },
  }]);

  await actor.createEmbeddedDocuments('Item', [{
    name: game.i18n.format('E20.ZordFeatureAttackEffectName', { name: attackName }),
    type: 'weaponEffect',
    flags: { essence20: { parentId: weapon.id } },
    system: {
      classification: baseline.classification,
      damageType,
      damageValue: baseline.damageValue,
      defenseType: 'toughness',
      range: baseline.range,
    },
  }]);

  ui.notifications.info(game.i18n.format('E20.ZordFeatureAttackTypeAdded', { name: attackName }));

  return dropFunc();
}

/**
 * Blast Attack (PR CRB, Zord Feature, p.136): "Your Zord's ranged attack is designed to deal with
 * groups of targets instead of a single foe. Your ranged attack now deals damage in 10ft radius
 * blast area of attack." radius + shape are the two fields helpers/aoe-targeting.mjs already keys
 * its area placement off (see weapon-effect.mjs's own `shape` comment), so this is exactly the
 * "burst" shape an ordinary Blast weapon already uses.
 * @param {Actor} actor
 * @param {Function} dropFunc
 * @returns {Promise<Array<Item>|null>}
 */
async function onBlastAttackDrop(actor, dropFunc) {
  const ranged = getAttacks(actor).filter(a => a.effect.system.classification?.style != 'melee');
  if (!ranged.length) {
    ui.notifications.warn(game.i18n.localize('E20.ZordFeatureNoRangedAttack'));
    return null;
  }

  let chosen = ranged[0];
  if (ranged.length > 1) {
    const index = await pickOne(
      game.i18n.localize('E20.ZordFeatureBlastTitle'),
      game.i18n.localize('E20.ZordFeatureBlastPickAttack'),
      Object.fromEntries(ranged.map((a, i) => [String(i), a.label])),
    );
    if (index === null) return null;

    chosen = ranged[Number(index)];
  }

  await chosen.effect.update({ 'system.radius': 10, 'system.shape': 'burst' });
  ui.notifications.info(game.i18n.format('E20.ZordFeatureBlastApplied', { attack: chosen.effect.name }));

  return dropFunc();
}

/**
 * Zord Mega-Weapon System (PR CRB, Zord Feature, p.139) - see helpers/zord-mega-weapon.mjs for the
 * pooled cost and duration counter. The drop half handled here is RAW's "the weapon system and its
 * kind of damage (energy, fire, etc.) are decided when the Zord Feature is acquired": pick melee or
 * ranged and a damage type once, and the weapon exists on the sheet from then on, flagged so
 * documents/item.mjs can spend one of its attacks whenever it's rolled. Summoning it (the 5
 * Personal Power) is a separate, repeatable act on the Zord's own sidebar.
 * @param {Actor} actor
 * @param {Function} dropFunc
 * @returns {Promise<Array<Item>|null>}
 */
async function onMegaWeaponDrop(actor, dropFunc) {
  const style = await pickOne(
    game.i18n.localize('E20.MegaWeaponTitle'),
    game.i18n.localize('E20.MegaWeaponPickStyle'),
    {
      melee: game.i18n.localize(BASELINE_ATTACKS.melee.labelKey),
      ranged: game.i18n.localize(BASELINE_ATTACKS.ranged.labelKey),
    },
  );
  if (style === null) return null;

  const damageType = await pickOne(
    game.i18n.localize('E20.MegaWeaponTitle'),
    game.i18n.localize('E20.ZordFeatureEnhancePickDamageType'),
    Object.fromEntries(Object.entries(CONFIG.E20.damageTypes)
      .map(([key, label]) => [key, game.i18n.localize(label)])),
  );
  if (damageType === null) return null;

  const baseline = BASELINE_ATTACKS[style];
  const weaponName = game.i18n.localize('E20.MegaWeaponName');

  const [weapon] = await actor.createEmbeddedDocuments('Item', [{
    name: weaponName,
    type: 'weapon',
    system: { traits: [damageType].filter(t => CONFIG.E20.weaponTraits[t]) },
  }]);

  await actor.createEmbeddedDocuments('Item', [{
    name: game.i18n.format('E20.ZordFeatureAttackEffectName', { name: weaponName }),
    type: 'weaponEffect',
    flags: { essence20: { parentId: weapon.id, [MEGA_WEAPON_EFFECT_FLAG]: true } },
    system: {
      classification: baseline.classification,
      damageType,
      damageValue: MEGA_WEAPON_DAMAGE,
      defenseType: 'toughness',
      range: baseline.range,
    },
  }]);

  ui.notifications.info(game.i18n.localize('E20.MegaWeaponCreated'));

  return dropFunc();
}

/**
 * Multi-Limb Attack (Through the Shattered Grid, Zord Feature, p.118) - see
 * MULTI_LIMB_ATTACK_ID's own comment above.
 * @param {Actor} actor
 * @param {Function} dropFunc
 * @returns {Promise<Array<Item>|null>}
 */
async function onMultiLimbAttackDrop(actor, dropFunc) {
  const melee = getAttacks(actor).filter(a => a.effect.system.classification?.style == 'melee');
  if (!melee.length) {
    ui.notifications.warn(game.i18n.localize('E20.ZordFeatureNoAttacks'));
    return null;
  }

  let chosen = melee[0];
  if (melee.length > 1) {
    const index = await pickOne(
      game.i18n.localize('E20.MultiLimbAttackTitle'),
      game.i18n.localize('E20.ZordFeatureEnhancePickAttack'),
      Object.fromEntries(melee.map((a, i) => [String(i), a.label])),
    );
    if (index === null) return null;

    chosen = melee[Number(index)];
  }

  await chosen.effect.update({ 'system.numTargets': Math.max(3, chosen.effect.system.numTargets ?? 1) });
  ui.notifications.info(game.i18n.format('E20.MultiLimbAttackApplied', { attack: chosen.effect.name }));

  return dropFunc();
}

/**
 * Restraining Chains (Through the Shattered Grid, Zord Feature, p.35) - see
 * RESTRAINING_CHAINS_ID's own comment above. Built straight from BASELINE_ATTACKS.ranged (no
 * dialog - RAW gives this attack fixed stats), with the Grapple damageType in place of a real
 * damage value/type - the same "Grapple is a real, existing damageType, an ordinary weaponEffect
 * attack" idiom Wrestler/Kung Fu Grip already establish elsewhere in this codebase.
 * @param {Actor} actor
 * @param {Function} dropFunc
 * @returns {Promise<Array<Item>|null>}
 */
async function onRestrainingChainsDrop(actor, dropFunc) {
  const attackName = game.i18n.localize('E20.RestrainingChainsAttackName');

  const [weapon] = await actor.createEmbeddedDocuments('Item', [{
    name: attackName,
    type: 'weapon',
    system: {},
  }]);

  await actor.createEmbeddedDocuments('Item', [{
    name: game.i18n.format('E20.ZordFeatureAttackEffectName', { name: attackName }),
    type: 'weaponEffect',
    flags: { essence20: { parentId: weapon.id } },
    system: {
      classification: BASELINE_ATTACKS.ranged.classification,
      damageType: 'grapple',
      damageValue: 0,
      defenseType: 'toughness',
      range: { min: null, reachMultiplier: 1, long: 65, value: 30 },
    },
  }]);

  ui.notifications.info(game.i18n.format('E20.ZordFeatureAttackTypeAdded', { name: attackName }));

  return dropFunc();
}

/**
 * Increase (Essence) (PR CRB, Zord Feature, p.137) - see INCREASE_ESSENCE_ID's own doc comment.
 * @param {Actor} actor
 * @param {Function} dropFunc
 * @returns {Promise<Array<Item>|null>}
 */
async function onIncreaseEssenceDrop(actor, dropFunc) {
  const essence = await pickOne(
    game.i18n.localize('E20.ZordFeatureIncreaseEssenceTitle'),
    game.i18n.localize('E20.ZordFeatureIncreaseEssencePickEssence'),
    {
      strength: game.i18n.localize(CONFIG.E20.essences.strength),
      speed: game.i18n.localize(CONFIG.E20.essences.speed),
    },
  );
  if (essence === null) return null;

  const droppedItemList = await dropFunc();
  const newItem = droppedItemList[0];
  const changeKey = `system.essences.${essence}.value`;
  const effect = newItem.effects.find(e => e.changes.some(c => c.key == changeKey));
  if (effect) {
    await effect.update({ disabled: false });
  }

  ui.notifications.info(game.i18n.format('E20.ZordFeatureIncreaseEssenceApplied', {
    essence: game.i18n.localize(CONFIG.E20.essences[essence]),
  }));

  return droppedItemList;
}

/**
 * Enables the embedded item's own pre-baked disabled `system.movement.<type>.bonus` Active
 * Effect if one exists (Light Chassis/Movement Booster both ship one per movement type they
 * anticipate), or creates a fresh one at `bonus` if not (Movement Booster's own "new movement
 * type" case - see MOVEMENT_BOOSTER_ID's own doc comment).
 * @param {Item} newItem The actor-embedded Zord Feature instance (post-dropFunc)
 * @param {String} movementType One of CONFIG.E20.movementTypes' own keys
 * @param {Number} bonus The feet of movement bonus to apply
 */
async function applyMovementBonus(newItem, movementType, bonus) {
  const changeKey = `system.movement.${movementType}.bonus`;
  const effect = newItem.effects.find(e => e.changes.some(c => c.key == changeKey));
  if (effect) {
    await effect.update({ disabled: false, changes: [{ ...effect.changes[0], value: String(bonus) }] });
  } else {
    await newItem.createEmbeddedDocuments('ActiveEffect', [{
      name: `${newItem.name} (${game.i18n.localize(CONFIG.E20.movementTypes[movementType])})`,
      img: 'icons/svg/aura.svg',
      disabled: false,
      transfer: true,
      changes: [{ key: changeKey, mode: 2, value: String(bonus) }],
    }]);
  }
}

/**
 * Light Chassis (PR CRB, Zord Feature, p.137) - see LIGHT_CHASSIS_ID's own doc comment.
 * @param {Actor} actor
 * @param {Function} dropFunc
 * @returns {Promise<Array<Item>|null>}
 */
async function onLightChassisDrop(actor, dropFunc) {
  const choices = {};
  for (const type of Object.keys(CONFIG.E20.movementTypes)) {
    if (actor.system.movement?.[type]?.base > 0) {
      choices[type] = game.i18n.localize(CONFIG.E20.movementTypes[type]);
    }
  }

  if (!Object.keys(choices).length) {
    ui.notifications.warn(game.i18n.localize('E20.ZordFeatureNoMovement'));
    return null;
  }

  const movementType = await pickOne(
    game.i18n.localize('E20.ZordFeatureLightChassisTitle'),
    game.i18n.localize('E20.ZordFeatureMovementPickType'),
    choices,
  );
  if (movementType === null) return null;

  const droppedItemList = await dropFunc();
  await applyMovementBonus(droppedItemList[0], movementType, 10);

  ui.notifications.info(game.i18n.format('E20.ZordFeatureMovementApplied', { type: choices[movementType] }));

  return droppedItemList;
}

/**
 * Movement Booster (PR CRB, Zord Feature, p.137) - see MOVEMENT_BOOSTER_ID's own doc comment.
 * @param {Actor} actor
 * @param {Function} dropFunc
 * @returns {Promise<Array<Item>|null>}
 */
async function onMovementBoosterDrop(actor, dropFunc) {
  const choices = Object.fromEntries(Object.keys(CONFIG.E20.movementTypes)
    .map(type => [type, game.i18n.localize(CONFIG.E20.movementTypes[type])]));

  const movementType = await pickOne(
    game.i18n.localize('E20.ZordFeatureMovementBoosterTitle'),
    game.i18n.localize('E20.ZordFeatureMovementPickType'),
    choices,
  );
  if (movementType === null) return null;

  const isNewType = !(actor.system.movement?.[movementType]?.base > 0);
  const droppedItemList = await dropFunc();
  await applyMovementBonus(droppedItemList[0], movementType, isNewType ? 45 : 30);

  ui.notifications.info(game.i18n.format('E20.ZordFeatureMovementApplied', { type: choices[movementType] }));

  return droppedItemList;
}

/**
 * Entry point from the drop dispatcher (drop-handler.mjs). Features other than the ones that need
 * a choice or a pre-configured attack fall straight through to the normal drop - their behaviour
 * lives in their own compendium Active Effect or in a dice.mjs check keyed on their id.
 * @param {Actor} actor
 * @param {Item} sourceItem
 * @param {Function} dropFunc
 * @returns {Promise<Array<Item>|null>}
 */
export async function onZordFeatureDrop(actor, sourceItem, dropFunc) {
  switch (featureSourceId(sourceItem)) {
  case ENHANCE_ATTACK_ID:
    return onEnhanceAttackDrop(actor, dropFunc);
  case INCREASE_ESSENCE_ID:
    return onIncreaseEssenceDrop(actor, dropFunc);
  case LIGHT_CHASSIS_ID:
    return onLightChassisDrop(actor, dropFunc);
  case MOVEMENT_BOOSTER_ID:
    return onMovementBoosterDrop(actor, dropFunc);
  case ADDITIONAL_ATTACK_TYPE_ID:
    return onAdditionalAttackTypeDrop(actor, dropFunc);
  case BLAST_ATTACK_ID:
    return onBlastAttackDrop(actor, dropFunc);
  case MEGA_WEAPON_ID:
    return onMegaWeaponDrop(actor, dropFunc);
  case MULTI_LIMB_ATTACK_ID:
    return onMultiLimbAttackDrop(actor, dropFunc);
  case RESTRAINING_CHAINS_ID:
    return onRestrainingChainsDrop(actor, dropFunc);
  default:
    return dropFunc();
  }
}
