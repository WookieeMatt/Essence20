import { registerApplyDialog } from "../../mechanics/item-hooks.mjs";

/**
 * Card reactions - buttons on a posted attack/check card for whoever may answer it. Each block
 * quotes its rule. The engine (who sees a button, remembering it was used, turning a hit into "no
 * effect") is ./core.mjs. Desperate Parry, Counterstrike (DD), Projectile Deflector, Steady Footing and
 * Shoot Out are their items' own Reaction rules now (rules/reactions.mjs).
 */

/* -------------------------------------------- */
/*  Contingencies                                */
/* -------------------------------------------- */

// (Desperate Parry and Point-Defense Reflexes are their items' own rules: a Use setting a toggle, a
// turnStart Trigger clearing it, and a Reaction. The Contingency helpers in core.mjs stay exported.)

// A Snag asked for by the roll's own dataset - the rules engine's `roll` step with `snag: true`
// (Point-Defense Reflexes' rules at close range). rollSkill's dataset has no snag of its own, so it
// is set once the dialog closes.
registerApplyDialog((actor, options, ctx) => {
  if (ctx?.dataset?.snag === true) {
    options.snag = true;
  }
});

/* -------------------------------------------- */
/*  When an attack misses or hits you            */
/* -------------------------------------------- */

// (Counterstrike, Decepticon Directive, is its own Reaction rule: a mark on the attacker, a one-slot
// bank, setTargets and an optional bonus attack. Steady Footing's counter-maneuver after a Fumbled
// Grapple / Shove / Trip is built the same way. Projectile Deflector's Finesse roll and Shoot Out's
// contested shot are Reaction rules too.)

/* -------------------------------------------- */
/*  Lowering someone else's attack               */
/* -------------------------------------------- */

// (Defender, the PR CRB General Perk, is its own Reaction rule: lowerTotal by the Finesse die.)

// (Defender, the Megaform Trait, is its own Reaction rule too: who: megaformPilot - the participant's piloting Ranger,
// found by rules/plugins/zords/megaform-pilot-reactors.mjs - paying 1 Personal Power for a late Snag.)
