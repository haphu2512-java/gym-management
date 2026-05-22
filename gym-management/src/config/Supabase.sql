-- ============================================================
-- 1. AUTH & PROFILES (Dành cho 2 tài khoản đăng nhập Admin/Staff)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMP
);

-- ============================================================
-- 2. STAFF MEMBERS (Danh sách nhân viên để chọn khi mở ca)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  staff_type TEXT DEFAULT 'CT' CHECK (staff_type IN ('CT', 'TV')),
  note TEXT,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. CORE TABLES (Hội viên, Sản phẩm, Ca làm)
-- ============================================================
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  fingerprint_status BOOLEAN DEFAULT FALSE,
  note TEXT,
  suspended_at DATE,
  remaining_days INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  stock_quantity INT DEFAULT 0,
  image_url TEXT,
  note TEXT,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  note TEXT,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_name TEXT NOT NULL,
  default_start TIME NOT NULL,
  default_end TIME NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  starting_cash NUMERIC DEFAULT 0,
  ending_cash NUMERIC,
  opened_by UUID REFERENCES profiles(id), -- Account đăng nhập
  opened_by_member UUID REFERENCES staff_members(id), -- Nhân viên được chọn
  status TEXT DEFAULT 'closed' CHECK (status IN ('open', 'closed')),
  note TEXT
);

