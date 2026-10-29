import { describe, expect, it } from 'vitest';
import { computeHandoverCash } from './handoverCash';

describe('computeHandoverCash', () => {
  it('đầu ca + các khoản thu tiền mặt - chi', () => {
    expect(computeHandoverCash({ startingCash: 500000, memberCash: 350000, serviceCash: 50000, drinkCash: 30000, expenses: 20000 }))
      .toBe(910000);
  });
  it('trừ khoản hoàn tiền (số âm trong thu hội viên)', () => {
    expect(computeHandoverCash({ startingCash: 500000, memberCash: 350000 - 300000 })).toBe(550000);
  });
  it('chịu được giá trị rỗng hoặc chuỗi', () => {
    expect(computeHandoverCash({ startingCash: '100000', memberCash: null, expenses: undefined })).toBe(100000);
  });
});
