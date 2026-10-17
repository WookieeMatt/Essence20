import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import { markOf } from "../../rules/predicate.mjs";

/**
 * The Perks and Upgrades that change a weapon for a while, from a Use button.
 *
 * Two kinds of change, both undone on their own:
 *
 * - A MUTATION, kept on the weapon's own flags (flags.essence20.mutation) and read by
 *   items/attacks/weapon-upgrades.mjs#applyToEffect: Explosive Ammo's blast, Utility Loaders' damage type,
 *   Backblast's halved range. "This effect lasts until you roll a Fumble with the weapon" -
 *   documents/item.mjs clears it on a Fumble; the one-shot parts (Firestorm, Airburst) clear after
 *   the next attack with the weapon.
 * - A TEMPORARY UPGRADE (or, for Knuckle Up, a temporary unarmed effect): a real Item, created on
 *   the actor and attached, stamped with when it goes away (flags.essence20.temporary).
 *   sweepTemporary() removes it; it runs at every turn start (documents/combat.mjs).
 */

// Explosive Ammo, Firestorm, Utility Loaders, Backblast, Airburst (a mutateWeapon step), Kitbash Upgrade, Armament
// Upgrade, Traps and Obstacles, Grid Connection, Beatdown, Jackhammer (fitUpgrade with until), Knuckle Up (grantAttacks)
// and Motor Lancer (a mark read by an ItemModifier stage item rule) are their items' own Use rules
// (rules/plugins/combat/weapon-mutation.mjs); this file keeps the state those rules write and its readers.

const MUTATION_FLAG = 'mutation';
const TEMPORARY_FLAG = 'temporary';
// Grid Connection's light armor shell: a rule mark (its Use rule's `mark {key: gridShell, until: scene}`).
const GRID_SHELL_MARK = 'gridShell';

function turnStamp() {
  const combat = game.combat;
  return combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : { combatId: null, round: 0, turn: 0 };
}

/* -------------------------------------------- */
/*  Temporary upgrades and effects              */
/* -------------------------------------------- */

/**
 * The temporary stamp a made-for-a-while Item carries (flags.essence20.temporary): its kind and source, with the
 * combat turn and scene it was made in - what isExpired reads.
 * @param {Object} temporary   {kind: 'turn'|'nextTurn'|'rounds'|'scene'|'untilUsed', rounds?, source?}
 * @returns {Object}
 */
export function temporaryStamp(temporary) {
  return { ...temporary, ...turnStamp(), scene: getSceneEpoch() };
}

/**
 * Attach a copy of a compendium upgrade to a weapon for a while.
 * @param {Actor} actor
 * @param {Item} weapon
 * @param {String} upgradeUuid
 * @param {Object} temporary   {kind: 'turn'|'nextTurn'|'rounds'|'scene'|'untilUsed', rounds, source}
 * @returns {Promise<Item|null>}
 */
export async function attachTemporaryUpgrade(actor, weapon, upgradeUuid, temporary) {
  const source = await fromUuid(upgradeUuid);
  if (!source) {
    return null;
  }

  const data = source.toObject();
  delete data._id;
  foundry.utils.setProperty(data, 'flags.core.sourceId', upgradeUuid);
  foundry.utils.setProperty(data, 'flags.essence20.parentId', weapon.id);
  foundry.utils.setProperty(data, `flags.essence20.${TEMPORARY_FLAG}`, temporaryStamp(temporary));
  const [created] = await actor.createEmbeddedDocuments('Item', [data]);
  const { setEntryAndAddItem } = await import("../../sheet-handlers/attachment-handler.mjs");
  const key = await setEntryAndAddItem(created, weapon);
  if (key) {
    await created.setFlag('essence20', 'collectionId', key);
  }

  return created;
}

/**
 * Whether a temporary Item's time is up.
 * @param {Object} temp   Its flags.essence20.temporary.
 * @returns {Boolean}
 */
export function isExpired(temp) {
  if (!temp) {
    return false;
  }

  const combat = game?.combat;
  if (temp.kind == 'scene') {
    return temp.scene != getSceneEpoch();
  }

  if (temp.kind == 'untilUsed') {
    return false;
  }

  if (!combat || combat.id != temp.combatId) {
    // The combat it was counted against is over.
    return !!temp.combatId || temp.kind != 'rounds';
  }

  if (temp.kind == 'turn') {
    return combat.round != temp.round || combat.turn != temp.turn;
  }

  if (temp.kind == 'nextTurn') {
    return combat.round > temp.round + 1 || (combat.round == temp.round + 1 && combat.turn > temp.turn);
  }

  if (temp.kind == 'rounds') {
    return combat.round >= temp.round + (temp.rounds ?? 10);
  }

  return false;
}

