-- ============================================================
-- Sửa lỗi "new row violates row-level security policy for table member_logs" (29/10/2026)
-- Khi nhân viên sửa hội viên, trình duyệt còn bản web cũ (chưa tải lại trang) gửi kèm
-- is_payment_verified = false/true nên bị policy ở 0300 chặn.
-- Thay vì chặn, trigger tự xóa trạng thái duyệt CK trên log do nhân viên ghi.
-- Trigger BEFORE chạy trước khi RLS kiểm tra WITH CHECK nên dòng mới hợp lệ.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION strip_member_log_verification()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Hàm RPC chạy SECURITY DEFINER (current_user là chủ hàm) nên không bị ảnh hưởng
  IF current_user = 'authenticated' AND NOT is_admin() THEN
    NEW.is_payment_verified := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_logs_strip_verification ON member_logs;
CREATE TRIGGER member_logs_strip_verification BEFORE INSERT ON member_logs
  FOR EACH ROW EXECUTE FUNCTION strip_member_log_verification();

COMMIT;
