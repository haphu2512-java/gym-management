import supabase from '../config/supabase';
import { staffLogService } from './staffLogService';

const PRODUCT_TABLE = 'products';

export const productService = {
  async getAllProducts() {
    const { data, error } = await supabase.from(PRODUCT_TABLE).select('*').order('name');
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

  async sellOneBottle(product, shiftId, userId) {
    const currentStock = Number(product.stock_quantity || 0);
    if (currentStock <= 0) {
      throw new Error('Sản phẩm đã hết hàng.');
    }

    const { data: updatedProduct, error: updateError } = await supabase
      .from(PRODUCT_TABLE)
      .update({ stock_quantity: currentStock - 1 })
      .eq('id', product.id)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);

    const { error: logError } = await supabase.from('sales_logs').insert([{
      product_id: product.id,
      shift_id: shiftId || null,
      sold_by: userId || null,
      quantity: 1,
      total_price: Number(product.price || 0)
    }]);

    if (logError) console.error('Failed to log sale:', logError);

    await staffLogService.logAction({
      staffId: userId,
      action: 'Bán hàng',
      targetItem: product.name,
      details: { price: product.price, shift_id: shiftId },
      note: 'Bán 1 chai ' + product.name
    });

    return updatedProduct;
  },

  async deleteProduct(id) {
    const { error } = await supabase.from(PRODUCT_TABLE).delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

