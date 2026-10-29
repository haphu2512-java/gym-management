import { getLocalISODate } from './formatters';

// Trạng thái hội viên: 'Suspended' | 'Active' | 'Expired'.
// So sánh chuỗi YYYY-MM-DD theo ngày địa phương, tránh lệch múi giờ của new Date('YYYY-MM-DD').
export function getMemberStatus(member, today = getLocalISODate()) {
  if (member.suspended_at) return 'Suspended';
  const endDate = member.end_date ? String(member.end_date).slice(0, 10) : '';
  return endDate && endDate >= today ? 'Active' : 'Expired';
}
