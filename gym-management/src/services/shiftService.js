import supabase from '../config/supabase';
import { staffLogService } from './staffLogService';
import { getLocalISODate } from '../utils/formatters';

const SHIFT_TABLE = 'shifts';

const DEFAULT_SHIFTS = ['Ca 1', 'Ca 2', 'Ca 3', 'Ca 4', 'Ca 5'];

// Ca 1: 5-8h, Ca 2: 9-11h, Ca 3: 13-16h, Ca 4: 16-19h, Ca 5: 19-22h
const SHIFT_TIME_MAP = {
  'Ca 1': { start: '05:00', end: '09:00', label: '5:00 - 9:00 sáng' },
  'Ca 2': { start: '09:00', end: '12:00', label: '9:00 - 12:00 trưa' },
  'Ca 3': { start: '13:00', end: '16:00', label: '13:00 - 16:00 chiều' },
  'Ca 4': { start: '16:00', end: '19:00', label: '16:00 - 19:00 chiều' },
  'Ca 5': { start: '19:00', end: '22:00', label: '19:00 - 22:00 tối' },
};

function validateShiftTime(shiftName, allowOverride = false) {
  if (allowOverride) return; // Admin có thể bỏ qua nếu cần

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTotal = currentHour * 60 + currentMinute;

  const schedule = SHIFT_TIME_MAP[shiftName];
  if (!schedule) return; // Nếu không tìm thấy thì bỏ qua

  const [startH, startM] = schedule.start.split(':').map(Number);
  const [endH, endM] = schedule.end.split(':').map(Number);
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  // Cho phép mở sớm 30 phút trước giờ bắt đầu ca
  const tolerance = 30;
  if (currentTotal < startTotal - tolerance || currentTotal > endTotal) {
    throw new Error(
      `Không thể mở ${shiftName} lúc này. ${shiftName} chỉ được mở trong khung giờ ${schedule.label}. Giờ hiện tại: ${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}.`
    );
  }
}

function formatDateKey(date = new Date()) {
  return getLocalISODate(date);
}

export const shiftService = {
  shiftOptions: DEFAULT_SHIFTS,
  shiftTimeMap: SHIFT_TIME_MAP,

  async getLatestShifts(limit = 20) {
    const { data, error } = await supabase
      .from(SHIFT_TABLE)
      .select(`
        *,
        profiles:opened_by (full_name),
        staff_members:opened_by_member (id, full_name, staff_type)
      `)
      .not('start_time', 'is', null)
      .order('start_time', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getTodayShifts() {
    const now = new Date();
    const startObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const start = startObj.toISOString();
    const end = endObj.toISOString();

    const { data, error } = await supabase
      .from(SHIFT_TABLE)
      .select('*')
      .gte('start_time', start)
      .lte('start_time', end)
      .order('start_time', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async validateShiftForLogin() {
    const shifts = await this.getTodayShifts();
    const active = shifts.find((item) => item.status === 'open');
    return { valid: Boolean(active), shift: active || null };
  },

  async openShift({ shiftName, startingCash = 0, note = '', authId = null, staffId = null, skipTimeCheck = false }) {
    // authId: id tài khoản đăng nhập (Admin/Staff)
    // staffId: id nhân viên thực tế chọn từ dropdown (staff_members)

    // Validate thời gian mở ca
    validateShiftTime(shiftName, skipTimeCheck);

    // Check if there is already an open shift
    const { data: openShifts, error: checkError } = await supabase
      .from(SHIFT_TABLE)
      .select('id, shift_name')
      .eq('status', 'open');

    if (checkError) throw new Error(checkError.message);
    if (openShifts && openShifts.length > 0) {
      throw new Error(`Đã có ca "${openShifts[0].shift_name}" đang mở. Vui lòng chốt ca cũ trước khi mở ca mới.`);
    }

    const times = SHIFT_TIME_MAP[shiftName] || { start: '00:00', end: '00:00' };

    const payload = {
      shift_name: shiftName,
      default_start: times.start + ':00',
      default_end: times.end + ':00',
      start_time: new Date().toISOString(),
      starting_cash: Number(startingCash || 0),
      status: 'open',
      opened_by: authId,
      opened_by_member: staffId,
      note,
    };

    const { data, error } = await supabase.from(SHIFT_TABLE).insert([payload]).select().single();
    if (error) throw new Error(error.message);

    await staffLogService.logAction({
      staffId: authId,
      staffMemberId: staffId,
      action: 'Mở ca trực',
      targetItem: shiftName,
      details: { startingCash },
      note: note || 'Mở ca mới',
      created_at: new Date().toISOString()
    });

    return data;
  },

  async closeShift({ shiftId, endingCash = 0, note = '', authId = null, staffId = null, shiftName = '' }) {
    if (authId) {
      const { data: shiftInfo } = await supabase.from(SHIFT_TABLE).select('opened_by').eq('id', shiftId).single();
      if (shiftInfo && shiftInfo.opened_by !== authId) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', authId).single();
        if (!profile || profile.role !== 'admin') {
          throw new Error('Bạn không có quyền chốt ca này. Chỉ người mở ca hoặc Quản lý mới có quyền chốt ca.');
        }
      }
    }

    const { data, error } = await supabase
      .from(SHIFT_TABLE)
      .update({
        ending_cash: Number(endingCash || 0),
        end_time: new Date().toISOString(),
        status: 'closed',
        note,
      })
      .eq('id', shiftId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await staffLogService.logAction({
      staffId: authId,
      staffMemberId: staffId,
      action: 'Chốt ca trực',
      targetItem: shiftName || data.shift_name,
      details: { endingCash },
      note: note || 'Chốt ca kết thúc',
      created_at: new Date().toISOString()
    });

    return data;
  },

  async getShiftSummary(shiftId) {
    // 1. Shift Basic Info
    const { data: shift, error: shiftError } = await supabase
      .from(SHIFT_TABLE)
      .select(`
        *,
        profiles:opened_by (full_name),
        staff_members:opened_by_member (id, full_name, staff_type)
      `)
      .eq('id', shiftId)
      .single();
    if (shiftError) throw new Error(shiftError.message);

    // 2. Member Payments (Registration/Renewal)
    const { data: payments, error: paymentError } = await supabase
      .from('payment_logs')
      .select(`
        *,
        members (member_code, full_name)
      `)
      .eq('shift_id', shiftId);
    if (paymentError) throw new Error(paymentError.message);

    // 3. Drink Sales
    const { data: sales, error: salesError } = await supabase
      .from('sales_logs')
      .select(`
        *,
        products (name)
      `)
      .eq('shift_id', shiftId);
    if (salesError) throw new Error(salesError.message);

    // 4. Expenses
    const { data: expenses, error: expenseError } = await supabase
      .from('shift_expenses')
      .select('*')
      .eq('shift_id', shiftId);
    if (expenseError) throw new Error(expenseError.message);

    return {
      shift,
      payments: payments || [],
      sales: sales || [],
      expenses: expenses || []
    };
  },
};
