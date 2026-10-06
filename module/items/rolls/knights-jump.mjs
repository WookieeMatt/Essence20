/**
 * Knight's Jump (GI Joe CRB, Grandmaster Focus, 1st level, p.87): "Once per turn as a Move
 * action, you can choose two allies to swap places in initiative order. This can result in one of
 * your allies gaining an additional turn."
 *
 * Requires the player to have exactly 2 allies currently targeted (the same "auto-detect via
 * currently-targeted tokens" idiom Mark Target/Splinter Defense already establish, widened to two
 * targets the way Through The Arches' own multi-target marking already does) - no picker dialog
 * offers a clean two-ally selection the way the single-ally pickAllyTargets does, so this reads
 * the targets directly rather than building a new two-dropdown UI. Swaps the two allies' own
 * Combatant#initiative values directly (the same real Combat/Combatant#update write Splinter
 * Defense's own Initiative dock already established), only inside an active Combat.
 */
export async function activateKnightsJump(actor) {
  if (!game.combat) {
    return false;
  }

  const targetedActors = Array.from(game.user.targets ?? []).map(token => token.actor).filter(a => a && a != actor);
  if (targetedActors.length != 2) {
    ui.notifications.warn(game.i18n.localize('E20.KnightsJumpNeedsTwoTargets'));
    return false;
  }

  const [combatantA, combatantB] = targetedActors.map(
    a => game.combat.combatants.find(c => c.actor?.id == a.id),
  );
  if (!combatantA || !combatantB) {
    ui.notifications.warn(game.i18n.localize('E20.KnightsJumpNeedsTwoTargets'));
    return false;
  }

  const initiativeA = combatantA.initiative;
  await combatantA.update({ initiative: combatantB.initiative });
  await combatantB.update({ initiative: initiativeA });
  return true;
}
