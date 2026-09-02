import { E20 } from "../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrArrayWithChoices, makeStrWithChoices } from "./generic-makers.mjs";

const fields = foundry.data.fields;

/**
 * The reroll grant schema, shared between PerkItemData (module/data/item/perk.mjs) and
 * RerollEffectData (module/data/effect.mjs) - a Perk and an ActiveEffect can each grant a reroll
 * ability, and both need the exact same shape. Previously this was copy-pasted between the two
 * files; factored out here so a future field addition (or fix) only needs to happen once - see
 * helpers/reroll.mjs for the runtime logic that actually reads these fields.
 * @returns {Object}   A plain object of schema fields, spread into the caller's own defineSchema().
 */
export const rerollSchema = () => ({
  reroll: new fields.SchemaField({
    enabled: makeBool(false),
    // 0 means unlimited (e.g. MLP's "Luck"/"Adolescent Attitude", which have no stated
    // frequency limit at all) - see helpers/reroll.mjs#canUseReroll.
    maxUses: makeInt(1),
    mode: makeStrWithChoices(Object.keys(E20.rerollModes), 'all'),
    reset: makeStrWithChoices(Object.keys(E20.rerollResets), 'none'),
    target: makeStrWithChoices(Object.keys(E20.rerollTargets), 'allDice'),
    // Which specific die results trigger the reroll (mode 'all' with a non-empty values list,
    // e.g. Power Infusion's own "reroll 1s" -> [1], "...and 2s" -> [1, 2]). Unused by 'ones'/
    // 'onesAndTwos' (fixed at 1 and 1-2 respectively, per those modes' own book-accurate meaning)
    // or 'single' (no value filter - the player picks a specific die regardless of what it shows).
    values: new fields.ArrayField(new fields.NumberField()),
    // A resource this actor must spend to use the reroll (e.g. Power Infusion's "spending 1
    // Personal Power"). resourcePath is a dot-path into the actor document (e.g.
    // "system.powers.personal.value") - deliberately a path rather than a fixed enum of named
    // resources, since which resource pool matters varies by game line (Personal Power, Cheer
    // Points, etc.) and this system has no single shared "spendable resource" concept to key off.
    cost: new fields.SchemaField({
      resourcePath: makeStr(''),
      amount: makeInt(0),
      // A separate, world-level (not per-actor) cost: Story Points (GI Joe CRB "In My Sights"),
      // shared by the whole table rather than held by any one actor. 0 means no such cost - see
      // helpers/story-points.mjs for why spending this needs a GM's own client to perform it.
      worldStoryPoints: makeInt(0),
      // Spends 1 use from a named rolePoints-type Item on the actor instead of resourcePath (e.g.
      // MLP CRB "Cheer" spending 1 of its own "Cheer Points"). Exists alongside resourcePath
      // rather than folded into it because a Role's growing spendable pool (Cheer Points,
      // Bits To Spare, etc.) is modeled as its own Item document with a level-scaling
      // system.resource.{value,max} (see item type "rolePoints", granted via a Role's own
      // system.items map) - not a field on the actor itself the way Personal Power/Energon are.
      // Looked up by exact Item name at reroll time via helpers/reroll.mjs's own
      // findRolePointsItem(); empty string (the default) means "not this kind of cost".
      rolePointsName: makeStr(''),
    }),
    // A single named precondition beyond simple usage-counting (e.g. Power Infusion's "while
    // Morphed"). See E20.rerollConditions (helpers/config.mjs) for the full set and why this is a
    // small fixed enum rather than a generic expression evaluator.
    condition: makeStrWithChoices(Object.keys(E20.rerollConditions), 'none'),
    // Scopes this reroll to only apply when one of these specific skills was rolled (e.g. PR
    // CRB "Expertise"/"Aptitude Augmenter" - both let the player pick ONE skill, but the Perk
    // can be taken multiple times, each grant scoped to a different skill; GI Joe CRB "Mutual
    // Understanding"/"Survivalist" are always scoped to 1-3 fixed skills). Empty = unscoped,
    // matching every skill roll - the pre-existing behavior for grants that don't set this.
    skills: makeStrArrayWithChoices(Object.keys(E20.skills)),
    // Scopes this reroll to only apply when the rolled skill belongs to this Essence (e.g. MLP/PR
    // CRB "Adolescent Attitude" - "reroll 1s on Social-based skill dice", any Social skill, not
    // one named skill). 'any' (E20.essences' own catch-all key) means unscoped.
    essence: makeStrWithChoices(Object.keys(E20.essences), 'any'),
    // Whether a matched result keeps getting rerolled until it no longer matches (true, the
    // default - matches every existing grant so far, e.g. "reroll 1s" chases a second 1 into a
    // third roll) or is rerolled exactly once and the new result is kept regardless (false - PR
    // CRB "Weapon Mastery": "...you can reroll the die and must use the new roll, even if the
    // new roll is a 1 or a 2"). Only meaningful for the 'ones'/'onesAndTwos'/values-based
    // matching in helpers/reroll.mjs#applyRerollToDie - the unconditional "reroll this whole die"
    // and single-die-target cases are already inherently one-shot.
    recursive: makeBool(true),
    // Excludes any skillDice-target die below this face size (e.g. MLP/PR CRB "Luck" - "any
    // Skill Die of d4 or higher", excluding a d2 specifically). 0 (the default) means no minimum
    // - every other existing grant applies to a die of any size.
    minDieFaces: makeInt(0),
    // A grant can add a side benefit beyond the reroll itself (GI Joe CRB "In My Sights": "When
    // you use this ability, you may crit on the d2") - forced onto the rerolled message's own
    // canCritD2 flag (helpers/combat.mjs#_isCritIsFumble reads it for crit highlighting)
    // regardless of whether the original roll had it. See chat.mjs#rerollMessage.
    grantsCanCritD2: makeBool(false),
  }),
});
