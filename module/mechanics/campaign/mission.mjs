/**
 * The Mission Generator (apps/mission-generator.mjs): an episode written up from the GM's own roll tables. A source is a
 * folder of world tables, a compendium of them or a folder inside one; each table is one section of the episode
 * ("Prize", "Place", "Scheme"), in the folder's order. Its draws go into a journal entry, a document result as a link.
 *
 * A source can carry its own title and outline - a folder's flags.essence20.mission (a compendium folder's too), or a
 * compendium's (in its module.json pack entry) - so a homebrew module ships its episode format with no code:
 *   "flags": { "essence20": { "mission": { "title": "Heist at {Location}", "outline": "1. A tip-off..." } } }
 * {Section} in either is replaced with that section's draw.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = text => String(text ?? '').replace(/[&<>"']/g, char => ESCAPES[char]);

// A description that's only one paragraph, unwrapped, so it reads inline after its section's name.
const inline = html => String(html ?? '').trim().replace(/^<p>([\s\S]*?)<\/p>$/i, (whole, inner) => (inner.includes('<p') ? whole : inner));

/**
 * A drawn result as text: its description, else its name.
 * @param {TableResult} result
 * @returns {String}   HTML.
 */
export const resultText = result => inline(result?.description) || escape(result?.name);

/**
 * A drawn result for the journal: a document result as a link to it, anything else its text.
 * @param {TableResult} result
 * @returns {String}   HTML.
 */
export function resultLink(result) {
  if (result?.documentUuid) {
    return `@UUID[${result.documentUuid}]{${String(result.name || '').replace(/[{}]/g, '')}}`;
  }

  return resultText(result);
}

/**
 * A source's tables in section order: their own sort, then by name.
 * @param {RollTable[]} tables
 * @returns {RollTable[]}
 */
export const sectionOrder = tables => [...(tables ?? [])]
  .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.name).localeCompare(String(b.name)));

/**
 * One table's draw, ready to show and write: the table's name and uuid, and each result drawn.
 * @param {RollTable} table
 * @returns {Promise<{name: String, uuid: String, results: Object[]}>}
 */
export async function rollSection(table) {
  const { results = [] } = (await table.roll()) ?? {};
  return {
    name: table.name,
    uuid: table.uuid,
    results: results.map(result => ({ name: result.name ?? '', text: resultText(result), link: resultLink(result) })),
  };
}

/** A section's draws as plain text (a title), joined. */
const plainOf = section => (section?.results ?? []).map(result => result.name || result.text.replace(/<[^>]*>/g, '')).join(', ');

/**
 * {Section} placeholders replaced with that section's draw (any case; spaces ignored). Unknown ones are left alone.
 * @param {String} template
 * @param {Object[]} sections   rollSection's.
 * @param {Function} [valueOf]   a section to its text - plain by default.
 * @returns {String}
 */
export function fillPlaceholders(template, sections, valueOf = plainOf) {
  const key = name => String(name).toLowerCase().replace(/\s+/g, '');
  const byKey = new Map((sections ?? []).map(section => [key(section.name), section]));
  return String(template ?? '').replace(/\{([^{}]+)\}/g, (whole, name) => (byKey.has(key(name)) ? valueOf(byKey.get(key(name))) : whole));
}

/**
 * The journal entry's name: the title with its placeholders filled, else the source's name and the first draw.
 * @param {String} title
 * @param {Object[]} sections
 * @param {String} sourceName
 * @returns {String}
 */
export function missionTitle(title, sections, sourceName) {
  const filled = fillPlaceholders(title, sections).trim();
  if (filled) {
    return filled;
  }

  const first = plainOf(sections?.[0]);
  return first ? `${sourceName}: ${first}` : sourceName;
}

/**
 * The outline as HTML: blank lines split paragraphs, lines starting "1." or "-" make a list. Its text is escaped; its
 * placeholders become the draws' links.
 * @param {String} outline
 * @param {Object[]} sections
 * @returns {String}
 */
export function outlineHtml(outline, sections) {
  const linkOf = section => section.results.map(result => result.link).join(', ');
  const fill = text => fillPlaceholders(escape(text), sections, linkOf);
  return String(outline ?? '').replace(/\r/g, '').split(/\n\s*\n/).map(block => block.trim()).filter(Boolean).map(block => {
    const lines = block.split('\n').map(line => line.trim());
    const numbered = lines.every(line => /^\d+[.)]\s/.test(line));
    if (numbered || lines.every(line => /^[-*]\s/.test(line))) {
      const items = lines.map(line => `<li>${fill(line.replace(/^(\d+[.)]|[-*])\s+/, ''))}</li>`).join('');
      return numbered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
    }

    return `<p>${lines.map(fill).join('<br>')}</p>`;
  }).join('\n');
}

/**
 * The journal page: each section's draws, then the outline.
 * @param {Object[]} sections
 * @param {String} [outline]
 * @returns {String}
 */
export function missionHtml(sections, outline = '') {
  const body = (sections ?? []).map(section => `<p><strong>${escape(section.name)}:</strong> ${section.results.map(result => result.link).join(', ') || '-'}</p>`);
  const tail = outlineHtml(outline, sections);
  return [...body, tail].filter(Boolean).join('\n');
}

/**
 * A source's own title and outline (flags.essence20.mission on the folder, or on the compendium's metadata).
 * @param {Object} flags
 * @returns {{title: String, outline: String}}
 */
export function missionDefaults(flags) {
  const mission = flags?.essence20?.mission ?? {};
  return { title: String(mission.title ?? ''), outline: String(mission.outline ?? '') };
}
