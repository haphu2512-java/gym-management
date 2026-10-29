import { describe, expect, it } from 'vitest';
import { addMonths, formatDate, formatMemberCode, getLocalISODate } from './formatters';

describe('addMonths', () => {
  it('cộng tháng bình thường', () => {
    expect(getLocalISODate(addMonths('2026-01-15', 1))).toBe('2026-02-15');
    expect(getLocalISODate(addMonths('2026-11-15', 3))).toBe('2027-02-15');
  });

  it('kẹp ngày cuối tháng giống Postgres', () => {
    expect(getLocalISODate(addMonths('2026-01-31', 1))).toBe('2026-02-28');
    expect(getLocalISODate(addMonths('2028-01-31', 1))).toBe('2028-02-29');
    expect(getLocalISODate(addMonths('2026-03-31', 1))).toBe('2026-04-30');
    expect(getLocalISODate(addMonths('2026-08-31', 6))).toBe('2027-02-28');
  });

  it('nhận cả Date object', () => {
    expect(getLocalISODate(addMonths(new Date(2026, 0, 10), 12))).toBe('2027-01-10');
  });
});

describe('getLocalISODate', () => {
  it('trả về ngày theo giờ địa phương', () => {
    expect(getLocalISODate(new Date(2026, 9, 29, 0, 30))).toBe('2026-10-29');
    expect(getLocalISODate(new Date(2026, 9, 29, 23, 59))).toBe('2026-10-29');
  });
});

describe('formatDate', () => {
  it('chuỗi YYYY-MM-DD không bị lệch múi giờ', () => {
    expect(formatDate('2026-10-29')).toBe('29-10-2026');
  });
  it('rỗng thì trả rỗng', () => {
    expect(formatDate(null)).toBe('');
  });
});

describe('formatMemberCode', () => {
  it('ẩn mã của hội viên đã xóa', () => {
    expect(formatMemberCode('HV01_del_1761700000000')).toBe('Đã xóa');
    expect(formatMemberCode('HV01')).toBe('HV01');
  });
});
