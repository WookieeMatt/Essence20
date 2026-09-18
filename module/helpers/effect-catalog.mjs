import { E20 } from "./config.mjs";

/**
 * A catalog of every actor field an Active Effect can usefully target, expressed in game
 * vocabulary ("Skills - Infiltration - Shift") rather than as a schema path
 * ("system.skills.infiltration.shiftUp"). This is the content behind the Effect Wizard
 * (module/apps/effect-wizard.mjs), the plain-English summaries on the Effects tabs, and the
 * pack key validator (scripts/check-effect-keys.mjs) - one vocabulary, several consumers.
 *
 * Deliberately a hand-authored table rather than a walk of the real DataModel schemas:
 *  - it has to run under plain Node for the Jest tests and the CI script, where
 *    foundry.data.fields doesn't exist (see scripts/check-pack-content.mjs's own doc comment
 *    on the same constraint), and
 *  - a schema walk can't know which fields are *meant* to be targeted. The defenses schema
 *    exposes armor/base/bonus/essence/morphed/name/shield/string/total, but only four of those
 *    are writable in any useful sense - the rest are computed in _prepareDefenses and an effect
 *    on them is silently clobbered. That judgement lives here, in `readOnly`.
 *
 * See docs/ACTIVE_EFFECTS_UI_PLAN.md for the design this implements.
 */

/** Node-safe localization - `game` exists under Foundry and Jest, but not in the CI script. */
const loc = (str) => globalThis.game?.i18n?.localize?.(str) ?? str;

/**
 * Node-safe localization with data interpolation.
 *
 * Outside a running Foundry there is no sentence to interpolate into - the CI validator has no
 * i18n at all, and Jest's stub returns the key unchanged - so rather than emitting a bare i18n
 * key, fall back to joining the pieces the sentence would have been built from. Readable enough
 * for a validator's console output, and it keeps summaries assertable in tests.
 * @param {String} str              i18n key for the sentence.
 * @param {Object} data             Interpolation data.
 * @param {Array<*>} fallbackParts  The pieces to join when no localized sentence is available.
 * @returns {String}
 */
function locFormat(str, data, fallbackParts) {
  const formatted = globalThis.game?.i18n?.format?.(str, data);
  if (formatted && formatted !== str) {
    return formatted;
  }

  return fallbackParts.filter(part => part !== "" && part !== undefined && part !== null).join(" ");
}

/**
 * Every property a group's targets can carry.
 * @typedef {Object} EffectProperty
 * @property {String} id          Stable id, unique within its group.
 * @property {String} label       i18n key for the property's own name ("Shift").
 * @property {String} widget      How the wizard edits the value - one of signedInt, int, bool,
 *                                edgeSnag, choice.
 * @property {String} [path]      Key template for single-path properties; "{target}" is
 *                                substituted with the chosen target's key.
 * @property {String} [plus]      Key template used for a positive signedInt / the Edge half of
 *                                an edgeSnag.
 * @property {String} [minus]     Key template used for a negative signedInt / the Snag half.
 * @property {String} type        The v14 change type string written for this property.
 * @property {String} [phase]     "final" for a field derived-data recomputes, so the change
 *                                lands after prepareDerivedData rather than being overwritten.
 *                                Defaults to "initial".
 * @property {String} summary     i18n key for the plain-English sentence.
 * @property {Function} [choices] For widget "choice", a getter for its {value: label} table.
 * @property {Boolean} [readOnly] Computed field - never offered by the wizard, flagged by the
 *                                validator, still hand-editable in the normal effect sheet.
 * @property {String} [hint]      i18n key for a caveat shown beside the property in the wizard.
 */

/**
 * Every skill an Active Effect can target.
 *
 * Not simply E20.skills: the actor schema (data/actor/templates/common.mjs) also defines
 * `wealth` as a full skill with its own shift/edge/snag fields, and eight shipped compendium
 * items target it (Vast Wealth, Appraiser, Loyal Customer, Mercantile Store, ...), but it is
 * absent from the E20.skills table because the sheets present the Wealth Die separately from
 * the skill list. Deriving the wizard's targets from that table alone would have made every one
 * of those items look like a typo.
 * @returns {Object} {key: i18n label}
 */
const skillTargets = () => ({ ...E20.skills, wealth: "E20.Wealth" });

/** Shared property sets, since several groups carry the same shapes. */
const movementProperties = (root) => [
  {
    id: "bonus", label: "E20.EffectPropBonus", widget: "int", type: "add",
    path: `${root}.{target}.bonus`, summary: "E20.EffectSummaryMovementBonus",
  },
  {
    id: "base", label: "E20.EffectPropBase", widget: "int", type: "override",
    path: `${root}.{target}.base`, summary: "E20.EffectSummaryMovementBase",
  },
  {
    id: "morphed", label: "E20.EffectPropMorphed", widget: "int", type: "add",
    path: `${root}.{target}.morphed`, summary: "E20.EffectSummaryMovementMorphed",
  },
  {
    id: "altMode", label: "E20.EffectPropAltMode", widget: "int", type: "add",
    path: `${root}.{target}.altMode`, summary: "E20.EffectSummaryMovementAltMode",
  },
  {
    id: "total", label: "E20.EffectPropTotal", widget: "int", type: "add", readOnly: true,
    path: `${root}.{target}.total`, summary: "E20.EffectSummaryMovementBonus",
  },
];

