// Round 15 (items1): step lendItem - lend a copy of one of the actor's own upgrades. Support, Tech Support.
import { recipients, registerStep } from "../../steps.mjs";

/**
 * `lendItem {item: "choice:<key>", to?: target, onto?: "choice:<key>", lasts?: nextTurnStart | scene}` - a copy of the
 * owned item a pick stored (an upgrade) is made on each recipient for a while, through the GM when this user can't
 * write to them (items/gear/support-upgrade-lending.mjs#lentCopy / lendStamp): until the start of the lender's next turn
 * (`lasts: nextTurnStart`, the default; the scene out of combat) or for the scene (`lasts: scene`) - swept by
 * items/attacks/weapon-perk-uses.mjs#sweepTemporary. `onto` - the recipient's weapon a `pick from: targetItem` stored:
 * the copy is attached to it; otherwise a lent armor upgrade counts as worn. A chat line says who got what.
 */
const listOf = collection => collection?.contents ?? (collection ? [...collection] : []);

registerStep('lendItem', async (step, ctx) => {
  const choices = ctx.item?.flags?.essence20?.rules?.choices ?? {};
  const itemKey = /^choice:([\w-]+)$/.exec(String(step.item ?? ''))?.[1];
  const ontoKey = /^choice:([\w-]+)$/.exec(String(step.onto ?? ''))?.[1];
  const lent = itemKey ? listOf(ctx.actor?.items).find(one => one.id == choices[itemKey] || one.uuid == choices[itemKey]) : null;
  if (!lent) {
    return false;
  }

  const { lendStamp, lentCopy } = await import("../../../items/gear/support-upgrade-lending.mjs");
  const { writeItems } = await import("../../../items/shared/gm-relayed-item-writes.mjs");
  const scene = step.lasts == 'scene';
  for (const ally of recipients({ ...step, to: step.to ?? 'target' }, ctx)) {
    // Only a weapon upgrade goes onto a weapon (an earlier lend's pick stays stored under the key).
    const stored = ontoKey && lent.system?.type == 'weapon' ? choices[ontoKey] : null;
    const weapon = stored ? listOf(ally.items).find(one => one.uuid == stored || one.id == stored) ?? null : null;
    const [created] = await writeItems(ally, { create: [lentCopy(lent, lendStamp(scene), ctx.actor, weapon?.id ?? null)] }) ?? [];
    if (created && weapon && ally.isOwner) {
      const { setEntryAndAddItem } = await import("../../../sheet-handlers/attachment-handler.mjs");
      const key = await setEntryAndAddItem(created, weapon);
      if (key) {
        await created.setFlag('essence20', 'collectionId', key);
      }
    }

    const i18n = globalThis.game?.i18n;
    const data = { name: ctx.actor?.name ?? '', ally: ally.name, upgrade: lent.name };
    ctx.chat.push(i18n?.format?.(scene ? 'E20.O2LentScene' : 'E20.O2LentTurn', data) ?? `${data.name} lends ${data.ally} the ${data.upgrade}.`);
  }
}, {
  errors: (step, where) => [
    ...(/^choice:[\w-]+$/.test(String(step.item ?? '')) ? [] : [`${where}: lendItem needs item: choice:<key>`]),
    ...(step.onto !== undefined && !/^choice:[\w-]+$/.test(String(step.onto)) ? [`${where}: lendItem onto must be choice:<key>`] : []),
    ...(step.lasts !== undefined && !['nextTurnStart', 'scene'].includes(step.lasts) ? [`${where}: lendItem lasts must be nextTurnStart or scene`] : []),
  ],
});
