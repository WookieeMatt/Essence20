/**
 * @jest-environment jsdom
 */
import { applyLook, hasLook, normalizeLook } from './line-look.mjs';

const window = () => {
  const root = document.createElement('div');
  root.innerHTML = '<header class="window-header"><i class="window-icon"></i><h1 class="window-title">Lion-O</h1></header>'
    + '<section class="window-content"><header class="sheet-header"></header></section>';
  return root;
};

test('a look is tidied: a known frame, a #rrggbb accent, image paths; anything else blank', () => {
  expect(normalizeLook({ frame: 'pony', accent: '#C0FFEE', logo: ' modules/tc/logo.webp ', headerArt: 'art.webp' }))
    .toEqual({ frame: 'pony', accent: '#c0ffee', logo: 'modules/tc/logo.webp', headerArt: 'art.webp' });
  expect(normalizeLook({ frame: 'thundera', accent: 'red', logo: null })).toEqual({ frame: '', accent: '', logo: '', headerArt: '' });
  expect(normalizeLook(undefined)).toEqual({ frame: '', accent: '', logo: '', headerArt: '' });
  expect(hasLook(normalizeLook({}))).toBe(false);
  expect(hasLook(normalizeLook({ accent: '#ff0000' }))).toBe(true);
  expect(hasLook(null)).toBe(false);
});

test('a look on a sheet: its accent, its header art behind the header, its logo before the title - once', () => {
  const sheet = window();
  const look = normalizeLook({ accent: '#e01818', logo: 'logo.webp', headerArt: 'my "lair".webp' });
  applyLook(sheet, look);
  applyLook(sheet, look);
  expect(sheet.style.getPropertyValue('--e20-theme-accent')).toBe('#e01818');
  expect(sheet.classList.contains('e20-line-art')).toBe(true);
  // Absolute against the page (jsdom's is http://localhost/): a relative one would resolve against css/.
  expect(sheet.style.getPropertyValue('--e20-line-header-art')).toBe('url("http://localhost/my%20%22lair%22.webp")');
  const logos = sheet.querySelectorAll('.e20-line-logo');
  expect(logos).toHaveLength(1);
  expect(logos[0].getAttribute('src')).toBe('logo.webp');
  expect(logos[0].nextElementSibling.classList.contains('window-title')).toBe(true);

  // A new logo replaces the old one's image; no look takes everything off again.
  applyLook(sheet, normalizeLook({ logo: 'other.webp' }));
  expect(sheet.querySelector('.e20-line-logo').getAttribute('src')).toBe('other.webp');
  expect(sheet.style.getPropertyValue('--e20-theme-accent')).toBe('');
  expect(sheet.classList.contains('e20-line-art')).toBe(false);
  applyLook(sheet, null);
  expect(sheet.querySelector('.e20-line-logo')).toBeNull();
});

test('a chat card or a window with no sheet header takes only the accent', () => {
  const card = document.createElement('li');
  applyLook(card, normalizeLook({ accent: '#123456', logo: 'logo.webp', headerArt: 'art.webp' }));
  expect(card.style.getPropertyValue('--e20-theme-accent')).toBe('#123456');
  expect(card.classList.contains('e20-line-art')).toBe(false);
  expect(card.querySelector('img')).toBeNull();
  expect(() => applyLook(null, null)).not.toThrow();
});
