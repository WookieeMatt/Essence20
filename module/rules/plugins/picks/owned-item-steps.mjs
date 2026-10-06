// Rules-engine plug-ins, round 15 (banked - docs/rules-batches/slBanked15.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { itemsFor, registerStep } from "../../steps.mjs";

const itemsOf = actor => actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);

/** The actor's items meeting every item tag (item:type:x, item:data:..., not:...). */
export function itemsWhere(actor, tags, ruleItem = null) {
  return itemsOf(actor).filter(item => evaluate(tags, contextFor({ self: actor, ruleItem, item })) === true);
}

/**
 * Tag `self:holdsItem:<item tags joined by &>` (target: too) - the actor owns an item meeting every one of them:
 * `self:holdsItem:item:type:weaponEffect&item:data:system.numHands=2&not:item:data:system.classification.style=melee`
 * (Weapon Conversion's "a two-handed ranged weapon to convert").
 */
registerTag('self:holdsItem', (rest, ctx) => itemsWhere(ctx?.self, String(rest ?? '').split('&').filter(Boolean), ctx?.ruleItem).length > 0);
registerTag('target:holdsItem', (rest, ctx) => (ctx?.other ? itemsWhere(ctx.other, String(rest ?? '').split('&').filter(Boolean), ctx?.ruleItem).length > 0 : null));

async function write(doc, method, args) {
  const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
  return needsGmRelay(doc) ? relayToGm(doc, method, args) : doc[method](...args);
}

/** An item's lone Active Effect switched on or off (an item with none, or several, is left alone). */
async function loneEffect(item, disabled) {
  const effects = item?.effects?.contents ?? (item?.effects ? [...item.effects] : []);
  if (effects.length == 1) {
    await write(effects[0], 'update', [{ disabled }]);
  }
}

/**
 * Step `flagItem {item, flag, exclusive?: [item tags], loneEffect?: true, to?}` - the item the selector finds (choice:<key>
 * after a `pick from: ownedItem`) gets `flags.essence20.<flag>` set. `exclusive`: the recipient's other items meeting those
 * tags that carry the flag lose it first ("only one at a time"). `loneEffect`: a flagged item's single Active Effect is
 * switched off, and switched back on when the flag comes off (an item with several effects keeps them as they are).
 * Matured: the ignored Hang-Up (`flags.essence20.maturedIgnored`, which findHangUp and the rules index skip).
 */
registerStep('flagItem', async (step, ctx) => {
  const { recipients } = await import("../../steps.mjs");
  const flag = String(step.flag ?? '');
  let flagged = 0;
  for (const actor of recipients(step, ctx)) {
    const [chosen] = itemsFor({ item: step.item }, actor, ctx);
    if (!chosen) {
      continue;
    }

    if (Array.isArray(step.exclusive)) {
      for (const other of itemsWhere(actor, step.exclusive, ctx.item)) {
        if (other.id != chosen.id && other.flags?.essence20?.[flag]) {
          await write(other, 'update', [{ [`flags.essence20.-=${flag}`]: null }]);
          if (step.loneEffect) {
            await loneEffect(other, false);
          }
        }
      }
    }

    await write(chosen, 'update', [{ [`flags.essence20.${flag}`]: true }]);
    if (step.loneEffect) {
      await loneEffect(chosen, true);
    }

    flagged++;
  }

  if (!flagged) {
    return false;
  }
}, { errors: (step, where) => [...(step.flag ? [] : [`${where}: flagItem needs a flag`]), ...(step.item ? [] : [`${where}: flagItem needs an item`])] });
