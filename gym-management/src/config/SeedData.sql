DO $$
DECLARE
  -- Tìm ID từ bảng auth.users dựa trên email
  uuid_nhu      UUID := (SELECT id FROM auth.users WHERE email = 'nhu.manager@gymmanage.com' LIMIT 1); 
  uuid_tramanh  UUID := (SELECT id FROM auth.users WHERE email = 'tramanh.staff@gymmanage.com' LIMIT 1);
  uuid_phu      UUID := (SELECT id FROM auth.users WHERE email = 'phu.staff@gymmanage.com' LIMIT 1);
BEGIN

  -- 1. XÓA SẠCH DỮ LIỆU CŨ
  TRUNCATE TABLE sales_logs, staff_logs, shifts, products, members, profiles, payment_logs, salary_configs, weekly_schedules CASCADE;

  -- 2. NẠP NHÂN VIÊN (Profiles)
  IF uuid_nhu IS NOT NULL THEN
    INSERT INTO profiles (id, full_name, role, staff_type, note) VALUES (uuid_nhu, 'Như', 'admin', 'CT', 'Quản lý hệ thống');
  END IF;
  
  IF uuid_tramanh IS NOT NULL THEN
    INSERT INTO profiles (id, full_name, role, staff_type, note) VALUES (uuid_tramanh, 'Trâm Anh', 'staff', 'CT', 'Nhân viên trực ca');
  END IF;

  IF uuid_phu IS NOT NULL THEN
    INSERT INTO profiles (id, full_name, role, staff_type, note) VALUES (uuid_phu, 'Phú', 'staff', 'TV', 'Nhân viên thử việc');
  END IF;

  -- 3. NẠP DANH MỤC SẢN PHẨM
  INSERT INTO products (name, price, stock_quantity, note) VALUES 
    ('Nước suối', 10000, 100, 'Chai nhỏ'),
    ('Nước suối lớn', 15000, 80, 'Chai lớn'),
    ('Revive vàng', 15000, 50, 'Vị chanh muối'),
    ('Revive trắng', 15000, 60, 'Vị truyền thống'),
    ('Revive 0 calo', 18000, 40, 'Hỗ trợ ăn kiêng'),
    ('Pocari', 15000, 70, 'Chai nhỏ'),
    ('Pocari lớn', 22000, 45, 'Chai lớn'),
    ('Sữa', 20000, 30, 'Sữa hộp bổ sung'),
    ('Monster', 35000, 25, 'Nước tăng lực nhập khẩu'),
    ('Nutri', 15000, 40, 'Nước trái cây milk');

  -- 4. NẠP CẤU HÌNH LƯƠNG MẪU (Ca 1 -> Ca 5)
  INSERT INTO salary_configs (shift_name, staff_type, rate_per_shift) VALUES
    ('Ca 1', 'CT', 150000), ('Ca 1', 'TV', 100000),
    ('Ca 2', 'CT', 150000), ('Ca 2', 'TV', 100000),
    ('Ca 3', 'CT', 150000), ('Ca 3', 'TV', 100000),
    ('Ca 4', 'CT', 200000), ('Ca 4', 'TV', 130000),
    ('Ca 5', 'CT', 200000), ('Ca 5', 'TV', 130000);

END $$;