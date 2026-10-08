import { isWisdomOfTheEldersActive } from './wisdom-of-the-elders.mjs';

const makeActor = flag => ({ getFlag: (scope, key) => (scope == 'essence20' && key == 'wisdomOfTheEldersActive' ? flag : undefined) });

describe("isWisdomOfTheEldersActive", () => {
  test("reads one option of the flag the item's Use rules write", () => {
    const actor = makeActor({ lightshieldArmor: true, resilientArmor: false });
    expect(isWisdomOfTheEldersActive(actor, 'lightshieldArmor')).toBe(true);
    expect(isWisdomOfTheEldersActive(actor, 'resilientArmor')).toBe(false);
    expect(isWisdomOfTheEldersActive(actor, 'lightfoilWings')).toBe(false);
    expect(isWisdomOfTheEldersActive(makeActor(undefined), 'lightshieldArmor')).toBe(false);
  });
});
