/**
 * What kind of creature an actor is - a robot, a Putty, one of the Machine Empire, an object.
 *
 * A handful of Perks care what they're fighting: Bot-Hunter (A Jump Through Time p.54) "robotic
 * Threats", Grid Champion (PR CRB p.95) "Putties and Tengas", Machinist Revolutionary (Across the
 * Stars p.69) "Machine Empire creatures", Monster Hunter (Across the Stars p.70) "a non-humanoid",
 * Earth Defenders (Field Guide p.69) "non-human creatures", Shaped Charges (GI Joe CRB p.81)
 * "objects and structures". The rulebooks never classify creatures in a way the system could read,
 * so an NPC carries its own tags - a comma-separated list typed into its sheet header
 * (system.creatureTags). A few things are read without a tag: a Cybertronian (an actor that can
 * transform), a Zord, a vehicle, a drone or Mini-Con companion, and names that say what they are
 * ("Putty Patroller", "Tenga Warrior").
 */

const ROBOT_TAGS = ['robot', 'robotic', 'bot', 'cybertronian', 'android', 'drone', 'machine', 'cog', 'zord', 'mechanical'];
const MECHANICAL_TAGS = [...ROBOT_TAGS, 'vehicle', 'computerized'];

/**
 * The actor's tags, lower-cased: its own typed list plus the ones its type implies.
 * @param {Actor} actor
 * @returns {Set<String>}
 */
export function creatureTagsOf(actor) {
  const tags = new Set();
  const typed = actor?.system?.creatureTags;
  const list = Array.isArray(typed) ? typed : String(typed ?? '').split(',');
  for (const tag of list) {
    const clean = String(tag).trim().toLowerCase();
    if (clean) {
      tags.add(clean);
    }
  }

  if (actor?.system?.canTransform || ['zord', 'megaform'].includes(actor?.type)) {
    tags.add('robot');
  }

  if (actor?.type == 'vehicle') {
    tags.add('vehicle');
  }

  if (actor?.type == 'companion' && ['drone', 'miniCon'].includes(actor.system?.type)) {
    tags.add('robot');
  }

  if (actor?.type == 'companion' && actor.system?.type == 'human') {
    tags.add('human');
  }

  const name = String(actor?.name ?? '').toLowerCase();
  if (/\bputt(y|ies)\b/.test(name)) {
    tags.add('putty');
  }

  if (/\btengas?\b/.test(name)) {
    tags.add('tenga');
  }

  return tags;
}

function hasAny(actor, list) {
  const tags = creatureTagsOf(actor);
  return list.some(tag => tags.has(tag));
}

export function isRobotic(actor) {
  return hasAny(actor, ROBOT_TAGS);
}

/** Robotic, a vehicle, or anything computerized - Bot-Hunter's "mechanical Threats". */
export function isMechanical(actor) {
  return hasAny(actor, MECHANICAL_TAGS);
}

export function isMachineEmpire(actor) {
  return hasAny(actor, ['machine empire', 'machineempire']);
}

export function isPuttyOrTenga(actor) {
  return hasAny(actor, ['putty', 'putties', 'tenga', 'tengas']);
}

/**
 * Monster Hunter's "non-humanoid (defined as something with more than two legs, two arms, and a
 * number of heads that do not equal one, but does not include robots/vehicles)".
 */
export function isNonHumanoid(actor) {
  return hasAny(actor, ['non-humanoid', 'nonhumanoid', 'monster']) && !isMechanical(actor);
}

/**
 * Earth Defenders' "non-human creatures": tagged as something that isn't human, or a robot. An
 * untagged NPC is treated as human, since most of any game line's cast is.
 */
export function isNonHuman(actor) {
  const tags = creatureTagsOf(actor);
  if (tags.has('human')) {
    return false;
  }

  return isRobotic(actor) || tags.has('non-human') || tags.has('nonhuman') || tags.has('alien') || tags.has('monster')
    || tags.has('non-humanoid') || tags.has('animal') || tags.has('creature');
}

/** Shaped Charges' "objects and structures". */
export function isObjectOrStructure(actor) {
  return hasAny(actor, ['object', 'structure', 'building', 'wall']);
}

/**
 * Whether the actor can't be affected by a Skill at all - a robot that can't be persuaded, a
 * mindless thing that can't be frightened. Tagged "immune:<skill>" (e.g. "immune:persuasion"), or
 * "mindless" for every Social skill. Fear Is Universal (Cobra Codex p.57) spends a Story Point to
 * get past it.
 * @param {Actor} actor
 * @param {String} skill
 * @returns {Boolean}
 */
export function isImmuneToSkill(actor, skill) {
  const tags = creatureTagsOf(actor);
  if (tags.has(`immune:${String(skill).toLowerCase()}`)) {
    return true;
  }

  return tags.has('mindless') && ['animalHandling', 'deception', 'intimidation', 'persuasion', 'culture', 'performance'].includes(skill);
}
