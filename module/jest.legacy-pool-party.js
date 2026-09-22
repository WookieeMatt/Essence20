import { jest } from '@jest/globals';

/**
 * A stand-in primary Party for unit tests, whose Story Point pool is the mocked world setting.
 *
 * The pool lives on the primary Party actor (helpers/story-points.mjs, helpers/party.mjs). Suites
 * written before it moved there express it as the world setting it used to be -
 * `game.settings.get = jest.fn(() => 2)` meant two Story Points - so this Party reads its pool
 * from that mock and those suites keep meaning what they say. It is not an owner, so a spend
 * still goes to the GM over the socket, which is also what they assert. A suite that cares
 * about ownership or the real fields sets `game.actors.party` itself.
 *
 * Shared between jest.setup.js and the suites that rebuild `global.game` from scratch.
 * @returns {Object}
 */
export function legacyPoolParty() {
  return {
    type: "party",
    name: "Party",
    isOwner: false,
    get system() {
      return {
        storyPoints: Number(game.settings?.get("essence20", "sptStoryPoints")) || 0,
        gmPoints: Number(game.settings?.get("essence20", "sptGmPoints")) || 0,
      };
    },
    update: jest.fn(async () => {}),
  };
}
