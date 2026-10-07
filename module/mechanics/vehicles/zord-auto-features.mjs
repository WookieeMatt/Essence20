/**
 * A new Zord's starting Zord Features (PR CRB p.134, expanded by Across the Stars p.103, Beneath the Helmet p.71, A Jump
 * Through Time p.82 and Through the Shattered Grid p.33):
 *  - Spectrum-Based: one Feature by the colour of the Role the Zord links to (Black: Hardened Chassis, Blue: Enhance
 *    (Attack), ...). Advanced Spectrum - any of those, or Auxiliary Zord.
 *  - Automatic: the Features every Zord of a Power Ranger team type comes with (Dinozords: Combiner and Heavy Chassis,
 *    ...). A mixed team picks two of the available Features.
 *
 * Offered once, when a Zord is first linked to a Ranger (dropped on the Ranger's sheet), and from the Ranger's Zords tab
 * until it has been done. The answer is kept on the Zord (flags.essence20.zordAutoFeatures). Features the Zord already
 * has are not added again; a Feature with a choice of its own (Combiner's Megaform Trait, Increase (Essence)) asks it
 * when it lands, as when it is dropped.
 */

export const AUTO_FLAG = 'zordAutoFeatures';

const C = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const FEATURES = {
  additionalAttackType: C('pr_crb', 'j5arWXvkd5fHbe0Q'),
  auxiliaryZord: C('pr_crb', 'QO0kY1y359tSnPTS'),
  combiner: C('pr_crb', 'ZZMBVjmosr0VViMU'),
  crewCompartment: C('pr_crb', 'iZsl6JiIHbr9x9PI'),
  enhanceAttack: C('pr_crb', 'OibmwLDNcXE6eJIO'),
  extraAttack: C('pr_crb', '9Zp7hPE0xHDCbs77'),
  hardenedChassis: C('pr_crb', '7vwrFKj2UAxG4ocf'),
  heavyChassis: C('pr_crb', 'dXtJGif7KEbsrgUa'),
  increaseEssence: C('pr_crb', 'oKGzWCOUCuefWuqD'),
  lightChassis: C('pr_crb', 'rVW7mvnV4MbGuxoq'),
  martialZord: C('pr_crb', 'nQcU1SrVChPaXXpq'),
  movementBooster: C('pr_crb', '9YQmZGdNCmtXLAd4'),
  rescueUpgrade: C('pr_crb', 'mUX5yrrvE6ppbAAm'),
  thunderUpgrade: C('pr_crb', 'TrahRuyqZz8UAQ6K'),
  warriorMode: C('pr_crb', 'RsrUlBazkPwpRfxi'),
  zeroG: C('pr_crb', '8xV4xaz8Hnqk4TgQ'),
  megafauna: C('across_the_stars', 'c6plguiUVmJzGNsw'),
  rrr: C('across_the_stars', 'pcavWqFi6FZ8QBAf'),
  targetingSuite: C('across_the_stars', '8L29IiLC62qrH0tr'),
  voidshield: C('across_the_stars', '6VOeIAu2XaPGV78P'),
  dinoGemIntegration: C('beneath_the_helmet', 'q9lciavy0Nfh0rR8'),
  energemInfusion: C('beneath_the_helmet', 'ZLQCeC2gGWHnYEBQ'),
  zordSentience: C('beneath_the_helmet', 'idhVrfBIKELsl3OW'),
  multiMegaform: C('jump_through_time', 'vbySX4nIsHsIhIzJ'),
  temporalBuffer: C('jump_through_time', 'EdqqEhA2JqrVIlVH'),
  manifestedZord: C('through_the_shattered_grid', 'fNMbLGJk5RiSi49J'),
  powerConstruct: C('through_the_shattered_grid', '34CRvsE7ncW4kmE8'),
};

