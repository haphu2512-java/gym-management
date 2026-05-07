DO $$
DECLARE
  -- Resolve users from auth.users (create these users in Supabase Auth first)
  uuid_nhu UUID := (SELECT id FROM auth.users WHERE email = 'nhu.manager@gymmanage.com' LIMIT 1);
  uuid_tramanh UUID := (SELECT id FROM auth.users WHERE email = 'tramanh.staff@gymmanage.com' LIMIT 1);
  uuid_phu UUID := (SELECT id FROM auth.users WHERE email = 'phu.staff@gymmanage.com' LIMIT 1);

  v_member_1 UUID;
  v_member_2 UUID;
  v_member_3 UUID;
  v_shift_1 UUID;
  v_shift_2 UUID;
  v_product_1 UUID;
  v_product_2 UUID;
BEGIN
  -- 1) Clean old data (children first)
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
    profiles
  CASCADE;

  -- 2) Seed profiles only when auth user exists
  IF uuid_nhu IS NOT NULL THEN
    INSERT INTO profiles (id, full_name, role, staff_type, note)
    VALUES (uuid_nhu, 'Nhu', 'admin', 'CT', 'Quan ly he thong');
  END IF;

  IF uuid_tramanh IS NOT NULL THEN
    INSERT INTO profiles (id, full_name, role, staff_type, note)
    VALUES (uuid_tramanh, 'Tram Anh', 'staff', 'CT', 'Nhan vien truc ca');
  END IF;

  IF uuid_phu IS NOT NULL THEN
    INSERT INTO profiles (id, full_name, role, staff_type, note)
    VALUES (uuid_phu, 'Phu', 'staff', 'TV', 'Nhan vien thu viec');
  END IF;

  IF uuid_nhu IS NULL AND uuid_tramanh IS NULL AND uuid_phu IS NULL THEN
    RAISE NOTICE 'No matching auth.users found. Create auth users first, then re-run SeedData.sql';
  END IF;

  -- 3) Products
  INSERT INTO products (name, price, stock_quantity, note) VALUES
    ('Nuoc suoi', 10000, 100, 'Chai nho'),
    ('Nuoc suoi lon', 15000, 80, 'Chai lon'),
    ('Revive vang', 15000, 50, 'Vi chanh muoi'),
    ('Revive trang', 15000, 60, 'Vi truyen thong'),
    ('Revive 0 calo', 18000, 40, 'Ho tro an kieng'),
    ('Pocari', 15000, 70, 'Chai nho'),
    ('Pocari lon', 22000, 45, 'Chai lon'),
    ('Sua', 20000, 30, 'Sua hop bo sung'),
    ('Monster', 35000, 25, 'Nuoc tang luc'),
    ('Nutri', 15000, 40, 'Nuoc trai cay milk');

  SELECT id INTO v_product_1 FROM products WHERE name = 'Nuoc suoi' LIMIT 1;
  SELECT id INTO v_product_2 FROM products WHERE name = 'Pocari' LIMIT 1;

  -- 4) Salary configs
  INSERT INTO salary_configs (shift_name, staff_type, rate_per_shift) VALUES
    ('Ca 1', 'CT', 150000), ('Ca 1', 'TV', 100000),
    ('Ca 2', 'CT', 150000), ('Ca 2', 'TV', 100000),
    ('Ca 3', 'CT', 150000), ('Ca 3', 'TV', 100000),
    ('Ca 4', 'CT', 200000), ('Ca 4', 'TV', 130000),
    ('Ca 5', 'CT', 200000), ('Ca 5', 'TV', 130000);

  -- 5) Members
  INSERT INTO members (
    member_code, full_name, package_type, start_date, end_date,
    fee, payment_method, is_payment_verified, fingerprint_status, note
  ) VALUES
    ('HV001', 'Nguyen Van A', 1, CURRENT_DATE - 10, CURRENT_DATE + 20, 500000, 'TM', true, true, 'Tap sang'),
    ('HV002', 'Tran Thi B', 3, CURRENT_DATE - 40, CURRENT_DATE - 5, 1200000, 'CK', false, false, 'Can gia han'),
    ('HV003', 'Le Van C', 1, CURRENT_DATE - 2, CURRENT_DATE + 28, 500000, 'CK', true, true, 'Da xac minh CK');

  SELECT id INTO v_member_1 FROM members WHERE member_code = 'HV001' LIMIT 1;
  SELECT id INTO v_member_2 FROM members WHERE member_code = 'HV002' LIMIT 1;
  SELECT id INTO v_member_3 FROM members WHERE member_code = 'HV003' LIMIT 1;

  -- 6) Shifts
  INSERT INTO shifts (
    shift_name, default_start, default_end, start_time, end_time,
    starting_cash, ending_cash, opened_by, status, note
  ) VALUES
    ('Ca 1', '05:00:00', '09:00:00', NOW() - INTERVAL '10 hours', NOW() - INTERVAL '6 hours', 500000, 870000, 
     (SELECT id FROM profiles WHERE id = uuid_tramanh), 'closed', 'Ca sang da chot'),
    ('Ca 2', '09:00:00', '13:00:00', NOW() - INTERVAL '2 hours', NULL, 400000, NULL, 
     (SELECT id FROM profiles WHERE id = uuid_phu), 'open', 'Ca hien tai');

  SELECT id INTO v_shift_1 FROM shifts WHERE shift_name = 'Ca 1' ORDER BY start_time DESC LIMIT 1;
  SELECT id INTO v_shift_2 FROM shifts WHERE shift_name = 'Ca 2' ORDER BY start_time DESC LIMIT 1;

  -- 7) Payment logs
  INSERT INTO payment_logs (
    member_id, shift_id, staff_id, amount, payment_method,
    payment_type, is_verified, verified_by, verified_at, note
  ) VALUES
    (v_member_1, v_shift_1, (SELECT id FROM profiles WHERE id = uuid_tramanh), 500000, 'TM', 'new', true, (SELECT id FROM profiles WHERE id = uuid_tramanh), NOW() - INTERVAL '9 hours', 'Dang ky moi HV001'),
    (v_member_2, v_shift_2, (SELECT id FROM profiles WHERE id = uuid_phu), 1200000, 'CK', 'renew', false, NULL, NULL, 'Gia han HV002 cho duyet CK'),
    (v_member_3, v_shift_2, (SELECT id FROM profiles WHERE id = uuid_phu), 500000, 'CK', 'new', true, (SELECT id FROM profiles WHERE id = uuid_nhu), NOW() - INTERVAL '30 minutes', 'CK da xac minh');

  -- 8) Sales logs
  INSERT INTO sales_logs (product_id, shift_id, sold_by, quantity, total_price, payment_method) VALUES
    (v_product_1, v_shift_2, (SELECT id FROM profiles WHERE id = uuid_phu), 2, 20000, 'TM'),
    (v_product_2, v_shift_2, (SELECT id FROM profiles WHERE id = uuid_phu), 1, 15000, 'TM');

  -- 9) Shift expenses (tab Chi)
  INSERT INTO shift_expenses (shift_id, amount, reason, created_by) VALUES
    (v_shift_2, 30000, 'Mua dung cu ve sinh', (SELECT id FROM profiles WHERE id = uuid_phu)),
    (v_shift_2, 15000, 'In hoa don', (SELECT id FROM profiles WHERE id = uuid_phu));

  -- 10) Logs
  INSERT INTO staff_logs (staff_id, action, target_item, details, note) VALUES
    ((SELECT id FROM profiles WHERE id = uuid_tramanh), 'Mo ca truc', 'Ca 1', jsonb_build_object('starting_cash', 500000), 'Mo ca sang'),
    ((SELECT id FROM profiles WHERE id = uuid_tramanh), 'Chot ca truc', 'Ca 1', jsonb_build_object('ending_cash', 870000), 'Ket ca sang'),
    ((SELECT id FROM profiles WHERE id = uuid_phu), 'Them khoan chi', 'Ca 2', jsonb_build_object('amount', 30000), 'Mua dung cu ve sinh');

  INSERT INTO member_logs (member_id, staff_id, action, details, note) VALUES
    (v_member_1, (SELECT id FROM profiles WHERE id = uuid_tramanh), 'CREATE', jsonb_build_object('fee', 500000), 'Them hoi vien moi'),
    (v_member_2, (SELECT id FROM profiles WHERE id = uuid_phu), 'RENEW', jsonb_build_object('fee', 1200000, 'package_type', 3), 'Gia han hoi vien');

  -- 11) Weekly schedules
  IF uuid_tramanh IS NOT NULL AND EXISTS (SELECT 1 FROM profiles WHERE id = uuid_tramanh) THEN
    INSERT INTO weekly_schedules (week_start, staff_id, day_of_week, shift_name)
    VALUES (date_trunc('week', CURRENT_DATE)::date, uuid_tramanh, 1, 'Ca 1');
  END IF;

  IF uuid_phu IS NOT NULL AND EXISTS (SELECT 1 FROM profiles WHERE id = uuid_phu) THEN
    INSERT INTO weekly_schedules (week_start, staff_id, day_of_week, shift_name)
    VALUES (date_trunc('week', CURRENT_DATE)::date, uuid_phu, 1, 'Ca 2');
  END IF;

  -- 12) Salary adjustments
  IF uuid_nhu IS NOT NULL AND uuid_phu IS NOT NULL 
     AND EXISTS (SELECT 1 FROM profiles WHERE id = uuid_nhu) 
     AND EXISTS (SELECT 1 FROM profiles WHERE id = uuid_phu) THEN
    INSERT INTO salary_adjustments (
      staff_id, adjustment_date, commission, shortage, penalty, reason, created_by
    ) VALUES
      (uuid_phu, CURRENT_DATE, 50000, 0, 0, 'Thuong doanh so nuoc', uuid_nhu);
  END IF;
END $$;
