import { getNearbyAllyTokens } from "./allies.mjs";
import { actorHasPerk } from "./perks.mjs";
import { getCombatStanceNumber } from "./combat-stance.mjs";

/**
 * Defender Step (Through the Shattered Grid, Magna Defender, 2nd level, p.24): "Whenever an
 * Attack targets an ally you can see, you can spend 1 Personal Power to Move half your Ground
 * Movement towards that ally. If you finish your movement adjacent to that ally, you increase
 * their defenses against the Attack that triggered this Role Perk by an amount equal to your
 * Combat Stance number."
 *
 * The first Perk built against the "intervene in someone else's roll before it resolves" hook
 * (helpers/defense-choice.mjs's own doc comment) - modifies THIS SPECIFIC target's own Defense
 * for THIS SPECIFIC attack, decided by a THIRD PARTY (the reacting ally), not the attacker or the
 * target themselves. Called from dice.mjs's own per-target difficulty loop, right after that same
 * target's own resolvedDefenseType is known (Defender Step boosts whichever Defense the target
 * actually chose, not a fixed one).
 *
 * "Move half your Ground Movement towards that ally" and "finish your movement adjacent to that
 * ally" have no movement-execution mechanic to verify (the same unenforceable-precondition idiom
 * this project already accepts elsewhere, e.g. Field Aid's own "heading in the direction of")-
 * the confirm dialog itself doubles as that adjudication (would you actually finish adjacent?),
 * the same "the dialog choice IS the fictional commitment" shape Sudden Death/Just a Graze/Hard
 * Corps already use for a narrower precondition dice.mjs/chat.mjs can't otherwise verify.
 *
 * Swift Defender (13th level, p.25): "you gain 1 temporary Health when you activate Defender
 * Step" - built here as the existing system.health.bonus grant (Got To Get Tough's own identical
 * "+1 temporary Health" shape). Its OTHER clause ("Move a distance equal to your Ground Movement
 * instead of half") has nothing to change mechanically, since neither distance is tracked either.
 *
 * Retribution (7th level, p.25) - "whenever you activate your Defender Step and end adjacent to
 * the enemy... you can spend 1 Personal Power to make a single melee Attack against that foe. You
 * gain +1 damage if the enemy still struck your ally or an Edge on the Retribution Attack if your
 * Defender Step caused the Attack to miss." Built in helpers/retribution.mjs: dice.mjs's own
 * _rollSkillHelper banks the outcome (see checkAndActivateDefenderStep's return shape below) once
 * the original attack's own hit/miss is known, scoped to the reactor and the specific enemy who
 * triggered it; that banked bonus then surfaces as a Roll Options Dialog checkbox on the
 * reactor's own next melee attack against that same enemy, the same "spend a resource via
 * checkbox" idiom every other costed roll bonus in this file already uses (Combat Stance's own
 * identical damage-spend checkbox is the closest template).
 */
const DEFENDER_STEP_ID = "Compendium.essence20.through_the_shattered_grid.Item.X59RRGMww6UZQJ78";
const SWIFT_DEFENDER_ID = "Compendium.essence20.through_the_shattered_grid.Item.MPAZdtX3Ob76h90Y";

/**
 * Checks whether any of targetActor's nearby allies want to activate Defender Step against this
 * specific incoming attack, prompting each eligible one in turn until one confirms. Spends 1
 * Personal Power and grants Swift Defender's own +1 temporary Health on confirmation.
 * @param {Actor} targetActor      The actor being attacked.
 * @param {Actor} attackingActor   The actor making the attack, for the confirm dialog's own flavor.
 * @returns {Promise<{bonus: Number, reactorUuid: String|null}>}   bonus is 0/reactorUuid is null
 *   if nobody activated it - see helpers/retribution.mjs for how these get used once the
 *   attack's own hit/miss is known.
 */
export async function checkAndActivateDefenderStep(targetActor, attackingActor) {
  const reactors = getNearbyAllyTokens(targetActor, Infinity)
    .map(token => token.actor)
    .filter(reactor => (
      reactor && reactor !== targetActor
      && actorHasPerk(reactor, DEFENDER_STEP_ID)
      && (reactor.system.powers?.personal?.value ?? 0) >= 1
    ));

  for (const reactor of reactors) {
    const confirmation = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('E20.DefenderStepConfirmTitle') },
      classes: ["window-app", "e20-window"],
      content: `<p>${game.i18n.format('E20.DefenderStepConfirmContent', {
        reactor: reactor.name, ally: targetActor.name, attacker: attackingActor?.name ?? '?',
      })}</p>`,
      modal: true,
      buttons: [
        { label: game.i18n.localize('E20.DialogYesButton'), action: 'yes' },
        { label: game.i18n.localize('E20.DialogNoButton'), action: 'no' },
      ],
    });

    if (confirmation != 'yes') {
      continue;
    }

    const update = { 'system.powers.personal.value': reactor.system.powers.personal.value - 1 };
    if (actorHasPerk(reactor, SWIFT_DEFENDER_ID)) {
      update['system.health.bonus'] = (reactor.system.health.bonus ?? 0) + 1;
    }

    await reactor.update(update);

    return { bonus: getCombatStanceNumber(reactor), reactorUuid: reactor.uuid };
  }

  return { bonus: 0, reactorUuid: null };
}