const trainingProperties = (root, summary, { toxins = false, upgrades = false } = {}) => {
  const properties = [
    {
      id: "weapons", label: "E20.EffectPropWeapons", widget: "bool", type: "override",
      path: `${root}.weapons.{target}`, summary, targetsOverride: () => E20.weaponTypes,
    },
    {
      id: "armors", label: "E20.EffectPropArmors", widget: "bool", type: "override",
      path: `${root}.armors.{target}`, summary, targetsOverride: () => E20.armorTypes,
    },
    {
      id: "poisons", label: "E20.EffectPropPoisons", widget: "bool", type: "override",
      path: `${root}.poisons.{target}`, summary, targetsOverride: () => E20.poisonTraining,
    },
  ];

  // system.trained carries two sub-blocks system.qualified doesn't (see
  // data/actor/templates/character.mjs) - enumerated here rather than left to a dynamic-key
  // pattern, so the wizard can offer them and the validator can suggest fixes for them.
  if (toxins) {
    properties.push({
      id: "toxins", label: "E20.EffectPropToxins", widget: "bool", type: "override",
      path: `${root}.toxins.{target}`, summary, targetsOverride: () => E20.poisonTraining,
    });
  }

  if (upgrades) {
    properties.push({
      id: "upgradeArmors", label: "E20.EffectPropUpgradeArmors", widget: "bool", type: "override",
      path: `${root}.upgrades.armors.{target}`, summary, targetsOverride: () => E20.availabilities,
    });
  }

  return properties;
};

/**
 * The catalog itself. Order is the order the wizard presents, so the common cases come first.
 * @type {Array<{id: String, label: String, targets: Function|null, properties: EffectProperty[]}>}
 */