/** Spectrum colour -> its Feature (`upgradedZord`: any Upgraded Zord option, picked). */
export const SPECTRUM_FEATURES = {
  black: 'hardenedChassis',
  blue: 'enhanceAttack',
  green: 'additionalAttackType',
  pink: 'movementBooster',
  red: 'increaseEssence',
  yellow: 'lightChassis',
  orange: 'additionalAttackType',
  purple: 'upgradedZord',
};

/** Team -> its Features (`megaformTrait`: a Megaform Trait, picked). */
export const TEAM_FEATURES = {
  battleborgs: ['extraAttack', 'martialZord'],
  dinozords: ['combiner', 'heavyChassis'],
  megaVehicleZords: ['combiner', 'zeroG'],
  turbozords: ['combiner', 'movementBooster'],
  zeoZords: ['combiner', 'megaformTrait'],
  uniqueTeam: ['auxiliaryZord', 'enhanceAttack'],
  deltaMaxZords: ['crewCompartment', 'rrr'],
  galactazords: ['megafauna', 'zeroG'],
  omegaPoweredZords: ['targetingSuite', 'zeroG'],
  rescuezords: ['rescueUpgrade', 'warriorMode'],
  solarzords: ['voidshield', 'zeroG'],
  dinoThunderDinoZords: ['combiner', 'dinoGemIntegration'],
  dinoChargeBioZords: ['combiner', 'energemInfusion', 'zordSentience'],
  timeForceZords: ['combiner', 'temporalBuffer'],
  zordAttackVehicles: ['combiner', 'multiMegaform'],
  thunderzordSystem: ['combiner', 'thunderUpgrade'],
  prometheaRangersZords: ['powerConstruct', 'manifestedZord', 'zeroG'],
};

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));
const COLOURS = Object.keys(SPECTRUM_FEATURES);

/** A Ranger's spectrum colour from their Role's name ("Red Ranger"), or null. */
export function rangerColour(ranger) {
  const items = ranger?.items?.contents ?? [...(ranger?.items ?? [])];
  const role = items.find(item => item.type == 'role');
  const match = new RegExp(`\\b(${COLOURS.join('|')})\\b`, 'i').exec(role?.name ?? '');
  return match ? match[1].toLowerCase() : null;
}

/** Whether the Zord's starting Features have been settled. */
export const autoFeaturesDone = zord => !!zord?.flags?.essence20?.[AUTO_FLAG];

/** The Features a mixed team chooses two of: every team's. */
export function mixedTeamOptions() {
  return [...new Set(Object.values(TEAM_FEATURES).flat())];
}

/** The compendium uuids to add for a spectrum colour and team (picks resolved by the caller). Exported for tests. */
export function plannedFeatures(colour, team, mixedPicks = []) {
  const keys = [
    ...(colour ? [SPECTRUM_FEATURES[colour]] : []),
    ...(team == 'mixed' ? mixedPicks : TEAM_FEATURES[team] ?? []),
  ];
  return keys.filter(Boolean);
}

const sourceOfItem = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? null;

/** Add one Feature (by key) unless the Zord already has it; the picks (`upgradedZord`, `megaformTrait`) are chosen here. */
async function addFeature(zord, key) {
  const { findItems, grantCopy, pickOne } = await import("../resources/grants.mjs");
  let uuid = FEATURES[key] ?? null;
  if (key == 'megaformTrait' || key == 'upgradedZord') {
    const rows = await findItems({
      type: key == 'megaformTrait' ? 'megaformTrait' : 'feature',
      fields: ['system.source.book'],
      matches: entry => (key == 'megaformTrait' ? entry.system?.source?.book != 'Enigma of Combination' : /^Upgraded Zord/.test(entry.name ?? '')),
    });
    uuid = await pickOne(`${zord.name}: ${T(key == 'megaformTrait' ? 'ZordAutoPickTrait' : 'ZordAutoPickUpgrade')}`, rows);
  }

  if (!uuid) {
    return null;
  }

  const items = zord.items?.contents ?? [...(zord.items ?? [])];
  if (key != 'megaformTrait' && items.some(item => sourceOfItem(item) == uuid)) {
    return null;
  }

  return grantCopy(zord, uuid);
}

