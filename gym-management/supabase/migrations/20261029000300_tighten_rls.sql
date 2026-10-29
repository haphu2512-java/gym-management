-- ============================================================
-- GIAI ĐOẠN B: siết RLS (B1) (29/10/2026)
-- Chạy SAU KHI frontend mới đã deploy. Nếu chạy khi web còn bản cũ,
-- các thao tác như chốt ca, hoàn tác bán hàng, xóa hội viên của bản cũ sẽ bị chặn.
--
-- Nguyên tắc:
--   - Mọi tài khoản đăng nhập được XEM.
--   - Bảng tiền (thanh toán, bán hàng, ca), lương, kho: nhân viên chỉ ghi qua hàm RPC
--     (SECURITY DEFINER, đã kiểm tra quyền bên trong). Ghi trực tiếp chỉ admin.
--   - Chi tiêu trong ca: ghi được khi ca còn mở (admin thì luôn được).
--   - Thông tin hội viên, ghi chú, nhật ký: nhân viên vẫn ghi được như cũ.
-- ============================================================

BEGIN;

-- Xóa các policy "Full access" cũ
DROP POLICY IF EXISTS "Full access members" ON members;
DROP POLICY IF EXISTS "Full access products" ON products;
DROP POLICY IF EXISTS "Full access shifts" ON shifts;
DROP POLICY IF EXISTS "Full access expenses" ON shift_expenses;
DROP POLICY IF EXISTS "Full access logs" ON staff_logs;
DROP POLICY IF EXISTS "Full access sales" ON sales_logs;
DROP POLICY IF EXISTS "Full access payments" ON payment_logs;
DROP POLICY IF EXISTS "Full access m_logs" ON member_logs;
DROP POLICY IF EXISTS "Full access schedule" ON weekly_schedules;
DROP POLICY IF EXISTS "Full access salary_cfg" ON salary_configs;
DROP POLICY IF EXISTS "Full access salary_adj" ON salary_adjustments;
DROP POLICY IF EXISTS "Full access services" ON services;
DROP POLICY IF EXISTS "Full access service_sales" ON service_sales;

-- Helper tạo cặp policy "ai cũng xem, admin mới ghi"
CREATE OR REPLACE FUNCTION pg_temp.read_all_write_admin(p_table TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS "Read %1$s" ON %1$I', p_table);
  EXECUTE format('DROP POLICY IF EXISTS "Admin write %1$s" ON %1$I', p_table);
  EXECUTE format('CREATE POLICY "Read %1$s" ON %1$I FOR SELECT TO authenticated USING (true)', p_table);
  EXECUTE format('CREATE POLICY "Admin write %1$s" ON %1$I FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())', p_table);
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products', 'services', 'shifts',
    'sales_logs', 'service_sales', 'payment_logs',
    'weekly_schedules', 'salary_configs', 'salary_adjustments'
  ] LOOP
    PERFORM pg_temp.read_all_write_admin(t);
  END LOOP;
END $$;

-- members: nhân viên sửa được thông tin (tên, mã, vân tay, ghi chú); tạo và xóa đi qua RPC
DROP POLICY IF EXISTS "Read members" ON members;
DROP POLICY IF EXISTS "Update members" ON members;
DROP POLICY IF EXISTS "Admin write members" ON members;
CREATE POLICY "Read members" ON members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Update members" ON members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin write members" ON members FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Nhân viên sửa trực tiếp không được đụng tới trạng thái xóa/bảo lưu (phải đi qua RPC).
-- Hàm RPC chạy SECURITY DEFINER (current_user là chủ hàm) nên không bị chặn.
CREATE OR REPLACE FUNCTION protect_member_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT is_admin() AND (
    NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
    OR NEW.remaining_days IS DISTINCT FROM OLD.remaining_days
  ) THEN
    RAISE EXCEPTION 'Không được sửa trực tiếp trạng thái xóa/bảo lưu của hội viên.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS members_protect_status ON members;
CREATE TRIGGER members_protect_status BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION protect_member_status();

-- member_logs: nhân viên thêm log (sửa thông tin hội viên) nhưng không được tự đặt trạng thái
-- đã duyệt chuyển khoản; sửa/xóa log chỉ admin
DROP POLICY IF EXISTS "Read member_logs" ON member_logs;
DROP POLICY IF EXISTS "Insert member_logs" ON member_logs;
DROP POLICY IF EXISTS "Admin write member_logs" ON member_logs;
CREATE POLICY "Read member_logs" ON member_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert member_logs" ON member_logs FOR INSERT TO authenticated WITH CHECK (is_payment_verified IS NULL);
CREATE POLICY "Admin write member_logs" ON member_logs FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- staff_logs: ai cũng ghi được nhật ký, sửa/xóa chỉ admin
DROP POLICY IF EXISTS "Read staff_logs" ON staff_logs;
DROP POLICY IF EXISTS "Insert staff_logs" ON staff_logs;
DROP POLICY IF EXISTS "Admin write staff_logs" ON staff_logs;
CREATE POLICY "Read staff_logs" ON staff_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert staff_logs" ON staff_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin write staff_logs" ON staff_logs FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- shift_expenses: ghi/sửa/xóa khi ca còn mở, admin thì luôn được
DROP POLICY IF EXISTS "Read shift_expenses" ON shift_expenses;
DROP POLICY IF EXISTS "Write open shift_expenses" ON shift_expenses;
CREATE POLICY "Read shift_expenses" ON shift_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Write open shift_expenses" ON shift_expenses FOR ALL TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM shifts s WHERE s.id = shift_id AND s.status = 'open'))
  WITH CHECK (is_admin() OR EXISTS (SELECT 1 FROM shifts s WHERE s.id = shift_id AND s.status = 'open'));

-- shift_notes, staff_members, profiles: giữ nguyên policy cũ

-- Role anon (chưa đăng nhập) không cần đọc bảng nào
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;

COMMIT;