export const EFFECT_GROUPS = [
  {
    id: "skills",
    label: "E20.EffectGroupSkills",
    targets: skillTargets,
    properties: [
      {
        id: "shift", label: "E20.EffectPropShift", widget: "signedInt", type: "add",
        plus: "system.skills.{target}.shiftUp",
        minus: "system.skills.{target}.shiftDown",
        summary: "E20.EffectSummarySkillShift",
        rollScoped: true,
        keywords: ["upshift", "downshift", "shift up", "shift down"],
      },
      {
        id: "edgeSnag", label: "E20.EffectPropEdgeSnag", widget: "edgeSnag", type: "override",
        plus: "system.skills.{target}.edge",
        minus: "system.skills.{target}.snag",
        summary: "E20.EffectSummarySkillEdgeSnag",
        rollScoped: true,
        keywords: ["edge", "snag", "advantage", "disadvantage"],
      },
      {
        id: "modifier", label: "E20.EffectPropModifier", widget: "int", type: "add",
        path: "system.skills.{target}.modifier",
        summary: "E20.EffectSummarySkillModifier",
        rollScoped: true,
        keywords: ["modifier", "flat bonus"],
      },
      {
        id: "isSpecialized", label: "E20.EffectPropSpecialized", widget: "bool", type: "override",
        path: "system.skills.{target}.isSpecialized",
        summary: "E20.EffectSummarySkillSpecialized",
        rollScoped: true,
        keywords: ["specialized", "specialization"],
      },
      {
        id: "canCritD2", label: "E20.EffectPropCanCritD2", widget: "bool", type: "override",
        path: "system.skills.{target}.canCritD2",
        summary: "E20.EffectSummarySkillCanCritD2",
        rollScoped: true,
        keywords: ["crit", "critical", "d2"],
      },
      {
        id: "canBeInitiative", label: "E20.EffectPropCanBeInitiative", widget: "bool",
        type: "override", path: "system.skills.{target}.canBeInitiative",
        summary: "E20.EffectSummarySkillCanBeInitiative",
        keywords: ["initiative"],
      },
      {
        id: "shiftSet", label: "E20.EffectPropSetShift", widget: "choice", type: "override",
        path: "system.skills.{target}.shift", choices: () => E20.skillChoicesShifts,
        summary: "E20.EffectSummarySkillSetShift",
        rollScoped: true,
        keywords: ["set die", "skill die", "d20", "d12"],
      },
      // The "extra Essence" grant (GI Joe CRB's Terrifying Presence: Intimidation may be rolled
      // with Social as well as its default Strength). Its own sub-target is an Essence, not a
      // skill, so it carries its own `target2` table, which the wizard renders as a second
      // dropdown and buildIndex expands into one key per skill/Essence pair.
      {
        id: "extraEssence", label: "E20.EffectPropExtraEssence", widget: "bool", type: "override",
        path: "system.skills.{target}.essences.{target2}",
        target2: () => E20.originEssences,
        target2Label: "E20.EffectTarget2Essence",
        summary: "E20.EffectSummarySkillExtraEssence",
        keywords: ["essence", "also uses", "roll with"],
      },
    ],
  },
  {
    id: "essenceShifts",
    label: "E20.EffectGroupEssenceShifts",
    targets: () => E20.essences,
    properties: [
      {
        id: "shift", label: "E20.EffectPropShift", widget: "signedInt", type: "add",
        plus: "system.essenceShifts.{target}.shiftUp",
        minus: "system.essenceShifts.{target}.shiftDown",
        summary: "E20.EffectSummaryEssenceShift",
        rollScoped: true,
        keywords: ["upshift", "downshift", "all skills"],
      },
      {
        id: "edgeSnag", label: "E20.EffectPropEdgeSnag", widget: "edgeSnag", type: "override",
        plus: "system.essenceShifts.{target}.edge",
        minus: "system.essenceShifts.{target}.snag",
        summary: "E20.EffectSummaryEssenceEdgeSnag",
        rollScoped: true,
        keywords: ["edge", "snag"],
      },
      {
        id: "untrainedBonus", label: "E20.EffectPropUntrainedBonus", widget: "bool",
        type: "override", path: "system.essenceShifts.{target}.untrainedBonus",
        summary: "E20.EffectSummaryEssenceUntrainedBonus",
        rollScoped: true,
        keywords: ["untrained"],
      },
      {
        id: "morphed", label: "E20.EffectPropMorphedShift", widget: "int", type: "add",
        path: "system.essenceShifts.{target}.morphed",
        summary: "E20.EffectSummaryEssenceMorphed",
        hint: "E20.EffectHintMorphed",
        keywords: ["morphed", "while morphed"],
      },
    ],
  },
  {
    id: "essences",
    label: "E20.EffectGroupEssences",
    targets: () => E20.originEssences,
    properties: [
      {
        id: "value", label: "E20.EffectPropValue", widget: "int", type: "add",
        path: "system.essences.{target}.value",
        summary: "E20.EffectSummaryEssenceValue",
        keywords: ["essence score", "increase"],
      },
      {
        id: "max", label: "E20.EffectPropMax", widget: "int", type: "add",
        path: "system.essences.{target}.max",
        summary: "E20.EffectSummaryEssenceMax",
      },
    ],
  },
  {
    id: "defenses",
    label: "E20.EffectGroupDefenses",
    targets: () => E20.defenses,
    properties: [
      {
        id: "bonus", label: "E20.EffectPropBonus", widget: "int", type: "add",
        path: "system.defenses.{target}.bonus",
        summary: "E20.EffectSummaryDefenseBonus",
        hint: "E20.EffectHintPcOnlyDefense",
        // Not the four defense names: those are target labels, which the wizard's search already
        // matches (and ranks above keywords). Listing them here only made every defense match a
        // search for any one of them.
        keywords: ["defense", "defence"],
      },
      {
        id: "morphed", label: "E20.EffectPropMorphed", widget: "int", type: "add",
        path: "system.defenses.{target}.morphed",
        summary: "E20.EffectSummaryDefenseMorphed",
        hint: "E20.EffectHintMorphed",
      },
      {
        id: "armor", label: "E20.EffectPropArmorValue", widget: "int", type: "add",
        path: "system.defenses.{target}.armor",
        summary: "E20.EffectSummaryDefenseArmor",
      },
      {
        id: "shield", label: "E20.EffectPropShield", widget: "int", type: "add",
        path: "system.defenses.{target}.shield",
        summary: "E20.EffectSummaryDefenseShield",
      },
      {
        id: "total", label: "E20.EffectPropTotal", widget: "int", type: "add", readOnly: true,
        path: "system.defenses.{target}.total",
        summary: "E20.EffectSummaryDefenseBonus",
      },
      // Not readOnly, despite being a "base" field: _prepareDefenses reads .base as an input to
      // the total rather than computing it, and several Perks already override the equivalent
      // movement base in code (Air Born, Static Electricity, Warrior Rush - see actor.mjs's own
      // comments on that permitted touch-point). Overriding it from an effect is legitimate.
      {
        id: "base", label: "E20.EffectPropBase", widget: "int", type: "override",
        path: "system.defenses.{target}.base",
        summary: "E20.EffectSummaryDefenseBase",
      },
    ],
  },
  {
    id: "health",
    label: "E20.EffectGroupHealth",
    targets: null,
    properties: [
      {
        id: "bonus", label: "E20.EffectPropBonus", widget: "int", type: "add",
        path: "system.health.bonus",
        summary: "E20.EffectSummaryHealthBonus",
        keywords: ["health", "hp", "hit points"],
      },
      // Computed, and deliberately not offered: _prepareHealth assigns max from Origin +
      // Conditioning + Role Points + system.health.bonus, so an initial-phase change here is
      // overwritten before anything reads it. `bonus` above IS the supported way to add Health -
      // it is an input to that sum, and all 46 Health rows in the packs already use it. Left in
      // the catalog as readOnly rather than deleted so the validator and the "did you mean" chip
      // can still recognise the key and explain why it does nothing.
      {
        id: "max", label: "E20.EffectPropMax", widget: "int", type: "add", readOnly: true,
        path: "system.health.max",
        summary: "E20.EffectSummaryHealthMax",
      },
      {
        id: "origin", label: "E20.EffectPropOriginHealth", widget: "int", type: "add",
        path: "system.health.origin",
        summary: "E20.EffectSummaryHealthOrigin",
      },
    ],
  },
  {
    id: "movement",
    label: "E20.EffectGroupMovement",
    targets: () => E20.movementTypes,
    properties: movementProperties("system.movement"),
  },
  {
    id: "trained",
    label: "E20.EffectGroupTrained",
    targets: null,
    properties: trainingProperties("system.trained", "E20.EffectSummaryTrained", { toxins: true, upgrades: true }),
  },
  {
    id: "qualified",
    label: "E20.EffectGroupQualified",
    targets: null,
    properties: trainingProperties("system.qualified", "E20.EffectSummaryQualified"),
  },
  {
    id: "damage",
    label: "E20.EffectGroupDamage",
    targets: () => E20.damageTypes,
    properties: [
      {
        id: "resistance", label: "E20.EffectPropResistant", widget: "bool", type: "override",
        path: "system.resistances.{target}",
        summary: "E20.EffectSummaryResistance",
        keywords: ["resist", "resistance"],
      },
      {
        id: "immunity", label: "E20.EffectPropImmune", widget: "bool", type: "override",
        path: "system.immunities.{target}",
        summary: "E20.EffectSummaryImmunity",
        keywords: ["immune", "immunity"],
      },
    ],
  },
  // Personal and Sorcerous Power look symmetrical but are computed differently, so they cannot
  // share one `{target}` property: _preparePersonalPowerSupply ADDS to personal.max on top of
  // whatever is already there (an initial-phase change survives), while _prepareSorcerousPower
  // ASSIGNS sorcerous.max outright from the actor's level (an initial-phase change does not).
  // They are split so each can carry the phase its own prep method requires - a single property
  // would silently work for one target and not the other.
  {
    id: "powers",
    label: "E20.EffectGroupPowers",
    targets: null,
    properties: [
      {
        id: "personalMax", label: "E20.EffectPropPersonalPowerMax", widget: "int", type: "add",
        path: "system.powers.personal.max",
        summary: "E20.EffectSummaryPersonalPowerMax",
        keywords: ["power", "energy", "personal", "grid"],
      },
      {
        id: "sorcerousMax", label: "E20.EffectPropSorcerousPowerMax", widget: "int", type: "add",
        phase: "final",
        path: "system.powers.sorcerous.max",
        summary: "E20.EffectSummarySorcerousPowerMax",
        hint: "E20.EffectHintSorcerousFinalPhase",
        keywords: ["power", "sorcerous", "spellcasting"],
      },
      {
        id: "regeneration", label: "E20.EffectPropRegeneration", widget: "int", type: "add",
        path: "system.powers.personal.regeneration",
        summary: "E20.EffectSummaryPowerRegeneration",
      },
    ],
  },
  // Specializations are the one group whose second target cannot be enumerated: they are keyed by
  // a slug of their own name (helpers/utils.mjs#slugifySpecializationName) and only exist once an
  // actor has them, so there is no table to offer. The wizard takes the name as free text and
  // slugifies it; parseKey resolves these by pattern rather than from the key index (see
  // buildDynamicEntries below, which generates those patterns from these same key templates).
  // Keys look like system.skills.science.specializations.medicine.shiftUp.
  {
    id: "specializations",
    label: "E20.EffectGroupSpecializations",
    targets: skillTargets,
    dynamicTarget2: true,
    target2Label: "E20.EffectTarget2Specialization",
    properties: [
      {
        id: "shift", label: "E20.EffectPropShift", widget: "signedInt", type: "add",
        plus: "system.skills.{target}.specializations.{target2}.shiftUp",
        minus: "system.skills.{target}.specializations.{target2}.shiftDown",
        summary: "E20.EffectSummarySpecializationShift",
        keywords: ["specialization", "upshift", "downshift"],
      },
      {
        id: "edgeSnag", label: "E20.EffectPropEdgeSnag", widget: "edgeSnag", type: "override",
        plus: "system.skills.{target}.specializations.{target2}.edge",
        minus: "system.skills.{target}.specializations.{target2}.snag",
        summary: "E20.EffectSummarySpecializationEdgeSnag",
        keywords: ["specialization", "edge", "snag"],
      },
      {
        id: "isSpecialized", label: "E20.EffectPropSpecialized", widget: "bool", type: "override",
        path: "system.skills.{target}.specializations.{target2}.isSpecialized",
        summary: "E20.EffectSummarySpecializationSpecialized",
      },
      {
        id: "shiftSet", label: "E20.EffectPropSetShift", widget: "choice", type: "override",
        path: "system.skills.{target}.specializations.{target2}.shift",
        choices: () => E20.skillChoicesShifts,
        summary: "E20.EffectSummarySpecializationSetShift",
      },
      // Granting the Specialization outright. Unlike every other property this writes more than
      // one change: the entry has to exist before anything can modify it, which means setting its
      // .name and flagging it .granted (so helpers/skill-picker.mjs#computeEssenceSpend doesn't
      // bill the player a skill point for it). Every other field is defaulted by
      // sheet-handlers/specialization-handler.mjs#normalizeSpecializations.
      {
        id: "grant", label: "E20.EffectPropGrantSpecialization", widget: "text", type: "override",
        path: "system.skills.{target}.specializations.{target2}.name",
        alsoSets: [
          { path: "system.skills.{target}.specializations.{target2}.granted", value: true },
        ],
        summary: "E20.EffectSummarySpecializationGrant",
        keywords: ["grant", "gain", "specialization"],
      },
    ],
  },
  // Energon (data/actor/templates/common.mjs). Only the ordinary pool has a maximum at all - the
  // other four (dark, primal, red, synthEn) are value-only spendable pools with no ceiling to
  // raise, so there is nothing for an effect to target on them. Surfaced by the catalog audit,
  // and the direct parallel of the Powers maximum just above. Spark of the Ancients (Enigma of
  // Combination, p.41 - "+2 maximum Energon Pool") was hardcoded in actor.mjs until this key
  // existed; it is now an ordinary effect on the Perk itself.
  {
    id: "energon",
    label: "E20.EffectGroupEnergon",
    targets: null,
    properties: [
      // The one property in the catalog that applies in the FINAL phase, and it has to be:
      // _prepareEnergon() assigns system.energon.normal.max outright (`=`, from the actor's
      // lowest Essence) during prepareDerivedData, so an initial-phase change here is computed,
      // then overwritten, and silently does nothing. Core v14 runs applyActiveEffects("final")
      // after prepareDerivedData (client/documents/actor.mjs#prepareData), so a final-phase add
      // lands on top of the computed maximum instead - which is the behaviour Spark of the
      // Ancients hardcodes today. This is the capability v14's two phases exist for.
      {
        id: "max", label: "E20.EffectPropMax", widget: "int", type: "add", phase: "final",
        path: "system.energon.normal.max",
        summary: "E20.EffectSummaryEnergonMax",
        hint: "E20.EffectHintEnergonFinalPhase",
        keywords: ["energon", "pool", "maximum", "transformer"],
      },
    ],
  },
  // Vehicle Traits (data/actor/vehicle.mjs#makeVehicleTraitsSchema) - a boolean per entry in
  // E20.vehicleTraits, so an upgrade can make a vehicle Amphibious, All-Terrain and so on. Found
  // by the catalog audit (helpers/effect-catalog-audit.mjs) rather than by hand, which is the
  // point of that check existing. Vehicles only; Zords have their own separate Megaform/Zord
  // Trait system (see megaform-trait.mjs), which is item-driven rather than a boolean map.
  {
    id: "vehicleTraits",
    label: "E20.EffectGroupVehicleTraits",
    targets: () => E20.vehicleTraits,
    properties: [
      {
        id: "has", label: "E20.EffectPropHasTrait", widget: "bool", type: "override",
        path: "system.traits.{target}",
        summary: "E20.EffectSummaryVehicleTrait",
        hint: "E20.EffectHintVehicleOnly",
        keywords: ["trait", "vehicle", "amphibious", "all terrain"],
      },
    ],
  },
  {
    id: "crew",
    label: "E20.EffectGroupCrew",
    targets: null,
    properties: [
      {
        id: "numDrivers", label: "E20.EffectPropNumDrivers", widget: "int", type: "add",
        path: "system.crew.numDrivers",
        summary: "E20.EffectSummaryCrewDrivers",
        hint: "E20.EffectHintMachineOnly",
        keywords: ["crew", "driver", "pilot"],
      },
      {
        id: "numPassengers", label: "E20.EffectPropNumPassengers", widget: "int", type: "add",
        path: "system.crew.numPassengers",
        summary: "E20.EffectSummaryCrewPassengers",
        hint: "E20.EffectHintMachineOnly",
        keywords: ["crew", "passenger", "seats"],
      },
    ],
  },
  {
    id: "other",
    label: "E20.EffectGroupOther",
    targets: null,
    properties: [
      {
        id: "size", label: "E20.EffectPropSize", widget: "choice", type: "override",
        path: "system.size", choices: () => E20.actorSizes,
        summary: "E20.EffectSummarySize",
        keywords: ["size", "large", "huge"],
      },
      {
        id: "poisonTraining", label: "E20.EffectPropPoisonTraining", widget: "int",
        type: "override", path: "system.poisonTraining",
        summary: "E20.EffectSummaryPoisonTraining",
      },
    ],
  },
];

