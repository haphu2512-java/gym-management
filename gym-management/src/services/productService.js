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

  async sellProduct(product, quantity, shiftId, userId, paymentMethod = 'TM') {
    const qty = Number(quantity || 1);
    // Use atomic transaction function
    const { data, error } = await supabase.rpc('sell_bottle_transaction', {
      p_product_id: product.id,
      p_shift_id: shiftId,
      p_staff_id: userId,
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

  async getFilteredSalesLogs(filters = {}) {
    let query = supabase
      .from('sales_logs')
      .select(`
        *,
        products (name),
        profiles:sold_by (full_name),
        shifts!inner (shift_name)
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
    
    query = query.limit(200);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },
};

