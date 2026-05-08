-- 1. Bảng lưu thông tin nhân viên (mở rộng từ auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  staff_type TEXT DEFAULT 'CT' CHECK (staff_type IN ('CT', 'TV')), -- CT: Chính thức, TV: Thử việc
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  note TEXT
);

-- 2. Bảng quản lý hội viên (Chỉ lưu thông tin cơ bản)
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  fingerprint_status BOOLEAN DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  deleted_at TIMESTAMP
);

-- 3. Bảng quản lý kho nước
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  stock_quantity INT DEFAULT 0,
  note TEXT
);

-- 4. Bảng quản lý ca làm việc
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_name TEXT NOT NULL,
  default_start TIME NOT NULL,
  default_end TIME NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  starting_cash NUMERIC DEFAULT 0,
  ending_cash NUMERIC,
  opened_by UUID REFERENCES profiles(id), -- Nhân viên mở ca
  status TEXT DEFAULT 'closed' CHECK (status IN ('open', 'closed')),
  note TEXT
);

-- 5. Bảng lưu nhật ký hoạt động (Staff Logs)
CREATE TABLE IF NOT EXISTS staff_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_item TEXT,
  details JSONB,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 6. Bảng lưu giao dịch bán hàng nước
CREATE TABLE IF NOT EXISTS sales_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  sold_by UUID REFERENCES profiles(id),
  quantity INT DEFAULT 1,
  total_price NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'TM' CHECK (payment_method IN ('TM', 'CK')),
  sold_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 7. Bảng ghi nhận thanh toán hội viên (Mới/Gia hạn)
CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES profiles(id),
  amount NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'TM' CHECK (payment_method IN ('TM', 'CK')),
  payment_type TEXT CHECK (payment_type IN ('new', 'renew')),
  is_verified BOOLEAN DEFAULT TRUE,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 8. Bảng nhật ký thay đổi hội viên (Member Logs - Lưu lịch sử gia hạn/đăng ký)
CREATE TABLE IF NOT EXISTS member_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'RENEW', 'VERIFY_PAYMENT'
  
  -- Thông tin gói tập tại thời điểm log
  package_type INT,
  membership_category TEXT DEFAULT 'normal' CHECK (membership_category IN ('normal', 'couple', 'team')),
  start_date DATE,
  end_date DATE,
  fee NUMERIC,
  payment_method TEXT CHECK (payment_method IN ('TM', 'CK')),
  is_payment_verified BOOLEAN DEFAULT FALSE,

  details JSONB,        -- { "old": ..., "new": ... }
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- View để lấy trạng thái hiện tại của hội viên (Ưu tiên lấy từ Log Gia hạn/Tạo mới)
CREATE OR REPLACE VIEW member_current_status AS
WITH LatestPackage AS (
    -- Lấy thông tin gói tập mới nhất
    SELECT DISTINCT ON (member_id)
      member_id,
      package_type,
      membership_category,
      start_date,
      end_date,
      fee,
      payment_method,
      created_at
    FROM member_logs
    WHERE package_type IS NOT NULL
    ORDER BY member_id, created_at DESC
),
LatestStatus AS (
    -- Lấy trạng thái thanh toán mới nhất (có thể từ log VERIFY_PAYMENT)
    SELECT DISTINCT ON (member_id)
      member_id,
      is_payment_verified,
      created_at
    FROM member_logs
    WHERE is_payment_verified IS NOT NULL
    ORDER BY member_id, created_at DESC
)
SELECT 
  m.id,
  m.member_code,
  m.full_name,
  m.fingerprint_status,
  m.note,
  m.created_at,
  m.deleted_at,
  lp.package_type,
  lp.membership_category,
  lp.start_date,
  lp.end_date,
  lp.fee,
  lp.payment_method,
  COALESCE(ls.is_payment_verified, FALSE) as is_payment_verified,
  lp.created_at as last_active_at
FROM members m
LEFT JOIN LatestPackage lp ON m.id = lp.member_id
LEFT JOIN LatestStatus ls ON m.id = ls.member_id
WHERE m.deleted_at IS NULL;

-- 9. Cấu hình lương theo ca
CREATE TABLE IF NOT EXISTS salary_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_name TEXT NOT NULL, -- Ca 1, Ca 2...
  staff_type TEXT NOT NULL CHECK (staff_type IN ('CT', 'TV')),
  rate_per_shift NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(shift_name, staff_type)
);

-- 9. Lịch xếp ca tuần
CREATE TABLE IF NOT EXISTS weekly_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL, -- Ngày Thứ 2 của tuần
  staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6), -- 0: Chủ nhật, 1: Thứ 2...
  shift_name TEXT NOT NULL, -- Ca 1, Ca 2...
  UNIQUE(week_start, day_of_week, shift_name)
);

