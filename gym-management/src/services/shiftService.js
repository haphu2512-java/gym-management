import supabase from '../config/supabase';
import { staffLogService } from './staffLogService';
import { getLocalISODate } from '../utils/formatters';

const SHIFT_TABLE = 'shifts';

const DEFAULT_SHIFTS = ['Ca 1', 'Ca 2', 'Ca 3', 'Ca 4', 'Ca 5'];

function formatDateKey(date = new Date()) {
  return getLocalISODate(date);
}

export const shiftService = {
  shiftOptions: DEFAULT_SHIFTS,

  async getLatestShifts(limit = 20) {
    const { data, error } = await supabase
      .from(SHIFT_TABLE)
      .select('*')
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

  async openShift({ shiftName, startingCash = 0, note = '', staffId = null }) {
    // Check if there is already an open shift
    const { data: openShifts, error: checkError } = await supabase
      .from(SHIFT_TABLE)
      .select('id, shift_name')
      .eq('status', 'open');

    if (checkError) throw new Error(checkError.message);
    if (openShifts && openShifts.length > 0) {
      throw new Error(`Đã có ca "${openShifts[0].shift_name}" đang mở. Vui lòng chốt ca cũ trước khi mở ca mới.`);
    }

    const shiftTimeMap = {
      'Ca 1': { start: '05:00:00', end: '09:00:00' },
      'Ca 2': { start: '09:00:00', end: '13:00:00' },
      'Ca 3': { start: '13:00:00', end: '17:00:00' },
      'Ca 4': { start: '17:00:00', end: '21:00:00' },
      'Ca 5': { start: '21:00:00', end: '23:00:00' },
    };

    const times = shiftTimeMap[shiftName] || { start: '00:00:00', end: '00:00:00' };

    const payload = {
      shift_name: shiftName,
      default_start: times.start,
      default_end: times.end,
      start_time: new Date().toISOString(),
      starting_cash: Number(startingCash || 0),
      status: 'open',
      opened_by: staffId,
      note,
    };

    const { data, error } = await supabase.from(SHIFT_TABLE).insert([payload]).select().single();
    if (error) throw new Error(error.message);

    await staffLogService.logAction({
      staffId,
      action: 'Mở ca trực',
      targetItem: shiftName,
      details: { startingCash },
      note: note || 'Mở ca mới',
      created_at: new Date().toISOString()
    });

    return data;
  },

  async closeShift({ shiftId, endingCash = 0, note = '', staffId = null, shiftName = '' }) {
    if (staffId) {
      const { data: shiftInfo } = await supabase.from(SHIFT_TABLE).select('opened_by').eq('id', shiftId).single();
      if (shiftInfo && shiftInfo.opened_by !== staffId) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', staffId).single();
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
      staffId,
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
        profiles:opened_by (full_name)
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