/**
 * Key patterns that are legitimately dynamic, so a concrete key can't be enumerated ahead of
 * time. Matched by the validator so these aren't reported as unknown; the wizard doesn't offer
 * them (see docs/ACTIVE_EFFECTS_UI_PLAN.md §11.6 on Specializations).
 */
export const DYNAMIC_KEY_PATTERNS = [
  // system.qualified has no toxins block of its own in the schema, but an effect targeting one is
  // harmless and a couple of hand-authored ones may exist - accepted rather than reported.
  /^system\.qualified\.toxins\.[a-zA-Z]+$/,
];

/* -------------------------------------------- */
/*  Dynamic (unenumerable) keys                 */
/* -------------------------------------------- */

/**
 * Turn a key template into a matcher, for the groups whose second target can't be enumerated
 * ahead of time (Specializations). Generated from the same templates the wizard builds keys
 * from, so the two can't drift apart.
 * @param {String} template
 * @returns {RegExp}
 */
function templateToPattern(template) {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(`^${escaped
    .replace("\\{target\\}", "([a-zA-Z0-9]+)")
    .replace("\\{target2\\}", "([a-zA-Z0-9_-]+)")}$`);
}

/** @type {Array<Object>|null} */
let dynamicEntries = null;

function buildDynamicEntries() {
  const entries = [];

  for (const group of EFFECT_GROUPS) {
    if (!group.dynamicTarget2) {
      continue;
    }

    for (const property of group.properties) {
      const variants = property.path
        ? [["single", property.path]]
        : [["plus", property.plus], ["minus", property.minus]];

      for (const [variant, template] of variants) {
        if (template) {
          entries.push({ pattern: templateToPattern(template), group, property, variant });
        }
      }
    }
  }

  return entries;
}

