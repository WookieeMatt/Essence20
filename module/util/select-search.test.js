import { jest } from '@jest/globals';
import {
  NO_PICK, SELECT_SEARCH_THRESHOLD, SELECT_SEARCH_ROWS, attachSelectSearch, filterSelectOptions, keptSelection, searchBoxHtml,
  searchSelectAttrs, searchedValue, selectSearchRender, stepSelection, wantsSelectSearch,
} from './select-search.mjs';

const OPTIONS = [
  { label: 'Any' },
  { label: 'Brave', group: 'G.I. JOE' },
  { label: 'Bookworm', group: 'G.I. JOE' },
  { label: 'Big Heart', group: 'My Little Pony' },
  { label: 'Cutie Mark Magic', group: 'My Little Pony' },
  { label: 'Grid Power', group: 'Power Rangers' },
];

describe('the threshold', () => {
  test('a search box only above SELECT_SEARCH_THRESHOLD options', () => {
    expect(SELECT_SEARCH_THRESHOLD).toBe(8);
    expect(wantsSelectSearch(SELECT_SEARCH_THRESHOLD)).toBe(false);
    expect(wantsSelectSearch(SELECT_SEARCH_THRESHOLD + 1)).toBe(true);
    expect(wantsSelectSearch(0)).toBe(false);
  });

  test('searchBoxHtml / searchSelectAttrs are empty at or below it', () => {
    expect(searchBoxHtml(SELECT_SEARCH_THRESHOLD)).toBe('');
    expect(searchSelectAttrs(SELECT_SEARCH_THRESHOLD)).toBe('');
  });

  test('above it: an autofocused search input with the localized placeholder, and a list box', () => {
    global.game = { i18n: { localize: key => (key == 'E20.SelectSearchPlaceholder' ? 'Search "it"' : key) } };
    const html = searchBoxHtml(9);
    expect(html).toContain('type="search"');
    expect(html).toContain('class="e20-select-search"');
    expect(html).toContain('autofocus');
    expect(html).toContain('placeholder="Search &quot;it&quot;"');
    expect(searchSelectAttrs(9)).toBe(' class="e20-select-searchable" size="9"');
    expect(searchSelectAttrs(200)).toBe(` class="e20-select-searchable" size="${SELECT_SEARCH_ROWS}"`);
    delete global.game;
  });

  test('falls back to "Search" with no i18n', () => {
    expect(searchBoxHtml(20)).toContain('placeholder="Search"');
  });
});

describe('filterSelectOptions', () => {
  test('an empty query shows everything and selects the first', () => {
    const result = filterSelectOptions(OPTIONS, '  ');
    expect(result.visible).toEqual([0, 1, 2, 3, 4, 5]);
    expect([...result.groups]).toEqual(['G.I. JOE', 'My Little Pony', 'Power Rangers']);
    expect(result.selected).toBe(0);
  });

  test('case-insensitive label match; groups left empty drop out', () => {
    const result = filterSelectOptions(OPTIONS, 'BR');
    expect(result.visible).toEqual([1]);
    expect([...result.groups]).toEqual(['G.I. JOE']);
    expect(result.selected).toBe(1);
  });

  test('a group-name match shows the whole group', () => {
    const result = filterSelectOptions(OPTIONS, 'pony');
    expect(result.visible).toEqual([3, 4]);
    expect([...result.groups]).toEqual(['My Little Pony']);
  });

  test('every word must match, across label and group', () => {
    expect(filterSelectOptions(OPTIONS, 'pony magic').visible).toEqual([4]);
    expect(filterSelectOptions(OPTIONS, 'joe magic').visible).toEqual([]);
  });

  test('no match: nothing visible, nothing selected', () => {
    const result = filterSelectOptions(OPTIONS, 'zzz');
    expect(result.visible).toEqual([]);
    expect(result.groups.size).toBe(0);
    expect(result.selected).toBe(-1);
  });

  test('copes with no options', () => {
    expect(filterSelectOptions(undefined, 'a')).toEqual({ visible: [], groups: new Set(), selected: -1 });
  });
});

describe('selection', () => {
  test('keptSelection keeps a visible selection and resets a hidden one to the first visible', () => {
    expect(keptSelection([1, 3, 4], 3)).toBe(3);
    expect(keptSelection([1, 3, 4], 2)).toBe(1);
    expect(keptSelection([1, 3, 4], -1)).toBe(1);
    expect(keptSelection([], 2)).toBe(-1);
  });

  test('stepSelection moves among visible options, clamped', () => {
    expect(stepSelection([1, 3, 4], 1, 1)).toBe(3);
    expect(stepSelection([1, 3, 4], 4, 1)).toBe(4);
    expect(stepSelection([1, 3, 4], 1, -1)).toBe(1);
    expect(stepSelection([1, 3, 4], 2, 1)).toBe(1);
    expect(stepSelection([], 0, 1)).toBe(-1);
  });
});

