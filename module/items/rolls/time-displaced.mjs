/**
 * A Jump Through Time (Power Rangers) items for the pr1 slice.
 *
 * - Mobile Headquarters, Zord Feature (p.83): its own rules (the crew's ↑1, SkillDie Edges, the scene allies'
 *   InitiativeEdge).
 * - Overdrive, Zord Feature (p.83-84): its own rules (a Use paid by a seated crew member, marks for each option
 *   taken this turn - module/rules/ext/a/).
 * - Time Displaced, Hang-Up (p.23): "Anytime you are confronted with a Skill Test in a situation you
 *   should not be familiar with due to your current era, you suffer ↓2. Additionally... the die
 *   rolled for [a Continuum Anomaly] Test is one size higher." A dialog checkbox for the ↓2 and a
 *   Use button rolling the Continuum Anomaly risk die (p.113, Table 4-7) one size larger.
 * - Warhead Magazines, Zord Feature (p.84): its own rules (a pickEach of three damage types, a DialogSelect with
 *   options from the picks and a HitRider - module/rules/ext/g/).
 */
import { registerUse } from "../../mechanics/item-hooks.mjs";
import { PR1 } from "../shared/pr-jtt-ats-item-ids.mjs";
import { TSafe as T } from "../shared/item-lang.mjs";
import { isItem } from "../shared/item-lookups.mjs";

/* -------------------------------------------- */
/*  Mobile Headquarters                          */
/* -------------------------------------------- */

// Mobile Headquarters is the Feature's own rules: the holder's Initiative Edge and its Megaform's best component
// Initiative are SkillDie rules (module/rules/plugins/rolls/skill-die.mjs); the other allied vehicles and Zords in the scene get
// theirs from an InitiativeEdge rule read at Initiative (module/rules/plugins/combat/damage-reduction.mjs).

/* -------------------------------------------- */
/*  Overdrive                                    */
/* -------------------------------------------- */

// Overdrive is the Feature's own rules: a Use (the payer picked from the seated crew, an option not yet taken this
// turn, up to three) marking the Zord, and the marks' DamageModifier / Movement / RollModifier / pilot switch.

/* -------------------------------------------- */
/*  Time Displaced Hang-Up                       */
/* -------------------------------------------- */

const LADDER = ['1d2', '1d4', '1d6', '1d8', '1d10', '1d12', '2d8'];
export const largerDie = formula => LADDER[Math.min(LADDER.length - 1, Math.max(0, LADDER.indexOf(formula)) + 1)];

registerUse({
  id: 'pr1-time-displaced',
  matches: item => isItem(item, PR1.timeDisplaced),
  run: async (item) => {
    const { RISK_DICE, anomalyBand } = await import("../resources/we-improvise-continuum-anomalies.mjs");
    const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
    const risk = await chooseSelect(item.name, T('ResAnomalyPrompt'),
      Object.keys(RISK_DICE).map(key => ({ value: key, label: T(`ResAnomalyRisk.${key}`) })));
    if (!risk) {
      return null;
    }

    const formula = largerDie(RISK_DICE[risk]);
    const roll = await new Roll(formula).evaluate();
    // The GM rolls this in secret (p.113).
    await roll.toMessage?.({
      speaker: ChatMessage.getSpeaker({ actor: item.parent }),
      flavor: T('Pr1TimeDisplacedFlavor', { formula, band: T(`ResAnomalyBand.${anomalyBand(roll.total)}`) }),
    }, { rollMode: 'blindroll' });
    return T('Pr1TimeDisplacedLine', { name: item.parent?.name ?? '' });
  },
});
