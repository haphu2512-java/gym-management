-- 1. Thêm cột bảo lưu vào bảng members
ALTER TABLE members ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS remaining_days INT;

-- 2. Cập nhật View để lấy thêm thông tin bảo lưu
DROP VIEW IF EXISTS member_current_status CASCADE;
CREATE OR REPLACE VIEW member_current_status AS
WITH LatestPackage AS (
    SELECT DISTINCT ON (member_id)
      member_id,
      package_type,
      membership_category,
      start_date,
      end_date,
      fee,
      payment_method,
      created_at
    FROM member_logs
    WHERE package_type IS NOT NULL
    ORDER BY member_id, created_at DESC
),
LatestStatus AS (
    SELECT DISTINCT ON (member_id)
      member_id,
      is_payment_verified,
      created_at
    FROM member_logs
    WHERE is_payment_verified IS NOT NULL
    ORDER BY member_id, created_at DESC
)
SELECT 
  m.id,
  m.member_code,
  m.full_name,
  m.fingerprint_status,
  m.note,
  m.created_at,
  m.deleted_at,
  m.suspended_at,    -- Cột mới
  m.remaining_days,  -- Cột mới
  lp.package_type,
  lp.membership_category,
  lp.start_date,
  lp.end_date,
  lp.fee,
  lp.payment_method,
  COALESCE(ls.is_payment_verified, FALSE) as is_payment_verified,
  lp.created_at as last_active_at
FROM members m
LEFT JOIN LatestPackage lp ON m.id = lp.member_id
LEFT JOIN LatestStatus ls ON m.id = ls.member_id
WHERE m.deleted_at IS NULL;

-- 3. Hàm thực hiện bảo lưu
CREATE OR REPLACE FUNCTION suspend_member(
  p_member_id UUID,
  p_staff_id UUID,
  p_suspended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  v_end_date DATE;
  v_remaining_days INT;
BEGIN
  -- 1. Lấy ngày hết hạn hiện tại từ log gói tập gần nhất
  SELECT end_date INTO v_end_date
  FROM member_logs
  WHERE member_id = p_member_id AND package_type IS NOT NULL
  ORDER BY created_at DESC LIMIT 1;

  IF v_end_date IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Hội viên không có gói tập để bảo lưu');
  END IF;

  -- 2. Tính số ngày còn lại (bao gồm cả ngày hôm nay)
  -- Sử dụng múi giờ Việt Nam để đồng bộ với nghiệp vụ tại quầy
  v_remaining_days := v_end_date - (p_suspended_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE;

  -- 3. Kiểm tra điều kiện 13 ngày
  IF v_remaining_days < 13 THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Chỉ hội viên còn từ 13 ngày tập trở lên mới được bảo lưu. Hiện tại chỉ còn ' || v_remaining_days || ' ngày.'
    );
  END IF;

  -- 4. Kiểm tra xem đã bảo lưu chưa
  IF EXISTS (SELECT 1 FROM members WHERE id = p_member_id AND suspended_at IS NOT NULL) THEN
    RETURN json_build_object('success', false, 'error', 'Hội viên này đã ở trạng thái bảo lưu');
  END IF;

  -- 5. Cập nhật bảng members
  UPDATE members 
  SET 
    suspended_at = p_suspended_at,
    remaining_days = v_remaining_days
  WHERE id = p_member_id;

  -- 6. Lưu log hành động
  INSERT INTO member_logs (member_id, staff_id, action, details, note, created_at)
  VALUES (p_member_id, p_staff_id, 'SUSPEND', 
          json_build_object(
            'remaining_days', v_remaining_days, 
            'suspended_at', p_suspended_at,
            'original_end_date', v_end_date
          ),
          'Bảo lưu hội viên (còn ' || v_remaining_days || ' ngày)', p_suspended_at);

  -- 7. Ghi vào nhật ký hoạt động (staff_logs) để hiện lên màn hình Admin
  INSERT INTO staff_logs (staff_id, action, target_item, details, created_at)
  VALUES (p_staff_id, 'Bảo lưu hội viên', (SELECT full_name FROM members WHERE id = p_member_id),
          json_build_object('member_id', p_member_id, 'remaining_days', v_remaining_days),
          p_suspended_at);

  RETURN json_build_object('success', true, 'remaining_days', v_remaining_days);
END;
$$ LANGUAGE plpgsql;

-- 4. Hàm thực hiện kích hoạt lại sau bảo lưu
CREATE OR REPLACE FUNCTION reactivate_member(
  p_member_id UUID,
  p_staff_id UUID,
  p_reactivated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
  v_remaining_days INT;
  v_new_end_date DATE;
  v_last_pkg RECORD;
BEGIN
  SELECT remaining_days INTO v_remaining_days FROM members WHERE id = p_member_id;
  
  IF v_remaining_days IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Hội viên không ở trạng thái bảo lưu');
  END IF;

  -- Lấy thông tin gói tập gần nhất để điền vào log mới
  SELECT package_type, membership_category, fee, payment_method 
  INTO v_last_pkg
  FROM member_logs 
  WHERE member_id = p_member_id AND package_type IS NOT NULL
  ORDER BY created_at DESC LIMIT 1;

  v_new_end_date := (p_reactivated_at + (v_remaining_days || ' days')::INTERVAL)::DATE;

  UPDATE members 
  SET 
    suspended_at = NULL,
    remaining_days = NULL
  WHERE id = p_member_id;

  -- Tạo log kích hoạt lại (với end_date mới) để View cập nhật đúng
  INSERT INTO member_logs (
    member_id, staff_id, action, 
    package_type, membership_category, start_date, end_date, fee, payment_method, is_payment_verified,
    note, created_at
  )
  VALUES (
    p_member_id, p_staff_id, 'REACTIVATE', 
    v_last_pkg.package_type, v_last_pkg.membership_category, p_reactivated_at::DATE, v_new_end_date, 
    v_last_pkg.fee, v_last_pkg.payment_method, TRUE,
    'Kích hoạt lại sau bảo lưu', p_reactivated_at
  );

  -- Ghi vào nhật ký hoạt động (staff_logs)
  INSERT INTO staff_logs (staff_id, action, target_item, details, created_at)
  VALUES (p_staff_id, 'Kích hoạt lại hội viên', (SELECT full_name FROM members WHERE id = p_member_id),
          json_build_object('member_id', p_member_id, 'new_end_date', v_new_end_date),
          p_reactivated_at);

  RETURN json_build_object('success', true, 'new_end_date', v_new_end_date);
END;
$$ LANGUAGE plpgsql;