/**
 * Ask for the Zord's team (and its spectrum colour when the Role doesn't say), then add the Features.
 * @param {Actor} ranger
 * @param {Actor} zord
 * @returns {Promise<Boolean>}   Whether it was settled (false: put off)
 */
export async function offerAutoFeatures(ranger, zord) {
  if (!zord?.isOwner || zord.type != 'zord' || autoFeaturesDone(zord)) {
    return false;
  }

  const colour = rangerColour(ranger);
  const teamOptions = [...Object.keys(TEAM_FEATURES), 'mixed', 'none']
    .map(key => `<option value="${key}">${T(`ZordTeam.${key}`)}</option>`).join('');
  const colourOptions = ['advanced', ...COLOURS, 'none']
    .map(key => `<option value="${key}"${key == colour ? ' selected' : ''}>${T(`ZordSpectrum.${key}`)}</option>`).join('');
  const answer = await foundry.applications.api.DialogV2.wait({
    window: { title: T('ZordAutoTitle', { name: zord.name }) },
    classes: ['window-app', 'e20-window'],
    position: { width: 460 },
    content: `<p>${T('ZordAutoPrompt', { name: zord.name, ranger: ranger?.name ?? '' })}</p>
      <div class="form-group"><label>${T('ZordAutoTeam')}</label><select name="team">${teamOptions}</select></div>
      <div class="form-group"><label>${T('ZordAutoSpectrum')}</label><select name="colour">${colourOptions}</select></div>`,
    buttons: [
      { action: 'ok', label: T('ZordAutoAdd'), default: true, callback: (event, button) => ({ team: button.form.elements.team.value, colour: button.form.elements.colour.value }) },
      { action: 'later', label: T('ZordGrowthLater') },
    ],
    rejectClose: false,
  });
  if (!answer || answer == 'later') {
    return false;
  }

  const { chooseSelect } = await import("../resources/grants.mjs");
  const label = key => (FEATURES[key] ? globalThis.fromUuidSync?.(FEATURES[key])?.name : null) ?? T(`ZordAutoFeature.${key}`);

  // Advanced Spectrum: any of the colours' Features, or Auxiliary Zord.
  let spectrumKey = SPECTRUM_FEATURES[answer.colour] ?? null;
  if (answer.colour == 'advanced') {
    const options = [...new Set([...Object.values(SPECTRUM_FEATURES), 'auxiliaryZord'])].map(key => ({ value: key, label: label(key) }));
    spectrumKey = await chooseSelect(zord.name, T('ZordAutoPickAdvanced'), options);
  }

  // A mixed team chooses two of the available Features.
  const mixedPicks = [];
  if (answer.team == 'mixed') {
    for (let i = 0; i < 2; i++) {
      const options = mixedTeamOptions().filter(key => !mixedPicks.includes(key)).map(key => ({ value: key, label: label(key) }));
      const picked = await chooseSelect(zord.name, T('ZordAutoPickMixed', { n: i + 1 }), options);
      if (picked) {
        mixedPicks.push(picked);
      }
    }
  }

  const keys = [...(spectrumKey ? [spectrumKey] : []), ...(answer.team == 'mixed' ? mixedPicks : TEAM_FEATURES[answer.team] ?? [])];
  const added = [];
  for (const key of keys) {
    const item = await addFeature(zord, key);
    if (item) {
      added.push(item.name);
    }
  }

  await zord.setFlag('essence20', AUTO_FLAG, { team: answer.team, colour: answer.colour });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: zord }),
    content: T('ZordAutoAdded', { name: zord.name, features: added.join(', ') || T('ZordAutoNothing') }),
  });
  return true;
}
