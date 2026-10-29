import { describe, expect, it } from 'vitest';
import { getMemberStatus } from './memberStatus';

describe('getMemberStatus', () => {
  const today = '2026-10-29';

  it('bảo lưu được ưu tiên', () => {
    expect(getMemberStatus({ suspended_at: '2026-10-01', end_date: '2027-01-01' }, today)).toBe('Suspended');
  });
  it('còn hạn khi hết hạn hôm nay hoặc sau', () => {
    expect(getMemberStatus({ end_date: '2026-10-29' }, today)).toBe('Active');
    expect(getMemberStatus({ end_date: '2026-11-01' }, today)).toBe('Active');
  });
  it('hết hạn khi ngày kết thúc đã qua hoặc chưa có gói', () => {
    expect(getMemberStatus({ end_date: '2026-10-28' }, today)).toBe('Expired');
    expect(getMemberStatus({ end_date: null }, today)).toBe('Expired');
  });
});
