-- ============================================================
-- GIAI ĐOẠN A: chuyển nghiệp vụ tiền về server (29/10/2026)
-- Chạy TRƯỚC khi deploy frontend mới. Tương thích với frontend cũ:
-- không đổi tên hoặc bỏ tham số hàm nào (tham số không còn dùng thì bị bỏ qua).
--
--   - is_admin(), local_today()
--   - Người thao tác lấy từ auth.uid(), không tin tham số p_admin_id (B2)
--   - Giá bán lấy từ bảng products/services, thời điểm lấy từ NOW() (B5)
--   - Bán hàng trừ kho atomic, kho không âm (L6)
--   - Hàm mới: open_shift, close_shift (L7), rollback_sale, rollback_service_sale (L5),
--     delete_member + hoàn tiền (L3), get_revenue_summary (L2)
--   - Các hàm ghi dữ liệu chạy SECURITY DEFINER để giai đoạn B siết RLS được
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Helpers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- Ngày hiện tại theo giờ Việt Nam (CURRENT_DATE của Supabase là UTC, lệch ngày trước 7h sáng)
CREATE OR REPLACE FUNCTION local_today()
RETURNS DATE
LANGUAGE sql STABLE
AS $$
  SELECT (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE;
$$;

CREATE OR REPLACE FUNCTION require_login()
RETURNS UUID
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập để thực hiện thao tác này.';
  END IF;
  RETURN auth.uid();
END;
$$;

-- ------------------------------------------------------------
-- 1. Ràng buộc dữ liệu
-- NOT VALID: chỉ áp dụng cho dữ liệu ghi mới, không lỗi với dữ liệu cũ.
-- ------------------------------------------------------------
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_non_negative;
ALTER TABLE products ADD CONSTRAINT products_stock_non_negative CHECK (stock_quantity >= 0) NOT VALID;

ALTER TABLE sales_logs DROP CONSTRAINT IF EXISTS sales_logs_quantity_positive;
ALTER TABLE sales_logs ADD CONSTRAINT sales_logs_quantity_positive CHECK (quantity > 0) NOT VALID;

ALTER TABLE service_sales DROP CONSTRAINT IF EXISTS service_sales_quantity_positive;
ALTER TABLE service_sales ADD CONSTRAINT service_sales_quantity_positive CHECK (quantity > 0) NOT VALID;

-- Thêm loại 'refund' (hoàn tiền, số tiền âm) cho payment_logs
ALTER TABLE payment_logs DROP CONSTRAINT IF EXISTS payment_logs_payment_type_check;
ALTER TABLE payment_logs ADD CONSTRAINT payment_logs_payment_type_check
  CHECK (payment_type IN ('new', 'renew', 'refund'));
ALTER TABLE payment_logs DROP CONSTRAINT IF EXISTS payment_logs_amount_sign;
ALTER TABLE payment_logs ADD CONSTRAINT payment_logs_amount_sign
  CHECK ((payment_type = 'refund' AND amount < 0) OR (payment_type IS DISTINCT FROM 'refund' AND amount >= 0)) NOT VALID;

-- Thời điểm do server ghi
ALTER TABLE shift_expenses ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE staff_logs ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE member_logs ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE payment_logs ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE sales_logs ALTER COLUMN sold_at SET DEFAULT NOW();
ALTER TABLE service_sales ALTER COLUMN sold_at SET DEFAULT NOW();

-- ------------------------------------------------------------
-- 2. Duyệt chuyển khoản (chỉ admin)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_payment_atomic(
  p_payment_id UUID,
  p_admin_id UUID DEFAULT NULL,          -- không dùng, giữ cho tương thích
  p_staff_member_id UUID DEFAULT NULL,
  p_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL  -- không dùng, giữ cho tương thích
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_updated_id UUID; v_member_id UUID; v_already_verified BOOLEAN := FALSE;
BEGIN
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Chỉ Admin mới có quyền duyệt chuyển khoản.');
  END IF;

  UPDATE payment_logs
  SET is_verified = true, verified_by = v_admin_id, verified_by_member = p_staff_member_id, verified_at = NOW()
  WHERE id = p_payment_id AND (is_verified = false OR is_verified IS NULL) AND payment_method = 'CK'
  RETURNING id, member_id INTO v_updated_id, v_member_id;

  IF v_updated_id IS NULL THEN
    SELECT member_id, is_verified INTO v_member_id, v_already_verified FROM payment_logs WHERE id = p_payment_id;
    IF v_member_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Không tìm thấy thanh toán.'); END IF;
  END IF;

  UPDATE member_logs
  SET is_payment_verified = true
  WHERE member_id = v_member_id AND (details->>'payment_id' = p_payment_id::text);

  IF v_already_verified = FALSE OR v_updated_id IS NOT NULL THEN
    INSERT INTO member_logs (member_id, staff_id, staff_member_id, action, is_payment_verified, note, created_at)
    VALUES (v_member_id, v_admin_id, p_staff_member_id, 'VERIFY_PAYMENT', true, 'Admin duyệt thanh toán', NOW());
  END IF;
  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION verify_all_payments_atomic(
  p_admin_id UUID DEFAULT NULL,          -- không dùng, giữ cho tương thích
  p_staff_member_id UUID DEFAULT NULL,
  p_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL  -- không dùng, giữ cho tương thích
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_count INT := 0;
BEGIN
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Chỉ Admin mới có quyền duyệt chuyển khoản.');
  END IF;

  FOR v_rec IN
    SELECT id FROM payment_logs
    WHERE payment_method = 'CK' AND (is_verified = false OR is_verified IS NULL)
  LOOP
    PERFORM verify_payment_atomic(v_rec.id, NULL, p_staff_member_id);
    v_count := v_count + 1;
  END LOOP;

  -- Log CK cũ chưa gắn payment_id thì không duyệt được qua payment_logs, đồng bộ trực tiếp
  UPDATE member_logs
  SET is_payment_verified = true
  WHERE payment_method = 'CK'
    AND (is_payment_verified = false OR is_payment_verified IS NULL)
    AND details->>'payment_id' IS NULL;

  RETURN json_build_object('success', true, 'count', v_count);
END;
$$;

-- ------------------------------------------------------------
-- 3. Hoàn tác gia hạn (chỉ admin, người gọi lấy từ auth.uid())
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION revert_renew_transaction(
  p_log_id UUID,
  p_admin_id UUID DEFAULT NULL           -- không dùng, giữ cho tương thích
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_member_id UUID;
  v_payment_id UUID;
  v_created_at TIMESTAMP WITH TIME ZONE;
  v_fee NUMERIC;
  v_package_type INT;
  v_name TEXT;
  v_is_latest BOOLEAN;
BEGIN
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Chỉ Admin mới có quyền hoàn tác giao dịch.');
  END IF;

  SELECT member_id, created_at, fee, package_type, (details->>'payment_id')::UUID
  INTO v_member_id, v_created_at, v_fee, v_package_type, v_payment_id
  FROM member_logs
  WHERE id = p_log_id AND action = 'RENEW'
  FOR UPDATE;

  IF v_member_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Không tìm thấy lịch sử gia hạn cần hoàn tác.');
  END IF;

  IF v_created_at < NOW() - INTERVAL '48 hours' THEN
    RETURN json_build_object('success', false, 'error', 'Giao dịch đã quá 48 giờ, không thể hoàn tác.');
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM member_logs
    WHERE member_id = v_member_id AND action = 'RENEW' AND created_at > v_created_at
  ) INTO v_is_latest;

  IF NOT v_is_latest THEN
    RETURN json_build_object('success', false, 'error', 'Đây không phải là lượt gia hạn mới nhất của hội viên này.');
  END IF;

  IF v_payment_id IS NOT NULL THEN
    DELETE FROM payment_logs WHERE id = v_payment_id;
  END IF;

  SELECT full_name INTO v_name FROM members WHERE id = v_member_id;
  DELETE FROM staff_logs
  WHERE action = 'Gia hạn hội viên'
    AND target_item = v_name
    AND created_at BETWEEN v_created_at - INTERVAL '5 seconds' AND v_created_at + INTERVAL '5 seconds';

  DELETE FROM member_logs WHERE id = p_log_id;

  INSERT INTO staff_logs (staff_id, action, target_item, details, created_at)
  VALUES (v_admin_id, 'Hoàn tác gia hạn', v_name, json_build_object('fee', v_fee, 'months', v_package_type, 'reverted_log_id', p_log_id), NOW());

  RETURN json_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------
-- 4. Bán nước: giá từ bảng products, trừ kho atomic
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sell_bottle_transaction(
  p_product_id UUID, p_shift_id UUID, p_auth_id UUID, p_staff_id UUID, p_quantity INT,
  p_total_price NUMERIC,                 -- không dùng: giá lấy từ bảng products
  p_payment_method TEXT,
  p_sold_at TIMESTAMP WITH TIME ZONE     -- không dùng: thời điểm lấy từ NOW()
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sale_id UUID; v_price NUMERIC; v_user UUID := require_login();
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Số lượng không hợp lệ'; END IF;
  IF p_payment_method NOT IN ('TM', 'CK') THEN RAISE EXCEPTION 'Hình thức thanh toán không hợp lệ'; END IF;
  IF NOT EXISTS (SELECT 1 FROM shifts WHERE id = p_shift_id AND status = 'open') THEN
    RAISE EXCEPTION 'Ca làm việc không tồn tại hoặc đã đóng.';
  END IF;

  UPDATE products SET stock_quantity = stock_quantity - p_quantity
  WHERE id = p_product_id AND deleted_at IS NULL AND stock_quantity >= p_quantity
  RETURNING price INTO v_price;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM products WHERE id = p_product_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Hết hàng';
    END IF;
    RAISE EXCEPTION 'Không tìm thấy sản phẩm';
  END IF;

  INSERT INTO sales_logs (product_id, shift_id, sold_by, sold_by_member, quantity, total_price, payment_method, sold_at)
  VALUES (p_product_id, p_shift_id, v_user, p_staff_id, p_quantity, v_price * p_quantity, p_payment_method, NOW())
  RETURNING id INTO v_sale_id;

  RETURN json_build_object('success', true, 'sale_id', v_sale_id);
END;
$$;

-- ------------------------------------------------------------
-- 5. Bán dịch vụ: giá từ bảng services
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sell_service_transaction(
  p_service_id UUID, p_shift_id UUID, p_auth_id UUID, p_staff_id UUID, p_quantity INT,
  p_total_price NUMERIC,                 -- không dùng: giá lấy từ bảng services
  p_payment_method TEXT,
  p_sold_at TIMESTAMP WITH TIME ZONE     -- không dùng: thời điểm lấy từ NOW()
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sale_id UUID; v_price NUMERIC; v_user UUID := require_login();
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Số lượng không hợp lệ'; END IF;
  IF p_payment_method NOT IN ('TM', 'CK') THEN RAISE EXCEPTION 'Hình thức thanh toán không hợp lệ'; END IF;
  IF NOT EXISTS (SELECT 1 FROM shifts WHERE id = p_shift_id AND status = 'open') THEN
    RAISE EXCEPTION 'Ca làm việc không tồn tại hoặc đã đóng.';
  END IF;

  SELECT price INTO v_price FROM services WHERE id = p_service_id AND deleted_at IS NULL;
  IF v_price IS NULL THEN RAISE EXCEPTION 'Không tìm thấy dịch vụ'; END IF;

  INSERT INTO service_sales (service_id, shift_id, sold_by, sold_by_member, quantity, total_price, payment_method, sold_at)
  VALUES (p_service_id, p_shift_id, v_user, p_staff_id, p_quantity, v_price * p_quantity, p_payment_method, NOW())
  RETURNING id INTO v_sale_id;

  RETURN json_build_object('success', true, 'sale_id', v_sale_id);
END;
$$;

-- ------------------------------------------------------------
-- 6. Hoàn tác bán hàng (L5): atomic, khóa dòng, chỉ admin hoặc người bán trong ca đang mở
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION rollback_sale(p_sale_id UUID, p_staff_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user UUID := require_login(); v_sale sales_logs%ROWTYPE; v_shift_status TEXT; v_name TEXT;
BEGIN
  SELECT * INTO v_sale FROM sales_logs WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy giao dịch (có thể đã được hoàn tác).'; END IF;

  SELECT status INTO v_shift_status FROM shifts WHERE id = v_sale.shift_id;
  IF NOT is_admin() AND NOT (
    v_shift_status = 'open'
    AND (v_sale.sold_by = v_user OR (p_staff_id IS NOT NULL AND v_sale.sold_by_member = p_staff_id))
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền hoàn tác giao dịch này (chỉ được hoàn tác giao dịch do chính bạn bán trong ca đang mở).';
  END IF;

  UPDATE products SET stock_quantity = stock_quantity + v_sale.quantity
  WHERE id = v_sale.product_id
  RETURNING name INTO v_name;

  DELETE FROM sales_logs WHERE id = p_sale_id;

  INSERT INTO staff_logs (staff_id, staff_member_id, action, target_item, details, note)
  VALUES (v_user, p_staff_id, 'Rollback bán hàng', COALESCE(v_name, 'N/A'),
          json_build_object('qty', v_sale.quantity, 'total', v_sale.total_price, 'method', v_sale.payment_method),
          'Hoàn tác giao dịch nước uống');

  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION rollback_service_sale(p_sale_id UUID, p_staff_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user UUID := require_login(); v_sale service_sales%ROWTYPE; v_shift_status TEXT; v_name TEXT;
BEGIN
  SELECT * INTO v_sale FROM service_sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy giao dịch (có thể đã được hoàn tác).'; END IF;

  SELECT status INTO v_shift_status FROM shifts WHERE id = v_sale.shift_id;
  IF NOT is_admin() AND NOT (
    v_shift_status = 'open'
    AND (v_sale.sold_by = v_user OR (p_staff_id IS NOT NULL AND v_sale.sold_by_member = p_staff_id))
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền hoàn tác giao dịch này (chỉ được hoàn tác giao dịch do chính bạn bán trong ca đang mở).';
  END IF;

  SELECT name INTO v_name FROM services WHERE id = v_sale.service_id;
  DELETE FROM service_sales WHERE id = p_sale_id;

  INSERT INTO staff_logs (staff_id, staff_member_id, action, target_item, details, note)
  VALUES (v_user, p_staff_id, 'Rollback bán dịch vụ', COALESCE(v_name, 'N/A'),
          json_build_object('qty', v_sale.quantity, 'total', v_sale.total_price, 'method', v_sale.payment_method),
          'Hoàn tác giao dịch dịch vụ');

  RETURN json_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------
-- 7. Mở / chốt ca (L7)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION open_shift(
  p_shift_name TEXT, p_starting_cash NUMERIC, p_note TEXT DEFAULT NULL, p_staff_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user UUID := require_login(); v_shift shifts%ROWTYPE; v_start TIME; v_end TIME;
BEGIN
  IF p_staff_id IS NULL THEN RAISE EXCEPTION 'Vui lòng chọn nhân viên trực trước khi mở ca.'; END IF;
  IF COALESCE(p_starting_cash, 0) < 0 THEN RAISE EXCEPTION 'Tiền đầu ca không hợp lệ'; END IF;

  -- Khung giờ mặc định, khớp SHIFT_TIME_MAP ở frontend
  SELECT s, e INTO v_start, v_end FROM (VALUES
    ('Ca 1', '05:00'::TIME, '08:00'::TIME),
    ('Ca 2', '08:00', '11:00'),
    ('Ca 3', '13:00', '16:00'),
    ('Ca 4', '16:00', '19:00'),
    ('Ca 5', '19:00', '22:00')
  ) AS m(n, s, e) WHERE n = p_shift_name;

  BEGIN
    INSERT INTO shifts (shift_name, default_start, default_end, start_time, starting_cash, status, opened_by, opened_by_member, note)
    VALUES (p_shift_name, COALESCE(v_start, '00:00'), COALESCE(v_end, '00:00'), NOW(), COALESCE(p_starting_cash, 0), 'open', v_user, p_staff_id, p_note)
    RETURNING * INTO v_shift;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Đã có ca đang mở. Vui lòng chốt ca cũ trước khi mở ca mới.';
  END;

  INSERT INTO staff_logs (staff_id, staff_member_id, action, target_item, details, note)
  VALUES (v_user, p_staff_id, 'Mở ca trực', p_shift_name, json_build_object('startingCash', p_starting_cash), COALESCE(NULLIF(p_note, ''), 'Mở ca mới'));

  RETURN row_to_json(v_shift);
END;
$$;

CREATE OR REPLACE FUNCTION close_shift(
  p_shift_id UUID, p_ending_cash NUMERIC, p_note TEXT DEFAULT NULL, p_staff_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user UUID := require_login(); v_shift shifts%ROWTYPE;
BEGIN
  IF COALESCE(p_ending_cash, 0) < 0 THEN RAISE EXCEPTION 'Tiền kết ca không hợp lệ'; END IF;

  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy ca làm việc.'; END IF;
  IF v_shift.status <> 'open' THEN RAISE EXCEPTION 'Ca này đã được chốt trước đó.'; END IF;
  IF v_shift.opened_by IS DISTINCT FROM v_user AND NOT is_admin() THEN
    RAISE EXCEPTION 'Bạn không có quyền chốt ca này. Chỉ người mở ca hoặc Quản lý mới có quyền chốt ca.';
  END IF;

  UPDATE shifts
  SET ending_cash = COALESCE(p_ending_cash, 0), end_time = NOW(), status = 'closed', note = p_note
  WHERE id = p_shift_id
  RETURNING * INTO v_shift;

  INSERT INTO staff_logs (staff_id, staff_member_id, action, target_item, details, note)
  VALUES (v_user, p_staff_id, 'Chốt ca trực', v_shift.shift_name, json_build_object('endingCash', p_ending_cash), COALESCE(NULLIF(p_note, ''), 'Chốt ca kết thúc'));

  RETURN row_to_json(v_shift);
END;
$$;

-- ------------------------------------------------------------
-- 8. Tạo hội viên: thời điểm từ NOW(), người thao tác từ auth.uid()
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_member_transaction(
  p_code TEXT, p_name TEXT, p_package_type INT, p_membership_category TEXT,
  p_fee NUMERIC, p_payment_method TEXT, p_shift_id UUID, p_staff_id UUID,
  p_fingerprint_status BOOLEAN, p_note TEXT, p_start_date DATE,
  p_created_at TIMESTAMP WITH TIME ZONE, -- không dùng: thời điểm lấy từ NOW()
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := require_login();
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_member_id UUID; v_payment_id UUID; v_end_date DATE; v_log_id UUID;
BEGIN
  IF p_package_type IS NULL OR p_package_type < 1 OR p_package_type > 36 THEN RAISE EXCEPTION 'Gói tập phải từ 1 đến 36 tháng'; END IF;
  IF COALESCE(p_fee, 0) < 0 THEN RAISE EXCEPTION 'Học phí không hợp lệ'; END IF;
  IF p_payment_method NOT IN ('TM', 'CK') THEN RAISE EXCEPTION 'Hình thức thanh toán không hợp lệ'; END IF;
  IF NOT EXISTS (SELECT 1 FROM shifts WHERE id = p_shift_id AND status = 'open') THEN
    RAISE EXCEPTION 'Ca làm việc không tồn tại hoặc đã đóng.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT member_id INTO v_member_id
    FROM member_logs
    WHERE details->>'idempotency_key' = p_idempotency_key
    LIMIT 1;

    IF v_member_id IS NOT NULL THEN
      RETURN json_build_object('success', true, 'member_id', v_member_id, 'idempotent', true);
    END IF;
  ELSE
    SELECT m.id INTO v_member_id
    FROM members m
    JOIN member_logs ml ON m.id = ml.member_id
    WHERE ml.action = 'CREATE'
      AND ml.staff_member_id = p_staff_id
      AND m.full_name = p_name
      AND (p_code IS NULL OR m.member_code = p_code)
      AND m.created_at >= v_now - INTERVAL '5 seconds'
    ORDER BY m.created_at DESC
    LIMIT 1;

    IF v_member_id IS NOT NULL THEN
      RETURN json_build_object('success', true, 'member_id', v_member_id, 'idempotent', true);
    END IF;
  END IF;

  v_end_date := p_start_date + (p_package_type || ' months')::INTERVAL;
  INSERT INTO members (member_code, full_name, fingerprint_status, note, created_at)
  VALUES (p_code, p_name, p_fingerprint_status, p_note, v_now) RETURNING id INTO v_member_id;

  INSERT INTO payment_logs (member_id, shift_id, staff_id, staff_member_id, amount, payment_method, payment_type, is_verified, note, created_at)
  VALUES (v_member_id, p_shift_id, v_user, p_staff_id, COALESCE(p_fee, 0), p_payment_method, 'new', (p_payment_method = 'TM'), NULLIF(p_note, ''), v_now)
  RETURNING id INTO v_payment_id;

  INSERT INTO member_logs (member_id, staff_id, staff_member_id, action, package_type, membership_category, start_date, end_date, fee, payment_method, is_payment_verified, created_at, details)
  VALUES (v_member_id, v_user, p_staff_id, 'CREATE', p_package_type, p_membership_category, p_start_date, v_end_date, COALESCE(p_fee, 0), p_payment_method, (p_payment_method = 'TM'), v_now,
          jsonb_build_object('idempotency_key', p_idempotency_key, 'payment_id', v_payment_id));

  INSERT INTO staff_logs (staff_id, staff_member_id, action, target_item, details, created_at)
  VALUES (v_user, p_staff_id, 'Tạo hội viên mới', p_name, json_build_object('code', p_code, 'fee', p_fee, 'idempotency_key', p_idempotency_key), v_now);

  RETURN json_build_object('success', true, 'member_id', v_member_id);
END;
$$;

-- ------------------------------------------------------------
-- 9. Gia hạn: thêm p_note (ghi chú lưu luôn trong giao dịch), thời điểm từ NOW()
-- Đổi danh sách tham số nên phải DROP hàm cũ trước.
-- Frontend cũ không truyền p_note vẫn gọi được (p_note có DEFAULT).
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS renew_member_transaction(UUID, INT, TEXT, NUMERIC, TEXT, UUID, UUID, DATE, TIMESTAMP WITH TIME ZONE, TEXT);

CREATE OR REPLACE FUNCTION renew_member_transaction(
  p_member_id UUID, p_package_type INT, p_membership_category TEXT,
  p_fee NUMERIC, p_payment_method TEXT, p_shift_id UUID, p_staff_id UUID,
  p_start_date DATE,
  p_created_at TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- không dùng: thời điểm lấy từ NOW()
  p_idempotency_key TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := require_login();
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_payment_id UUID; v_end_date DATE; v_name TEXT;
BEGIN
  IF p_package_type IS NULL OR p_package_type < 1 OR p_package_type > 36 THEN RAISE EXCEPTION 'Gói tập phải từ 1 đến 36 tháng'; END IF;
  IF COALESCE(p_fee, 0) < 0 THEN RAISE EXCEPTION 'Học phí không hợp lệ'; END IF;
  IF p_payment_method NOT IN ('TM', 'CK') THEN RAISE EXCEPTION 'Hình thức thanh toán không hợp lệ'; END IF;
  IF NOT EXISTS (SELECT 1 FROM shifts WHERE id = p_shift_id AND status = 'open') THEN
    RAISE EXCEPTION 'Ca làm việc không tồn tại hoặc đã đóng.';
  END IF;

  SELECT full_name INTO v_name FROM members WHERE id = p_member_id AND deleted_at IS NULL;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Không tìm thấy hội viên'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT (details->>'payment_id')::UUID INTO v_payment_id
    FROM member_logs
    WHERE member_id = p_member_id AND details->>'idempotency_key' = p_idempotency_key
    LIMIT 1;

    IF v_payment_id IS NOT NULL THEN
      RETURN json_build_object('success', true, 'payment_id', v_payment_id, 'idempotent', true);
    END IF;
  ELSE
    SELECT (details->>'payment_id')::UUID INTO v_payment_id
    FROM member_logs
    WHERE member_id = p_member_id
      AND action = 'RENEW'
      AND staff_member_id = p_staff_id
      AND created_at >= v_now - INTERVAL '5 seconds'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_payment_id IS NOT NULL THEN
      RETURN json_build_object('success', true, 'payment_id', v_payment_id, 'idempotent', true);
    END IF;
  END IF;

  v_end_date := p_start_date + (p_package_type || ' months')::INTERVAL;

  INSERT INTO payment_logs (member_id, shift_id, staff_id, staff_member_id, amount, payment_method, payment_type, is_verified, note, created_at)
  VALUES (p_member_id, p_shift_id, v_user, p_staff_id, COALESCE(p_fee, 0), p_payment_method, 'renew', (p_payment_method = 'TM'), NULLIF(p_note, ''), v_now)
  RETURNING id INTO v_payment_id;

  INSERT INTO member_logs (member_id, staff_id, staff_member_id, action, package_type, membership_category, start_date, end_date, fee, payment_method, is_payment_verified, note, created_at, details)
  VALUES (p_member_id, v_user, p_staff_id, 'RENEW', p_package_type, p_membership_category, p_start_date, v_end_date, COALESCE(p_fee, 0), p_payment_method, (p_payment_method = 'TM'), NULLIF(p_note, ''), v_now,
          jsonb_build_object('idempotency_key', p_idempotency_key, 'payment_id', v_payment_id));

  IF NULLIF(p_note, '') IS NOT NULL THEN
    UPDATE members SET note = p_note WHERE id = p_member_id;
  END IF;

  INSERT INTO staff_logs (staff_id, staff_member_id, action, target_item, details, created_at)
  VALUES (v_user, p_staff_id, 'Gia hạn hội viên', v_name, json_build_object('fee', p_fee, 'months', p_package_type, 'idempotency_key', p_idempotency_key), v_now);

  RETURN json_build_object('success', true, 'payment_id', v_payment_id);
END;
$$;

-- ------------------------------------------------------------
-- 10. Bảo lưu / kích hoạt lại: ngày theo giờ Việt Nam, thời điểm từ NOW()
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION suspend_member(
  p_member_id UUID,
  p_staff_id UUID,
  p_shift_id UUID,
  p_suspended_at DATE DEFAULT NULL,                    -- không dùng: lấy local_today()
  p_created_at TIMESTAMP WITH TIME ZONE DEFAULT NULL   -- không dùng: lấy NOW()
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user UUID := require_login(); v_today DATE := local_today(); v_remaining_days INT;
BEGIN
  PERFORM 1 FROM members WHERE id = p_member_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM members WHERE id = p_member_id AND suspended_at IS NOT NULL) THEN
    RETURN json_build_object('success', true, 'days', (SELECT remaining_days FROM members WHERE id = p_member_id), 'message', 'Already suspended');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shifts WHERE id = p_shift_id AND status = 'open') THEN
    RAISE EXCEPTION 'Ca làm việc không tồn tại hoặc đã đóng.';
  END IF;

  SELECT (end_date - v_today) INTO v_remaining_days FROM member_current_status WHERE id = p_member_id;
  IF v_remaining_days IS NULL THEN RAISE EXCEPTION 'Hội viên chưa có gói tập để bảo lưu'; END IF;
  IF v_remaining_days < 13 THEN RAISE EXCEPTION 'Không đủ điều kiện (tối thiểu 13 ngày)'; END IF;

  UPDATE members SET suspended_at = v_today, remaining_days = v_remaining_days WHERE id = p_member_id;

  INSERT INTO member_logs (member_id, staff_id, staff_member_id, action, note, created_at)
  VALUES (p_member_id, v_user, p_staff_id, 'SUSPEND', 'Bảo lưu (còn ' || v_remaining_days || ' ngày)', NOW());

  INSERT INTO staff_logs (staff_id, staff_member_id, action, target_item, details, created_at)
  VALUES (v_user, p_staff_id, 'Bảo lưu hội viên', (SELECT full_name FROM members WHERE id = p_member_id), json_build_object('days', v_remaining_days, 'shift_id', p_shift_id), NOW());

  RETURN json_build_object('success', true, 'days', v_remaining_days);
END;
$$;

CREATE OR REPLACE FUNCTION reactivate_member(
  p_member_id UUID,
  p_staff_id UUID,
  p_shift_id UUID,
  p_reactivated_at DATE DEFAULT NULL,                  -- không dùng: lấy local_today()
  p_created_at TIMESTAMP WITH TIME ZONE DEFAULT NULL   -- không dùng: lấy NOW()
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user UUID := require_login(); v_today DATE := local_today(); v_days INT; v_new_end DATE;
BEGIN
  PERFORM 1 FROM members WHERE id = p_member_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM members WHERE id = p_member_id AND suspended_at IS NULL) THEN
    RETURN json_build_object('success', true, 'new_end', (SELECT end_date FROM member_current_status WHERE id = p_member_id), 'message', 'Already active');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shifts WHERE id = p_shift_id AND status = 'open') THEN
    RAISE EXCEPTION 'Ca làm việc không tồn tại hoặc đã đóng.';
  END IF;

  SELECT remaining_days INTO v_days FROM members WHERE id = p_member_id;
  v_new_end := v_today + COALESCE(v_days, 0);

  UPDATE members SET suspended_at = NULL, remaining_days = 0 WHERE id = p_member_id;

  INSERT INTO member_logs (member_id, staff_id, staff_member_id, action, package_type, start_date, end_date, note, created_at)
  VALUES (p_member_id, v_user, p_staff_id, 'REACTIVATE', NULL, v_today, v_new_end, 'Kích hoạt lại sau bảo lưu', NOW());

  INSERT INTO staff_logs (staff_id, staff_member_id, action, target_item, details, created_at)
  VALUES (v_user, p_staff_id, 'Kích hoạt lại hội viên', (SELECT full_name FROM members WHERE id = p_member_id), json_build_object('days', v_days, 'new_end', v_new_end), NOW());

  RETURN json_build_object('success', true, 'new_end', v_new_end);
END;
$$;

-- ------------------------------------------------------------
-- 11. Xóa hội viên (L3): KHÔNG sửa các khoản thu cũ.
-- Nếu hoàn tiền cho khách, ghi một khoản 'refund' số tiền âm vào ca đang mở.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_member(
  p_member_id UUID,
  p_shift_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_refund_amount NUMERIC DEFAULT 0,
  p_refund_method TEXT DEFAULT 'TM',
  p_note TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user UUID := auth.uid(); v_member members%ROWTYPE; v_refund NUMERIC := COALESCE(p_refund_amount, 0); v_payment_id UUID;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Chỉ Admin mới có quyền xóa hội viên.'; END IF;
  IF v_refund < 0 THEN RAISE EXCEPTION 'Số tiền hoàn không hợp lệ'; END IF;

  SELECT * INTO v_member FROM members WHERE id = p_member_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy hội viên (có thể đã bị xóa).'; END IF;

  IF v_refund > 0 THEN
    IF p_refund_method NOT IN ('TM', 'CK') THEN RAISE EXCEPTION 'Hình thức hoàn tiền không hợp lệ'; END IF;
    IF NOT EXISTS (SELECT 1 FROM shifts WHERE id = p_shift_id AND status = 'open') THEN
      RAISE EXCEPTION 'Cần mở ca để ghi nhận khoản hoàn tiền.';
    END IF;

    INSERT INTO payment_logs (member_id, shift_id, staff_id, staff_member_id, amount, payment_method, payment_type, is_verified, verified_by, verified_at, note, created_at)
    VALUES (p_member_id, p_shift_id, v_user, p_staff_id, -v_refund, p_refund_method, 'refund', true, v_user, NOW(),
            COALESCE(NULLIF(p_note, ''), 'Hoàn tiền khi xóa hội viên'), NOW())
    RETURNING id INTO v_payment_id;
  END IF;

  -- Đổi mã để mã cũ dùng lại được (member_code là UNIQUE)
  UPDATE members
  SET deleted_at = NOW(),
      member_code = CASE WHEN member_code IS NULL THEN NULL ELSE member_code || '_del_' || (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT END
  WHERE id = p_member_id;

  INSERT INTO member_logs (member_id, staff_id, staff_member_id, action, note, details)
  VALUES (p_member_id, v_user, p_staff_id, 'DELETE', COALESCE(NULLIF(p_note, ''), 'Xóa hội viên'),
          jsonb_build_object('refund_amount', v_refund, 'refund_payment_id', v_payment_id, 'member_code', v_member.member_code));

  INSERT INTO staff_logs (staff_id, staff_member_id, action, target_item, details, note)
  VALUES (v_user, p_staff_id, 'Xóa hội viên', v_member.full_name,
          json_build_object('member_id', p_member_id, 'member_code', v_member.member_code, 'refund_amount', v_refund),
          CASE WHEN v_refund > 0 THEN 'Xóa hội viên, hoàn tiền ' || v_refund ELSE 'Xóa hội viên, không hoàn tiền' END);

  RETURN json_build_object('success', true, 'refund_payment_id', v_payment_id);
END;
$$;

-- ------------------------------------------------------------
-- 12. Tổng doanh thu tính bằng SQL (L2): không bị giới hạn 1000 dòng
-- Chạy với quyền người gọi (RLS vẫn áp dụng).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_revenue_summary(
  p_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql STABLE
AS $$
  SELECT json_build_object(
    'water', (SELECT COALESCE(SUM(total_price), 0) FROM sales_logs
              WHERE (p_start IS NULL OR sold_at >= p_start) AND (p_end IS NULL OR sold_at <= p_end)),
    'member', (SELECT COALESCE(SUM(amount), 0) FROM payment_logs
               WHERE is_verified = true
                 AND (p_start IS NULL OR created_at >= p_start) AND (p_end IS NULL OR created_at <= p_end)),
    'service', (SELECT COALESCE(SUM(total_price), 0) FROM service_sales
                WHERE (p_start IS NULL OR sold_at >= p_start) AND (p_end IS NULL OR sold_at <= p_end))
  );
$$;

-- ------------------------------------------------------------
-- 13. Quyền gọi hàm: chỉ tài khoản đã đăng nhập
-- ------------------------------------------------------------
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

COMMIT;