/**
 * Resolve a key belonging to a group whose targets can't be enumerated.
 * @param {String} key
 * @returns {Object|null}
 */
function parseDynamicKey(key) {
  dynamicEntries ??= buildDynamicEntries();

  for (const entry of dynamicEntries) {
    const match = entry.pattern.exec(key);
    if (!match) {
      continue;
    }

    const [, target, target2] = match;
    // The first capture is only a real target if it's a skill this system actually has - without
    // this, "system.skills.nonsense.specializations.x.edge" would resolve happily.
    if (!(target in skillTargets())) {
      continue;
    }

    return {
      groupId: entry.group.id,
      propertyId: entry.property.id,
      target,
      target2: target2 ?? null,
      variant: entry.variant,
      group: entry.group,
      property: entry.property,
    };
  }

  return null;
}

/* -------------------------------------------- */
/*  Index                                       */
/* -------------------------------------------- */

/**
 * Expand a property's key template against a target (and, for extraEssence, a second target).
 * @param {String} template
 * @param {String|null} target
 * @param {String|null} target2
 * @returns {String}
 */
function expand(template, target, target2) {
  return template
    .replace("{target}", target ?? "")
    .replace("{target2}", target2 ?? "");
}

/**
 * Every concrete key the catalog describes, mapped back to the group/target/property that
 * produced it. Built once, lazily, so E20's own preLocalize pass has run first under Foundry.
 * @type {Map<String, Object>|null}
 */
