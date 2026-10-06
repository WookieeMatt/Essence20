/**
 * Dark Energon's addiction attack on every use, and a use feeding an addict's craving (Decepticon Directive p.80).
 * The Hang-Up it grants is ./addicted-dark-energon.mjs; the strain itself ./energon-strains.mjs.
 */
import { IDS } from "../shared/resource-team-lookups.mjs";
import { T } from "../shared/item-lang.mjs";
import { has } from "../shared/item-lookups.mjs";
import { num } from "../shared/numbers.mjs";
import { say } from "../shared/chat-lines.mjs";

const ADDICTION_LADDER = ['d6', 'd8', 'd10', 'd12', '2d8', '3d6'];
const ADDICTION_FLAG = 'darkEnergonUses';

/** The addiction attack's skill die after this many earlier uses, or 'auto' past the top. */
export function addictionDie(previousUses) {
  return ADDICTION_LADDER[previousUses] ?? 'auto';
}

// "Dark Energon is highly addictive, making an attack against the Willpower of anyone who uses it,
// starting with a base skill level of +d6 and gaining ↑1 for each time used until it automatically
// succeeds. When the attack succeeds, the subject gains the Addicted (Dark Energon) Hang-Up."
export async function darkEnergonAddiction(actor) {
  if (has(actor, IDS.addictedDarkEnergon)) {
    return;
  }

  const uses = num(actor.flags?.essence20?.[ADDICTION_FLAG]);
  await actor.setFlag('essence20', ADDICTION_FLAG, uses + 1);
  const die = addictionDie(uses);
  const willpower = num(actor.system?.defenses?.willpower?.total);
  let hit = true;
  let total = '-';
  if (die != 'auto') {
    // Word of Unicron (Decepticon Directive p.67): "Dark Energon addiction 'attacks' ... against you suffer Snag."
    const snag = has(actor, 'Compendium.essence20.decepticon_directive.Item.liMchvrumE1wB8Rc');
    const roll = await new Roll(`${snag ? '2d20kl' : '1d20'} + ${die.startsWith('d') ? `1${die}` : die}`).evaluate();
    total = roll.total;
    hit = roll.total >= willpower;
  }

  await say(actor, T(hit ? 'ResDarkAddictionHit' : 'ResDarkAddictionMiss', { name: actor.name, die, total, willpower }));
  if (hit) {
    // "At the same skill level that caused the Hang-Up" - the daily attack (./addicted-dark-energon.mjs#newDay)
    // reads this instead of asking.
    await actor.setFlag('essence20', ADDICTION_DIE_FLAG, die);
    const { grantCopy } = await import("../../mechanics/resources/grants.mjs");
    await grantCopy(actor, IDS.addictedDarkEnergon);
  }
}

/** The die the addiction hit at, for the Hang-Up's daily attack ('auto' always succeeds). */
export const ADDICTION_DIE_FLAG = 'darkEnergonAddictionDie';

// Consuming or using Dark Energon feeds an addict's craving for the day - the Hang-Up's state
// (./addicted-dark-energon.mjs, flag q1Addiction) goes back to not craving, as its own "Consumed" button does.
export async function feedDarkEnergonCraving(actor) {
  const state = actor?.flags?.essence20?.q1Addiction;
  if (state?.craving) {
    await actor.setFlag('essence20', 'q1Addiction', { ...state, craving: false, cravingDay: null });
  }
}
