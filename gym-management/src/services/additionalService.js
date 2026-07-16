import supabase from '../config/supabase';

const SERVICE_TABLE = 'services';

export const additionalService = {
  async getAllServices() {
    const { data, error } = await supabase
      .from(SERVICE_TABLE)
      .select('*')
      .is('deleted_at', null)
      .order('name');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async addService(payload) {
    const { data, error } = await supabase.from(SERVICE_TABLE).insert([payload]).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateService(id, payload) {
    const { data, error } = await supabase
      .from(SERVICE_TABLE)
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async sellService(service, quantity, shiftId, authId, staffId, paymentMethod = 'TM') {
    const qty = Number(quantity || 1);
    const { data, error } = await supabase.rpc('sell_service_transaction', {
      p_service_id: service.id,
      p_shift_id: shiftId,
      p_auth_id: authId,
      p_staff_id: staffId,
      p_quantity: qty,
      p_total_price: Number(service.price || 0) * qty,
      p_payment_method: paymentMethod,
      p_sold_at: new Date().toISOString()
    });

    if (error) throw new Error('Bán dịch vụ thất bại: ' + error.message);
    if (data?.success === false) throw new Error(data.error || 'Bán dịch vụ thất bại');

    return data;
  },

  async deleteService(id) {
    const { error } = await supabase
      .from(SERVICE_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getServiceRevenueForShift(shiftId, paymentMethod = null) {
    if (!shiftId) return 0;
    let query = supabase
      .from('service_sales')
      .select('total_price')
      .eq('shift_id', shiftId);
    
    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  },

  async getFilteredServiceLogs(filters = {}) {
    let query = supabase
      .from('service_sales')
      .select(`
        *,
        services (name),
        profiles:sold_by (full_name),
        staff_members:sold_by_member (full_name),
        shifts!inner (id, shift_name, status)
      `)
      .order('sold_at', { ascending: false });

    if (filters.startDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      query = query.gte('sold_at', start.toISOString());
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('sold_at', end.toISOString());
    }
    if (filters.date && !filters.startDate && !filters.endDate) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.gte('sold_at', startOfDay.toISOString())
                   .lte('sold_at', endOfDay.toISOString());
    }

    if (filters.shiftName) {
      query = query.eq('shifts.shift_name', filters.shiftName);
    }

    if (filters.paymentMethod) {
      query = query.eq('payment_method', filters.paymentMethod);
    }
    
    const lim = filters.limit !== undefined ? filters.limit : (filters.startDate || filters.endDate ? null : 200);
    if (lim) {
      query = query.limit(lim);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async rollbackServiceSale(saleId, authId, staffId, activeShiftId) {
    // 1. Lấy thông tin bản ghi bán dịch vụ kèm theo trạng thái ca làm
    const { data: sale, error: fetchError } = await supabase
      .from('service_sales')
      .select('*, shifts(status)')
      .eq('id', saleId)
      .single();

    if (fetchError || !sale) {
      throw new Error('Không tìm thấy giao dịch hoặc lỗi: ' + (fetchError?.message || 'Unknown'));
    }

    // Lấy thông tin role của người dùng thực hiện
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authId)
      .single();

    const isAdmin = profile?.role === 'admin';

    // 2. Kiểm tra điều kiện bảo mật/quyền hạn
    if (!isAdmin) {
      const isShiftOpen = sale.shifts?.status === 'open';
      const isOwnSale = sale.sold_by === authId || (staffId && sale.sold_by_member === staffId);
      const isInActiveShift = activeShiftId && sale.shift_id === activeShiftId;

      if (!isShiftOpen || !isInActiveShift || !isOwnSale) {
        throw new Error('Bạn không có quyền hoàn tác giao dịch này (chỉ được hoàn tác giao dịch do chính bạn bán trong ca đang mở của bạn).');
      }
    }

    // 3. Xóa nhật ký bán dịch vụ trong service_sales
    const { error: deleteError } = await supabase
      .from('service_sales')
      .delete()
      .eq('id', saleId);

    if (deleteError) {
      throw new Error('Xóa lịch sử bán dịch vụ thất bại: ' + deleteError.message);
    }

    return { success: true };
  },
};
