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
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 8. Cấu hình lương theo ca
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

-- KÍCH HOẠT RLS VÀ TẠO POLICY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Profiles Access" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Members Access" ON members FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Products Access" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Shifts Access" ON shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE staff_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Staff Logs Access" ON staff_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE sales_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Sales Logs Access" ON sales_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Payment Logs Access" ON payment_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE salary_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Salary Configs Access" ON salary_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE weekly_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Weekly Schedules Access" ON weekly_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