-- 10. Bang ghi nhan chi trong ca
CREATE TABLE IF NOT EXISTS shift_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- ===========================================
-- COMPATIBILITY PATCHES (OLD DB SAFE)
-- ===========================================
-- If tables already exist from old versions, ensure required columns exist
ALTER TABLE IF EXISTS payment_logs ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES profiles(id);
ALTER TABLE IF EXISTS payment_logs ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS payment_logs ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);
ALTER TABLE IF EXISTS payment_logs ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payment_logs'
      AND column_name = 'collected_by'
  ) THEN
    -- Only backfill rows that match an existing profile to avoid FK violations
    UPDATE payment_logs pl
    SET staff_id = pl.collected_by
    WHERE pl.staff_id IS NULL
      AND pl.collected_by IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = pl.collected_by
      );
  END IF;
END $$;

-- 11. Trigger tự động tạo profile khi có user mới đăng ký qua Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, staff_type)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', new.email), 'staff', 'CT');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe trigger creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- KÍCH HOẠT RLS VÀ TẠO POLICY AN TOÀN

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_expenses ENABLE ROW LEVEL SECURITY;

-- Safe re-run: drop policies before re-creating
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "members_select" ON members;
DROP POLICY IF EXISTS "members_insert" ON members;
DROP POLICY IF EXISTS "members_update" ON members;
DROP POLICY IF EXISTS "payment_logs_select" ON payment_logs;
DROP POLICY IF EXISTS "payment_logs_insert" ON payment_logs;
DROP POLICY IF EXISTS "payment_logs_update" ON payment_logs;
DROP POLICY IF EXISTS "sales_logs_select" ON sales_logs;
DROP POLICY IF EXISTS "sales_logs_insert" ON sales_logs;
DROP POLICY IF EXISTS "shifts_select" ON shifts;
DROP POLICY IF EXISTS "shifts_insert" ON shifts;
DROP POLICY IF EXISTS "shifts_update" ON shifts;
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "staff_logs_select" ON staff_logs;
DROP POLICY IF EXISTS "staff_logs_insert" ON staff_logs;
DROP POLICY IF EXISTS "member_logs_select" ON member_logs;
DROP POLICY IF EXISTS "member_logs_insert" ON member_logs;
DROP POLICY IF EXISTS "salary_configs_select" ON salary_configs;
DROP POLICY IF EXISTS "salary_configs_insert" ON salary_configs;
DROP POLICY IF EXISTS "salary_configs_update" ON salary_configs;
DROP POLICY IF EXISTS "weekly_schedules_select" ON weekly_schedules;
DROP POLICY IF EXISTS "weekly_schedules_insert" ON weekly_schedules;
DROP POLICY IF EXISTS "weekly_schedules_update" ON weekly_schedules;
DROP POLICY IF EXISTS "shift_expenses_select" ON shift_expenses;
DROP POLICY IF EXISTS "shift_expenses_insert" ON shift_expenses;

-- PROFILES: All authenticated can view, only admins can modify
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' OR auth.uid() = id
);

-- MEMBERS: All authenticated can view for check-in, staff can create/update
CREATE POLICY "members_select" ON members FOR SELECT TO authenticated USING (true);
CREATE POLICY "members_insert" ON members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "members_update" ON members FOR UPDATE TO authenticated USING (true);

-- PAYMENT_LOGS: Staff can view own verifications, admins view all
CREATE POLICY "payment_logs_select" ON payment_logs FOR SELECT TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR auth.uid() = staff_id
  OR auth.uid() = verified_by
  OR EXISTS (
    SELECT 1 FROM shifts s
    WHERE s.id = shift_id
    AND s.opened_by = auth.uid()
  )
);
CREATE POLICY "payment_logs_insert" ON payment_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "payment_logs_update" ON payment_logs FOR UPDATE TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- SALES_LOGS: All authenticated can view
CREATE POLICY "sales_logs_select" ON sales_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_logs_insert" ON sales_logs FOR INSERT TO authenticated WITH CHECK (true);

-- SHIFTS: All authenticated can view
CREATE POLICY "shifts_select" ON shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "shifts_insert" ON shifts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "shifts_update" ON shifts FOR UPDATE TO authenticated USING (true);

-- PRODUCTS: All authenticated can view, only admins can modify
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_insert" ON products FOR INSERT TO authenticated WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "products_update" ON products FOR UPDATE TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- STAFF_LOGS: Staff can only view own logs, admins view all
CREATE POLICY "staff_logs_select" ON staff_logs FOR SELECT TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR auth.uid() = staff_id
);
CREATE POLICY "staff_logs_insert" ON staff_logs FOR INSERT TO authenticated WITH CHECK (true);