/**
 * Remove every expired temporary upgrade and effect from an actor.
 * @param {Actor} actor
 * @returns {Promise<Number>}   How many Items were removed.
 */
export async function sweepTemporary(actor) {
  if (!actor?.items) {
    return 0;
  }

  const expired = actor.items.filter(item => isExpired(item.flags?.essence20?.[TEMPORARY_FLAG]));
  if (expired.length) {
    await removeTemporaryItems(actor, expired);
  }

  return expired.length;
}

async function removeTemporaryItems(actor, items) {
  for (const item of items) {
    const weapon = actor.items.get(item.flags?.essence20?.parentId);
    const key = item.flags?.essence20?.collectionId;
    if (weapon && key && weapon.system.items?.[key]) {
      await weapon.update({ [`system.items.${key}`]: new foundry.data.operators.ForcedDeletion() });
    }
  }

  await actor.deleteEmbeddedDocuments('Item', items.map(item => item.id));
}

/**
 * A temporary "until used" upgrade is spent by the next attack with its weapon (Traps and
 * Obstacles' one-use trap). Called by documents/item.mjs after an attack.
 */
export async function spendUntilUsed(actor, weapon) {
  const used = actor?.items?.filter(item => item.flags?.essence20?.parentId == weapon?.id
    && item.flags?.essence20?.[TEMPORARY_FLAG]?.kind == 'untilUsed') ?? [];
  if (used.length) {
    await removeTemporaryItems(actor, used);
  }
}

/* -------------------------------------------- */
/*  Mutations                                   */
/* -------------------------------------------- */

export function getMutation(weapon) {
  return weapon?.flags?.essence20?.[MUTATION_FLAG] ?? null;
}

/**
 * After an attack with a mutated weapon: the one-shot parts are spent, and a Fumble ends the rest -
 * the altered ammunition lasts until a Fumble with the weapon.
 * @param {Item} weapon
 * @param {Boolean} fumbled
 */
export async function afterMutatedAttack(weapon, fumbled) {
  const mutation = getMutation(weapon);
  if (!mutation) {
    return;
  }

  if (fumbled) {
    await weapon.unsetFlag('essence20', MUTATION_FLAG);
    return;
  }

  if (mutation.tripleNext || mutation.airburstNext) {
    await weapon.setFlag('essence20', MUTATION_FLAG, { ...mutation, tripleNext: false, airburstNext: false });
  }
}

/* -------------------------------------------- */
/*  Grid Connection's shell                     */
/* -------------------------------------------- */

/** Whether Grid Connection's light armor shell is up (its Use rule's gridShell mark, for the scene). */
export function isGridShellActive(actor) {
  return markOf(actor, GRID_SHELL_MARK);
}

/**
 * Everything a changed weapon does once an attack with it has been rolled. Called by
 * documents/item.mjs with the roll's result ({success, outcomes: [{isFumble, results}]}).
 * @param {Actor} actor
 * @param {Item} weapon
 * @param {Object} rollResult
 */
export async function resolveWeaponChangesAfterAttack(actor, weapon, rollResult) {
  const mutation = getMutation(weapon);
  const outcomes = rollResult?.outcomes ?? [];
  const fumbled = outcomes.some(outcome => outcome?.isFumble);
  const { applyDamage } = await import("../../mechanics/combat/combat.mjs");

  if (mutation?.backblast) {
    const token = actor.getActiveTokens?.()?.[0];
    const near = token && canvas?.grid
      ? canvas.tokens.placeables.filter(other => other !== token && other.actor
        && canvas.grid.measurePath([token.center, other.center]).distance <= 5)
      : [];
    const victims = fumbled ? [actor] : near.map(other => other.actor);
    for (const victim of victims) {
      await applyDamage(victim, 1, 'fire');
    }

    if (victims.length) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: game.i18n.format('E20.WeaponUseBackblastHit', { weapon: weapon.name, names: victims.map(v => v.name).join(', ') }),
      });
    }
  }

  if (mutation?.airburstNext) {
    for (const result of outcomes.flatMap(outcome => outcome?.results ?? [])) {
      const target = result.targetUuid ? await fromUuid(result.targetUuid) : null;
      if (target) {
        await target.toggleStatusEffect?.(result.success ? 'prone' : 'impaired', { active: true });
      }
    }
  }

  await afterMutatedAttack(weapon, fumbled);
  await spendUntilUsed(actor, weapon);
}
