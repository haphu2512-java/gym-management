-- 1. Bảng lưu thông tin nhân viên (mở rộng từ auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  staff_type TEXT DEFAULT 'CT' CHECK (staff_type IN ('CT', 'TV')), -- CT: Chính thức, TV: Thử việc
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  note TEXT
);

-- 2. Bảng quản lý hội viên
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  package_type INT NOT NULL, 
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  fee NUMERIC NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('TM', 'CK')),
  is_payment_verified BOOLEAN DEFAULT FALSE,
  fingerprint_status BOOLEAN DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
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
  sold_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 8. Bảng nhật ký thay đổi hội viên (Member Logs)
CREATE TABLE IF NOT EXISTS member_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'RENEW', 'VERIFY_PAYMENT'
  details JSONB,        -- { "old": ..., "new": ... }
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 9. Cấu hình lương theo ca
CREATE TABLE IF NOT EXISTS salary_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_name TEXT NOT NULL, -- Ca 1, Ca 2...
  staff_type TEXT NOT NULL CHECK (staff_type IN ('CT', 'TV')),
  rate_per_shift NUMERIC NOT NULL,
  UNIQUE(shift_name, staff_type)
);

-- 9. Lịch xếp ca tuần
CREATE TABLE IF NOT EXISTS weekly_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL, -- Ngày Thứ 2 của tuần
  staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6), -- 0: Chủ nhật, 1: Thứ 2...
  shift_name TEXT NOT NULL, -- Ca 1, Ca 2...
  UNIQUE(week_start, staff_id, day_of_week, shift_name)
);

-- 10. Bang ghi nhan chi trong ca
CREATE TABLE IF NOT EXISTS shift_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
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

-- MEMBER_LOGS: Only admins can view
CREATE POLICY "member_logs_select" ON member_logs FOR SELECT TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
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
  p_total_price NUMERIC
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

  INSERT INTO sales_logs (product_id, shift_id, sold_by, quantity, total_price)
  VALUES (p_product_id, p_shift_id, p_staff_id, p_quantity, p_total_price)
  RETURNING id INTO v_sales_log_id;

  INSERT INTO staff_logs (staff_id, action, target_item, details)
  VALUES (p_staff_id, 'Bán hàng', (SELECT name FROM products WHERE id = p_product_id),
          json_build_object('sale_id', v_sales_log_id));

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
  p_fee NUMERIC,
  p_payment_method TEXT,
  p_shift_id UUID,
  p_staff_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_member_id UUID;
  v_payment_id UUID;
BEGIN
  -- Create member
  INSERT INTO members (member_code, full_name, package_type, fee, start_date, end_date, payment_method, is_payment_verified)
  VALUES (p_code, p_name, p_package_type, p_fee, NOW()::DATE,
          (NOW() + (p_package_type || ' months')::INTERVAL)::DATE, p_payment_method,
          (p_payment_method = 'TM'))
  RETURNING id INTO v_member_id;

  -- Create payment log
  INSERT INTO payment_logs (member_id, shift_id, staff_id, amount, payment_method, payment_type, is_verified)
  VALUES (v_member_id, p_shift_id, p_staff_id, p_fee, p_payment_method, 'new', (p_payment_method = 'TM'))
  RETURNING id INTO v_payment_id;

  -- Create audit logs
  INSERT INTO member_logs (member_id, staff_id, action, details)
  VALUES (v_member_id, p_staff_id, 'CREATE',
          json_build_object('code', p_code, 'fee', p_fee, 'payment_id', v_payment_id));

  INSERT INTO staff_logs (staff_id, action, target_item, details)
  VALUES (p_staff_id, 'Tạo hội viên', p_code,
          json_build_object('member_id', v_member_id, 'fee', p_fee));

  RETURN json_build_object('success', true, 'member_id', v_member_id, 'payment_id', v_payment_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Atomic payment verification
CREATE OR REPLACE FUNCTION verify_payment_atomic(
  p_payment_id UUID,
  p_admin_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE payment_logs
  SET
    is_verified = true,
    verified_by = p_admin_id,
    verified_at = NOW()
  WHERE
    id = p_payment_id
    AND is_verified = false  -- Only if not already verified
    AND payment_method = 'CK'  -- Only for bank transfers
  RETURNING id INTO v_updated;

  IF v_updated IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Payment already verified or not found');
  END IF;

  -- Log verification
  INSERT INTO staff_logs (staff_id, action, target_item, details)
  VALUES (p_admin_id, 'Xác thực thanh toán', 'Payment #' || p_payment_id,
          json_build_object('payment_id', p_payment_id));

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

-- Update existing NULLs
UPDATE profiles SET staff_type = 'CT' WHERE staff_type IS NULL;
