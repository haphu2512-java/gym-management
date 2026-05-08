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

  async sellOneBottle(product, shiftId, userId, paymentMethod = 'TM') {
    // Use atomic transaction function
    const { data, error } = await supabase.rpc('sell_bottle_transaction', {
      p_product_id: product.id,
      p_shift_id: shiftId,
      p_staff_id: userId,
      p_quantity: 1,
      p_total_price: Number(product.price || 0),
      p_payment_method: paymentMethod
    });

    if (error) throw new Error('Bán hàng thất bại: ' + error.message);
    if (!data.success) throw new Error(data.error || 'Bán hàng thất bại');

    return data;
  },

  async deleteProduct(id) {
    // Use soft delete instead of hard delete
    const { error } = await supabase
      .from(PRODUCT_TABLE)
      .update({ deleted_at: new Date() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getDrinkRevenueForShift(shiftId) {
    if (!shiftId) return 0;
    const { data, error } = await supabase
      .from('sales_logs')
      .select('total_price')
      .eq('shift_id', shiftId);
    if (error) throw new Error(error.message);
    return data.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  },
};

