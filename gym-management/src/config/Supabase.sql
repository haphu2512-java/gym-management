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
  member_code TEXT UNIQUE NOT NULL,
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
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  sold_by UUID REFERENCES profiles(id),
  sold_by_member UUID REFERENCES staff_members(id),
  quantity INT DEFAULT 1,
  total_price NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'TM' CHECK (payment_method IN ('TM', 'CK')),
  sold_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff_members(id),
  amount NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'TM' CHECK (payment_method IN ('TM', 'CK')),
  payment_type TEXT CHECK (payment_type IN ('new', 'renew')),
  is_verified BOOLEAN DEFAULT TRUE,
  verified_by UUID REFERENCES profiles(id),
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
CREATE OR REPLACE VIEW member_current_status AS
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
  lp.created_at as last_active_at
FROM members m
LEFT JOIN LatestPackage lp ON m.id = lp.member_id
LEFT JOIN LatestStatus ls ON m.id = ls.member_id
WHERE m.deleted_at IS NULL;

-- ============================================================
-- 6. FUNCTIONS (Logic nghiệp vụ)
-- ============================================================

-- A. Duyệt thanh toán CK (Atomic)
CREATE OR REPLACE FUNCTION verify_payment_atomic(p_payment_id UUID, p_admin_id UUID, p_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())
RETURNS JSON AS $$
DECLARE
  v_updated_id UUID; v_member_id UUID; v_already_verified BOOLEAN := FALSE;
BEGIN
  UPDATE payment_logs SET is_verified = true, verified_by = p_admin_id, verified_at = p_verified_at
  WHERE id = p_payment_id AND (is_verified = false OR is_verified IS NULL) AND payment_method = 'CK'
  RETURNING id, member_id INTO v_updated_id, v_member_id;

  IF v_updated_id IS NULL THEN
    SELECT member_id, is_verified INTO v_member_id, v_already_verified FROM payment_logs WHERE id = p_payment_id;
    IF v_member_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Không tìm thấy thanh toán.'); END IF;
  END IF;

  UPDATE member_logs SET is_payment_verified = true WHERE member_id = v_member_id AND (details->>'payment_id' = p_payment_id::text);
  
  IF v_already_verified = FALSE OR v_updated_id IS NOT NULL THEN
    INSERT INTO member_logs (member_id, staff_id, action, is_payment_verified, note, created_at)
    VALUES (v_member_id, p_admin_id, 'VERIFY_PAYMENT', true, 'Admin duyệt thanh toán', p_verified_at);
  END IF;
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Bán hàng nước (Atomic)
CREATE OR REPLACE FUNCTION sell_bottle_transaction(p_product_id UUID, p_shift_id UUID, p_staff_id UUID, p_quantity INT, p_total_price NUMERIC, p_payment_method TEXT, p_sold_at TIMESTAMP WITH TIME ZONE)
RETURNS JSON AS $$
DECLARE v_sale_id UUID;
BEGIN
  IF (SELECT stock_quantity FROM products WHERE id = p_product_id) < p_quantity THEN RAISE EXCEPTION 'Hết hàng'; END IF;
  UPDATE products SET stock_quantity = stock_quantity - p_quantity WHERE id = p_product_id;
  INSERT INTO sales_logs (product_id, shift_id, sold_by_member, quantity, total_price, payment_method, sold_at)
  VALUES (p_product_id, p_shift_id, p_staff_id, p_quantity, p_total_price, p_payment_method, p_sold_at) RETURNING id INTO v_sale_id;
  RETURN json_build_object('success', true, 'sale_id', v_sale_id);
END;
$$ LANGUAGE plpgsql;

-- C. Bảo lưu hội viên
CREATE OR REPLACE FUNCTION suspend_member(p_member_id UUID, p_staff_id UUID, p_suspended_at DATE DEFAULT CURRENT_DATE, p_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())
RETURNS JSON AS $$
DECLARE v_remaining_days INT; v_end_date DATE;
BEGIN
  SELECT (end_date - p_suspended_at) INTO v_remaining_days FROM member_current_status WHERE id = p_member_id;
  IF v_remaining_days < 13 THEN RAISE EXCEPTION 'Không đủ điều kiện (tối thiểu 13 ngày)'; END IF;
  UPDATE members SET suspended_at = p_suspended_at, remaining_days = v_remaining_days WHERE id = p_member_id;
  INSERT INTO member_logs (member_id, staff_member_id, action, note, created_at)
  VALUES (p_member_id, p_staff_id, 'SUSPEND', 'Bảo lưu (còn ' || v_remaining_days || ' ngày)', p_created_at);
  INSERT INTO staff_logs (staff_member_id, action, target_item, details, created_at)
  VALUES (p_staff_id, 'Bảo lưu hội viên', (SELECT full_name FROM members WHERE id = p_member_id), json_build_object('days', v_remaining_days), p_created_at);
  RETURN json_build_object('success', true, 'days', v_remaining_days);
END;
$$ LANGUAGE plpgsql;

-- D. Kích hoạt lại
CREATE OR REPLACE FUNCTION reactivate_member(p_member_id UUID, p_staff_id UUID, p_reactivated_at DATE DEFAULT CURRENT_DATE, p_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())
RETURNS JSON AS $$
DECLARE v_days INT; v_new_end DATE;
BEGIN
  SELECT remaining_days INTO v_days FROM members WHERE id = p_member_id;
  v_new_end := p_reactivated_at + (v_days || ' days')::INTERVAL;
  UPDATE members SET suspended_at = NULL, remaining_days = 0 WHERE id = p_member_id;
  INSERT INTO member_logs (member_id, staff_member_id, action, package_type, start_date, end_date, note, created_at)
  VALUES (p_member_id, p_staff_id, 'REACTIVATE', 0, p_reactivated_at, v_new_end, 'Kích hoạt lại sau bảo lưu', p_created_at);
  RETURN json_build_object('success', true, 'new_end', v_new_end);
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
ALTER TABLE sales_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Full access staff_members" ON staff_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access members" ON members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access shifts" ON shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access logs" ON staff_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access sales" ON sales_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access payments" ON payment_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access m_logs" ON member_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access schedule" ON weekly_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access salary_cfg" ON salary_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access salary_adj" ON salary_adjustments FOR ALL TO authenticated USING (true) WITH CHECK (true);
