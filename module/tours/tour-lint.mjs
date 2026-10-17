/**
 * A development check that walks every registered Essence20 tour and reports steps whose target
 * cannot be resolved.
 *
 * Tours are the one part of this system whose correctness depends on CSS selectors matching
 * templates they don't live next to, so they rot silently: a class renamed in a `.hbs` file breaks
 * a tour that nothing else references, and nobody finds out until someone plays it. The Jest suite
 * validates a tour's *structure* and its localization keys, but it cannot check a selector without
 * a browser and a populated actor. This does the other half, in a live client.
 *
 * Run from a macro or the console:
 * ```js
 * const { lintTours } = await import("/systems/essence20/module/tours/tour-lint.mjs");
 * await lintTours();
 * ```
 *
 * It restores whatever progress each tour had, so running it does not wipe a user's place, and it
 * cleans up any demo content it caused to be created.
 *
 * @see docs/TOURS_PLAN.md §8
 */

import { cleanupDemoActors } from "./demo-content.mjs";

/**
 * @typedef TourLintResult
 * @property {string} tour              The tour key.
 * @property {number} steps             How many steps were walked.
 * @property {string[]} unresolved      Ids of steps whose selector matched nothing.
 * @property {string[]} skipped         Ids of `optional` steps that were skipped.
 * @property {string|null} error        The error that aborted this tour, if any.
 */

/**
 * Walk one tour, recording any step whose target could not be resolved.
 * @param {foundry.nue.Tour} tour   The tour to walk.
 * @returns {Promise<TourLintResult>}
 */
async function lintTour(tour) {
  const result = { tour: tour.key, steps: 0, unresolved: [], skipped: [], error: null };
  const seen = new Set();

  try {
    await tour.reset();
    await tour.start();

    const inspect = () => {
      const step = tour.currentStep;
      if (!step || seen.has(step.id)) return;
      seen.add(step.id);
      result.steps++;

      if (!step.selector) return;
      const rect = tour.targetElement?.getBoundingClientRect();
      if (!rect || !rect.width || !rect.height) result.unresolved.push(step.id);
    };

    inspect();
    while (tour.hasNext) {
      await tour.next();
      inspect();
    }

    // Any declared step we never saw was skipped — which is correct for an `optional` step whose
    // UI genuinely isn't present, and a bug for anything else.
    for (const step of tour.config.steps) {
      if (seen.has(step.id)) continue;
      if (step.optional) result.skipped.push(step.id);
      else result.unresolved.push(`${step.id} (never reached)`);
    }
  } catch (err) {
    result.error = String(err).slice(0, 200);
  } finally {
    tour.exit();
  }

  return result;
}

/**
 * Walk every Essence20 tour and report what could not be resolved.
 * @param {object} [options]
 * @param {string} [options.namespace]   Which namespace to lint. Defaults to this system's.
 * @returns {Promise<TourLintResult[]>}
 */
export async function lintTours({ namespace = "essence20" } = {}) {
  const tours = game.tours.filter(t => t.namespace === namespace);

  // Preserve each user's place, so running the check isn't destructive to their own progress.
  const progress = foundry.utils.deepClone(game.settings.get("core", "tourProgress"));
  const results = [];

  for (const tour of tours) {
    if (!tour.canStart) {
      results.push({ tour: tour.key, steps: 0, unresolved: [], skipped: [], error: "cannot start" });
      continue;
    }

    results.push(await lintTour(tour));

    // Each tour's `exit()` schedules its teardown fire-and-forget, so walking the next one
    // immediately would race the outgoing cleanup against the incoming provisioning. Awaiting a
    // cleanup of our own is what makes that ordering total: it joins the same queue behind the
    // teardown, so by the time it resolves the teardown has finished too. A fixed sleep here was
    // not enough — it failed a different tour on each run depending on how long provisioning took.
    await new Promise(resolve => window.setTimeout(resolve, 0));
    await cleanupDemoActors();
  }

  await game.settings.set("core", "tourProgress", progress);
  for (const tour of tours) tour._reloadProgress();
  await cleanupDemoActors();

  const broken = results.filter(r => r.error || r.unresolved.length);
  console.group(`Essence20 | Tour lint: ${results.length} tours, ${broken.length} with problems`);
  for (const r of results) {
    const parts = [`${r.steps} steps`];
    if (r.skipped.length) parts.push(`skipped: ${r.skipped.join(", ")}`);
    if (r.unresolved.length) parts.push(`UNRESOLVED: ${r.unresolved.join(", ")}`);
    if (r.error) parts.push(`ERROR: ${r.error}`);
    console[(r.error || r.unresolved.length) ? "warn" : "log"](`${r.tour} — ${parts.join(" | ")}`);
  }

  console.groupEnd();
  ui.notifications?.info(`Tour lint: ${results.length} tours checked, ${broken.length} with problems. See console.`);
  return results;
}
