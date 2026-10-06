import { registerChatButton, registerPostRoll } from "../../mechanics/item-hooks.mjs";

/**
 * Weapon rules for the data1 slice of the Item Review:
 * - A weaponEffect that inflicts a Condition on a hit (flags.essence20.onHitStatus), e.g. the
 *   Dynamite, Bundle alternate effect (A Jump Through Time, Table 3-8, p.79): "Target is Stunned
 *   for 2d2 turns".
 * - Drive-By (GI Joe CRB, Vehicle Traits, p.172): "In order to use this attack, the vehicle must
 *   move at least 15 feet first" - for the Ram and Flyby natural attacks.
 */

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

/* -------------------------------------------- */
/*  Condition on a hit                           */
/* -------------------------------------------- */

/**
 * The on-hit Condition an effect carries: {status, rounds} where rounds is a number or a dice
 * formula ("2d2").
 */
export function onHitStatusOf(item) {
  const spec = item?.flags?.essence20?.onHitStatus;
  return spec?.status ? spec : null;
}

function escape(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function onHitStatusCard(actor, item, target, spec) {
  const status = CONFIG.statusEffects?.find?.(s => s.id == spec.status);
  const label = status ? game.i18n.localize(status.name ?? status.label ?? spec.status) : spec.status;
  return `<p>${T('E20.D1OnHitStatus', { name: escape(target.name), status: escape(label), rounds: escape(spec.rounds ?? '') })}</p>`
    + `<button type="button" data-e20-ext="d1OnHitStatus" data-target="${escape(target.uuid)}" data-status="${escape(spec.status)}" data-rounds="${escape(spec.rounds ?? '')}">`
    + `${T('E20.D1ApplyStatus', { status: escape(label) })}</button>`;
}

registerPostRoll(async (actor, results, checkContext, { hits, rider } = {}) => {
  if (!rider?.itemUuid || !hits?.some(h => h.hit)) {
    return;
  }

  const item = await fromUuid(rider.itemUuid);
  const spec = onHitStatusOf(item);
  if (!spec) {
    return;
  }

  for (const { target, hit } of hits) {
    if (hit && target) {
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: onHitStatusCard(actor, item, target, spec) });
    }
  }
});

/** How many rounds a spec's duration comes to - rolled when it's a formula. */
export async function resolveRounds(rounds) {
  if (rounds === '' || rounds === null || rounds === undefined) {
    return null;
  }

  if (Number.isFinite(Number(rounds))) {
    return Number(rounds);
  }

  const roll = await new Roll(String(rounds)).evaluate();
  return roll.total;
}

registerChatButton('d1OnHitStatus', async (message, button) => {
  const target = await fromUuid(button.dataset.target);
  const actor = target?.actor ?? target;
  if (!actor?.toggleStatusEffect) {
    return;
  }

  const rounds = await resolveRounds(button.dataset.rounds);
  const status = button.dataset.status;
  if (actor.isOwner) {
    const { applyTimedCondition } = await import("../../mechanics/combat/timed-status.mjs");
    await applyTimedCondition(actor, status, rounds);
  } else {
    const { needsGmRelay, relayToGm } = await import("../../mechanics/world/gm-relay.mjs");
    if (!needsGmRelay(actor)) {
      ui.notifications?.warn(T('E20.D1NeedsGm'));
      return;
    }

    await relayToGm(actor, 'toggleStatusEffect', [status, { active: true }]);
  }

  button.disabled = true;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: T('E20.D1StatusApplied', { name: actor.name, status, rounds: rounds ?? '-' }),
  });
});

/* -------------------------------------------- */
/*  Drive-By                                     */
/* -------------------------------------------- */

export const DRIVE_BY_FEET = 15;

// actorId -> {key, feet}: how far the actor's token has moved during its own current turn. Tracked
// on the client that moves the token (preUpdateToken still has the old position), which is almost
// always the one then rolling the Ram/Flyby - the gate below is a confirm, not a hard block, for the
// cases where it isn't.
const moved = new Map();

function turnKey(combat) {
  return combat ? `${combat.id}:${combat.round}:${combat.turn}` : null;
}

export function feetMovedThisTurn(actor, combat = game.combat) {
  const key = turnKey(combat);
  const entry = actor ? moved.get(actor.id) : null;
  return key && entry?.key == key ? entry.feet : 0;
}

export function noteMovement(actor, feet, combat = game.combat) {
  const key = turnKey(combat);
  if (!actor || !key || !(feet > 0)) {
    return;
  }

  const entry = moved.get(actor.id);
  moved.set(actor.id, { key, feet: (entry?.key == key ? entry.feet : 0) + feet });
}

export function isDriveByAttack(item) {
  return item?.type == 'weaponEffect' && !!(item.system?.isRam || item.system?.isFlyby);
}

/**
 * Whether this roll should stop and ask: a Ram/Flyby in a started combat, on the actor's own turn,
 * with less than 15ft moved so far.
 */
export function driveByShortfall(item, dataset, combat = game.combat) {
  if (!isDriveByAttack(item) || dataset?.rollType == 'info' || !combat?.started) {
    return null;
  }

  const actor = item.actor ?? item.parent;
  if (!actor || combat.combatant?.actor?.id != actor.id) {
    return null;
  }

  const feet = feetMovedThisTurn(actor, combat);
  return feet < DRIVE_BY_FEET ? { feet } : null;
}

Hooks.on('preUpdateToken', (tokenDoc, changes) => {
  if (!changes || (!('x' in changes) && !('y' in changes))) {
    return;
  }

  const combat = game.combat;
  const actor = tokenDoc?.actor;
  if (!combat?.started || !actor || combat.combatant?.actor?.id != actor.id) {
    return;
  }

  const from = { x: tokenDoc.x, y: tokenDoc.y };
  const to = { x: changes.x ?? from.x, y: changes.y ?? from.y };
  const feet = canvas?.grid?.measurePath?.([from, to])?.distance ?? 0;
  noteMovement(actor, feet, combat);
});

Hooks.once('setup', () => {
  const cls = CONFIG.Item?.documentClass;
  const original = cls?.prototype?.roll;
  if (!original || original.d1DriveBy) {
    return;
  }

  const wrapped = async function (dataset, ...rest) {
    const short = driveByShortfall(this, dataset ?? {});
    if (short) {
      const proceed = await foundry.applications.api.DialogV2.confirm({
        window: { title: this.name },
        content: `<p>${T('E20.D1DriveByPrompt', { name: this.name, feet: Math.round(short.feet), need: DRIVE_BY_FEET })}</p>`,
        rejectClose: false,
      });
      if (!proceed) {
        return null;
      }
    }

    return original.call(this, dataset, ...rest);
  };

  wrapped.d1DriveBy = true;
  cls.prototype.roll = wrapped;
});
