import { distillLandingRate, LANDING_RATE_MAX } from '../CreationStage';

it('caps pitch at 1.48 across 30 Distill landings', () => {
  const rates = Array.from({ length: 30 }, (_, index) => distillLandingRate(index));
  expect(Math.max(...rates)).toBe(LANDING_RATE_MAX);
  expect(rates.every((rate) => rate <= 1.48)).toBe(true);
});
