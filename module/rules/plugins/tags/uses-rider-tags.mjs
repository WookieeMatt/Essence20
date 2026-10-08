import { CHECK_NAMES, registerCheck, registerTag } from "../../predicate.mjs";
import { checkMarkTarget } from "../../../items/rolls/mark-target.mjs";

/**
 * Small tags for the target-rider items (round 15, uses):
 *   - `check:markTarget` - the other party is this actor's current Mark Target (items/rolls/mark-target.mjs#checkMarkTarget:
 *     the one designated this scene, or anyone during Mark Everybot's encounter). On My Mark!.
 *   - `self:status:any[:except=<id>|<id>...]` / `target:status:any[...]` - the actor has some Condition (a status), other
 *     than the ones listed. Co-Dependent (not Morphed / Alt Mode / Cover / Total Cover / Defending).
 *   - `roll:entry:<key>` - in a `targeted` Trigger: the defender's check entry (dice.mjs) carries that flag (Scapegoat's
 *     `scapegoatSwapped` - its Defense was swapped by the Scapegoat Perk); unknown outside one.
 *   - `item:primaryAttack` - the rolled attack is its weapon's first attack (the first of the actor's attack items
 *     attached to that weapon); false for an attack with no weapon. Highly Effective (`not:item:primaryAttack`).
 */

if (!CHECK_NAMES.includes('markTarget')) {
  CHECK_NAMES.push('markTarget');
}

registerCheck('markTarget', (actor, option, ctx) => (ctx?.other ? checkMarkTarget(actor, ctx.other) : false));

function anyStatus(actor, rest) {
  const match = /^any(?::except=(.+))?$/.exec(String(rest ?? ''));
  if (!match) {
    return undefined;
  }

  const except = new Set((match[1] ?? '').split('|').filter(Boolean));
  return !!actor && [...(actor.statuses ?? [])].some(status => !except.has(status));
}

registerTag('self:status', (rest, ctx) => anyStatus(ctx.self, rest), { phrase: (arg, w) => (/^any(:|$)/.test(arg) ? (arg.length > 4 ? [`{who} {is} ${arg.slice(4).split('|').map(w.humanize).join(' or ')}`, `{who} {isnt} ${arg.slice(4).split('|').map(w.humanize).join(' or ')}`] : ['{who} {has} a Condition', '{who} {has} no Condition']) : null) });
registerTag('target:status', (rest, ctx) => (/^any(:|$)/.test(String(rest ?? '')) ? (ctx.other ? anyStatus(ctx.other, rest) : false) : undefined), { phrase: (arg, w) => (/^any(:|$)/.test(arg) ? (arg.length > 4 ? [`{who} {is} ${arg.slice(4).split('|').map(w.humanize).join(' or ')}`, `{who} {isnt} ${arg.slice(4).split('|').map(w.humanize).join(' or ')}`] : ['{who} {has} a Condition', '{who} {has} no Condition']) : null) });

const listOf = collection => collection?.contents ?? (collection ? [...collection] : []);

registerTag('item:primaryAttack', (rest, ctx) => {
  const attack = ctx.item;
  const parentId = attack?.flags?.essence20?.parentId;
  const owner = attack?.parent ?? ctx.self;
  if (!parentId || !owner) {
    return false;
  }

  const first = listOf(owner.items).find(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == parentId);
  return !!first && (first === attack || first.id == attack.id);
}, { phrase: ["{who} {is} its weapon's first attack", "{who} {isnt} its weapon's first attack"] });

registerTag('roll:entry', (rest, ctx) => (ctx.entry ? !!ctx.entry[rest] : null), { phrase: ['the entry used is {arg}', "the entry used isn't {arg}"] });

// self:sourced:<16-char id>:<path>=<value> / !=<value> - the actor's copy of that book item has (or hasn't) that value at
// <path> (Secondary Tech reading Primary Tech's flags.essence20.techChoice). No copy, or nothing stored: = is false and
// != true. (Unlike {sourced...} in a tag's text, a missing value doesn't make the whole tag false.)
registerTag('self:sourced', (rest, ctx) => {
  const match = /^([A-Za-z0-9]{16}):([\w.]+?)(!=|=)(.*)$/.exec(String(rest ?? ''));
  if (!match) {
    return null;
  }

  const copy = listOf(ctx.self?.items).find(item => String(item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? '').split('.').pop() == match[1]);
  const stored = copy ? match[2].split('.').reduce((value, key) => (value === null || value === undefined ? value : value[key]), copy) : undefined;
  const same = stored !== undefined && stored !== null && String(stored) == match[4];
  return match[3] == '=' ? same : !same;
}, { phrase: (arg, w) => {
  const match = /^([A-Za-z0-9]{16}):([\w.]+?)(!=|=)(.*)$/.exec(arg);
  return match ? [`your ${w.itemName(match[1])}'s ${w.pathName(match[2]).toLowerCase()} is ${match[3] == '!=' ? 'not ' : ''}${w.humanize(match[4])}`, `your ${w.itemName(match[1])}'s ${w.pathName(match[2]).toLowerCase()} is ${match[3] == '!=' ? '' : 'not '}${w.humanize(match[4])}`] : null;
} });
