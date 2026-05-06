DO $$
DECLARE
  -- Tìm ID từ bảng auth.users dựa trên email (Bạn phải tạo User này trước trong Supabase Auth)
  uuid_nhu      UUID := (SELECT id FROM auth.users WHERE email = 'nhu.manager@gymmanage.com' LIMIT 1); 
  uuid_tramanh  UUID := (SELECT id FROM auth.users WHERE email = 'tramanh.staff@gymmanage.com' LIMIT 1);
  uuid_phu      UUID := (SELECT id FROM auth.users WHERE email = 'phu.staff@gymmanage.com' LIMIT 1);
BEGIN

  -- 1. XÓA SẠCH DỮ LIỆU CŨ (Trừ bảng auth.users)
  TRUNCATE TABLE sales_logs, staff_logs, shifts, products, members, profiles CASCADE;

  -- 2. NẠP NHÂN VIÊN (Profiles) - Cần thiết để đăng nhập và phân quyền
  IF uuid_nhu IS NOT NULL THEN
    INSERT INTO profiles (id, full_name, role, note) VALUES (uuid_nhu, 'Như', 'admin', 'Quản lý hệ thống');
  END IF;
  
  IF uuid_tramanh IS NOT NULL THEN
    INSERT INTO profiles (id, full_name, role, note) VALUES (uuid_tramanh, 'Trâm Anh', 'staff', 'Nhân viên trực ca');
  END IF;

  IF uuid_phu IS NOT NULL THEN
    INSERT INTO profiles (id, full_name, role, note) VALUES (uuid_phu, 'Phú', 'staff', 'Nhân viên trực ca');
  END IF;

  -- 3. NẠP DANH MỤC SẢN PHẨM (Menu nước) - Giữ lại để không phải nhập tay
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

  -- KHÔNG NẠP SHIFTS VÀ MEMBERS MẪU ĐỂ TRÁNH NHẦM LẪN

END $$;