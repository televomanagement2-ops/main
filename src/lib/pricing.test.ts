import { describe, it, expect } from 'vitest';
import { computeOrderTotals } from './pricing';

describe('computeOrderTotals', () => {
  it('returns no tax when the rate is 0 (template default)', () => {
    const r = computeOrderTotals(79, 0, 0);
    expect(r.tax).toBe(0);
    expect(r.total).toBe(79);
  });

  it('applies a flat rate to subtotal + shipping', () => {
    const r = computeOrderTotals(100, 10, 0.07);
    expect(r.tax).toBe(7.7); // (100 + 10) * 0.07
    expect(r.total).toBe(117.7);
  });

  it('rounds tax and total to the cent', () => {
    const r = computeOrderTotals(19.99, 0, 0.0825);
    expect(r.tax).toBe(1.65); // 19.99 * 0.0825 = 1.649175 → 1.65
    expect(r.total).toBe(21.64);
  });

  it('treats a negative or invalid rate as 0', () => {
    expect(computeOrderTotals(50, 5, -0.1).tax).toBe(0);
    expect(computeOrderTotals(50, 5, Number.NaN).total).toBe(55);
  });

  it('never produces negative amounts from bad input', () => {
    const r = computeOrderTotals(-100, -5, 0.1);
    expect(r.subtotal).toBe(0);
    expect(r.shipping).toBe(0);
    expect(r.total).toBe(0);
  });

  it('matches the server tax base (subtotal + shipping, not subtotal only)', () => {
    const r = computeOrderTotals(200, 50, 0.1);
    expect(r.tax).toBe(25); // (200 + 50) * 0.1, not 200 * 0.1
  });
});
