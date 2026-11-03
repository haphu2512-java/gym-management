-- ============================================================
-- Danh sách hành động cho bộ lọc ở trang Nhật ký hoạt động (03/11/2026)
--   get_staff_log_actions(): trả về các giá trị action khác nhau đang có trong staff_logs.
--   Chỉ đọc, không đổi dữ liệu. Frontend vẫn chạy khi chưa chạy file này
--   (khi đó tự lấy danh sách từ dữ liệu log).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION get_staff_log_actions()
RETURNS TABLE (action TEXT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT DISTINCT l.action FROM staff_logs l
  WHERE l.action IS NOT NULL AND l.action <> ''
  ORDER BY 1;
$$;

REVOKE EXECUTE ON FUNCTION get_staff_log_actions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_staff_log_actions() TO authenticated, service_role;

COMMIT;
