/**
 * The Race and Chase Tracker (apps/race-tracker.mjs): a count for each racing token - laps in a race, lead in a chase -
 * kept on the scene (flags.essence20.race), so each scene has its own race and it survives a reload. Standings go to
 * chat; a hazard table, if one is chosen, is drawn whenever the leader starts a new lap (and on demand).
 *
 * Pure state in, state out: the window writes what these return.
 */

export const RACE_FLAG = 'race';
export const RACE_MODES = Object.freeze(['laps', 'lead']);

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = text => String(text ?? '').replace(/[&<>"']/g, char => ESCAPES[char]);

/**
 * A race, tidied: a known mode, racers with a token id, a name and a whole-number count.
 * @param {Object} raw
 * @returns {{mode: String, hazardTable: String, hazardEachLap: Boolean, racers: Object[]}}
 */
export function normalizeRace(raw) {
  const race = raw && typeof raw == 'object' ? raw : {};
  const seen = new Set();
  const racers = [];
  for (const racer of Array.isArray(race.racers) ? race.racers : []) {
    if (!racer?.tokenId || seen.has(racer.tokenId)) {
      continue;
    }

    seen.add(racer.tokenId);
    racers.push({ tokenId: String(racer.tokenId), name: String(racer.name ?? ''), img: String(racer.img ?? ''), count: Math.trunc(Number(racer.count)) || 0 });
  }

  return {
    mode: RACE_MODES.includes(race.mode) ? race.mode : 'laps',
    hazardTable: String(race.hazardTable ?? ''),
    hazardEachLap: !!race.hazardEachLap,
    racers,
  };
}

/**
 * Tokens joined to the race at 0; one already in it stays as it is.
 * @param {Object} race
 * @param {Token[]|TokenDocument[]} tokens
 * @returns {Object}   the new race.
 */
export function addRacers(race, tokens) {
  const next = normalizeRace(race);
  for (const token of tokens ?? []) {
    const doc = token?.document ?? token;
    if (doc?.id && !next.racers.some(racer => racer.tokenId == doc.id)) {
      next.racers.push({ tokenId: doc.id, name: doc.name ?? '', img: doc.texture?.src ?? '', count: 0 });
    }
  }

  return next;
}

/** A racer taken out of the race. */
export function removeRacer(race, tokenId) {
  const next = normalizeRace(race);
  next.racers = next.racers.filter(racer => racer.tokenId != tokenId);
  return next;
}

const best = race => Math.max(0, ...race.racers.map(racer => racer.count));

/**
 * A racer's count up or down (laps not below 0). A lap race's leader reaching a new lap sets `newLap` (the hazard's cue).
 * @param {Object} race
 * @param {String} tokenId
 * @param {Number} delta
 * @returns {{race: Object, newLap: Boolean}}
 */
export function bump(race, tokenId, delta) {
  const next = normalizeRace(race);
  const before = best(next);
  const racer = next.racers.find(entry => entry.tokenId == tokenId);
  if (racer) {
    // Laps don't go below none; a chase's lead can (falling behind).
    racer.count += Math.trunc(Number(delta)) || 0;
    racer.count = next.mode == 'laps' ? Math.max(0, racer.count) : racer.count;
  }

  return { race: next, newLap: next.mode == 'laps' && best(next) > before };
}

/** Every count back to 0; the racers stay. */
export function resetRace(race) {
  const next = normalizeRace(race);
  next.racers.forEach(racer => (racer.count = 0));
  return next;
}

/**
 * The racers, best first, each with its place (ties share one).
 * @param {Object} race
 * @returns {Object[]}   racers with a `place`.
 */
export function standings(race) {
  const sorted = normalizeRace(race).racers.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return sorted.map(racer => ({ ...racer, place: 1 + sorted.filter(other => other.count > racer.count).length }));
}

/**
 * The standings as a chat card.
 * @param {Object} race
 * @param {{title: String, unit: Function}} labels   unit(count) is the count's words ("2 laps").
 * @returns {String}   HTML.
 */
export function standingsHtml(race, { title, unit }) {
  const rows = standings(race).map(racer => `<li value="${racer.place}">${escape(racer.name)}: ${escape(unit(racer.count))}</li>`);
  return `<h3>${escape(title)}</h3>${rows.length ? `<ol>${rows.join('')}</ol>` : ''}`;
}
