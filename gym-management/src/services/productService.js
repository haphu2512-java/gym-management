import supabase from '../config/supabase';

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

  async sellOneBottle(product) {
    const currentStock = Number(product.stock_quantity || 0);
    if (currentStock <= 0) {
      throw new Error('Sản phẩm đã hết hàng.');
    }

    return this.updateProduct(product.id, { stock_quantity: currentStock - 1 });
  },

  async deleteProduct(id) {
    const { error } = await supabase.from(PRODUCT_TABLE).delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
