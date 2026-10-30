-- ============================================================
-- Sửa nhập nhầm trong ca (30/10/2026)
--   1. change_payment_method: đổi TM <-> CK cho một lần đăng ký/gia hạn
--      (nhân viên chọn nhầm tiền mặt cho khoản chuyển khoản làm lệch tiền két).
--   2. delete_member thêm chế độ "nhập nhầm": tự hoàn đúng các khoản đã thu của hội viên
--      trong ca đang mở (cùng số tiền, cùng hình thức), nên tiền ca về như chưa nhập.
--   Cả hai chỉ Admin được dùng, để quản lý kiểm soát việc sửa tiền.
-- Chạy được bất cứ lúc nào sau 0400; frontend cũ vẫn dùng được.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Đổi hình thức thanh toán
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION change_payment_method(
  p_member_log_id UUID,
  p_new_method TEXT,
  p_staff_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := require_login();
  v_log member_logs%ROWTYPE;
  v_pay payment_logs%ROWTYPE;
  v_member_name TEXT;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Chỉ Admin mới được đổi hình thức thanh toán.'; END IF;
  IF p_new_method NOT IN ('TM', 'CK') THEN RAISE EXCEPTION 'Hình thức thanh toán không hợp lệ'; END IF;

  SELECT * INTO v_log FROM member_logs
  WHERE id = p_member_log_id AND action IN ('CREATE', 'RENEW')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy lượt đăng ký/gia hạn.'; END IF;

  -- Log tạo từ 29/10/2026 lưu payment_id; log cũ hơn thì ghép theo hội viên + thời điểm
  SELECT * INTO v_pay FROM payment_logs
  WHERE id = NULLIF(v_log.details->>'payment_id', '')::UUID
  FOR UPDATE;
  IF NOT FOUND THEN
    SELECT * INTO v_pay FROM payment_logs
    WHERE member_id = v_log.member_id
      AND payment_type = CASE v_log.action WHEN 'CREATE' THEN 'new' ELSE 'renew' END
      AND created_at BETWEEN v_log.created_at - INTERVAL '10 seconds' AND v_log.created_at + INTERVAL '10 seconds'
    ORDER BY abs(EXTRACT(EPOCH FROM (created_at - v_log.created_at)))
    LIMIT 1
    FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy khoản thu của lượt này.'; END IF;

  IF v_pay.payment_method = p_new_method THEN
    RETURN json_build_object('success', true, 'changed', false);
  END IF;

  UPDATE payment_logs
  SET payment_method = p_new_method,
      is_verified = (p_new_method = 'TM'),
      verified_by = NULL,
      verified_at = NULL,
      note = concat_ws(' | ', NULLIF(note, ''), 'Đổi ' || v_pay.payment_method || ' → ' || p_new_method)
  WHERE id = v_pay.id;

  UPDATE member_logs
  SET payment_method = p_new_method,
      is_payment_verified = (p_new_method = 'TM'),
      details = COALESCE(details, '{}'::jsonb) || jsonb_build_object(
        'payment_id', v_pay.id,
        'method_changed_from', v_pay.payment_method,
        'method_changed_at', NOW(),
        'method_changed_by', v_user)
  WHERE id = v_log.id;

  SELECT full_name INTO v_member_name FROM members WHERE id = v_log.member_id;
  INSERT INTO staff_logs (staff_id, staff_member_id, action, target_item, details, note)
  VALUES (v_user, p_staff_id, 'Đổi hình thức thanh toán', v_member_name,
          json_build_object('member_log_id', v_log.id, 'payment_id', v_pay.id, 'amount', v_pay.amount,
                            'from', v_pay.payment_method, 'to', p_new_method),
          'Đổi ' || v_pay.payment_method || ' → ' || p_new_method || ' (' || v_pay.amount || 'đ)');

  RETURN json_build_object('success', true, 'changed', true, 'payment_id', v_pay.id);
END;
$$;

-- ------------------------------------------------------------
-- 2. Xóa hội viên: thêm chế độ nhập nhầm
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS delete_member(UUID, UUID, UUID, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION delete_member(
  p_member_id UUID,
  p_shift_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_refund_amount NUMERIC DEFAULT 0,
  p_refund_method TEXT DEFAULT 'TM',
  p_note TEXT DEFAULT NULL,
  p_void_current_shift BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := require_login();
  v_member members%ROWTYPE;
  v_refund NUMERIC := COALESCE(p_refund_amount, 0);
  v_payment_id UUID;
  v_pay RECORD;
  v_voided INT := 0;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Chỉ Admin mới có quyền xóa hội viên.'; END IF;

  SELECT * INTO v_member FROM members WHERE id = p_member_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy hội viên (có thể đã bị xóa).'; END IF;

  IF p_void_current_shift THEN
    -- Nhập nhầm: hoàn đúng các khoản đã thu trong ca đang mở
    IF NOT EXISTS (SELECT 1 FROM shifts WHERE id = p_shift_id AND status = 'open') THEN
      RAISE EXCEPTION 'Cần có ca đang mở để hủy khoản nhập nhầm.';
    END IF;
    v_refund := 0;
    FOR v_pay IN
      SELECT * FROM payment_logs
      WHERE member_id = p_member_id AND shift_id = p_shift_id
        AND payment_type IN ('new', 'renew') AND amount > 0
      ORDER BY created_at
    LOOP
      INSERT INTO payment_logs (member_id, shift_id, staff_id, staff_member_id, amount, payment_method, payment_type, is_verified, note, created_at)
      VALUES (p_member_id, p_shift_id, v_user, p_staff_id, -v_pay.amount, v_pay.payment_method, 'refund',
              v_pay.is_verified, 'Hủy do nhập nhầm (khoản thu ' || v_pay.id || ')', NOW());
      v_refund := v_refund + v_pay.amount;
      v_voided := v_voided + 1;
    END LOOP;

    IF v_voided = 0 THEN
      RAISE EXCEPTION 'Hội viên không có khoản thu nào trong ca này.';
    END IF;
  ELSE
    IF v_refund < 0 THEN RAISE EXCEPTION 'Số tiền hoàn không hợp lệ'; END IF;

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
  END IF;

  -- Đổi mã để mã cũ dùng lại được (member_code là UNIQUE)
  UPDATE members
  SET deleted_at = NOW(),
      member_code = CASE WHEN member_code IS NULL THEN NULL ELSE member_code || '_del_' || (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT END
  WHERE id = p_member_id;

  INSERT INTO member_logs (member_id, staff_id, staff_member_id, action, note, details)
  VALUES (p_member_id, v_user, p_staff_id, 'DELETE',
          COALESCE(NULLIF(p_note, ''), CASE WHEN p_void_current_shift THEN 'Xóa do nhập nhầm' ELSE 'Xóa hội viên' END),
          jsonb_build_object('refund_amount', v_refund, 'refund_payment_id', v_payment_id,
                             'member_code', v_member.member_code, 'void_current_shift', p_void_current_shift));

  INSERT INTO staff_logs (staff_id, staff_member_id, action, target_item, details, note)
  VALUES (v_user, p_staff_id, 'Xóa hội viên', v_member.full_name,
          json_build_object('member_id', p_member_id, 'member_code', v_member.member_code,
                            'refund_amount', v_refund, 'void_current_shift', p_void_current_shift),
          CASE
            WHEN p_void_current_shift THEN 'Xóa do nhập nhầm, hủy ' || v_refund || 'đ đã thu trong ca'
            WHEN v_refund > 0 THEN 'Xóa hội viên, hoàn tiền ' || v_refund
            ELSE 'Xóa hội viên, không hoàn tiền'
          END);

  RETURN json_build_object('success', true, 'refund_payment_id', v_payment_id, 'refund_amount', v_refund);
END;
$$;

REVOKE EXECUTE ON FUNCTION change_payment_method(UUID, TEXT, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION delete_member(UUID, UUID, UUID, NUMERIC, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION change_payment_method(UUID, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION delete_member(UUID, UUID, UUID, NUMERIC, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;

COMMIT;
