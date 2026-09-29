/**
 * Shared bits for the data21 slice of the Item Review (data errors and missing items across the
 * lines): compendium ids, item lookups and the owner-or-GM write every rider here needs.
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
const fmmc = id => uuid('finster_s_monster_matic_cookbook', id);
const ia = id => uuid('intercontinental_adventures', id);

export const D21 = {
  // Finster's Monster-Matic Cookbook
  stingerSprayPerk: fmmc('90rddMq7sK1SrhBi'),
  stingerSprayWeapon: fmmc('iOq7mriMr4BCBl78'),
  stingerSprayEffects: [fmmc('b2cIwfYeGzvifR7l'), fmmc('GZRKwL2vRwXUIjtf'), fmmc('Bx7lTyG4lBTi66Si')],
  psychoMorpher: fmmc('EkBMS8Ih24UYBQ4R'),
  pathCruelty: fmmc('vWie8Dy4u54sf1hy'),
  pathFlame: fmmc('4PbR4S3s83Coa0kL'),
  pathFrost: fmmc('GQ5aQWbjmaO9y00w'),
  pathStone: fmmc('TEjkVjIEFEbRI736'),
  pathThorns: fmmc('0ICOTyVDXK1i6l1S'),
  pathVenom: fmmc('rWoVOcNc3lXKDbhg'),
  psychoAxe: fmmc('J1c1RFPaz3ende3k'),
  psychoBlade: fmmc('G22NKq1Zcbeippwe'),
  psychoBlaster: fmmc('mXz4XbFVVAxAhXP7'),
  psychoBow: fmmc('5I2uX1zj3oC5e0TP'),
  psychoDagger: fmmc('6ciS2IDmQVD6GIk7'),
  psychoScythe: fmmc('KIdCaJ7nlWDyANng'),
  psychoStaff: fmmc('fJUfCWJOoluPf5vm'),
  psychoSlinger: fmmc('NTy3KQc1Lcg4LlyX'),
  psychoSword: fmmc('gZoFLl1P4qVeJ1xR'),
  psychoTrident: fmmc('yyg2pmTVJmxCiYFF'),
  psychoBladeEffects: [fmmc('04vQyKGeDIKmBaBZ'), fmmc('SlQRp4ghRuoyeoRG'), fmmc('JYrWES4zfCrAYGeE')],
  psychoStaffEffects: [fmmc('NX0WE3tH2ZZPa9iI'), fmmc('EqdelDXgGy3Akw91')],
  sorcerousTremors: fmmc('zU6fU3xsjC6gU0MZ'),
  largerThanLife: fmmc('Gwhns0NfDQYhCVPK'),
  mystic: fmmc('SBlOGEnend5WYwgd'),
  sorcery: fmmc('xUBOE1s5pgVyUrwj'),
  // Intercontinental Adventures
  hobnailedBootEffects: [ia('ReeqwVjlTrE1VeJv'), ia('E9rtUBRIgt039HZN'), ia('4KC2IK7KNiyrWmQg')],
  ironClawEffects: [ia('3FNuMBoWp4WtgzsS'), ia('cApOuns5qiokKyQl'), ia('BCYK3w1QYgeyiz2r')],
  // Beneath the Helmet
  meleeWeaponEffects: [uuid('beneath_the_helmet', 'ipbTrbEZCVBKEXUS'), uuid('beneath_the_helmet', 'JsdC4NFStH1gfSft')],
  // G.I. Joe CRB drone upgrades
  basicDefenses: uuid('gi_joe_crb', 'CQYBJKyLfPIUp1JG'),
  advancedDefenses: uuid('gi_joe_crb', 'kow4o1ubo29p8b0D'),
  specializedDefenses: uuid('gi_joe_crb', 'qPYov7nAiPjYrD4Q'),
  // A Jump Through Time
  skyMorpher: uuid('jump_through_time', '2FlXYjY1AFSFq8Jz'),
  // My Little Pony CRB
  compassionate: uuid('mlp_crb', 'TARp0NItPetoMUv2'),
  // Sgt Slaughter Sourcebook
  alternateOfficer: uuid('sgt_slaughter_sourcebook', '5iH3ztH4sjqboZK5'),
};

export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? null;
}

export function itemsOf(actor) {
  const items = actor?.items;
  if (Array.isArray(items?.contents)) {
    return items.contents;
  }

  return items && typeof items[Symbol.iterator] == 'function' ? [...items] : [];
}

export function findSourced(actor, uuid) {
  return uuid ? itemsOf(actor).find(item => sourceOf(item) == uuid) ?? null : null;
}

export function escape(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Write to a document the user may not own (an attacked target) - through the GM when needed. */
export async function writeDoc(doc, method, args) {
  if (!doc) {
    return;
  }

  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(doc)) {
    await relayToGm(doc, method, args);
    return;
  }

  await doc[method](...args);
}

export function postLine(actor, content) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${content}</p>` });
}

/** The weapon an embedded weaponEffect belongs to. */
export function parentWeaponOf(actor, item) {
  const parentId = item?.flags?.essence20?.parentId;
  return parentId ? actor?.items?.get?.(parentId) ?? null : null;
}
