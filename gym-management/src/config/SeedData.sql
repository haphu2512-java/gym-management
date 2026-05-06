DO $$
DECLARE
  -- Tự động tìm ID từ bảng auth.users dựa trên email bạn đã tạo ở giao diện
  uuid_nhu      UUID := (SELECT id FROM auth.users WHERE email = 'nhu.manager@gymmanage.com' LIMIT 1); 
  uuid_tramanh  UUID := (SELECT id FROM auth.users WHERE email = 'tramanh.staff@gymmanage.com' LIMIT 1);
  uuid_phu      UUID := (SELECT id FROM auth.users WHERE email = 'phu.staff@gymmanage.com' LIMIT 1);

  -- Khai báo các biến tạm để liên kết dữ liệu logic giữa các bảng
  id_nuoc_suoi  UUID := gen_random_uuid();
  id_revive_v   UUID := gen_random_uuid();
  id_pocari     UUID := gen_random_uuid();
  
  id_ca1        UUID := gen_random_uuid();
  id_ca2        UUID := gen_random_uuid();
  id_ca3        UUID := gen_random_uuid();
  id_ca4        UUID := gen_random_uuid();
  id_ca5        UUID := gen_random_uuid();

  id_khach1     UUID := gen_random_uuid();
  id_khach2     UUID := gen_random_uuid();
BEGIN

  -- Kiểm tra xem bạn đã tạo User trên giao diện chưa để tránh lỗi trống dữ liệu
  IF uuid_nhu IS NULL OR uuid_tramanh IS NULL OR uuid_phu IS NULL THEN
    RAISE EXCEPTION 'LỖI: Bạn chưa tạo đầy đủ 3 tài khoản email (nhu.manager@gymmanage.com, tramanh.staff@gymmanage.com, phu.staff@gymmanage.com) trên giao diện Supabase Auth. Hãy tạo chúng trước rồi chạy lại lệnh này nhé!';
  END IF;

  -- ======================================================
  -- 1. LÀM SẠCH DATA CŨ TRONG CÁC BẢNG (Giữ lại auth.users)
  -- ======================================================
  TRUNCATE TABLE sales_logs, staff_logs, shifts, products, members, profiles CASCADE;

  -- ======================================================
  -- 2. NẠP DỮ LIỆU BẢNG PROFILES (Thông tin nhân viên)
  -- ======================================================
  INSERT INTO profiles (id, full_name, role, note) VALUES 
    (uuid_nhu, 'Như', 'admin', 'Quản lý hệ thống'),
    (uuid_tramanh, 'Trâm Anh', 'staff', 'Nhân viên trực ca'),
    (uuid_phu, 'Phú', 'staff', 'Nhân viên trực ca');

  -- ======================================================
  -- 3. NẠP DỮ LIỆU BẢNG PRODUCTS (10 loại nước theo menu ảnh)
  -- ======================================================
  INSERT INTO products (id, name, price, stock_quantity, note) VALUES 
    (id_nuoc_suoi, 'Nước suối', 10000, 100, 'Chai nhỏ'),
    (gen_random_uuid(), 'Nước suối lớn', 15000, 80, 'Chai lớn'),
    (id_revive_v, 'Revive vàng', 15000, 50, 'Vị chanh muối'),
    (gen_random_uuid(), 'Revive trắng', 15000, 60, 'Vị truyền thống'),
    (gen_random_uuid(), 'Revive 0 calo', 18000, 40, 'Hỗ trợ ăn kiêng'),
    (id_pocari, 'Pocari', 15000, 70, 'Chai nhỏ'),
    (gen_random_uuid(), 'Pocari lớn', 22000, 45, 'Chai lớn'),
    (gen_random_uuid(), 'Sữa', 20000, 30, 'Sữa hộp bổ sung'),
    (gen_random_uuid(), 'Monster', 35000, 25, 'Nước tăng lực nhập khẩu'),
    (gen_random_uuid(), 'Nutri', 15000, 40, 'Nước trái cây milk');

  -- ======================================================
  -- 4. NẠP DỮ LIỆU BẢNG SHIFTS (5 ca mặc định quy định)
  -- ======================================================
  INSERT INTO shifts (id, shift_name, default_start, default_end, start_time, end_time, starting_cash, ending_cash, status, note) VALUES 
    (id_ca1, 'Ca 1', '05:00:00', '08:00:00', '2026-05-06 05:02:11+07', '2026-05-06 08:00:15+07', 200000, 450000, 'closed', 'Ca sáng Phú trực bàn giao đủ tiền'),
    (id_ca2, 'Ca 2', '09:00:00', '11:00:00', '2026-05-06 08:55:00+07', NULL, 450000, NULL, 'open', 'Trâm Anh đang trực ca này'),
    (id_ca3, 'Ca 3', '13:00:00', '16:00:00', NULL, NULL, 0, NULL, 'closed', 'Mặc định (13h - 16h)'),
    (id_ca4, 'Ca 4', '16:00:00', '19:00:00', NULL, NULL, 0, NULL, 'closed', 'Mặc định (16h - 19h)'),
    (id_ca5, 'Ca 5', '19:00:00', '22:00:00', NULL, NULL, 0, NULL, 'closed', 'Mặc định (19h - 22h)');

  -- ======================================================
  -- 5. NẠP DỮ LIỆU BẢNG MEMBERS (Hội viên mẫu)
  -- ======================================================
  INSERT INTO members (id, member_code, full_name, package_type, start_date, end_date, fee, payment_method, is_payment_verified, fingerprint_status, note) VALUES 
    (id_khach1, 'HV001', 'Phạm Minh Hoàng', 1, '2026-05-01', '2026-06-01', 500000, 'TM', TRUE, TRUE, 'Khách hay đi ca sáng'),
    (id_khach2, 'HV002', 'Hoàng Thùy Linh', 3, '2026-05-01', '2026-08-01', 1350000, 'CK', FALSE, TRUE, 'Đã check vân tay');

  -- ======================================================
  -- 6. NẠP DỮ LIỆU BẢNG STAFF_LOGS (Nhật ký hoạt động)
  -- ======================================================
  INSERT INTO staff_logs (staff_id, action, target_item, details, note) VALUES 
    (uuid_phu, 'MỞ CA', 'shifts', '{"shift_name": "Ca 1", "starting_cash": 200000}', 'Phú vào ca sáng sớm'),
    (uuid_phu, 'ĐĂNG KÝ HỘI VIÊN', 'members', '{"member_name": "Phạm Minh Hoàng", "package": "1 tháng"}', 'Đăng ký gói tháng thu tiền mặt'),
    (uuid_tramanh, 'MỞ CA', 'shifts', '{"shift_name": "Ca 2", "starting_cash": 450000}', 'Nhận bàn giao từ ca 1');

  -- ======================================================
  -- 7. NẠP DỮ LIỆU BẢNG SALES_LOGS (Lịch sử bán nước trong ca)
  -- ======================================================
  INSERT INTO sales_logs (product_id, shift_id, sold_by, quantity, total_price) VALUES 
    (id_nuoc_suoi, id_ca1, uuid_phu, 2, 20000), 
    (id_revive_v,  id_ca1, uuid_phu, 1, 15000), 
    (id_pocari,    id_ca2, uuid_tramanh, 1, 15000);

END $$;