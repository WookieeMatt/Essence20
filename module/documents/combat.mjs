import { onCompanionTurnStart, onFirstCombatTurn } from "../helpers/companions.mjs";
import { onSpiritsHostTurn } from "../helpers/team-actions.mjs";
import { onRoundChange } from "../helpers/summons.mjs";
import { onTurnStartZones } from "../helpers/target-riders.mjs";
import { checkSelfDestruct } from "../helpers/vehicle-upgrades.mjs";
import { sweepTemporary } from "../helpers/weapon-perk-uses.mjs";
import { checkTimeBombs } from "../helpers/planted-bombs.mjs";
import { Dice } from "../dice.mjs";
import { RollDialog } from "../helpers/roll-dialog.mjs";
import { applyGotToGetTough } from "../helpers/got-to-get-tough.mjs";
import { advanceEncounter } from "../helpers/scene-clock.mjs";
import { expireAoeRegions } from "../helpers/aoe-expiry.mjs";
import { isTracking, resetTurn } from "../helpers/action-economy.mjs";
import { DEFENDING_STATUS } from "../helpers/named-actions.mjs";
import { applyVainglorious } from "../helpers/vainglorious.mjs";
import { applyEnvironmentAtTurnEnd } from "../helpers/environment-hazards.mjs";

export class Essence20Combat extends Combat {
  constructor(data, context) {
    super(data, context);
    this._dice = new Dice(ChatMessage, new RollDialog(), game.i18n);
  }

  /**
  * @override
  */
  async rollInitiative(ids, options) {
    const combatants = ids.flatMap(
      (id) => this.combatants.get(id) ?? [],
    );

    for (let combatant of combatants) {
      if (await this._dice.prepareInitiativeRoll(combatant.actor)) {
        await applyGotToGetTough(combatant.actor);
        await super.rollInitiative([combatant.id], options);
      }
    }
  }

  /**
   * Refill the incoming combatant's action budget - see helpers/action-economy.mjs#resetTurn.
   *
   * Foundry v14 calls _onStartTurn AFTER the Combat document's own update has committed, and only
   * on one designated GM client. That buys three things the combatTurn/combatRound hook pair used
   * elsewhere in this system (see essence20.mjs) can't offer: the combatant passed in is already
   * the new one (no "combat.combatant is still the OLD, ending turn" workaround), the very first
   * turn of a brand-new combat is covered without a separate combatStart case, and exactly one
   * write reaches the database rather than one per connected player.
   *
   * @param {Combatant} combatant             The Combatant whose turn just started
   * @param {CombatTurnEventContext} context  The context of the turn that just started
   * @override
   */
  async _onStartTurn(combatant, context) {
    await super._onStartTurn(combatant, context);

    if (isTracking()) {
      await resetTurn(combatant);
      // Vainglorious (Transformers CRB p.43): forced Standard-action spend on the actor's first
      // turn of this combat - see helpers/vainglorious.mjs for why it's per-combat rather than
      // assumed to be round 1.
      await applyVainglorious(combatant.actor);
    }

    /* "This benefit lasts until the beginning of your next turn" (GI Joe CRB p.196) - so the
       Defend Snag ends here, on the defender's own next turn, not at the end of the round.
       Deliberately outside the isTracking() guard above: Defend is a rules effect that works
       whether or not the world is counting actions, and a Condition that could be applied but
       never cleared would be worse than not applying it. */
    if (combatant?.actor?.statuses?.has(DEFENDING_STATUS)) {
      await combatant.actor.toggleStatusEffect(DEFENDING_STATUS, { active: false });
    }

    // Temporary upgrades and effects whose time is up (Beatdown, Armament Upgrade, Knuckle Up...),
    // and Time Bombs coming due - helpers/weapon-perk-uses.mjs, helpers/planted-bombs.mjs.
    for (const other of this.combatants ?? []) {
      if (other.actor) {
        await sweepTemporary(other.actor);
      }
    }

    await checkTimeBombs(this);
    await checkSelfDestruct(this);

    // Suppressing Fire areas: gone at their owner's next turn, and an enemy starting a turn in
    // one is offered to its owner - helpers/target-riders.mjs.
    if (combatant?.actor) {
      await onTurnStartZones(combatant.actor);
      // Companions (Artificial Intelligence, Constrictor, the tractor beam), Spirit's Host, and Perch on
      // the first round - helpers/companions.mjs, helpers/team-actions.mjs.
      await onCompanionTurnStart(combatant.actor, this);
      await onSpiritsHostTurn(combatant.actor);
      if ((context?.round ?? this.round) == 1) {
        await onFirstCombatTurn(combatant.actor);
      }
    }

    // A vehicle called "like a Zord" turns up on its round (helpers/summons.mjs).
    if ((context?.turn ?? this.turn) == 0) {
      await onRoundChange(this);
    }
  }

