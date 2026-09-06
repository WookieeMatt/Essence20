/*
* Parse the UUID to get just the ID value of the item
* @param {string} uuid of the item that we are parsing for the id
* @return {string|null} index or null returned.
*/
export function parseId(uuid) {
  const parts = uuid.split(".");
  const index = parts[(parts.length-1)];

  return index || null;
}

/**
* Get Items of a type
* @param {String} type  The type of Item to return
* @param {Item[]} items The Items to search through
* @returns {Item[]}     All Items of the type requested
*/
export function getItemsOfTypeFromSystemItems(type, items) {
  const itemsOfType = [];
  for (const item of items) {
    if (item.type == type) {
      itemsOfType.push(item);
    }
  }

  return itemsOfType;
}

/**
* Handles creating a unique 5 digit Id for an Item
* @param {Item[]} items The Items keyed by IDs
*/
export function createId(items) {
  let id = "";
  do {
    id = _randomId(5);
  } while (items[id]);

  return id;
}

/**
 * Turns a Specialization's display name into a stable, predictable key (e.g. "Specific Subject"
 * -> "specificSubject") instead of an opaque random one, so a Perk's Active Effect can target it
 * directly - e.g. system.skills.science.specializations.medicine.shiftUp (ADD 1) or
 * system.skills.science.specializations.medicine.edge (OVERRIDE true). Safe now specifically
 * because a Specialization can no longer be renamed after it's added (see
 * sheet-handlers/specialization-handler.mjs) - the earlier design (essence20-specialization-
 * redesign) used an opaque id instead precisely to survive a rename that's no longer possible.
 * Collision-checked against `existing` (an id -> record map, the same shape as
 * system.skills.<skill>.specializations) the same way createId() is, so two different names that
 * happen to slugify the same (e.g. two custom entries differing only in punctuation) get distinct
 * keys instead of one silently overwriting the other.
 * @param {String} name The specialization's display name.
 * @param {Object} existing The skill's existing specializations (id -> record), to check for
 *   collisions.
 * @returns {String} A key unique within `existing`.
 */
export function slugifySpecializationName(name, existing = {}) {
  const words = name.trim().split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const base = words
    .map((word, i) => i === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join('') || 'specialization';

  let key = base;
  let suffix = 2;
  while (existing[key]) {
    key = `${base}${suffix}`;
    suffix++;
  }

  return key;
}

/**
 * Title-cases a Specialization's display name (e.g. "sniper rifle" -> "Sniper Rifle") so a
 * custom one a player free-types reads the same as the standard-catalog picks next to it in the
 * Skill Picker's dropdown (see CONFIG.E20.standardSpecializations), which are already written in
 * Title Case - rather than showing whatever raw casing the player happened to type. Splits only
 * on whitespace (not slugifySpecializationName's own punctuation-splitting above) so a hyphenated
 * or apostrophed word stays one word, just with its own leading letter capitalized.
 * @param {String} name The specialization's raw display name.
 * @returns {String} The same name, title-cased.
 */
export function titleCaseSpecializationName(name) {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
* Generate a random ID
* Generate random number and convert it to base 36 and remove the '0.' at the beginning
* As long as the string is not long enough, generate more random data into it
* Use substring in case we generated a string with a length higher than the requested length
* @param length    The length of the random ID to generate
* @return          Return a string containing random letters and numbers
*/
export function _randomId(length) {
  const multiplier = Math.pow(10, length);
  return Math.floor((1 + Math.random()) * multiplier)
    .toString(16)
    .substring(1);
}

/**
 * Handle Shifting skills
 * @param {String} skill The skill shifting
 * @param {Number} shift The quantity of the shift
 * @param {Actor} actor  The actor
 * @return {String} newShift The value of the new Shift
 * @return {String} skillString The name of the skill being shifted
 */
export function getShiftedSkill(skill, shift, actor) {
  let skillString = "";
  let currentShift = "";
  let newShift = "";

  if (skill == "conditioning") {
    skillString = `system.${skill}`;
    currentShift = actor.system[skill];
    newShift = currentShift + shift;
  } else {
    currentShift = actor.system.skills[skill].shift;
    skillString = `system.skills.${skill}.shift`;
    newShift = CONFIG.E20.skillShiftList[Math.max(0, (CONFIG.E20.skillShiftList.indexOf(currentShift) - shift))];
  }

  return [newShift, skillString];
}

/*
 * Caches all roles from compendium packs to prevent repeated
 * pack.getDocuments() calls in Item.getData()
 */
export async function updateRoleCache() {
  const allRoles = await _getAllPackRoles();
  CONFIG.E20.allPackRoles = allRoles;
}

/* Helper to fetch all Roles from compendium packs */
async function _getAllPackRoles() {
  let allRoles = [];

  for (const pack of game.packs) {
    const packRoles = await pack.getDocuments({ type: "role" });
    allRoles = allRoles.concat(packRoles);
  }

  return allRoles;
}
