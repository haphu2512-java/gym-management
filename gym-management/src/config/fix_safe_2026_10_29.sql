-- ============================================================
-- BẢN SỬA AN TOÀN (29/10/2026)
-- Chạy 1 lần trong Supabase SQL Editor. Có thể chạy lại nhiều lần.
-- Không đổi tham số hàm nào, bản web đang chạy không bị ảnh hưởng.
--   1. Chặn role anon (chưa đăng nhập) gọi các hàm RPC.
--   2. View member_current_status: lấy ngày hết hạn mới sau khi kích hoạt lại bảo lưu.
--   3. suspend_member: không cho bảo lưu hội viên chưa có gói tập.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Quyền gọi hàm: chỉ tài khoản đã đăng nhập
-- ------------------------------------------------------------
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- ------------------------------------------------------------
-- 2. View trạng thái hội viên
-- Log REACTIVATE có package_type = NULL nên trước đây bị bỏ qua,
-- khiến end_date vẫn là ngày hết hạn cũ trước khi bảo lưu.
-- Giữ nguyên tên và thứ tự cột để CREATE OR REPLACE chạy được.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW member_current_status
WITH (security_invoker = true)
AS
WITH LatestPackage AS (
    SELECT DISTINCT ON (member_id)
      member_id, package_type, membership_category, start_date, end_date, fee, payment_method, created_at
    FROM member_logs
    WHERE package_type IS NOT NULL
    ORDER BY member_id, created_at DESC
),
LatestReactivate AS (
    SELECT DISTINCT ON (member_id)
      member_id, start_date, end_date, created_at
    FROM member_logs
    WHERE action = 'REACTIVATE'
    ORDER BY member_id, created_at DESC
),
LatestStatus AS (
    SELECT DISTINCT ON (member_id)
      member_id, is_payment_verified, created_at
    FROM member_logs
    WHERE is_payment_verified IS NOT NULL
    ORDER BY member_id, created_at DESC
)
SELECT
  m.id, m.member_code, m.full_name, m.fingerprint_status, m.note, m.created_at, m.deleted_at,
  m.suspended_at, m.remaining_days,
  lp.package_type, lp.membership_category,
  CASE WHEN lr.created_at > lp.created_at THEN lr.start_date ELSE lp.start_date END AS start_date,
  CASE WHEN lr.created_at > lp.created_at THEN lr.end_date ELSE lp.end_date END AS end_date,
  lp.fee, lp.payment_method,
  COALESCE(ls.is_payment_verified, FALSE) as is_payment_verified,
  (
    SELECT ml.created_at
    FROM member_logs ml
    WHERE ml.member_id = m.id AND ml.action IN ('CREATE', 'RENEW')
    ORDER BY ml.created_at DESC
    LIMIT 1
  ) as last_active_at
FROM members m
LEFT JOIN LatestPackage lp ON m.id = lp.member_id
LEFT JOIN LatestReactivate lr ON m.id = lr.member_id
LEFT JOIN LatestStatus ls ON m.id = ls.member_id
WHERE m.deleted_at IS NULL;

-- ------------------------------------------------------------
-- 3. Bảo lưu: chặn khi chưa có gói tập (end_date NULL)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION suspend_member(
  p_member_id UUID,
  p_staff_id UUID,
  p_shift_id UUID,
  p_suspended_at DATE DEFAULT CURRENT_DATE,
  p_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE v_remaining_days INT; v_end_date DATE; v_admin_id UUID;
BEGIN
  -- 1. Check if member is already suspended (Idempotency)
  IF EXISTS (SELECT 1 FROM members WHERE id = p_member_id AND suspended_at IS NOT NULL) THEN
    RETURN json_build_object('success', true, 'days', (SELECT remaining_days FROM members WHERE id = p_member_id), 'message', 'Already suspended');
  END IF;

  -- Kiểm tra ca có tồn tại và đang mở không
  IF NOT EXISTS (SELECT 1 FROM shifts WHERE id = p_shift_id AND status = 'open') THEN
    RAISE EXCEPTION 'Ca làm việc không tồn tại hoặc đã đóng.';
  END IF;

  SELECT opened_by INTO v_admin_id FROM shifts WHERE id = p_shift_id;

  SELECT (end_date - p_suspended_at) INTO v_remaining_days FROM member_current_status WHERE id = p_member_id;
  IF v_remaining_days IS NULL THEN RAISE EXCEPTION 'Hội viên chưa có gói tập để bảo lưu'; END IF;
  IF v_remaining_days < 13 THEN RAISE EXCEPTION 'Không đủ điều kiện (tối thiểu 13 ngày)'; END IF;

  UPDATE members SET suspended_at = p_suspended_at, remaining_days = v_remaining_days WHERE id = p_member_id;

  INSERT INTO member_logs (member_id, staff_id, staff_member_id, action, note, created_at)
  VALUES (p_member_id, v_admin_id, p_staff_id, 'SUSPEND', 'Bảo lưu (còn ' || v_remaining_days || ' ngày)', p_created_at);

  INSERT INTO staff_logs (staff_id, staff_member_id, action, target_item, details, created_at)
  VALUES (v_admin_id, p_staff_id, 'Bảo lưu hội viên', (SELECT full_name FROM members WHERE id = p_member_id), json_build_object('days', v_remaining_days, 'shift_id', p_shift_id), p_created_at);

  RETURN json_build_object('success', true, 'days', v_remaining_days);
END;
$$ LANGUAGE plpgsql;

-- suspend_member vừa tạo lại, cấp quyền lại cho chắc
REVOKE EXECUTE ON FUNCTION suspend_member(UUID, UUID, UUID, DATE, TIMESTAMP WITH TIME ZONE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION suspend_member(UUID, UUID, UUID, DATE, TIMESTAMP WITH TIME ZONE) TO authenticated, service_role;

COMMIT;

-- Kiểm tra sau khi chạy (kết quả phải là false):
-- SELECT has_function_privilege('anon', 'verify_all_payments_atomic(uuid, uuid, timestamptz)', 'EXECUTE');