let keyIndex = null;

function buildIndex() {
  const index = new Map();

  for (const group of EFFECT_GROUPS) {
    if (group.dynamicTarget2) {
      continue;
    }

    for (const property of group.properties) {
      // A property may override its group's target list (the trained/qualified groups pick their
      // own per-property list) or opt out of targets entirely.
      const targetTable = property.targetless
        ? null
        : (property.targetsOverride?.() ?? group.targets?.() ?? null);
      const targets = targetTable ? Object.keys(targetTable) : [null];
      const secondTargets = property.target2 ? Object.keys(property.target2()) : [null];

      for (const target of targets) {
        for (const target2 of secondTargets) {
          const variants = property.path
            ? [["single", property.path]]
            : [["plus", property.plus], ["minus", property.minus]];

          for (const [variant, template] of variants) {
            if (!template) {
              continue;
            }

            index.set(expand(template, target, target2), {
              groupId: group.id,
              propertyId: property.id,
              target,
              target2,
              variant,
              group,
              property,
            });
          }
        }
      }
    }
  }

  return index;
}

/** @returns {Map<String, Object>} The lazily built key index. */
function getIndex() {
  return keyIndex ??= buildIndex();
}

/** Discards the cached index. Only needed by tests that mutate E20's own tables. */
export function resetCatalog() {
  keyIndex = null;
  dynamicEntries = null;
}

/** @returns {String[]} Every concrete key the catalog knows about. */
export function allKeys() {
  return [...getIndex().keys()];
}

/**
 * Resolve an Active Effect change key back to the catalog entry that describes it.
 * @param {String} key
 * @returns {Object|null} {groupId, propertyId, target, target2, variant, group, property}, or
 *   null if this key isn't one the catalog describes.
 */
export function parseKey(key) {
  if (typeof key !== "string" || !key) {
    return null;
  }

  return getIndex().get(key) ?? parseDynamicKey(key) ?? null;
}

/**
 * Resolve a key to the roll-relevant field it targets, for the Roll Options Dialog's
 * toggleable-effect list (helpers/skill-effects.mjs).
 *
 * "Roll-relevant" means a property flagged `rollScoped` in the catalog - the set
 * applySkillEffectBonus actually knows how to fold into a single roll. Anything else an effect
 * changes (Health, a Defense, Movement) is real but has no meaning scoped to one Skill Test.
 * Keeping that flag on the catalog entry means adding a new roll-relevant property is one edit
 * here rather than an edit here plus a matching string in a Set somewhere else.
 * @param {String} key
 * @param {String} skillKey   The skill being rolled.
 * @param {String} essence    Its Essence, or "any" for a skill not tied to one.
 * @returns {{scope: String, field: String}|null} `scope` is "skill" for a change aimed at this
 *   exact skill, "essence" for one aimed at its Essence (or "any", which reaches every skill).
 */
export function resolveRollScopedChange(key, skillKey, essence) {
  const entry = parseKey(key);
  if (!entry?.property.rollScoped) {
    return null;
  }

  // The field name is the key's own last segment - the catalog built the key from a template, so
  // this cannot drift from what the schema actually holds.
  const field = key.split(".").pop();

  if (entry.groupId === "skills") {
    return entry.target === skillKey ? { scope: "skill", field } : null;
  }

  if (entry.groupId === "essenceShifts") {
    const scopes = essence === "any" ? ["any"] : [essence, "any"];

    return scopes.includes(entry.target) ? { scope: "essence", field } : null;
  }

  return null;
}