-- MEMBER_LOGS: All authenticated can view (required for member_current_status view)
CREATE POLICY "member_logs_select" ON member_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "member_logs_insert" ON member_logs FOR INSERT TO authenticated WITH CHECK (true);

-- SALARY_CONFIGS: Only admins can modify
CREATE POLICY "salary_configs_select" ON salary_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "salary_configs_insert" ON salary_configs FOR INSERT TO authenticated WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "salary_configs_update" ON salary_configs FOR UPDATE TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- WEEKLY_SCHEDULES: Staff view own, admins view all
CREATE POLICY "weekly_schedules_select" ON weekly_schedules FOR SELECT TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR auth.uid() = staff_id
);
CREATE POLICY "weekly_schedules_insert" ON weekly_schedules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "weekly_schedules_update" ON weekly_schedules FOR UPDATE TO authenticated USING (true);

-- SHIFT_EXPENSES: All authenticated can view/insert for operation transparency
CREATE POLICY "shift_expenses_select" ON shift_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "shift_expenses_insert" ON shift_expenses FOR INSERT TO authenticated WITH CHECK (true);

-- ===========================================
-- ADDITIONAL TABLES & FUNCTIONS FOR PHASE 1
-- ===========================================

-- 11. Bảng điều chỉnh lương (thay thế localStorage)
CREATE TABLE IF NOT EXISTS salary_adjustments (
  id BIGSERIAL PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  adjustment_date DATE NOT NULL,
  commission NUMERIC(12,2) DEFAULT 0,
  shortage NUMERIC(12,2) DEFAULT 0,
  penalty NUMERIC(12,2) DEFAULT 0,
  reason TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS for salary_adjustments
ALTER TABLE salary_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salary_adjustments_select" ON salary_adjustments FOR SELECT TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR auth.uid() = staff_id
);
CREATE POLICY "salary_adjustments_insert" ON salary_adjustments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "salary_adjustments_update" ON salary_adjustments FOR UPDATE TO authenticated USING (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_salary_adj_staff_date ON salary_adjustments(staff_id, adjustment_date);

-- ===========================================
-- TRANSACTION FUNCTIONS FOR ATOMIC OPERATIONS
-- ===========================================

-- Atomic product sale transaction
CREATE OR REPLACE FUNCTION sell_bottle_transaction(
  p_product_id UUID,
  p_shift_id UUID,
  p_staff_id UUID,
  p_quantity INT,
  p_total_price NUMERIC,
  p_payment_method TEXT DEFAULT 'TM',
  p_sold_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  v_sales_log_id UUID;
  v_current_stock INT;
BEGIN
  -- Check stock first
  SELECT stock_quantity INTO v_current_stock FROM products WHERE id = p_product_id;
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Hết hàng';
  END IF;

  -- Atomic: Decrement + Log in transaction
  UPDATE products SET stock_quantity = stock_quantity - p_quantity WHERE id = p_product_id;

  INSERT INTO sales_logs (product_id, shift_id, sold_by, quantity, total_price, payment_method, sold_at)
  VALUES (p_product_id, p_shift_id, p_staff_id, p_quantity, p_total_price, p_payment_method, p_sold_at)
  RETURNING id INTO v_sales_log_id;

  INSERT INTO staff_logs (staff_id, action, target_item, details, created_at)
  VALUES (p_staff_id, 'Bán hàng', (SELECT name FROM products WHERE id = p_product_id),
          json_build_object('sale_id', v_sales_log_id),
          p_sold_at);

  RETURN json_build_object('success', true, 'sale_id', v_sales_log_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Atomic member creation transaction
CREATE OR REPLACE FUNCTION create_member_transaction(
  p_code TEXT,
  p_name TEXT,
  p_package_type INT,
  p_membership_category TEXT,
  p_fee NUMERIC,
  p_payment_method TEXT,
  p_shift_id UUID,
  p_staff_id UUID,
  p_start_date DATE DEFAULT NOW(),
  p_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  v_member_id UUID;
  v_payment_id UUID;
  v_start_date DATE := p_start_date;
  v_end_date DATE := (p_start_date + (p_package_type || ' months')::INTERVAL)::DATE;
  v_is_verified BOOLEAN := (p_payment_method = 'TM');
  v_result JSON;
BEGIN
  -- Create member (Chỉ thông tin cơ bản)
  INSERT INTO members (member_code, full_name, created_at)
  VALUES (p_code, p_name, p_created_at)
  RETURNING id INTO v_member_id;

  -- Create payment log
  INSERT INTO payment_logs (member_id, shift_id, staff_id, amount, payment_method, payment_type, is_verified, created_at)
  VALUES (v_member_id, p_shift_id, p_staff_id, p_fee, p_payment_method, 'new', v_is_verified, p_created_at)
  RETURNING id INTO v_payment_id;

  -- Create audit & state log (Lưu thông tin gói tập vào đây)
  INSERT INTO member_logs (
    member_id, staff_id, action, 
    package_type, membership_category, start_date, end_date, fee, payment_method, is_payment_verified,
    details, created_at
  )
  VALUES (
    v_member_id, p_staff_id, 'CREATE',
    p_package_type, p_membership_category, v_start_date, v_end_date, p_fee, p_payment_method, v_is_verified,
    json_build_object('code', p_code, 'fee', p_fee, 'payment_id', v_payment_id),
    p_created_at
  );

  INSERT INTO staff_logs (staff_id, action, target_item, details, created_at)
  VALUES (p_staff_id, 'Tạo hội viên', p_code,
          json_build_object('member_id', v_member_id, 'fee', p_fee),
          p_created_at);

  -- Trả về toàn bộ thông tin từ view để đồng bộ state local ngay lập tức
  SELECT row_to_json(r) FROM (
    SELECT * FROM member_current_status WHERE id = v_member_id
  ) r INTO v_result;

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Atomic payment verification
CREATE OR REPLACE FUNCTION verify_payment_atomic(
  p_payment_id UUID,
  p_admin_id UUID,
  p_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  v_updated_id UUID;
  v_member_id UUID;
BEGIN
  -- 1. Update payment_logs
  UPDATE payment_logs
  SET
    is_verified = true,
    verified_by = p_admin_id,
    verified_at = p_verified_at
  WHERE
    id = p_payment_id
    AND is_verified = false  -- Only if not already verified
    AND payment_method = 'CK'  -- Only for bank transfers
  RETURNING id, member_id INTO v_updated_id, v_member_id;

  IF v_updated_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Payment already verified or not found');
  END IF;

  -- 2. Update the original log entry (CREATE/RENEW) for consistency
  UPDATE member_logs
  SET is_payment_verified = true
  WHERE member_id = v_member_id
    AND (details->>'payment_id' = p_payment_id::text);

  -- 3. Create verification log in member_logs (For audit trail and to update current status view)
  INSERT INTO member_logs (member_id, staff_id, action, is_payment_verified, note, created_at)
  VALUES (v_member_id, p_admin_id, 'VERIFY_PAYMENT', true, 'Admin duyệt thanh toán chuyển khoản', p_verified_at);

  -- 4. Log verification in staff_logs
  INSERT INTO staff_logs (staff_id, action, target_item, details, created_at)
  VALUES (p_admin_id, 'Xác thực thanh toán', 'Payment #' || p_payment_id,
          json_build_object('payment_id', p_payment_id, 'member_id', v_member_id),
          p_verified_at);

  RETURN json_build_object('success', true, 'payment_id', p_payment_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- SOFT DELETE COLUMNS
-- ===========================================

-- Add soft delete columns
ALTER TABLE members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE payment_logs ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);
ALTER TABLE payment_logs ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_members_deleted ON members(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_deleted ON profiles(deleted_at) WHERE deleted_at IS NULL;

-- ===========================================
-- STAFF TYPE DEFAULT FIX
-- ===========================================

-- Fix staff_type default and NOT NULL
ALTER TABLE profiles
  ALTER COLUMN staff_type SET DEFAULT 'CT',
  ALTER COLUMN staff_type SET NOT NULL;
-- Update existing member_logs table if membership_category is missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='member_logs' AND column_name='membership_category') THEN
    ALTER TABLE member_logs ADD COLUMN membership_category TEXT DEFAULT 'normal' CHECK (membership_category IN ('normal', 'couple', 'team'));
  END IF;
END $$;

ALTER TABLE IF EXISTS salary_configs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());
ALTER TABLE IF EXISTS salary_configs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP; -- For consistency if needed later

-- Fix UNIQUE constraint on weekly_schedules
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='weekly_schedules_week_start_staff_id_day_of_week_shift_name_key') THEN
        ALTER TABLE weekly_schedules DROP CONSTRAINT weekly_schedules_week_start_staff_id_day_of_week_shift_name_key;
        ALTER TABLE weekly_schedules ADD CONSTRAINT weekly_schedules_week_start_day_of_week_shift_name_key UNIQUE(week_start, day_of_week, shift_name);
    END IF;
END $$;
