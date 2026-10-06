/**
 * Power Rangers - Through the Shattered Grid's Better Together (Influence) and its Hang-Up.
 */
import { registerRollSources, registerUse } from "../../mechanics/item-hooks.mjs";
import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import { O3 } from "../shared/mlp-pr-tf-ids-and-skill-total.mjs";
import { T } from "../shared/item-lang.mjs";
import { escapeHtml as escape, say } from "../shared/chat-lines.mjs";
import { findSourced as findItem, has, isItem } from "../shared/item-lookups.mjs";
import { myActor, tokenOf } from "../shared/sides.mjs";
import { stampLive, untilEndOfNextTurn } from "../shared/turn-stamps.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";

/*
 * Better Together (Through the Shattered Grid, Influence, p.18): "You synchronize with a chosen ally
 * when you take this Influence. Whenever you or your chosen ally Lend Assistance to one another for
 * any Skill Test, you both gain ↑1 and an Edge until the end of your next turn." Hang-Up: "In any
 * situation where you and your chosen ally are not in a scene together, you suffer ↓1 on any Skill
 * Test until you are reunited."
 *
 * The ally is chosen with the Perk's Use button. The assist is seen as it's banked (the ally's
 * pendingLendAssistance flag written by mechanics/actions/lend-assistance.mjs, on the assister's client); the
 * assister stamps the pair on their own actor, which both of them read.
 */
const PARTNER_FLAG = 'o3Partner';
const SYNC_FLAG = 'o3BetterTogether';
const BT_HANGUP = 'Compendium.essence20.through_the_shattered_grid.Item.7WzxxG6T7kF6daMY';

export function partnerOf(actor) {
  return findItem(actor, O3.betterTogether)?.flags?.essence20?.[PARTNER_FLAG] ?? null;
}

export function isPair(a, b) {
  return !!a && !!b && ((has(a, O3.betterTogether) && partnerOf(a) == b.uuid) || (has(b, O3.betterTogether) && partnerOf(b) == a.uuid));
}

export function betterTogetherActive(actor) {
  const live = record => !!record && record.epoch == getSceneEpoch() && stampLive(record.until);
  const own = actor?.flags?.essence20?.[SYNC_FLAG];
  if (live(own)) {
    return true;
  }

  return worldActors().some(other => {
    const record = other.flags?.essence20?.[SYNC_FLAG];
    return record?.with == actor?.uuid && live(record);
  });
}

registerUse({
  id: 'o3BetterTogether',
  matches: item => isItem(item, O3.betterTogether),
  run: async (item) => {
    const actor = item.parent;
    const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
    const options = worldActors().filter(a => a.type == 'playerCharacter' && a.uuid != actor.uuid)
      .map(a => ({ value: a.uuid, label: a.name }));
    const uuid = await chooseSelect(item.name, T('O3BetterTogetherPick'), options);
    if (!uuid) {
      return null;
    }

    await item.setFlag('essence20', PARTNER_FLAG, uuid);
    return T('O3BetterTogetherChosen', { name: escape(actor.name), ally: escape(options.find(o => o.value == uuid)?.label) });
  },
});

Hooks.on?.('updateActor', async (ally, changes, options, userId) => {
  if (userId != game.user?.id) {
    return;
  }

  const flags = changes?.flags?.essence20 ?? {};
  const shift = flags.pendingLendAssistanceShift;
  const edge = flags.pendingLendAssistanceEdge;
  if (!shift && !edge) {
    return;
  }

  const assister = shift?.assisterUuid ? await fromUuid(shift.assisterUuid) : myActor();
  if (!assister || assister.uuid == ally.uuid || !assister.isOwner || !isPair(assister, ally)) {
    return;
  }

  await assister.setFlag('essence20', SYNC_FLAG, { with: ally.uuid, epoch: getSceneEpoch(), until: untilEndOfNextTurn(assister) });
  await say(assister, T('O3BetterTogetherLine', { name: escape(assister.name), ally: escape(ally.name) }));
});

function onSceneTogether(actor, partnerUuid) {
  const scene = canvas?.scene;
  if (!scene || !tokenOf(actor)) {
    return true;
  }

  const partner = worldActors().find(a => a.uuid == partnerUuid);
  return !partner || !!tokenOf(partner);
}

registerRollSources((actor) => {
  const sources = [];
  if (betterTogetherActive(actor)) {
    sources.push({ id: 'o3BetterTogether', label: 'Better Together', shiftUp: 1, edge: true });
  }

  const partner = partnerOf(actor);
  if (partner && has(actor, BT_HANGUP) && !onSceneTogether(actor, partner)) {
    sources.push({ id: 'o3BetterTogetherApart', label: 'Better Together (Hang-Up)', shiftDown: 1 });
  }

  return { sources };
});