/**
 * Whether a key is valid - known to the catalog, or matching one of the legitimately dynamic
 * patterns. Used by the validator; the wizard only ever deals in catalog keys.
 * @param {String} key
 * @returns {Boolean}
 */
export function isKnownKey(key) {
  if (parseKey(key)) {
    return true;
  }

  return DYNAMIC_KEY_PATTERNS.some(pattern => pattern.test(key));
}

/* -------------------------------------------- */
/*  Building changes                            */
/* -------------------------------------------- */

/**
 * Build the Active Effect change row for a wizard selection.
 *
 * The signed widgets are where this earns its keep: the schema carries shiftUp and shiftDown as
 * two separate *positive* fields, but the game concept is one signed number, so a value of -2
 * here becomes `shiftDown: 2` rather than a negative shiftUp (which would do nothing useful).
 * Edge/Snag works the same way over its own two booleans.
 * @param {Object} selection
 * @param {String} selection.groupId
 * @param {String} selection.propertyId
 * @param {String} [selection.target]
 * @param {String} [selection.target2]
 * @param {Number|String|Boolean} selection.value
 * @returns {{key: String, type: String, value: *, phase: String}|null}
 */
export function buildChange({ groupId, propertyId, target = null, target2 = null, value }) {
  const group = EFFECT_GROUPS.find(g => g.id === groupId);
  const property = group?.properties.find(p => p.id === propertyId);
  if (!property) {
    return null;
  }

  let key = null;
  let changeValue = value;

  switch (property.widget) {
  case "signedInt": {
    const numeric = Number(value) || 0;
    if (!numeric) {
      return null;
    }

    key = expand(numeric > 0 ? property.plus : property.minus, target, target2);
    changeValue = Math.abs(numeric);
    break;
  }

  case "edgeSnag": {
    if (value !== "plus" && value !== "minus") {
      return null;
    }

    key = expand(value === "plus" ? property.plus : property.minus, target, target2);
    changeValue = true;
    break;
  }

  case "bool":
    key = expand(property.path, target, target2);
    changeValue = value !== false && value !== "false";
    break;
  case "int":
    key = expand(property.path, target, target2);
    changeValue = Number(value) || 0;
    break;
  case "text": {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) {
      return null;
    }

    key = expand(property.path, target, target2);
    changeValue = text;
    break;
  }

  default:
    key = expand(property.path, target, target2);
    changeValue = value;
  }

  return { key, type: property.type, value: changeValue, phase: property.phase ?? "initial" };
}

/**
 * Every change row a wizard selection produces.
 *
 * Almost always exactly one, so buildChange above stays the simple case. Granting a
 * Specialization is the exception: the entry has to be brought into existence, which means its
 * .name AND its .granted flag, and normalizeSpecializations fills in the rest.
 * @param {Object} selection  As buildChange.
 * @returns {Array<Object>}   Empty when the selection wouldn't build anything.
 */
export function buildChanges(selection) {
  const first = buildChange(selection);
  if (!first) {
    return [];
  }

  const group = EFFECT_GROUPS.find(g => g.id === selection.groupId);
  const property = group?.properties.find(p => p.id === selection.propertyId);
  const extra = (property?.alsoSets ?? []).map(({ path, value }) => ({
    key: expand(path, selection.target ?? null, selection.target2 ?? null),
    type: property.type,
    value,
    phase: property.phase ?? "initial",
  }));

  return [first, ...extra];
}

/**
 * The inverse of buildChange - the wizard's own control state for an existing change row, so a
 * change can be round-tripped back into the UI it came from.
 * @param {{key: String, value: *}} change
 * @returns {Object|null}
 */
export function describeChange(change) {
  const entry = parseKey(change?.key);
  if (!entry) {
    return null;
  }

  const { property, variant } = entry;
  let value = change.value;

  if (property.widget === "signedInt") {
    value = (variant === "minus" ? -1 : 1) * Math.abs(Number(value) || 0);
  } else if (property.widget === "edgeSnag") {
    value = variant;
  }

  return { ...entry, value };
}

/* -------------------------------------------- */
/*  Plain English                               */
/* -------------------------------------------- */

/**
 * Turn a Specialization's stored slug back into something readable - "deepSeaBiology" reads as a
 * bug in a sentence, even though it is exactly what the key holds. The inverse of
 * helpers/utils.mjs#slugifySpecializationName, as far as one exists: the original punctuation is
 * gone for good, but the word boundaries survive in the camelCasing.
 * @param {String} slug
 * @returns {String}
 */
function humanizeSlug(slug) {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase());
}

/**
 * A one-sentence, book-vocabulary description of what a change actually does - "Infiltration is
 * upshifted by 1". Shown live in the wizard and under each effect on the Effects tabs.
 * @param {{key: String, value: *}} change
 * @returns {String|null} null when the key isn't one the catalog describes, so callers can fall
 *   back to showing the raw key rather than inventing a sentence for it.
 */
