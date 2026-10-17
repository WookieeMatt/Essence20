import { skillKeyOf } from "./stat-block-parser.mjs";

/**
 * Rules for a pasted Perk / Power / Hang-Up that matched nothing in the compendium, read from its text. Only the
 * plainest sentence is read - "suffers ↓1 to all Social Skill Tests", "gains ↑2 on Deception Skill Tests", "has Edge on
 * Athletics Skill Tests" - into a Roll Modifier rule on that Skill (or every Skill of that Essence). Whatever follows
 * "Skill Tests" ("with other Decepticons") isn't something a rule can check, so it goes in the rule's label: the Roll
 * Options Dialog shows the modifier with that reason, and the GM unticks it when it doesn't apply.
 *
 * A paste can lose the arrows ("suffers 1 to all Social Skill Tests"), so the verb decides: suffers/takes is down,
 * gains/gets is up.
 */

const ESSENCES = ['strength', 'speed', 'smarts', 'social'];

const SENTENCE = /\b(suffers?|takes?|gains?|gets?|has|have|receives?)\s+(?:an?\s+)?(?:(?:[↓↑]\s*)?(\d+)|(Edge|Snag))\s+(?:on|to)\s+(?:all\s+|any\s+|their\s+|his\s+|her\s+)?([A-Za-z][A-Za-z ,/-]*?)\s+Skill\s+Tests?([^.]*)/i;

/** What the printed list names: Skills and Essences ("Social", "Deception and Persuasion"), as `when` tags. */
function tagsFor(printed) {
  const tags = [];
  for (const part of printed.split(/\s*(?:,|\band\b|\bor\b|\/)\s*/i).map(word => word.trim()).filter(Boolean)) {
    // "Smarts-based Skill Tests": every Skill of that Essence.
    const essence = ESSENCES.find(key => key == part.toLowerCase().replace(/-based$/, ''));
    const skill = essence ? null : skillKeyOf(part);
    if (!essence && !skill) {
      return null;
    }

    tags.push(essence ? `essence:${essence}` : `skill:${skill}`);
  }

  return tags.length ? tags : null;
}

/**
 * The rules read from one item's text, or [].
 * @param {String} name   The item's name (the rule's label).
 * @param {String} text   Its printed text.
 * @returns {Object[]}
 */
export function rulesFromText(name, text) {
  const plain = String(text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const match = plain.match(SENTENCE);
  if (!match) {
    return [];
  }

  const [, verb, amount, edgeSnag, skills, tail] = match;
  const tags = tagsFor(skills);
  if (!tags) {
    return [];
  }

  const down = /^(suffer|take)/i.test(verb);
  const rule = { type: 'RollModifier', label: name, when: tags.length > 1 ? [{ any: tags }] : tags };
  if (edgeSnag) {
    rule[edgeSnag.toLowerCase()] = true;
  } else if (/^(suffer|take|gain|get|receive)/i.test(verb)) {
    rule[down ? 'downshift' : 'upshift'] = Number.parseInt(amount, 10);
  } else {
    return [];
  }

  // "... Skill Tests and takes ↓1 on ..." - a second clause, not a condition on this one.
  const condition = tail.replace(/^[\s,;]+|[\s,;]+$/g, '');
  if (condition && !/^and\b/i.test(condition)) {
    rule.label = `${name} (${condition})`;
  }

  return [rule];
}

/**
 * Gives every item that came in bare (not a compendium copy) the rules its text reads as. Returns how many it added.
 * @param {Object[]} items   Item creation data.
 */
export function addRulesFromText(items) {
  let added = 0;
  for (const item of items ?? []) {
    if (!['perk', 'power', 'hangUp'].includes(item?.type) || item._stats?.compendiumSource || item.system?.rules?.length) {
      continue;
    }

    const rules = rulesFromText(item.name, item.system?.description);
    if (rules.length) {
      item.system.rules = rules;
      added += rules.length;
    }
  }

  return added;
}
