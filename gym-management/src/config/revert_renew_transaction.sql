-- ============================================================
-- HÀM HOÀN TÁC GIA HẠN HỘI VIÊN (SECURITY DEFINER)
-- Chỉ tài khoản Admin mới có thể gọi hàm này.
-- Giới hạn thời gian hoàn tác trong 48 giờ.
-- Chỉ cho phép hoàn tác lượt gia hạn mới nhất để tránh đè đứt gãy lịch sử.
-- ============================================================

CREATE OR REPLACE FUNCTION revert_renew_transaction(
  p_log_id UUID,
  p_admin_id UUID
) RETURNS JSON AS $$
DECLARE
  v_member_id UUID;
  v_payment_id UUID;
  v_created_at TIMESTAMP WITH TIME ZONE;
  v_fee NUMERIC;
  v_package_type INT;
  v_name TEXT;
  v_role TEXT;
  v_is_latest BOOLEAN;
BEGIN
  -- 1. Kiểm tra quyền Admin
  SELECT role INTO v_role FROM profiles WHERE id = p_admin_id;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Chỉ Admin mới có quyền hoàn tác giao dịch.');
  END IF;

  -- 2. Lấy thông tin bản ghi log cần xóa
  SELECT member_id, created_at, fee, package_type, (details->>'payment_id')::UUID
  INTO v_member_id, v_created_at, v_fee, v_package_type, v_payment_id
  FROM member_logs
  WHERE id = p_log_id AND action = 'RENEW';

  IF v_member_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Không tìm thấy lịch sử gia hạn cần hoàn tác.');
  END IF;

  -- 3. Kiểm tra giới hạn thời gian (48 giờ)
  IF v_created_at < NOW() - INTERVAL '48 hours' THEN
    RETURN json_build_object('success', false, 'error', 'Giao dịch đã quá 48 giờ, không thể hoàn tác.');
  END IF;

  -- 4. Kiểm tra xem có phải là lượt gia hạn RENEW mới nhất của hội viên này không
  SELECT NOT EXISTS (
    SELECT 1 FROM member_logs 
    WHERE member_id = v_member_id 
      AND action = 'RENEW' 
      AND created_at > v_created_at
  ) INTO v_is_latest;

  IF NOT v_is_latest THEN
    RETURN json_build_object('success', false, 'error', 'Đây không phải là lượt gia hạn mới nhất của hội viên này.');
  END IF;

  -- 5. Thực hiện xóa các bản ghi liên quan
  -- A. Xóa trong payment_logs
  IF v_payment_id IS NOT NULL THEN
    DELETE FROM payment_logs WHERE id = v_payment_id;
  END IF;

  -- B. Xóa trong staff_logs (những hành động gia hạn được ghi nhận lệch không quá 5 giây)
  SELECT full_name INTO v_name FROM members WHERE id = v_member_id;
  DELETE FROM staff_logs 
  WHERE action = 'Gia hạn hội viên'
    AND target_item = v_name
    AND created_at BETWEEN v_created_at - INTERVAL '5 seconds' AND v_created_at + INTERVAL '5 seconds';

  -- C. Xóa trong member_logs
  DELETE FROM member_logs WHERE id = p_log_id;

  -- D. Ghi log kiểm toán (audit log) về hành động hoàn tác này
  INSERT INTO staff_logs (staff_id, action, target_item, details, created_at)
  VALUES (p_admin_id, 'Hoàn tác gia hạn', v_name, json_build_object('fee', v_fee, 'months', v_package_type, 'reverted_log_id', p_log_id), NOW());

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
