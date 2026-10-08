import { registerUntil } from "../../expiry.mjs";

/**
 * Round 15 (items2): `until: "calendarDay"` - lasts until the real-world date changes (the ISO day the effect started
 * on). The "once per day per target" bucket the hand-written Preventative Measures kept (a list of treated ids keyed to
 * `new Date().toISOString().slice(0, 10)`), as a mark / bank / grant duration.
 */

/** Today's ISO date (UTC), the bucket the old code used. */
export function todayBucket(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

registerUntil('calendarDay', {
  stamp: () => ({ day: todayBucket() }),
  expired: stamp => stamp.day != todayBucket(),
});
