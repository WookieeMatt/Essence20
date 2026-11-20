import { addRacers, bump, normalizeRace, removeRacer, resetRace, standings, standingsHtml } from './race.mjs';

const token = (id, name) => ({ document: { id, name, texture: { src: `${id}.webp` } } });

test('a race is tidied: a known mode, one entry per token, whole counts', () => {
  expect(normalizeRace({ mode: 'drag', racers: [{ tokenId: 'a', name: 'Rhino', count: '2.7' }, { tokenId: 'a' }, { name: 'nobody' }] })).toEqual({
    mode: 'laps', hazardTable: '', hazardEachLap: false, racers: [{ tokenId: 'a', name: 'Rhino', img: '', count: 2 }],
  });
  expect(normalizeRace(undefined).racers).toEqual([]);
  expect(normalizeRace({ mode: 'lead', hazardEachLap: 1 })).toMatchObject({ mode: 'lead', hazardEachLap: true });
});

test('tokens join at 0; one already racing keeps its count; a racer can leave', () => {
  let race = addRacers({}, [token('a', 'Rhino'), token('b', 'Switchblade')]);
  race = bump(race, 'a', 2).race;
  race = addRacers(race, [token('a', 'Rhino'), { id: 'c', name: 'Jackhammer' }, null]);
  expect(race.racers.map(racer => `${racer.name}:${racer.count}`)).toEqual(['Rhino:2', 'Switchblade:0', 'Jackhammer:0']);
  expect(race.racers[0].img).toBe('a.webp');
  expect(removeRacer(race, 'b').racers.map(racer => racer.tokenId)).toEqual(['a', 'c']);
});

test('the leader reaching a new lap is the hazard\'s cue - in a race, not a chase', () => {
  let race = addRacers({}, [token('a', 'A'), token('b', 'B')]);
  let step = bump(race, 'a', 1);
  expect(step.newLap).toBe(true);
  step = bump(step.race, 'b', 1);
  expect(step.newLap).toBe(false);
  step = bump(step.race, 'a', -1);
  expect(step.newLap).toBe(false);
  expect(bump(step.race, 'zz', 5).race).toEqual(step.race);
  race = addRacers({ mode: 'lead' }, [token('a', 'A')]);
  expect(bump(race, 'a', 1).newLap).toBe(false);
});

test('laps stop at 0; a chase\'s lead can go below it', () => {
  expect(bump(addRacers({}, [token('a', 'A')]), 'a', -1).race.racers[0].count).toBe(0);
  expect(bump(addRacers({ mode: 'lead' }, [token('a', 'A')]), 'a', -2).race.racers[0].count).toBe(-2);
});

test('standings: best first, ties share a place; reset zeroes the counts', () => {
  let race = addRacers({}, [token('a', 'Thunderhawk'), token('b', 'Condor'), token('c', 'Rhino')]);
  race = bump(race, 'a', 3).race;
  race = bump(race, 'b', 3).race;
  race = bump(race, 'c', 1).race;
  expect(standings(race).map(racer => `${racer.place}:${racer.name}`)).toEqual(['1:Condor', '1:Thunderhawk', '3:Rhino']);
  expect(resetRace(race).racers.every(racer => racer.count == 0)).toBe(true);
  expect(resetRace(race).racers).toHaveLength(3);
});

test('the standings card is escaped and numbered by place', () => {
  let race = addRacers({}, [token('a', '<Rhino>'), token('b', 'Condor')]);
  race = bump(race, 'b', 1).race;
  expect(standingsHtml(race, { title: 'Race standings', unit: count => `${count} laps` }))
    .toBe('<h3>Race standings</h3><ol><li value="1">Condor: 1 laps</li><li value="2">&lt;Rhino&gt;: 0 laps</li></ol>');
  expect(standingsHtml({}, { title: 'Empty', unit: String })).toBe('<h3>Empty</h3>');
});
