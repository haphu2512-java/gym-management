-- 1. Tạo bảng services
CREATE TABLE IF NOT EXISTS services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  note TEXT,
  deleted_at TIMESTAMP
);

-- 2. Tạo bảng service_sales
CREATE TABLE IF NOT EXISTS service_sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  sold_by UUID REFERENCES profiles(id),
  sold_by_member UUID REFERENCES staff_members(id),
  quantity INT DEFAULT 1,
  total_price NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'TM' CHECK (payment_method IN ('TM', 'CK')),
  sold_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tạo hàm bán dịch vụ (Atomic)
CREATE OR REPLACE FUNCTION sell_service_transaction(p_service_id UUID, p_shift_id UUID, p_auth_id UUID, p_staff_id UUID, p_quantity INT, p_total_price NUMERIC, p_payment_method TEXT, p_sold_at TIMESTAMP WITH TIME ZONE)
RETURNS JSON AS $$
DECLARE v_sale_id UUID;
BEGIN
  INSERT INTO service_sales (service_id, shift_id, sold_by, sold_by_member, quantity, total_price, payment_method, sold_at)
  VALUES (p_service_id, p_shift_id, p_auth_id, p_staff_id, p_quantity, p_total_price, p_payment_method, p_sold_at) RETURNING id INTO v_sale_id;
  RETURN json_build_object('success', true, 'sale_id', v_sale_id);
END;
$$ LANGUAGE plpgsql;

-- 4. Bật RLS và phân quyền
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Full access services" ON services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access service_sales" ON service_sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
