import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateMemberDates } from './memberService';

describe('validateMemberDates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 29, 9, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('chấp nhận gói 1–36 tháng kết thúc trong tương lai', async () => {
    await expect(validateMemberDates('2026-10-29', 1)).resolves.toBe(true);
    await expect(validateMemberDates('2026-10-29', 36)).resolves.toBe(true);
  });
  it('từ chối gói ngoài khoảng 1–36', async () => {
    await expect(validateMemberDates('2026-10-29', 0)).rejects.toThrow('tối thiểu 1 tháng');
    await expect(validateMemberDates('2026-10-29', 37)).rejects.toThrow('tối đa 36 tháng');
  });
  it('từ chối ngày kết thúc ở quá khứ, trừ khi gia hạn từ ngày hết hạn', async () => {
    await expect(validateMemberDates('2026-01-01', 1)).rejects.toThrow('không được ở quá khứ');
    await expect(validateMemberDates('2026-01-01', 1, true)).resolves.toBe(true);
  });
});
