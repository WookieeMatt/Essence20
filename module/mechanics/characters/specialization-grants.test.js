import { existingSpecialization, grantSpecializationUpdate, releaseSpecializationsUpdate } from './specialization-grants.mjs';

/** Specializations a rule step gives and takes back (specialization-grants.mjs). */

const slug = name => name.toLowerCase().replace(/[^a-z]/g, '');
const DELETE = Symbol('delete');
const SPEC = path => `system.skills.athletics.specializations.${path}`;
const PERK = 'Actor.a.Item.perk';
const GEAR = 'Actor.a.Item.gear';

/** The fields and flags an actor would have after an update (enough for these tests). */
function apply(state, update) {
  const next = { fields: { ...state.fields, specializations: { ...state.fields.specializations } }, flags: { ...state.flags } };
  for (const [path, value] of Object.entries(update ?? {})) {
    if (path.startsWith('flags.essence20.')) {
      next.flags[path.slice('flags.essence20.'.length)] = value;
    } else {
      const key = path.split('.').pop();
      if (value === DELETE) {
        delete next.fields.specializations[key];
      } else {
        next.fields.specializations[key] = value;
      }
    }
  }

  return next;
}

const fresh = (specializations = {}) => ({ fields: { shift: 'd6', specializations }, flags: {} });
const grant = (state, until, source = null, name = 'Climbing') => grantSpecializationUpdate({ ...state, skill: 'athletics', name, until, source, slug });

describe('existingSpecialization', () => {
  test('by name, any case; none: null', () => {
    expect(existingSpecialization({ climbing: { name: 'Climbing' } }, ' climbing ')).toBe('climbing');
    expect(existingSpecialization({ climbing: { name: 'Climbing' } }, 'Swimming')).toBeNull();
    expect(existingSpecialization(undefined, 'x')).toBeNull();
    expect(existingSpecialization({}, '')).toBeNull();
  });
});

describe('until "item"', () => {
  test("given at the Skill's die, listed against the item; deleting the item takes it back", () => {
    const update = grant(fresh(), 'item', PERK);
    expect(update[SPEC('climbing')]).toMatchObject({ name: 'Climbing', shift: 'd6', isSpecialized: true, granted: true });
    const state = apply(fresh(), update);
    expect(state.flags.grantedSpecializations).toEqual([{ skill: 'athletics', key: 'climbing', item: PERK }]);
    // Given again by the same item: nothing.
    expect(grant(state, 'item', PERK)).toBeNull();

    const released = releaseSpecializationsUpdate(state.flags, PERK, { deletion: DELETE });
    expect(apply(state, released).fields.specializations).toEqual({});
    expect(apply(state, released).flags.grantedSpecializations).toEqual([]);
    expect(releaseSpecializationsUpdate(state.flags, GEAR)).toBeNull();
  });

  test("the character's own Specialization of that name: no copy, and the item never takes it away", () => {
    const own = fresh({ climbing: { name: 'Climbing', shift: 'd8' } });
    expect(grant(own, 'item', PERK)).toBeNull();
    expect(releaseSpecializationsUpdate(own.flags, PERK)).toBeNull();
  });

  test('two items giving the same one share it - it goes with the last', () => {
    let state = apply(fresh(), grant(fresh(), 'item', PERK));
    state = apply(state, grant(state, 'item', GEAR));
    expect(Object.keys(state.fields.specializations)).toEqual(['climbing']);
    state = apply(state, releaseSpecializationsUpdate(state.flags, PERK, { deletion: DELETE }));
    expect(Object.keys(state.fields.specializations)).toEqual(['climbing']);
    state = apply(state, releaseSpecializationsUpdate(state.flags, GEAR, { deletion: DELETE }));
    expect(state.fields.specializations).toEqual({});
  });

  test("a scene grant of the same one becomes the item's, so the scene's end doesn't take it", () => {
    const scene = apply(fresh(), grant(fresh(), 'scene'));
    const state = apply(scene, grant(scene, 'item', PERK));
    expect(state.flags.bestowedExpertise).toEqual([]);
    expect(state.flags.grantedSpecializations).toEqual([{ skill: 'athletics', key: 'climbing', item: PERK }]);
  });

  test('only one Skill or one key taken back when asked; no item, nothing given', () => {
    let state = apply(fresh(), grant(fresh(), 'item', PERK));
    state = apply(state, grant(state, 'item', PERK, 'Running'));
    const one = releaseSpecializationsUpdate(state.flags, PERK, { skill: 'athletics', key: 'running', deletion: DELETE });
    expect(Object.keys(apply(state, one).fields.specializations)).toEqual(['climbing']);
    expect(releaseSpecializationsUpdate(state.flags, PERK, { skill: 'culture' })).toBeNull();
    expect(grant(fresh(), 'item', null)).toBeNull();
  });
});

describe('until "scene"', () => {
  test('listed for the scene sweep; a Skill that has one of that name gets no second copy', () => {
    const update = grant(fresh(), 'scene');
    expect(update['flags.essence20.bestowedExpertise']).toEqual([{ skill: 'athletics', key: 'climbing' }]);
    expect(grant(fresh({ c: { name: 'climbing' } }), 'scene')).toBeNull();
    expect(grant(fresh(), undefined)).toEqual(update);
  });
});
