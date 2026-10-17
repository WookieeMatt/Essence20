import { teleportOptions } from './move-to.mjs';

describe('moveTo animate: false - a teleport Foundry records as one', () => {
  test("the move's one waypoint is Foundry's Displace action, where the token lands", () => {
    const document = { id: 'tok1', _source: { elevation: 5, width: 2, height: 2, depth: 2, shape: 0, level: 'l1' } };
    expect(teleportOptions(document, { x: 300, y: 400 })).toEqual({
      animate: false,
      movement: { tok1: { waypoints: [{
        x: 300, y: 400, elevation: 5, width: 2, height: 2, depth: 2, shape: 0, level: 'l1', action: 'displace',
        snapped: false, explicit: false, checkpoint: true,
      }] } },
    });
  });

  test('a token document without an id (a stand-in) just jumps', () => {
    expect(teleportOptions({}, { x: 1, y: 2 })).toEqual({ animate: false });
    expect(teleportOptions(null, { x: 1, y: 2 })).toEqual({ animate: false });
  });
});
