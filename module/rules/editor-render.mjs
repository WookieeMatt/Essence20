import { COMMON_FIELDS, RULE_FORMS, STEP_COMMON, STEP_FORMS, TAG_FAMILIES, formFor, stepChoices } from "./editor-spec.mjs";
import { RULE_TYPES } from "./types.mjs";
import { summarizeRule } from "./types.mjs";

/**
 * The guided rule editor's form, as HTML built from editor-spec.mjs, and the reading of it back.
 *
 * Every input is named by its path in the rule (`steps.0.amount`, `cost.resource`) and carries its
 * field kind (`data-kind`), so one change handler can write any of them back with the right type
 * (readInput). Structural buttons (add or remove a step, a tag, an option) carry `data-edit` plus the
 * list's path, handled by applyEdit. Plain functions throughout, so the whole form is unit-tested
 * under Node; apps/rule-editor.mjs only wires it to a window.
 */

const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Localize "E20.Rules.Field.<key>", or fall back to the key itself spaced out. */
export function fieldLabel(key) {
  const full = `E20.Rules.Field.${key}`;
  const text = globalThis.game?.i18n?.localize?.(full);
  return text && text != full ? text : String(key).replace(/^.*\./, '').replace(/([a-z])([A-Z])/g, '$1 $2');
}

const getPath = (object, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), object);

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let node = object;
  for (const [i, key] of keys.entries()) {
    if (node[key] === undefined || node[key] === null || typeof node[key] != 'object') {
      node[key] = /^\d+$/.test(keys[i + 1] ?? last) ? [] : {};
    }

    node = node[key];
  }

  if (value === undefined) {
    if (Array.isArray(node)) {
      node[Number(last)] = undefined;
    } else {
      delete node[last];
    }
  } else {
    node[last] = value;
  }
}

/** Drop empty objects left behind by cleared fields (cost: {} after its action is unset). */
export function tidy(value) {
  if (Array.isArray(value)) {
    return value.filter(entry => entry !== undefined).map(tidy);
  }

  if (value && typeof value == 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      const clean = tidy(entry);
      const emptyObject = clean && typeof clean == 'object' && !Array.isArray(clean) && !Object.keys(clean).length;
      if (clean !== undefined && !emptyObject) {
        out[key] = clean;
      }
    }

    return out;
  }

  return value;
}

/* -------------------------------------------- */
/*  Options                                      */
/* -------------------------------------------- */

/** A named option list, from CONFIG at render time: [[value, label]]. */
export function optionList(name, { rule = {}, helpers = [], derivedPaths = DERIVED_PATHS } = {}) {
  const E20 = globalThis.CONFIG?.E20 ?? {};
  const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;
  const fromTable = table => Object.entries(table ?? {}).filter(([key]) => key != 'any').map(([key, label]) => [key, localize(label)]);
  switch (name) {
  case 'skills': return fromTable(E20.skills);
  case 'essences': return fromTable(E20.essences);
  case 'defenses': return fromTable(E20.defenses);
  case 'damageTypes': return fromTable(E20.damageTypes);
  case 'rerollModes': return fromTable(E20.rerollModes);
  case 'rerollTargets': return fromTable(E20.rerollTargets);
  case 'rerollResets': return fromTable(E20.rerollResets);
  case 'statuses': return (globalThis.CONFIG?.statusEffects ?? E20.statusEffects ?? []).map(status => [status.id, localize(status.name ?? status.label ?? status.id)]);
  case 'visionModes': return fromTable(E20.visionModes);
  case 'scopes': return (RULE_TYPES[rule.type]?.scopes ?? ['self']).map(scope => [scope, fieldLabel(`Scope.${scope}`)]);
  case 'helpers': return helpers.map(helper => [helper, helper]);
  case 'terrains': return [['wild', fieldLabel('Wild')], ...fromTable(E20.environments)];
  case 'sceneEnvironments': return fromTable(E20.sceneEnvironments);
  case 'derivedPaths': return derivedPaths.map(([path, key]) => [path, fieldLabel(key)]);
  }

  return [];
}

