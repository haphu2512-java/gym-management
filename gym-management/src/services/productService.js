import supabase from '../config/supabase';
import { staffLogService } from './staffLogService';

const PRODUCT_TABLE = 'products';

export const productService = {
  async getAllProducts() {
    const { data, error } = await supabase
      .from(PRODUCT_TABLE)
      .select('*')
      .is('deleted_at', null)
      .order('name');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async addProduct(payload) {
    const { data, error } = await supabase.from(PRODUCT_TABLE).insert([payload]).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateProduct(id, payload) {
    const { data, error } = await supabase
      .from(PRODUCT_TABLE)
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async sellProduct(product, quantity, shiftId, authId, staffId, paymentMethod = 'TM') {
    const qty = Number(quantity || 1);
    // Use atomic transaction function
    const { data, error } = await supabase.rpc('sell_bottle_transaction', {
      p_product_id: product.id,
      p_shift_id: shiftId,
      p_auth_id: authId,
      p_staff_id: staffId,
      p_quantity: qty,
      p_total_price: Number(product.price || 0) * qty,
      p_payment_method: paymentMethod,
      p_sold_at: new Date().toISOString()
    });

    if (error) throw new Error('Bán hàng thất bại: ' + error.message);
    if (data?.success === false) throw new Error(data.error || 'Bán hàng thất bại');

    return data;
  },

  async deleteProduct(id) {
    // Use soft delete instead of hard delete
    const { error } = await supabase
      .from(PRODUCT_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getDrinkRevenueForShift(shiftId, paymentMethod = null) {
    if (!shiftId) return 0;
    let query = supabase
      .from('sales_logs')
      .select('total_price')
      .eq('shift_id', shiftId);
    
    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  },

  async getTotalDrinkRevenue(filters = {}) {
    let query = supabase
      .from('sales_logs')
      .select('total_price');

    if (filters.startDate) {
      query = query.gte('sold_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('sold_at', filters.endDate);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  },

  async getFilteredSalesLogs(filters = {}) {
    let query = supabase
      .from('sales_logs')
      .select(`
        *,
        products (name),
        profiles:sold_by (full_name),
        staff_members:sold_by_member (full_name),
        shifts!inner (id, shift_name, status)
      `)
      .order('sold_at', { ascending: false });

    if (filters.date) {
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
    
    query = query.limit(200);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async rollbackSale(saleId, authId, staffId, activeShiftId) {
    // 1. Lấy thông tin bản ghi bán hàng kèm theo trạng thái ca làm
    const { data: sale, error: fetchError } = await supabase
      .from('sales_logs')
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

    // 3. Lấy tồn kho hiện tại của sản phẩm để cộng dồn chính xác
    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', sale.product_id)
      .single();

    if (prodError || !product) {
      throw new Error('Không lấy được thông tin tồn kho sản phẩm: ' + (prodError?.message || 'Unknown'));
    }

    // 4. Cộng trả lại số lượng vào kho
    const { error: stockUpdateError } = await supabase
      .from('products')
      .update({ stock_quantity: Number(product.stock_quantity || 0) + Number(sale.quantity || 1) })
      .eq('id', sale.product_id);

    if (stockUpdateError) {
      throw new Error('Cập nhật tồn kho thất bại: ' + stockUpdateError.message);
    }

    // 5. Xóa nhật ký bán hàng trong sales_logs
    const { error: deleteError } = await supabase
      .from('sales_logs')
      .delete()
      .eq('id', saleId);

    if (deleteError) {
      // Revert lại số lượng tồn kho nếu xóa nhật ký thất bại
      await supabase
        .from('products')
        .update({ stock_quantity: product.stock_quantity })
        .eq('id', sale.product_id);
      throw new Error('Xóa lịch sử bán hàng thất bại: ' + deleteError.message);
    }

    return { success: true };
  },
};

