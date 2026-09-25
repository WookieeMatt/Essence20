import { E20 } from './config.mjs';

// Table 8-1: Equipment Availability (GI Joe CRB p.139), read off the printed table.
describe("E20.availabilityDifficulties", () => {
  test("matches the printed Requisition Difficulties", () => {
    expect(E20.availabilityDifficulties).toEqual({
      automatic: 0,
      standard: 0,
      limited: 10,
      restricted: 15,
      prototype: 20,
      unique: 25,
      theoretical: 30,
      other: 0,
    });
  });

  // A tier without a Difficulty would silently mis-price whatever rolled against it.
  test("covers every availability tier the schema allows", () => {
    expect(Object.keys(E20.availabilityDifficulties).sort())
      .toEqual(Object.keys(E20.availabilities).sort());
  });
});
