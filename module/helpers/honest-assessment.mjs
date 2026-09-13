/**
 * Honest Assessment (MLP CRB, Spirit of Honesty, 14th level, p.79): "As a Free action, you can
 * give yourself a downshift ↓2 penalty on both Deception and Persuasion to give yourself an
 * upshift ↑2 on any other one Skill. This lasts until the end of the scene."
 *
 * A self-only, multi-roll toggle (not a one-shot bank-and-consume) - the chosen Skill is picked
 * once, permanently, at Perk-drop time via the existing choiceType:'skills' mechanism (same
 * shape as Awesome), so the toggle itself just needs to flip on/off. Free to switch either way
 * (RAW states no cost beyond the Free action), same idiom as Dig In. "Until the end of the
 * scene" is approximated as "until manually toggled off" - this project's usual duration idiom
 * for anything longer than a single roll with no expiry hook to attach to.
 */
const HONEST_ASSESSMENT_FLAG = 'honestAssessmentActive';

export function isHonestAssessmentActive(actor) {
  return !!actor.getFlag?.('essence20', HONEST_ASSESSMENT_FLAG);
}

export async function toggleHonestAssessment(actor) {
  const nowActive = !isHonestAssessmentActive(actor);
  await actor.setFlag('essence20', HONEST_ASSESSMENT_FLAG, nowActive);
  return nowActive;
}
