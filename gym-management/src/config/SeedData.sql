DO $$
DECLARE
  -- Lấy UUID của các tài khoản Auth (Phải tạo User trong Supabase Auth trước với các email này)
  uuid_admin UUID := (SELECT id FROM auth.users WHERE email = 'admin@gym.com' LIMIT 1);
  uuid_staff UUID := (SELECT id FROM auth.users WHERE email = 'staff@gym.com' LIMIT 1);

  -- Biến lưu ID của nhân viên mẫu (staff_members)
  v_staff_1 UUID;
  v_staff_2 UUID;
  v_staff_3 UUID;

  -- Biến lưu ID nghiệp vụ
  v_member_1 UUID;
  v_member_2 UUID;
  v_shift_1 UUID;
  v_product_1 UUID;
BEGIN
  -- 1) Làm sạch dữ liệu cũ
  TRUNCATE TABLE
    shift_expenses,
    sales_logs,
    payment_logs,
    member_logs,
    staff_logs,
    weekly_schedules,
    salary_adjustments,
    shifts,
    members,
    products,
    salary_configs,
    staff_members,
    profiles
  CASCADE;

  -- 2) Tạo Profile cho 2 tài khoản Auth chính
  IF uuid_admin IS NOT NULL THEN
    INSERT INTO profiles (id, full_name, role) VALUES (uuid_admin, 'Quản trị viên', 'admin');
  END IF;
  IF uuid_staff IS NOT NULL THEN
    INSERT INTO profiles (id, full_name, role) VALUES (uuid_staff, 'Nhân viên hệ thống', 'staff');
  END IF;

  -- 3) Tạo danh sách nhân viên thực tế (staff_members)
  INSERT INTO staff_members (full_name, staff_type, note) VALUES
    ('Trâm Anh', 'CT', 'Nhân viên ca sáng'),
    ('Anh Phú', 'CT', 'Nhân viên ca tối'),
    ('Hồng Nhung', 'TV', 'Nhân viên thử việc')
  RETURNING id INTO v_staff_1;
  
  SELECT id INTO v_staff_2 FROM staff_members WHERE full_name = 'Anh Phú';
  SELECT id INTO v_staff_3 FROM staff_members WHERE full_name = 'Hồng Nhung';

  -- 4) Sản phẩm
  INSERT INTO products (name, price, stock_quantity, note) VALUES
    ('Nước suối 500ml', 10000, 100, 'Lavie'),
    ('Pocari Sweat', 15000, 50, 'Bù khoáng'),
    ('Revive', 15000, 60, 'Chanh muối'),
    ('Monster Energy', 35000, 20, 'Tăng lực');

  -- 5) Cấu hình lương (Salary Configs)
  INSERT INTO salary_configs (shift_name, staff_type, rate_per_shift) VALUES
    ('Ca 1', 'CT', 150000), ('Ca 1', 'TV', 120000),
    ('Ca 2', 'CT', 150000), ('Ca 2', 'TV', 120000),
    ('Ca 3', 'CT', 180000), ('Ca 3', 'TV', 140000);

  -- 6) Hội viên mẫu (Members)
  INSERT INTO members (member_code, full_name, note) VALUES
    ('HV001', 'Nguyễn Văn An', 'Hội viên lâu năm'),
    ('HV002', 'Lê Thị Bình', 'Hội viên mới');

  SELECT id INTO v_member_1 FROM members WHERE member_code = 'HV001';
  SELECT id INTO v_member_2 FROM members WHERE member_code = 'HV002';

  -- 7) Ca làm việc (Shifts)
  INSERT INTO shifts (shift_name, default_start, default_end, start_time, end_time, starting_cash, ending_cash, opened_by, opened_by_member, status)
  VALUES 
    ('Ca 1', '05:00:00', '13:00:00', NOW() - INTERVAL '5 hours', NULL, 500000, NULL, uuid_staff, v_staff_1, 'open');

  SELECT id INTO v_shift_1 FROM shifts WHERE status = 'open' LIMIT 1;

  -- 8) Nhật ký hội viên (Member Logs)
  INSERT INTO member_logs (member_id, staff_member_id, action, package_type, membership_category, start_date, end_date, fee, payment_method, is_payment_verified, created_at)
  VALUES
    (v_member_1, v_staff_1, 'CREATE', 1, 'normal', CURRENT_DATE - 5, CURRENT_DATE + 25, 500000, 'TM', true, NOW() - INTERVAL '5 days'),
    (v_member_2, v_staff_1, 'CREATE', 3, 'normal', CURRENT_DATE, CURRENT_DATE + 90, 1200000, 'CK', false, NOW());

  -- 9) Nhật ký nhân viên (Staff Logs)
  INSERT INTO staff_logs (staff_member_id, action, target_item, details, created_at)
  VALUES
    (v_staff_1, 'Mở ca trực', 'Ca 1', '{"starting_cash": 500000}', NOW() - INTERVAL '5 hours');

  -- 10) Lịch làm việc tuần
  INSERT INTO weekly_schedules (week_start, staff_member_id, day_of_week, shift_name)
  VALUES
    (date_trunc('week', CURRENT_DATE)::date, v_staff_1, 1, 'Ca 1'),
    (date_trunc('week', CURRENT_DATE)::date, v_staff_2, 1, 'Ca 2');

  RAISE NOTICE 'Seed data completed successfully!';
END $$;
