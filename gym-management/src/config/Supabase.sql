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
CREATE TABLE shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_name TEXT NOT NULL, -- Ca 1, Ca 2, Ca 3, Ca 4, Ca 5
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  starting_cash NUMERIC DEFAULT 0,
  ending_cash NUMERIC,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  note TEXT
);