export function summarize(change) {
  const described = describeChange(change);
  if (!described) {
    return null;
  }

  const { group, property, target, target2, value } = described;
  const targetTable = property.targetsOverride?.() ?? group.targets?.() ?? null;
  const targetLabel = target && targetTable ? loc(targetTable[target]) : "";

  // A dynamic second target (a Specialization) has no label table to look up - the slug is the
  // only name the key carries. Turn it back into words rather than showing "deepSeaBiology" in a
  // sentence, which reads like a bug even though it is exactly what is stored.
  let target2Label = "";
  if (target2) {
    target2Label = property.target2 ? loc(property.target2()[target2]) : humanizeSlug(target2);
  }

  const data = {
    target: targetLabel,
    target2: target2Label,
    value: Math.abs(Number(value) || 0),
    amount: value,
  };

  if (property.widget === "signedInt") {
    data.direction = loc(value < 0 ? "E20.EffectDirectionDown" : "E20.EffectDirectionUp");
  } else if (property.widget === "edgeSnag") {
    data.direction = loc(value === "minus" ? "E20.EffectDirectionSnag" : "E20.EffectDirectionEdge");
  } else if (property.widget === "choice") {
    data.value = loc(property.choices()[change.value] ?? change.value);
  } else if (property.widget === "text") {
    // The value IS the text (a Specialization's display name) - the numeric coercion above turns
    // it into 0, which is how "Grants the Science Specialization 0" happens.
    data.value = change.value;
  } else if (property.widget === "bool") {
    // "is immune to Fire" vs "is no longer immune to Fire" - an override to false is rare but
    // real (an item that removes a training), and reading "is immune" for it would be a lie.
    data.direction = loc(
      (change.value === false || change.value === "false")
        ? "E20.EffectDirectionNot"
        : "E20.EffectDirectionIs",
    );
  }

  return locFormat(property.summary, data, [
    data.target, data.target2, data.direction, data.value,
  ]);
}

/**
 * Every summary for an effect, skipping changes the catalog can't describe.
 * @param {ActiveEffect} effect
 * @returns {String[]}
 */
export function summarizeEffect(effect) {
  return readChanges(effect)
    .map(change => summarize(change))
    .filter(summary => !!summary);
}

/* -------------------------------------------- */
/*  Typo help                                   */
/* -------------------------------------------- */

/**
 * Levenshtein distance, capped - we only ever care about "close enough to be a typo".
 * @param {String} a
 * @param {String} b
 * @returns {Number}
 */
function distance(a, b) {
  if (Math.abs(a.length - b.length) > 6) {
    return Infinity;
  }

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }

    previous = current;
  }

  return previous[b.length];
}

/**
 * The catalog key a malformed one was most likely meant to be. Built for the real typos this
 * system has actually shipped - "systen.skills.might.shiftUp", "…intimidation.essence.social",
 * "…infilitration.shiftUp", "…alertness.shfitUp" - all of which are one or two edits away from a
 * real key while being completely inert in play.
 * @param {String} key
 * @param {Number} [maxDistance] How far off a key may be and still be considered a typo of one.
 * @returns {String|null}
 */
export function suggestKey(key, maxDistance = 4) {
  if (typeof key !== "string" || !key) {
    return null;
  }

  let best = null;
  let bestDistance = Infinity;

  for (const candidate of allKeys()) {
    const d = distance(key, candidate);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }

  return bestDistance <= maxDistance ? best : null;
}

/* -------------------------------------------- */
/*  Reading and writing changes                 */
/* -------------------------------------------- */

/**
 * An effect's change rows, whichever generation of Foundry produced them.
 *
 * v14 moved changes into system data (`effect.system.changes`, see common/data/active-effect.mjs)
 * and left a deprecated `effect.changes` shim forwarding to it, which core removes in v16. Every
 * read in this system goes through here so there's one place to drop the fallback then - and so
 * the same helper works on a raw pack JSON object, which is still v13-shaped on disk.
 * @param {ActiveEffect|Object} effect
 * @returns {Array<Object>}
 */
export function readChanges(effect) {
  if (!effect) {
    return [];
  }

  const changes = effect.system?.changes ?? effect.changes;

  return Array.isArray(changes) ? changes : [];
}

/**
 * The update path an effect's changes live under.
 *
 * Unconditional since system.json declares `minimum: "14"` - v14 moved changes into system data
 * and there is no longer an older generation to write the flat `changes` path for. readChanges
 * above still accepts both shapes, but for a different reason: the compendium packs are still
 * v13-shaped JSON on disk (a deliberate call - see docs/ACTIVE_EFFECTS_UI_PLAN.md §11.4) and the
 * CI validator reads those files directly, with no Foundry to migrate them.
 * @returns {String}
 */
export function changesPath() {
  return "system.changes";
}

/**
 * Persist a complete replacement set of change rows onto an effect.
 * @param {ActiveEffect} effect
 * @param {Array<Object>} changes
 * @returns {Promise<ActiveEffect>}
 */
export function writeChanges(effect, changes) {
  return effect.update({ [changesPath()]: changes });
}

/**
 * Append change rows to an effect, leaving whatever it already had.
 * @param {ActiveEffect} effect
 * @param {Array<Object>} changes
 * @returns {Promise<ActiveEffect>}
 */
export function appendChanges(effect, changes) {
  return writeChanges(effect, [...readChanges(effect), ...changes]);
}
