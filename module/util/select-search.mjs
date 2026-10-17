/**
 * A search box over a pick prompt's <select> - the rules engine's ChoiceSet asks, `pick` steps, pickSubPerk, list picks
 * and the item-grant pickers. "Any General Perk" offers about 200 options, which is too many to scroll.
 *
 * Shared by every caller of mechanics/resources/grants.mjs#chooseSelect (and rules/lifecycle.mjs#askChoice,
 * mechanics/resources/kits.mjs, util/compendium-item-picker.mjs, which build their own <select>): the prompt puts
 * searchBoxHtml() above the select, passes selectSearchRender() as the DialogV2 `render` option, and reads the answer
 * through searchedValue().
 *
 * Behaviour:
 * - shown only when the list has more than SELECT_SEARCH_THRESHOLD options; autofocused;
 * - case-insensitive; every word typed must appear in the option's label or its group (optgroup) name, so typing a game
 *   line's name shows that whole group;
 * - non-matching options and emptied optgroups are hidden; each keystroke selects the first visible option, so Enter /
 *   Confirm picks it; ArrowUp / ArrowDown in the box step through the visible options;
 * - nothing visible: the Confirm button is disabled (Enter does nothing), and should a submit get through anyway the
 *   answer is NO_PICK, which the callers treat like Cancel - an option the player can't see is never picked;
 * - a selected option that the filter hid is never submitted silently: searchedValue() falls back to the first visible
 *   one (keptSelection);
 * - Escape / Cancel close the dialog as before (DialogV2's own keydown handler).
 */

/** Pick prompts with more options than this get a search box. */
export const SELECT_SEARCH_THRESHOLD = 8;

/** A search box's class (sass/assets/_select-prompt.scss). */
export const SELECT_SEARCH_CLASS = 'e20-select-search';

/** What searchedValue() answers when no option is visible: callers resolve it as a cancel. */
export const NO_PICK = Symbol('e20.noPick');

/** Whether a list of `count` options gets a search box. */
export function wantsSelectSearch(count) {
  return Number(count) > SELECT_SEARCH_THRESHOLD;
}

const words = text => String(text ?? '').toLocaleLowerCase().split(/\s+/).filter(Boolean);

/**
 * Which options a query leaves visible.
 * @param {Array<{label: String, group?: String}>} options   In list order.
 * @param {String} query
 * @returns {{visible: Array<Number>, groups: Set<String>, selected: Number}}   The visible options' indices (in order),
 *   the groups that still have one, and the index to select (the first visible; -1 when none).
 */
export function filterSelectOptions(options, query) {
  const terms = words(query);
  const visible = [];
  const groups = new Set();
  (options ?? []).forEach((option, index) => {
    const haystack = `${option?.label ?? ''} ${option?.group ?? ''}`.toLocaleLowerCase();
    if (terms.every(term => haystack.includes(term))) {
      visible.push(index);
      if (option?.group) {
        groups.add(option.group);
      }
    }
  });

  return { visible, groups, selected: visible[0] ?? -1 };
}

/** The selection to submit: the current one while it is visible, otherwise the first visible one (-1: none). */
export function keptSelection(visible, current) {
  return visible.includes(current) ? current : (visible[0] ?? -1);
}

/** The visible option `delta` steps from the current one (clamped to the ends; the first when current is hidden). */
export function stepSelection(visible, current, delta) {
  if (!visible.length) {
    return -1;
  }

  const at = visible.indexOf(current);
  if (at < 0) {
    return visible[0];
  }

  return visible[Math.min(visible.length - 1, Math.max(0, at + delta))];
}

/** The search box's HTML for a list of `count` options ('' at or below the threshold). */
export function searchBoxHtml(count) {
  if (!wantsSelectSearch(count)) {
    return '';
  }

  const placeholder = String(globalThis.game?.i18n?.localize?.('E20.SelectSearchPlaceholder') ?? 'Search')
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  return `<div class="form-group e20-select-search-row"><input type="search" class="${SELECT_SEARCH_CLASS}" placeholder="${placeholder}" aria-label="${placeholder}" autocomplete="off" autofocus></div>`;
}

/** Rows a searchable select shows at once: it becomes a short list box, so the matches are visible as you type. */
export const SELECT_SEARCH_ROWS = 10;

/** The extra <select> attributes for a list of `count` options ('' at or below the threshold). */
export function searchSelectAttrs(count) {
  return wantsSelectSearch(count) ? ` class="e20-select-searchable" size="${Math.min(SELECT_SEARCH_ROWS, Number(count))}"` : '';
}

const optionRows = select => [...select.options].map(option => ({
  label: option.textContent,
  group: option.parentElement?.tagName == 'OPTGROUP' ? option.parentElement.label : '',
}));

const shownIndices = select => [...select.options].flatMap((option, index) => (option.hidden ? [] : [index]));

/**
 * The submitted value of a (possibly filtered) select: a hidden selection falls back to the first visible option;
 * NO_PICK when nothing is visible.
 * @param {HTMLSelectElement} select
 * @returns {String|Symbol}
 */
export function searchedValue(select) {
  if (!select) {
    return NO_PICK;
  }

  // Not a real <select> (a plain field, a test's stand-in): its value as it is.
  if (!select.options) {
    return select.value;
  }

  const index = keptSelection(shownIndices(select), select.selectedIndex);
  if (index < 0) {
    return NO_PICK;
  }

  select.selectedIndex = index;
  return select.options[index].value;
}

/**
 * Wire a rendered prompt's search box to its select. Safe to call on every render (binds once).
 * @param {HTMLElement} root   The dialog's element.
 * @param {Object} [options]
 * @param {String} [options.name]   The select's name.
 * @param {String} [options.confirm]   The confirm button's action, disabled while nothing is visible.
 */
export function attachSelectSearch(root, { name = 'choice', confirm = 'ok' } = {}) {
  const input = root?.querySelector?.(`input.${SELECT_SEARCH_CLASS}`);
  const select = root?.querySelector?.(`select[name="${name}"]`);
  if (!input || !select || input.dataset.e20Bound) {
    return;
  }

  input.dataset.e20Bound = '1';
  const button = root.querySelector(`button[data-action="${confirm}"]`);
  // A list box (searchSelectAttrs' size) starts with nothing selected, unlike a drop-down: show the first as picked.
  if (select.selectedIndex < 0 && select.options.length) {
    select.selectedIndex = 0;
  }

  select.addEventListener('dblclick', event => {
    if (event.target?.tagName == 'OPTION' && button && !button.disabled) {
      button.click();
    }
  });
  input.addEventListener('input', () => {
    const { visible, groups, selected } = filterSelectOptions(optionRows(select), input.value);
    const shown = new Set(visible);
    [...select.options].forEach((option, index) => {
      option.hidden = !shown.has(index);
    });
    select.querySelectorAll('optgroup').forEach(group => {
      group.hidden = !groups.has(group.label);
    });
    select.selectedIndex = selected;
    if (button) {
      button.disabled = selected < 0;
    }
  });
  input.addEventListener('keydown', event => {
    const delta = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (delta) {
      event.preventDefault();
      select.selectedIndex = stepSelection(shownIndices(select), select.selectedIndex, delta);
    }
  });
  input.focus?.();
}

/** A DialogV2 `render` option that wires the search box (see attachSelectSearch). */
export function selectSearchRender(options) {
  return (event, dialog) => attachSelectSearch(dialog?.element, options);
}
