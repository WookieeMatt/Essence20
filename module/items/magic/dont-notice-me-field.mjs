import { isActiveForWindow } from "../../mechanics/resources/scene-clock.mjs";

/**
 * Don't-Notice-Me-Field (MLP CRB, Superior Enchantment spell, p.137): the target turns silent and
 * invisible - Edge on Infiltration to stay unseen, and a Snag on Awareness for anyone looking for them.
 *
 * Cast against the spell's own flat casting DIF (Superior = Hard/20, same manual-DIF shape as
 * Fluttery Wings/Bestow Expertise), on whichever token is currently targeted (or the caster
 * themselves with nothing targeted) - same "cast on the current target" idiom Fluttery Wings/
 * Lightning Speed/Summon Armor already establish. On a successful cast: toggles the real
 * 'invisible' status Condition (this system's own status - "silent" has no equivalent tracked
 * Condition anywhere in this codebase, a scoped gap left unbuilt rather than approximated), plus
 * a scene-scoped flag (the Scene Clock, same "1 scene" duration fit Fluttery Wings already uses)
 * read two ways in dice.mjs#_getAutomaticCombatModifiers: as a self-side Edge on the holder's own
 * Infiltration Tests "related to not being seen" (unconditional on isAttack - Infiltration is
 * never a weaponEffect), and reciprocally as a Snag on anyone rolling Alertness ("Awareness" in
 * this RAW's own flavor text - this system's actual Skill is Alertness) against them, the same
 * mirror-image reciprocal shape Skepticism/See Something Say Nothing already establish. Ending it
 * when the target harms someone or meets stronger magic is a
 * GM-judged narrative break condition with no fixed numeric trigger to hook automatically, left
 * for the GM to clear by hand (same idiom this project already accepts for Disappear/other
 * conditionally-broken invisibility effects).
 */
const DONT_NOTICE_ME_FIELD_FLAG = 'dontNoticeMeFieldActive';

export function isDontNoticeMeFieldActive(actor) {
  return isActiveForWindow(actor, DONT_NOTICE_ME_FIELD_FLAG, 'scene');
}
