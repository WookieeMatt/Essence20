/**
 * Wealth Tests in place of Requisition Skill Tests.
 *
 * Money Talks (Cobra Codex, General Perk, p.80): "During Equipment Assignment and Requisition
 * phases, you can make Wealth Tests (see page 111) in place of Requisition Skill Tests."
 *
 * Capable Freelancer (Intercontinental Adventures, Mercenary Faction, p.103): "you can make Wealth
 * Tests (described in G.I. JOE: COBRA Codex) in place of Skill Tests for your Requisition Attempts
 * during Equipment Assignment and Requisition."
 *
 * A Wealth Test "work[s] similar to Skill Tests, though the bonus die you add to the d20 roll
 * depends on your financial situation" (Cobra Codex p.111, Table 3-6) - which is exactly the
 * Wealth skill every character already has (system.skills.wealth, Impoverished = d20 + Snag ...
 * Wealthy = d12). So the Financial Situation steps are shifts on that skill: Desperate's "one step
 * worse" and Profit Director's "one step better" are plain Active Effects on the pack items
 * (system.skills.wealth.shiftDown / shiftUp), and the Requisition roll is simply re-pointed at the
 * Wealth skill here, carrying the skill's own shifts with it (the Requisition call passes none).
 */
import { registerPreRoll } from "../../mechanics/item-hooks.mjs";
import { IDS } from "../shared/resource-team-lookups.mjs";
import { T } from "../shared/item-lang.mjs";
import { findSourced as findItem, has } from "../shared/item-lookups.mjs";
import { num } from "../shared/numbers.mjs";

export function wealthSourceFor(actor) {
  return findItem(actor, IDS.moneyTalks) ?? findItem(actor, IDS.capableFreelancer);
}

/**
 * The dataset changes that turn a Requisition roll into a Wealth Test.
 * @param {Object} dataset
 * @param {Object} wealth   actor.system.skills.wealth
 */
export function toWealthTest(dataset, wealth) {
  dataset.requisitionSkill = dataset.skill;
  dataset.skill = 'wealth';
  delete dataset.essence;
  dataset.shiftUp = num(dataset.shiftUp) + num(wealth?.shiftUp);
  dataset.shiftDown = num(dataset.shiftDown) + num(wealth?.shiftDown);
  dataset.isWealthRequisition = true;
  return dataset;
}

registerPreRoll(async (actor, dataset) => {
  if (!dataset?.requisitionItemName || dataset.skill == 'wealth'
    || !(has(actor, IDS.moneyTalks) || has(actor, IDS.capableFreelancer))) {
    return;
  }

  const source = wealthSourceFor(actor);
  const { chooseButtons } = await import("../../mechanics/resources/grants.mjs");
  const choice = await chooseButtons(source?.name ?? '', T('ResWealthRequisitionPrompt', { name: dataset.requisitionItemName }), [
    ['wealth', T('ResWealthRequisitionWealth')],
    ['skill', game.i18n.localize(CONFIG.E20?.skills?.[dataset.skill] ?? dataset.skill)],
  ]);
  if (choice == 'wealth') {
    toWealthTest(dataset, actor.system?.skills?.wealth);
  }
});
