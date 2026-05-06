-- 1. Bảng lưu thông tin nhân viên (mở rộng từ auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  note TEXT
);

-- 2. Bảng quản lý hội viên
CREATE TABLE members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  package_type INT NOT NULL, -- Số tháng đăng ký (1, 3, 12...)
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  fee NUMERIC NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('TM', 'R')), -- TM: Tiền mặt, R: Chuyển khoản
  fingerprint_status BOOLEAN DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Bảng quản lý kho nước
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  stock_quantity INT DEFAULT 0,
  note TEXT
);

-- 4. Bảng quản lý ca làm việc (5 ca)
-- CREATE TABLE shifts (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   shift_name TEXT NOT NULL, -- Ca 1, Ca 2, Ca 3, Ca 4, Ca 5
--   start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   end_time TIMESTAMP WITH TIME ZONE,
--   starting_cash NUMERIC DEFAULT 0,
--   ending_cash NUMERIC,
--   status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
--   note TEXT
-- );

CREATE TABLE shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_name TEXT NOT NULL,       -- Ca 1, Ca 2, Ca 3, Ca 4, Ca 5
  default_start TIME NOT NULL,    -- Giờ bắt đầu quy định (Ví dụ: 05:00:00)
  default_end TIME NOT NULL,      -- Giờ kết thúc quy định (Ví dụ: 08:00:00)
  start_time TIMESTAMP WITH TIME ZONE, -- Thực tế bấm MỞ CA (Hệ thống tự lấy NOW())
  end_time TIMESTAMP WITH TIME ZONE,   -- Thực tế bấm KẾT CA (Hệ thống tự lấy NOW())
  starting_cash NUMERIC DEFAULT 0,
  ending_cash NUMERIC,
  status TEXT DEFAULT 'closed' CHECK (status IN ('open', 'closed')), -- Mặc định đóng, khi nào nhân viên bấm mới 'open'
  note TEXT
);

-- 5. Bảng luu lịch sử thay đổi của hội viên
CREATE TABLE member_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  before_data JSONB,
  after_data JSONB,
  note TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Bảng luu giao dich ban hang
CREATE TABLE sales_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  sold_by UUID REFERENCES auth.users(id),
  quantity INT DEFAULT 1,
  total_price NUMERIC NOT NULL,
  sold_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);