  /**
   * Environmental damage over time for whoever's turn just ended - Vacuum's Essence damage "at the
   * end of each turn", and the round-counted damage of a Corrosive, Extreme Temperature or Toxic
   * environment (see helpers/environment-hazards.mjs). v14 runs this once, on the active GM, after
   * the turn change has committed - so exactly one tick per turn reaches the database.
   *
   * @param {Combatant} combatant             The Combatant whose turn just ended
   * @param {CombatTurnEventContext} context  The context of the turn that just ended
   * @override
   */
  async _onEndTurn(combatant, context) {
    await super._onEndTurn(combatant, context);

    if (combatant?.actor) {
      // The combatant's own token, so the scene the fight is on decides - not the scene the GM
      // client running this happens to be viewing.
      await applyEnvironmentAtTurnEnd(combatant.actor, this, combatant.token ?? null);
    }
  }

  /**
   * Expire any lingering Area of Effect region whose duration is counted in rounds - see
   * helpers/aoe-expiry.mjs.
   *
   * This is the only place a round-based area can expire while a fight is still running.
   * `updateWorldTime` can't do it: CONFIG.time.roundTime is 0 in this system, so advancing a round
   * moves no world time, and expireAoeRegions with no round in its context deliberately treats a
   * round-based area as "can't tell yet" rather than expiring it. Without this hook, such an area
   * survived until deleteCombat swept it - so a "3 rounds" area sat on the map for the rest of the
   * encounter.
   *
   * The round to judge against is `context.round`, NOT `this.round`. Like _onStartTurn, v14 runs
   * this post-commit, so by the time it fires the document has already advanced and `this.round`
   * is the round about to START - measured in v14.364, ending round 2 arrives here with
   * context.round 2 and this.round 3. Using `this.round` expired everything a full round early:
   * an area placed on round 1 for 3 rounds vanished as round 3 began instead of surviving it.
   *
   * With the round that actually ended, the inclusive count in isAoeExpired lands where the rules
   * doc says it should - that same area covers rounds 1, 2 and 3, because 3 - 1 + 1 >= 3 first
   * holds at the end of round 3.
   *
   * A context with no round leaves it null on purpose: isAoeExpired then treats a round-based area
   * as "can't tell yet" and leaves it alone, which is the safe direction to fail in.
   *
   * v14 runs this on one designated GM client, so a single sweep reaches the database rather than
   * one per connected player.
   *
   * @param {CombatRoundEventContext} context   The context of the round that just ended
   * @override
   */
  async _onEndRound(context) {
    await super._onEndRound(context);

    await expireAoeRegions({ round: context?.round ?? null });
  }

  /**
   * Advance the Scene Clock's encounter counter when the encounter ends, refreshing every
   * once-per-encounter ability - which is what those abilities already did before the clock
   * existed, since they were stamped with the ending combat's own id. Once-per-SCENE abilities
   * deliberately do not refresh here; only the GM's own New Scene does that. See
   * helpers/scene-clock.mjs.
   *
   * v14 has no _onEndCombat extension point, so this runs through _onDelete, guarded by
   * game.user.isActiveGM - the same designated-GM idiom core itself uses a few lines further down
   * in its own implementation.
   *
   * Nothing clears the action ledgers here, deliberately. They live on the Combatants, which are
   * embedded in this Combat and are destroyed along with it, so there is nothing left to clear -
   * and trying anyway is worse than useless: an unsetFlag on a Combatant whose parent Combat has
   * just been deleted makes the server resolve that Combat by uuid, fail to find it, and throw
   * "The Combat <id> does not exist in combats".
   *
   * _onDelete is synchronous, so the counter bump is deliberately fire-and-forget with its own
   * catch - a failed settings write must not surface as an unhandled rejection during teardown.
   *
   * @override
   */
  _onDelete(options, userId) {
    super._onDelete(options, userId);

    if (game.user?.isActiveGM) {
      advanceEncounter().catch(error => console.error("Essence20 | Scene Clock", error));
    }
  }
}
