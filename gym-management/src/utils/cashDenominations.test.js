import { describe, expect, it } from 'vitest';
import { compactDenominations, sumDenominations } from './cashDenominations';

describe('sumDenominations', () => {
  it('cộng số tờ × mệnh giá', () => {
    expect(sumDenominations({ 500000: 1, 200000: 2, 10000: 1, 2000: 3 })).toBe(916000);
  });

  it('bỏ qua ô trống, số âm, số lẻ', () => {
    expect(sumDenominations({ 500000: '', 100000: -1, 50000: 1.5, 1000: '2' })).toBe(2000);
    expect(sumDenominations()).toBe(0);
  });
});

describe('compactDenominations', () => {
  it('chỉ giữ mệnh giá có số tờ', () => {
    expect(compactDenominations({ 500000: '1', 200000: '', 500: 0, 1000: 4 })).toEqual({ 500000: 1, 1000: 4 });
  });
});