/** Common numbers a DerivedStat can change, offered by name; anything else can be typed. */
export const DERIVED_PATHS = [
  ['system.health.max', 'Path.healthMax'],
  ['system.movement.ground.total', 'Path.movementGround'],
  ['system.movement.swim.total', 'Path.movementSwim'],
  ['system.movement.climb.total', 'Path.movementClimb'],
  ['system.movement.aerial.total', 'Path.movementAerial'],
  ['system.movement.burrow.total', 'Path.movementBurrow'],
];

function resolveOptions(field, context) {
  const options = typeof field.options == 'string' ? [field.options] : field.options ?? [];
  const out = [];
  for (const option of options) {
    if (typeof option == 'string') {
      out.push(...optionList(option, context));
    } else {
      out.push([option[0], fieldLabel(option[1])]);
    }
  }

  return out;
}

/* -------------------------------------------- */
/*  Fields                                       */
/* -------------------------------------------- */

const attrs = (path, kind) => `name="${escape(path)}" data-kind="${kind}"`;

function selectHtml(path, kind, value, options, { blank = false, custom = false } = {}) {
  const known = options.some(([v]) => String(v) == String(value ?? ''));
  const rows = [
    blank ? `<option value=""${value === undefined || value === '' ? ' selected' : ''}></option>` : '',
    ...options.map(([v, label]) => `<option value="${escape(v)}"${String(v) == String(value ?? '') ? ' selected' : ''}>${escape(label)}</option>`),
    custom && value && !known ? `<option value="${escape(value)}" selected>${escape(value)}</option>` : '',
  ];
  return `<select ${attrs(path, kind)}>${rows.join('')}</select>`;
}

/** One tag row: [not] family : argument. */
function tagRow(path, tag, index) {
  const text = typeof tag == 'string' ? tag : `any:${(tag?.any ?? []).join(' | ')}`;
  const negated = text.startsWith('not:');
  const bare = negated ? text.slice(4) : text;
  // self:level>=N shows as its own "level" row (a plain number; another comparison keeps its sign).
  const level = /^self:level(>=|<=|>|<|=)(\d+)$/.exec(bare);
  const cut = bare.indexOf(':');
  const family = level ? 'level' : cut < 0 ? bare : bare.slice(0, cut);
  const arg = level ? (level[1] == '>=' ? level[2] : `${level[1]}${level[2]}`) : cut < 0 ? '' : bare.slice(cut + 1);
  const families = ['level', ...TAG_FAMILIES.map(([key]) => key), 'any'];
  const listId = `e20-tag-args-${family}`;
  return `<li class="e20-tag-row" data-index="${index}">
    <label class="e20-tag-not"><input type="checkbox" name="${escape(`${path}.${index}`)}" data-kind="tagNot"${negated ? ' checked' : ''}> ${escape(fieldLabel('Not'))}</label>
    <select name="${escape(`${path}.${index}`)}" data-kind="tagFamily">${families.map(f => `<option value="${f}"${f == family ? ' selected' : ''}>${escape(fieldLabel(`Tag.${f}`))}</option>`).join('')}</select>
    <input type="text" name="${escape(`${path}.${index}`)}" data-kind="tagArg" value="${escape(arg)}" list="${listId}" placeholder="${escape(fieldLabel(`TagHint.${family}`))}">
    <a class="e20-editor-control" data-edit="remove" data-path="${escape(path)}" data-index="${index}"><i class="fas fa-times"></i></a>
  </li>`;
}

