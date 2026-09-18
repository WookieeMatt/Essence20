/**
 * Structural validation of the tour definitions under `tours/`.
 *
 * Tours are data, not code: a mistyped localization key or a duplicated step id produces a tour
 * that registers without complaint and then renders "E20.Tours.Whatever.Title" at the user, or
 * silently stores its progress under the wrong step. None of that surfaces until someone actually
 * plays the tour, which is exactly the kind of failure worth catching in CI instead.
 *
 * This file deliberately reads the JSON off disk rather than importing the tour classes - it is
 * validating the authored content, and needs no Foundry environment to do it.
 *
 * See docs/TOURS_PLAN.md §8.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOURS_DIR = path.join(ROOT, 'tours');
const LANG_FILE = path.join(ROOT, 'lang', 'en.json');

/** @returns {string[]} Every `tours/*.json` basename. */
function tourFiles() {
  return fs.readdirSync(TOURS_DIR).filter((f) => f.endsWith('.json'));
}

/**
 * Resolve a dotted localization key against the loaded translation object.
 * @param {object} lang   The parsed lang/en.json.
 * @param {string} key    A dotted key, e.g. "E20.Tours.Welcome.Title".
 * @returns {boolean}     Whether the key resolves to a string.
 */
function keyResolves(lang, key) {
  const value = key.split('.').reduce((obj, part) => (obj == null ? undefined : obj[part]), lang);
  return typeof value === 'string';
}

const lang = JSON.parse(fs.readFileSync(LANG_FILE, 'utf8'));
const files = tourFiles();

describe('tour definitions', () => {
  it('finds at least one tour to validate', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  describe.each(files)('%s', (file) => {
    const tour = JSON.parse(fs.readFileSync(path.join(TOURS_DIR, file), 'utf8'));

    it('declares the fields ToursCollection#register and the Manage Tours UI need', () => {
      expect(tour.namespace).toBe('essence20');
      expect(typeof tour.id).toBe('string');
      expect(tour.id.length).toBeGreaterThan(0);
      // Without display:true the tour registers fine and is invisible in Manage Tours.
      expect(tour.display).toBe(true);
      expect(Array.isArray(tour.steps)).toBe(true);
      expect(tour.steps.length).toBeGreaterThan(0);
    });

    it('resolves its own title and description', () => {
      expect(keyResolves(lang, tour.title)).toBe(true);
      expect(keyResolves(lang, tour.description)).toBe(true);
    });

    it('gives every step a unique id', () => {
      const ids = tour.steps.map((s) => s.id);
      expect(ids).toHaveLength(new Set(ids).size);
      for (const id of ids) expect(typeof id).toBe('string');
    });

    it('resolves every step title and content', () => {
      // Collect every failure before asserting, so one run names all the bad keys rather than
      // stopping at the first and needing a re-run per typo.
      const unresolved = [];
      for (const step of tour.steps) {
        for (const field of ['title', 'content']) {
          if (!keyResolves(lang, step[field])) unresolved.push(`${step.id}.${field} -> ${step[field]}`);
        }
      }

      expect(unresolved).toEqual([]);
    });

    it('only uses tooltip directions core understands', () => {
      const valid = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'CENTER'];
      for (const step of tour.steps) {
        if (!step.tooltipDirection) continue;
        expect(valid).toContain(step.tooltipDirection);
      }
    });

    it('only marks a step optional when it has a target that could go missing', () => {
      // `optional` means "skip if the selector never resolves", so it is meaningless - and a sign
      // of a copy-paste error - on a centre-screen step, which has no selector at all.
      for (const step of tour.steps) {
        if (step.optional) expect(step.selector ?? step.waitFor).toBeDefined();
      }
    });

    it('points suggestedNextTours at properly namespaced keys', () => {
      for (const next of tour.suggestedNextTours ?? []) {
        expect(next).toMatch(/^[a-z0-9-]+\.[A-Za-z0-9]+$/);
      }
    });
  });
});