-- ============================================================
-- 3b. SHIFT EXPENSES (Quản lý chi tiêu trong ca)
-- ============================================================
CREATE TABLE IF NOT EXISTS shift_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS shift_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  created_by_member UUID REFERENCES staff_members(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- ============================================================
-- 4. LOGS & TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES profiles(id), -- Account
  staff_member_id UUID REFERENCES staff_members(id), -- Nhân viên trực
  action TEXT NOT NULL,
  target_item TEXT,
  details JSONB,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  sold_by UUID REFERENCES profiles(id), -- Tài khoản đăng nhập
  sold_by_member UUID REFERENCES staff_members(id), -- Nhân viên trực thực tế
  quantity INT NOT NULL,
  total_price NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'TM',
  sold_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS service_sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID REFERENCES services(id),
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  sold_by UUID REFERENCES profiles(id),
  sold_by_member UUID REFERENCES staff_members(id),
  quantity INT NOT NULL,
  total_price NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'TM',
  sold_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES profiles(id), -- Tài khoản đăng nhập
  staff_member_id UUID REFERENCES staff_members(id), -- Nhân viên trực thực tế
  amount NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'TM' CHECK (payment_method IN ('TM', 'CK')),
  payment_type TEXT CHECK (payment_type IN ('new', 'renew')),
  is_verified BOOLEAN DEFAULT TRUE,
  verified_by UUID REFERENCES profiles(id),
  verified_by_member UUID REFERENCES staff_members(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS member_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES profiles(id),
  staff_member_id UUID REFERENCES staff_members(id),
  action TEXT NOT NULL, 
  package_type INT,
  membership_category TEXT DEFAULT 'normal',
  start_date DATE,
  end_date DATE,
  fee NUMERIC,
  payment_method TEXT,
  is_payment_verified BOOLEAN DEFAULT NULL, -- NULL để tránh đè trạng thái
  details JSONB,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- ============================================================
-- 5. VIEW: MẶT BẰNG TRẠNG THÁI HỘI VIÊN (Quan trọng nhất)
-- ============================================================
CREATE OR REPLACE VIEW member_current_status 
WITH (security_invoker = true)
AS
WITH LatestPackage AS (
    SELECT DISTINCT ON (member_id)
      member_id, package_type, membership_category, start_date, end_date, fee, payment_method, created_at
    FROM member_logs
    WHERE package_type IS NOT NULL
    ORDER BY member_id, created_at DESC
),
LatestStatus AS (
    SELECT DISTINCT ON (member_id)
      member_id, is_payment_verified, created_at
    FROM member_logs
    WHERE is_payment_verified IS NOT NULL
    ORDER BY member_id, created_at DESC
)
SELECT 
  m.id, m.member_code, m.full_name, m.fingerprint_status, m.note, m.created_at, m.deleted_at,
  m.suspended_at, m.remaining_days,
  lp.package_type, lp.membership_category, lp.start_date, lp.end_date, lp.fee, lp.payment_method,
  COALESCE(ls.is_payment_verified, FALSE) as is_payment_verified,
  (
    SELECT ml.created_at 
    FROM member_logs ml 
    WHERE ml.member_id = m.id AND ml.action IN ('CREATE', 'RENEW') 
    ORDER BY ml.created_at DESC 
    LIMIT 1
  ) as last_active_at
FROM members m
LEFT JOIN LatestPackage lp ON m.id = lp.member_id
LEFT JOIN LatestStatus ls ON m.id = ls.member_id
WHERE m.deleted_at IS NULL;

-- ============================================================
-- 6. FUNCTIONS (Logic nghiệp vụ)
-- ============================================================

-- A. Duyệt thanh toán CK (Atomic)
CREATE OR REPLACE FUNCTION verify_payment_atomic(
  p_payment_id UUID, 
  p_admin_id UUID, 
  p_staff_member_id UUID DEFAULT NULL,
  p_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  v_updated_id UUID; v_member_id UUID; v_already_verified BOOLEAN := FALSE;
BEGIN
  UPDATE payment_logs 
  SET 
    is_verified = true, 
    verified_by = p_admin_id, 
    verified_by_member = p_staff_member_id,
    verified_at = p_verified_at
  WHERE id = p_payment_id AND (is_verified = false OR is_verified IS NULL) AND payment_method = 'CK'
  RETURNING id, member_id INTO v_updated_id, v_member_id;

  IF v_updated_id IS NULL THEN
    SELECT member_id, is_verified INTO v_member_id, v_already_verified FROM payment_logs WHERE id = p_payment_id;
    IF v_member_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Không tìm thấy thanh toán.'); END IF;
  END IF;

  UPDATE member_logs 
  SET is_payment_verified = true 
  WHERE member_id = v_member_id AND (details->>'payment_id' = p_payment_id::text);
  
  IF v_already_verified = FALSE OR v_updated_id IS NOT NULL THEN
    INSERT INTO member_logs (member_id, staff_id, staff_member_id, action, is_payment_verified, note, created_at)
    VALUES (v_member_id, p_admin_id, p_staff_member_id, 'VERIFY_PAYMENT', true, 'Admin duyệt thanh toán', p_verified_at);
  END IF;
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Bán hàng nước (Atomic)
CREATE OR REPLACE FUNCTION sell_bottle_transaction(p_product_id UUID, p_shift_id UUID, p_auth_id UUID, p_staff_id UUID, p_quantity INT, p_total_price NUMERIC, p_payment_method TEXT, p_sold_at TIMESTAMP WITH TIME ZONE)
RETURNS JSON AS $$
DECLARE v_sale_id UUID;
BEGIN
  IF (SELECT stock_quantity FROM products WHERE id = p_product_id) < p_quantity THEN RAISE EXCEPTION 'Hết hàng'; END IF;
  UPDATE products SET stock_quantity = stock_quantity - p_quantity WHERE id = p_product_id;
  INSERT INTO sales_logs (product_id, shift_id, sold_by, sold_by_member, quantity, total_price, payment_method, sold_at)
  VALUES (p_product_id, p_shift_id, p_auth_id, p_staff_id, p_quantity, p_total_price, p_payment_method, p_sold_at) RETURNING id INTO v_sale_id;
  RETURN json_build_object('success', true, 'sale_id', v_sale_id);
END;
$$ LANGUAGE plpgsql;

-- C. Bán Dịch Vụ (Tập ngày, Gói PT...) (Atomic)
CREATE OR REPLACE FUNCTION sell_service_transaction(p_service_id UUID, p_shift_id UUID, p_auth_id UUID, p_staff_id UUID, p_quantity INT, p_total_price NUMERIC, p_payment_method TEXT, p_sold_at TIMESTAMP WITH TIME ZONE)
RETURNS JSON AS $$
DECLARE v_sale_id UUID;
BEGIN
  INSERT INTO service_sales (service_id, shift_id, sold_by, sold_by_member, quantity, total_price, payment_method, sold_at)
  VALUES (p_service_id, p_shift_id, p_auth_id, p_staff_id, p_quantity, p_total_price, p_payment_method, p_sold_at) RETURNING id INTO v_sale_id;
  RETURN json_build_object('success', true, 'sale_id', v_sale_id);
END;
$$ LANGUAGE plpgsql;

-- C. Bảo lưu hội viên
CREATE OR REPLACE FUNCTION suspend_member(
  p_member_id UUID, 
  p_staff_id UUID, 
  p_shift_id UUID,
  p_suspended_at DATE DEFAULT CURRENT_DATE, 
  p_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE v_remaining_days INT; v_end_date DATE; v_admin_id UUID;
BEGIN
  -- Kiểm tra ca có tồn tại và đang mở không
  IF NOT EXISTS (SELECT 1 FROM shifts WHERE id = p_shift_id AND status = 'open') THEN
    RAISE EXCEPTION 'Ca làm việc không tồn tại hoặc đã đóng.';
  END IF;

  SELECT opened_by INTO v_admin_id FROM shifts WHERE id = p_shift_id;

  SELECT (end_date - p_suspended_at) INTO v_remaining_days FROM member_current_status WHERE id = p_member_id;
  IF v_remaining_days < 13 THEN RAISE EXCEPTION 'Không đủ điều kiện (tối thiểu 13 ngày)'; END IF;
  
  UPDATE members SET suspended_at = p_suspended_at, remaining_days = v_remaining_days WHERE id = p_member_id;
  
  INSERT INTO member_logs (member_id, staff_id, staff_member_id, action, note, created_at)
  VALUES (p_member_id, v_admin_id, p_staff_id, 'SUSPEND', 'Bảo lưu (còn ' || v_remaining_days || ' ngày)', p_created_at);
  
  INSERT INTO staff_logs (staff_id, staff_member_id, action, target_item, details, created_at)
  VALUES (v_admin_id, p_staff_id, 'Bảo lưu hội viên', (SELECT full_name FROM members WHERE id = p_member_id), json_build_object('days', v_remaining_days, 'shift_id', p_shift_id), p_created_at);
  
  RETURN json_build_object('success', true, 'days', v_remaining_days);
END;
$$ LANGUAGE plpgsql;

-- D. Kích hoạt lại
CREATE OR REPLACE FUNCTION reactivate_member(
  p_member_id UUID, 
  p_staff_id UUID, 
  p_shift_id UUID,
  p_reactivated_at DATE DEFAULT CURRENT_DATE, 
  p_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE v_days INT; v_new_end DATE; v_admin_id UUID;
BEGIN
  -- Kiểm tra ca có tồn tại và đang mở không
  IF NOT EXISTS (SELECT 1 FROM shifts WHERE id = p_shift_id AND status = 'open') THEN
    RAISE EXCEPTION 'Ca làm việc không tồn tại hoặc đã đóng.';
  END IF;

  SELECT opened_by INTO v_admin_id FROM shifts WHERE id = p_shift_id;

  SELECT remaining_days INTO v_days FROM members WHERE id = p_member_id;
  v_new_end := p_reactivated_at + (v_days || ' days')::INTERVAL;
  
  UPDATE members SET suspended_at = NULL, remaining_days = 0 WHERE id = p_member_id;
  
  INSERT INTO member_logs (member_id, staff_id, staff_member_id, action, package_type, start_date, end_date, note, created_at)
  VALUES (p_member_id, v_admin_id, p_staff_id, 'REACTIVATE', NULL, p_reactivated_at, v_new_end, 'Kích hoạt lại sau bảo lưu', p_created_at);
  
  RETURN json_build_object('success', true, 'new_end', v_new_end);
END;
$$ LANGUAGE plpgsql;

-- E. Tạo hội viên mới (Atomic)
CREATE OR REPLACE FUNCTION create_member_transaction(
  p_code TEXT, p_name TEXT, p_package_type INT, p_membership_category TEXT, 
  p_fee NUMERIC, p_payment_method TEXT, p_shift_id UUID, p_staff_id UUID, 
  p_fingerprint_status BOOLEAN, p_note TEXT, p_start_date DATE, p_created_at TIMESTAMP WITH TIME ZONE
) RETURNS JSON AS $$
DECLARE v_member_id UUID; v_payment_id UUID; v_end_date DATE;
BEGIN
  v_end_date := p_start_date + (p_package_type || ' months')::INTERVAL;
  INSERT INTO members (member_code, full_name, fingerprint_status, note, created_at)
  VALUES (p_code, p_name, p_fingerprint_status, p_note, p_created_at) RETURNING id INTO v_member_id;

  INSERT INTO member_logs (member_id, staff_id, staff_member_id, action, package_type, membership_category, start_date, end_date, fee, payment_method, is_payment_verified, created_at)
  VALUES (v_member_id, (SELECT opened_by FROM shifts WHERE id = p_shift_id), p_staff_id, 'CREATE', p_package_type, p_membership_category, p_start_date, v_end_date, p_fee, p_payment_method, (p_payment_method = 'TM'), p_created_at);

  INSERT INTO payment_logs (member_id, shift_id, staff_id, staff_member_id, amount, payment_method, payment_type, is_verified, created_at)
  VALUES (v_member_id, p_shift_id, (SELECT opened_by FROM shifts WHERE id = p_shift_id), p_staff_id, p_fee, p_payment_method, 'new', (p_payment_method = 'TM'), p_created_at) RETURNING id INTO v_payment_id;

  UPDATE member_logs SET details = jsonb_build_object('payment_id', v_payment_id) WHERE member_id = v_member_id AND action = 'CREATE';

  INSERT INTO staff_logs (staff_member_id, action, target_item, details, created_at)
  VALUES (p_staff_id, 'Tạo hội viên mới', p_name, json_build_object('code', p_code, 'fee', p_fee), p_created_at);

  RETURN json_build_object('success', true, 'member_id', v_member_id);
END;
$$ LANGUAGE plpgsql;

-- F. Gia hạn hội viên (Atomic)
CREATE OR REPLACE FUNCTION renew_member_transaction(
  p_member_id UUID, p_package_type INT, p_membership_category TEXT, 
  p_fee NUMERIC, p_payment_method TEXT, p_shift_id UUID, p_staff_id UUID, 
  p_start_date DATE, p_created_at TIMESTAMP WITH TIME ZONE
) RETURNS JSON AS $$
DECLARE v_payment_id UUID; v_end_date DATE; v_name TEXT;
BEGIN
  v_end_date := p_start_date + (p_package_type || ' months')::INTERVAL;
  SELECT full_name INTO v_name FROM members WHERE id = p_member_id;

  INSERT INTO member_logs (member_id, staff_id, staff_member_id, action, package_type, membership_category, start_date, end_date, fee, payment_method, is_payment_verified, created_at)
  VALUES (p_member_id, (SELECT opened_by FROM shifts WHERE id = p_shift_id), p_staff_id, 'RENEW', p_package_type, p_membership_category, p_start_date, v_end_date, p_fee, p_payment_method, (p_payment_method = 'TM'), p_created_at);

  INSERT INTO payment_logs (member_id, shift_id, staff_id, staff_member_id, amount, payment_method, payment_type, is_verified, created_at)
  VALUES (p_member_id, p_shift_id, (SELECT opened_by FROM shifts WHERE id = p_shift_id), p_staff_id, p_fee, p_payment_method, 'renew', (p_payment_method = 'TM'), p_created_at) RETURNING id INTO v_payment_id;

  UPDATE member_logs SET details = jsonb_build_object('payment_id', v_payment_id) WHERE member_id = p_member_id AND action = 'RENEW' AND created_at = p_created_at;

  INSERT INTO staff_logs (staff_member_id, action, target_item, details, created_at)
  VALUES (p_staff_id, 'Gia hạn hội viên', v_name, json_build_object('fee', p_fee, 'months', p_package_type), p_created_at);

  RETURN json_build_object('success', true, 'payment_id', v_payment_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. LƯƠNG & XẾP CA
-- ============================================================
CREATE TABLE IF NOT EXISTS salary_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_name TEXT NOT NULL,
  staff_type TEXT NOT NULL,
  rate_per_shift NUMERIC NOT NULL,
  UNIQUE(shift_name, staff_type)
);

CREATE TABLE IF NOT EXISTS weekly_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  staff_member_id UUID REFERENCES staff_members(id) ON DELETE CASCADE,
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
  shift_name TEXT NOT NULL,
  UNIQUE(week_start, day_of_week, shift_name)
);

CREATE TABLE IF NOT EXISTS salary_adjustments (
  id BIGSERIAL PRIMARY KEY,
  staff_member_id UUID REFERENCES staff_members(id) ON DELETE CASCADE,
  adjustment_date DATE NOT NULL,
  commission NUMERIC DEFAULT 0,
  shortage NUMERIC DEFAULT 0,
  penalty NUMERIC DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (staff_member_id, adjustment_date)
);

-- ============================================================
-- 8. RLS (Security) - Cho phép 2 tài khoản chung thao tác
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "View staff_members" ON staff_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage staff_members" ON staff_members FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);
CREATE POLICY "Full access members" ON members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access shifts" ON shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access expenses" ON shift_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access logs" ON staff_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access sales" ON sales_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access payments" ON payment_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access m_logs" ON member_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access schedule" ON weekly_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access salary_cfg" ON salary_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access salary_adj" ON salary_adjustments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access services" ON services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access service_sales" ON service_sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access shift_notes" ON shift_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 9. AUTH TRIGGERS (Tự động tạo Profile khi có User mới)
-- ============================================================

-- Xóa trigger cũ trước để tránh lỗi dependency khi cập nhật hàm
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Hàm xử lý khi có user mới
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.email), 
    'staff' -- Mặc định là nhân viên, admin sẽ chỉnh tay sau
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tạo lại trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 10. PERMISSIONS (Cấp quyền cho các role của Supabase)
-- ============================================================

-- Cấp quyền USAGE trên schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Cấp tất cả quyền trên các bảng hiện tại cho authenticated và service_role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- Cấp quyền SELECT cho anon (để có thể thực hiện một số kiểm tra trước khi đăng nhập nếu cần)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON TABLE shift_notes TO anon;
GRANT ALL PRIVILEGES ON TABLE shift_notes TO authenticated, service_role;

-- Đảm bảo các bảng tạo mới trong tương lai cũng được cấp quyền tự động
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;