/** The datalists the tag argument inputs suggest from - one per family. */
export function tagDatalists(context = {}) {
  const levels = `<datalist id="e20-tag-args-level">${Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}"></option>`).join('')}</datalist>`;
  return levels + TAG_FAMILIES.map(([family, args]) => {
    const values = typeof args == 'string' ? (args == 'text' ? [] : optionList(args, context).map(([v]) => v)) : args;
    const statusArgs = ['self', 'target'].includes(family) ? optionList('statuses', context).map(([v]) => `status:${v}`) : [];
    return `<datalist id="e20-tag-args-${family}">${[...values, ...statusArgs].map(v => `<option value="${escape(v)}"></option>`).join('')}</datalist>`;
  }).join('');
}

function resourceHtml(path, value) {
  const kind = value?.pool !== undefined ? 'pool' : value?.path !== undefined ? 'path' : value?.storyPoints ? 'storyPoints' : '';
  const key = value?.pool ?? value?.path ?? '';
  return `<div class="e20-editor-inline">
    <select name="${escape(path)}" data-kind="resourceKind">
      ${[['', 'ResourceNone'], ['pool', 'ResourcePool'], ['path', 'ResourcePath'], ['storyPoints', 'ResourceStoryPoints']].map(([v, l]) => `<option value="${v}"${v == kind ? ' selected' : ''}>${escape(fieldLabel(l))}</option>`).join('')}
    </select>
    ${['pool', 'path'].includes(kind) ? `<input type="text" name="${escape(path)}" data-kind="resourceKey" value="${escape(key)}" placeholder="${escape(fieldLabel(kind == 'pool' ? 'PoolKeyHint' : 'PathHint'))}">` : ''}
  </div>`;
}

function stepsHtml(path, steps, rule, context, depth) {
  const list = Array.isArray(steps) ? steps : [];
  const choices = stepChoices(rule);
  const rows = list.map((step, index) => {
    const stepPath = `${path}.${index}`;
    const fields = [...(STEP_FORMS[step?.do] ?? []), ...STEP_COMMON];
    return `<li class="e20-step" data-depth="${depth}">
      <div class="e20-step-head">
        ${selectHtml(`${stepPath}.do`, 'stepType', step?.do, choices.map(type => [type, fieldLabel(`Step.${type}`)]))}
        <span class="e20-editor-controls">
          <a class="e20-editor-control" data-edit="up" data-path="${escape(path)}" data-index="${index}"><i class="fas fa-arrow-up"></i></a>
          <a class="e20-editor-control" data-edit="down" data-path="${escape(path)}" data-index="${index}"><i class="fas fa-arrow-down"></i></a>
          <a class="e20-editor-control" data-edit="remove" data-path="${escape(path)}" data-index="${index}"><i class="fas fa-trash"></i></a>
        </span>
      </div>
      ${fieldsHtml(fields, step ?? {}, stepPath, rule, context, depth + 1)}
    </li>`;
  }).join('');
  return `<ol class="e20-steps">${rows}</ol>
    <a class="e20-editor-add" data-edit="addStep" data-path="${escape(path)}"><i class="fas fa-plus"></i> ${escape(fieldLabel('AddStep'))}</a>`;
}

function choicesHtml(path, options, rule, context, depth) {
  const list = Array.isArray(options) ? options : [];
  const rows = list.map((option, index) => `<li class="e20-choice">
      <div class="e20-step-head">
        <input type="text" name="${escape(`${path}.${index}.label`)}" data-kind="text" value="${escape(option?.label)}" placeholder="${escape(fieldLabel('OptionLabel'))}">
        <a class="e20-editor-control" data-edit="remove" data-path="${escape(path)}" data-index="${index}"><i class="fas fa-trash"></i></a>
      </div>
      ${stepsHtml(`${path}.${index}.steps`, option?.steps, rule, context, depth + 1)}
    </li>`).join('');
  return `<ol class="e20-choices">${rows}</ol>
    <a class="e20-editor-add" data-edit="addChoice" data-path="${escape(path)}"><i class="fas fa-plus"></i> ${escape(fieldLabel('AddOption'))}</a>`;
}

function fieldHtml(field, value, path, rule, context, depth) {
  switch (field.kind) {
  case 'text':
  case 'formula':
  case 'number':
    return `<input type="${field.kind == 'number' ? 'number' : 'text'}" ${attrs(path, field.kind)} value="${escape(value)}">`;
  case 'checkbox':
    return `<input type="checkbox" ${attrs(path, 'checkbox')}${value ? ' checked' : ''}>`;
  case 'stacks':
    return selectHtml(path, 'stacks', value === undefined ? '' : String(value), [['true', fieldLabel('StacksYes')], ['false', fieldLabel('StacksNo')]], { blank: true });
  case 'select':
    return selectHtml(path, 'select', value, resolveOptions(field, { ...context, rule }), { blank: !['type', 'do'].includes(field.path), custom: !!field.allowCustom })
      + (field.allowCustom ? `<input type="text" ${attrs(path, 'text')} value="${escape(value)}" class="e20-editor-custom" placeholder="${escape(fieldLabel('OrType'))}">` : '');
  case 'skills':
  case 'strings': {
    const list = Array.isArray(value) ? value : [];
    return `<input type="text" ${attrs(path, field.kind)} value="${escape(list.join(', '))}" placeholder="${escape(fieldLabel('CommaList'))}">`;
  }

  case 'tags': {
    const list = Array.isArray(value) ? value : [];
    return `<ol class="e20-tags">${list.map((tag, i) => tagRow(path, tag, i)).join('')}</ol>
      <a class="e20-editor-add" data-edit="addTag" data-path="${escape(path)}"><i class="fas fa-plus"></i> ${escape(fieldLabel('AddCondition'))}</a>`;
  }

  // A small object edited as JSON (an item's data, the values to set) - kept as typed while it doesn't parse.
  case 'json':
    return `<textarea ${attrs(path, 'json')} rows="3" class="e20-editor-json">${escape(value === undefined ? '' : JSON.stringify(value))}</textarea>`;
  case 'resource':
    return resourceHtml(path, value);
  case 'steps':
    return stepsHtml(path, value, rule, context, depth);
  case 'choices':
    return choicesHtml(path, value, rule, context, depth);
  }

  return '';
}

/** A list of fields as labelled rows. Nested paths are relative to `prefix`. */
export function fieldsHtml(fields, object, prefix, rule, context = {}, depth = 0) {
  return fields.filter(field => !field.showIf || field.showIf(object)).map(field => {
    const path = prefix ? `${prefix}.${field.path}` : field.path;
    const wide = ['steps', 'choices', 'tags'].includes(field.kind);
    return `<div class="e20-editor-field${wide ? ' is-wide' : ''}${field.advanced ? ' is-advanced' : ''}" data-field="${escape(field.path)}">
      <label>${escape(fieldLabel(field.label))}</label>
      <div class="e20-editor-value">${fieldHtml(field, getPath(object, field.path), path, rule, context, depth)}</div>
      ${field.hint ? `<p class="e20-editor-hint">${escape(fieldLabel(field.hint))}</p>` : ''}
    </div>`;
  }).join('');
}

/** The whole form for one rule. */
export function ruleFormHtml(rule, context = {}) {
  const typeOptions = Object.keys(RULE_TYPES).map(type => [type, fieldLabel(`Type.${type}`)]);
  return `<div class="e20-editor-field" data-field="type">
      <label>${escape(fieldLabel('RuleType'))}</label>
      <div class="e20-editor-value">${selectHtml('type', 'ruleType', rule.type, typeOptions)}</div>
    </div>
    ${fieldsHtml(formFor(rule.type), rule, '', rule, context)}
    ${tagDatalists(context)}`;
}

/* -------------------------------------------- */
/*  Reading it back                              */
/* -------------------------------------------- */

/** Rebuild one tag from its row's three inputs. */
export function composeTag(not, family, arg) {
  if (family == 'any') {
    const inner = String(arg ?? '').split('|').map(part => part.trim()).filter(Boolean);
    return { any: inner };
  }

  // The editor's "level" row: a level number (or <=N, =N ...) stored as self:level>=N.
  if (family == 'level') {
    const match = /^\s*(>=|<=|>|<|=)?\s*(\d+)?\s*$/.exec(String(arg ?? ''));
    const body = `self:level${match?.[1] ?? '>='}${match?.[2] ?? 1}`;
    return not ? `not:${body}` : body;
  }

  const body = arg === '' || arg === undefined ? family : `${family}:${arg}`;
  return not ? `not:${body}` : body;
}

/**
 * Write one changed input into the rule. Mutates and returns it.
 * @param {Object} rule
 * @param {String} path     The input's name.
 * @param {String} kind     Its data-kind.
 * @param {*} raw           Its value (checked for a checkbox).
 * @param {Object} [row]    For tag inputs: {not, family, arg} - the whole row's current values.
 * @returns {Object}
 */
export function readInput(rule, path, kind, raw, row = null) {
  switch (kind) {
  case 'text':
  case 'select':
  case 'ruleType':
  case 'stepType':
    setPath(rule, path, raw === '' ? undefined : raw);
    break;
  case 'number':
    setPath(rule, path, raw === '' || raw === null ? undefined : Number(raw));
    break;
  case 'formula':
    setPath(rule, path, raw === '' ? undefined : (/^-?\d+(\.\d+)?$/.test(String(raw).trim()) ? Number(raw) : String(raw).trim()));
    break;
  case 'checkbox':
    setPath(rule, path, raw ? true : undefined);
    break;
  case 'json': {
    if (String(raw ?? '').trim() === '') {
      setPath(rule, path, undefined);
      break;
    }

    try {
      setPath(rule, path, JSON.parse(raw));
    } catch (error) {
      // Not valid yet - leave the stored value until it is.
    }

    break;
  }

  case 'stacks':
    setPath(rule, path, raw === '' ? undefined : raw === 'true');
    break;
  case 'skills':
  case 'strings': {
    const list = String(raw ?? '').split(',').map(part => part.trim()).filter(Boolean);
    setPath(rule, path, list.length ? list : undefined);
    break;
  }

  case 'tagNot':
  case 'tagFamily':
  case 'tagArg':
    setPath(rule, path, composeTag(row?.not, row?.family, row?.arg));
    break;
  case 'resourceKind':
    setPath(rule, path, raw == 'storyPoints' ? { storyPoints: true } : raw == 'pool' ? { pool: '' } : raw == 'path' ? { path: '' } : undefined);
    break;
  case 'resourceKey': {
    const current = getPath(rule, path) ?? {};
    setPath(rule, path, current.pool !== undefined ? { pool: raw } : { path: raw });
    break;
  }
  }

  if (kind == 'stepType') {
    // A new kind of step keeps only what both kinds share.
    const step = getPath(rule, path.replace(/\.do$/, ''));
    const keep = new Set(['do', 'when', ...(STEP_FORMS[raw] ?? []).map(field => field.path)]);
    for (const key of Object.keys(step ?? {})) {
      if (!keep.has(key)) {
        delete step[key];
      }
    }
  }

  return rule;
}

/** A blank step of the first kind on offer. */
function newStep() {
  return { do: 'chat', text: '' };
}

/**
 * A structural edit from a button: add/remove/move a step, tag or option.
 * @param {Object} rule
 * @param {String} edit    addStep | addTag | addChoice | remove | up | down
 * @param {String} path    The list's path.
 * @param {Number} [index]
 * @returns {Object}   The rule.
 */
export function applyEdit(rule, edit, path, index = 0) {
  const list = Array.isArray(getPath(rule, path)) ? getPath(rule, path) : [];
  switch (edit) {
  case 'addStep': list.push(newStep()); break;
  case 'addTag': list.push('skill:athletics'); break;
  case 'addLevelTag': list.push('self:level>=1'); break;
  case 'addChoice': list.push({ label: '', steps: [] }); break;
  case 'remove': list.splice(index, 1); break;
  case 'up':
    if (index > 0) {
      [list[index - 1], list[index]] = [list[index], list[index - 1]];
    }

    break;
  case 'down':
    if (index < list.length - 1) {
      [list[index + 1], list[index]] = [list[index], list[index + 1]];
    }

    break;
  }

  setPath(rule, path, list.length ? list : (path.endsWith('steps') || path == 'when' ? list : undefined));
  return rule;
}

/** The live summary line shown above the form. */
/** The prerequisites form (rules/prerequisites.mjs): the condition picker on its own. */
export function prerequisitesFormHtml(value, context = {}) {
  // A level requirement is common enough for its own button (the row reads "level is at least [n]").
  const addLevel = `<a class="e20-editor-add" data-edit="addLevelTag" data-path="when"><i class="fas fa-plus"></i> ${escape(fieldLabel('AddLevel'))}</a>`;
  return `${fieldsHtml([{ path: 'when', kind: 'tags', label: 'PrereqWhen' }], value, '', value, context)}${addLevel}${tagDatalists(context)}`;
}

export function previewLine(rule) {
  return summarizeRule(tidy(rule));
}

export { COMMON_FIELDS, RULE_FORMS };
