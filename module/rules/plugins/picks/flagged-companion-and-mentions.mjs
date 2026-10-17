// Rules-engine plug-ins, round 16 (part b - docs/rules-batches/slLeftB16.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { companionsOf } from "../../../mechanics/companions/companion-link.mjs";
import { registerTag } from "../../predicate.mjs";
import { prerequisiteText } from "../../prerequisites.mjs";
import { registerRecipient } from "../../steps.mjs";

/**
 * - Recipient `companionFlagged:<flag>` - the actor's first companion (companion-link.mjs#companionsOf: listed on its sheet,
 *   or tied to it as companionOf) carrying `flags.essence20.<flag>` - Rally Guardians' company (`guardians`).
 *   Tag `self:companionFlagged:<flag>` - it has one.
 * - Tag `item:mentions:<text|text...>` - the item's (or compendium entry's) name or prerequisites (its
 *   `system.prerequisites.when` tags in words - rules/prerequisites.mjs#prerequisiteText) contain one of the texts, ignoring case; a hyphen counts as a space ("mega weapon" finds "Zord Mega-Weapon System"). Rally Guardians
 *   Features' ban on Combiner, Zord Mega-Weapon System and anything needing Combiner.
 */

const flaggedCompanions = (owner, flag) => companionsOf(owner).filter(actor => !!actor?.flags?.essence20?.[flag]);

registerRecipient(/^companionFlagged:([\w-]+)$/, (match, ctx) => flaggedCompanions(ctx.actor, match[1]).slice(0, 1));

registerTag('self:companionFlagged', (rest, ctx) => (ctx?.self && rest ? flaggedCompanions(ctx.self, rest).length > 0 : null), { phrase: ['{who} {has} a {arg} companion', '{who} {has} no {arg} companion'] });

const plain = text => String(text ?? '').toLowerCase().replace(/-/g, ' ');

registerTag('item:mentions', (rest, ctx) => {
  const item = ctx?.item;
  if (!item) {
    return null;
  }

  // The prerequisite tags in words (prerequisiteText; an unmigrated item's old typed text when it has no tags, until 6.1).
  const haystack = `${plain(item.name)} ${plain(prerequisiteText(item))}`;
  return String(rest ?? '').split('|').map(plain).filter(Boolean).some(text => haystack.includes(text));
}, { phrase: arg => [`{poss} name or prerequisite mentions "${arg.split('|').join('" or "')}"`, `{poss} name and prerequisite don't mention "${arg.split('|').join('" or "')}"`] });