/* A minimal stand-in for the dialog's DOM: just what select-search.mjs touches. */
function fakeDom(options) {
  const listeners = {};
  const on = (el, name) => (type, fn) => {
    listeners[`${name}:${type}`] = fn;
  };

  const groups = new Map();
  const select = { selectedIndex: -1, addEventListener: on(null, 'select') };
  select.options = options.map(({ label, group, value }) => {
    let parent = { tagName: 'SELECT' };
    if (group) {
      if (!groups.has(group)) {
        groups.set(group, { tagName: 'OPTGROUP', label: group, hidden: false });
      }

      parent = groups.get(group);
    }

    return { value: value ?? label, textContent: label, hidden: false, parentElement: parent, tagName: 'OPTION' };
  });
  select.querySelectorAll = () => [...groups.values()];
  const input = { value: '', dataset: {}, addEventListener: on(null, 'input'), focus: jest.fn() };
  const button = { disabled: false, click: jest.fn() };
  const root = {
    querySelector: selector => (selector.startsWith('input') ? input : selector.startsWith('select') ? select : selector.startsWith('button') ? button : null),
  };
  const type = text => {
    input.value = text;
    listeners['input:input']();
  };

  return { root, select, input, button, groups, listeners, type };
}

describe('attachSelectSearch', () => {
  test('filters, hides empty groups, selects the first visible and disables Confirm on no match', () => {
    const dom = fakeDom(OPTIONS);
    attachSelectSearch(dom.root);
    expect(dom.select.selectedIndex).toBe(0);
    expect(dom.input.focus).toHaveBeenCalled();

    dom.type('pony');
    expect(dom.select.options.map(o => o.hidden)).toEqual([true, true, true, false, false, true]);
    expect(dom.groups.get('G.I. JOE').hidden).toBe(true);
    expect(dom.groups.get('My Little Pony').hidden).toBe(false);
    expect(dom.select.selectedIndex).toBe(3);
    expect(searchedValue(dom.select)).toBe('Big Heart');

    dom.type('nothing like it');
    expect(dom.select.selectedIndex).toBe(-1);
    expect(dom.button.disabled).toBe(true);
    expect(searchedValue(dom.select)).toBe(NO_PICK);

    dom.type('');
    expect(dom.button.disabled).toBe(false);
    expect(dom.select.options.every(o => !o.hidden)).toBe(true);
  });

  test('arrow keys step through the visible options; double-click confirms', () => {
    const dom = fakeDom(OPTIONS);
    attachSelectSearch(dom.root);
    dom.type('pony');
    const preventDefault = jest.fn();
    dom.listeners['input:keydown']({ key: 'ArrowDown', preventDefault });
    expect(dom.select.selectedIndex).toBe(4);
    expect(preventDefault).toHaveBeenCalled();
    dom.listeners['input:keydown']({ key: 'ArrowUp', preventDefault });
    expect(dom.select.selectedIndex).toBe(3);
    dom.listeners['input:keydown']({ key: 'a', preventDefault: jest.fn() });
    expect(dom.select.selectedIndex).toBe(3);

    dom.listeners['select:dblclick']({ target: { tagName: 'OPTION' } });
    expect(dom.button.click).toHaveBeenCalled();
  });

  test('binds once, and does nothing without a search box', () => {
    const dom = fakeDom(OPTIONS);
    attachSelectSearch(dom.root);
    dom.input.focus.mockClear();
    attachSelectSearch(dom.root);
    expect(dom.input.focus).not.toHaveBeenCalled();
    expect(() => attachSelectSearch({ querySelector: () => null })).not.toThrow();
    expect(() => attachSelectSearch(undefined)).not.toThrow();
  });

  test('selectSearchRender wires the dialog element', () => {
    const dom = fakeDom(OPTIONS);
    selectSearchRender()({}, { element: dom.root });
    expect(dom.input.dataset.e20Bound).toBe('1');
  });
});

describe('searchedValue', () => {
  test('a hidden selection is never submitted: it falls back to the first visible option', () => {
    const dom = fakeDom(OPTIONS);
    dom.select.options[1].hidden = true;
    dom.select.options[0].hidden = true;
    dom.select.selectedIndex = 1;
    expect(searchedValue(dom.select)).toBe('Bookworm');
    expect(dom.select.selectedIndex).toBe(2);
  });

  test('a plain field answers its value; no field answers NO_PICK', () => {
    expect(searchedValue({ value: 'x' })).toBe('x');
    expect(searchedValue(null)).toBe(NO_PICK);
  });
});
