import {
  FORMATION_TIMING,
  constructionFraction,
  formationTimeline,
  letterVertexIndexes,
  reducedFormationTimeline,
  vertexArrivalFractions,
} from '../creationMotion';
import { formationForLetters } from '@/stores/v2/creationStore';
import { distillIntention } from '@/utils/sigil/distillation';

const formationOf = (intention: string, category: Parameters<typeof formationForLetters>[1]) =>
  formationForLetters(distillIntention(intention).finalLetters, category);

const SAMPLES = [
  formationOf('I am the man of the year', 'desire'),
  formationOf('I finish the project', 'career'),
  formationOf('Calm', 'spirituality'),
  formationOf('I build a calm, generous, deeply connected family life with patience and trust', 'family'),
];

describe('formationTimeline', () => {
  it('gives the construction itself three to four seconds, whatever the intention', () => {
    for (const formation of SAMPLES) {
      const timeline = formationTimeline(formation.vertices);
      if (formation.vertices.length < 2) continue;
      const construct = (timeline.constructEnd - timeline.constructStart) * timeline.total;
      expect(construct).toBeGreaterThanOrEqual(FORMATION_TIMING.constructMin - 1);
      expect(construct).toBeLessThanOrEqual(FORMATION_TIMING.constructMax + 1);
    }
  });

  it('runs square → mapping → construction → breathing → recession, in that order', () => {
    const timeline = formationTimeline(SAMPLES[0].vertices);
    expect(timeline.gridEnd).toBeLessThanOrEqual(timeline.departures[0]);
    expect(Math.max(...timeline.landings)).toBeLessThan(timeline.constructStart);
    expect(timeline.constructEnd).toBeLessThan(timeline.settleStart);
    // The finished geometry holds (the "breath") before the grid recedes.
    expect((timeline.settleStart - timeline.constructEnd) * timeline.total).toBeCloseTo(FORMATION_TIMING.breathe, 0);
    expect(timeline.settleStart).toBeLessThan(1);
  });

  it('carries letters in order, each leaving before the next', () => {
    const { departures, landings } = formationTimeline(SAMPLES[0].vertices);
    for (let i = 1; i < departures.length; i += 1) expect(departures[i]).toBeGreaterThan(departures[i - 1]);
    departures.forEach((departure, i) => expect(landings[i]).toBeGreaterThan(departure));
  });

  it('strictly enforces the causal chain: each letter lands before the next departs', () => {
    for (const formation of SAMPLES) {
      const { departures, landings } = formationTimeline(formation.vertices);
      for (let i = 1; i < departures.length; i += 1) {
        expect(departures[i]).toBeGreaterThan(landings[i - 1]);
      }
    }
  });


  it('draws the real path segment by segment, following the mapped order', () => {
    const { vertices } = SAMPLES[1];
    const timeline = formationTimeline(vertices);
    const along = vertexArrivalFractions(vertices);
    timeline.vertexArrivals.forEach((arrival, index) => {
      // When the line reaches a vertex, exactly the path up to that vertex has been drawn.
      expect(constructionFraction(arrival, timeline.clockIn, timeline.clockOut)).toBeCloseTo(along[index], 5);
    });
    for (let i = 1; i < timeline.vertexArrivals.length; i += 1) {
      expect(timeline.vertexArrivals[i]).toBeGreaterThan(timeline.vertexArrivals[i - 1]);
    }
  });

  it('pauses at each point before drawing on', () => {
    const { vertices } = SAMPLES[1];
    const timeline = formationTimeline(vertices);
    const pause = FORMATION_TIMING.vertexPause / timeline.total;
    const inner = timeline.vertexArrivals.slice(1, -1);
    for (const arrival of inner) {
      const held = constructionFraction(arrival + pause * 0.9, timeline.clockIn, timeline.clockOut);
      expect(held).toBeCloseTo(constructionFraction(arrival, timeline.clockIn, timeline.clockOut), 6);
    }
  });

  it('never draws backwards and ends with the whole path', () => {
    const timeline = formationTimeline(SAMPLES[3].vertices);
    let last = 0;
    for (let p = 0; p <= 1; p += 0.002) {
      const drawn = constructionFraction(p, timeline.clockIn, timeline.clockOut);
      expect(drawn).toBeGreaterThanOrEqual(last - 1e-9);
      last = drawn;
    }
    expect(constructionFraction(1, timeline.clockIn, timeline.clockOut)).toBe(1);
  });

  it('scales every stage by the pace without changing the order', () => {
    const full = formationTimeline(SAMPLES[0].vertices, 1);
    const quick = formationTimeline(SAMPLES[0].vertices, 0.8);
    expect(quick.total).toBeCloseTo(full.total * 0.8, 3);
    expect(quick.constructStart).toBeCloseTo(full.constructStart, 6);
  });

  it('keeps reduced motion short and staged', () => {
    const reduced = reducedFormationTimeline(5);
    expect(reduced.total).toBeLessThanOrEqual(1200);
    expect(reduced.landings).toHaveLength(5);
    expect(constructionFraction(1, reduced.clockIn, reduced.clockOut)).toBe(1);
  });
});

describe('letterVertexIndexes', () => {
  it('pairs each distilled letter with the vertex it became', () => {
    const letters = distillIntention('I am the man of the year').finalLetters;
    const formation = formationForLetters(letters, 'desire');
    const indexes = letterVertexIndexes(letters, formation.vertices.map((vertex) => vertex.letter));
    expect(indexes).toEqual(letters.map((_, i) => i));
  });
});
