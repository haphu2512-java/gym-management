-- Kiểm thử RLS và các hàm RPC trên Postgres local (không cần Supabase).
-- Chạy: xem supabase/README.md, mục "Kiểm thử SQL".
-- Mỗi khối kiểm tra RAISE EXCEPTION nếu sai, nên script dừng ở lỗi đầu tiên.
\set ON_ERROR_STOP 1
SET client_min_messages = warning;

-- Không dùng được với RLS: UPDATE/DELETE bị RLS chặn chỉ ảnh hưởng 0 dòng, không báo lỗi,
-- nên các bước đó kiểm tra lại dữ liệu sau khi chạy.

-- Dữ liệu mẫu (chạy với quyền postgres)
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'admin@gym.com'),
  ('00000000-0000-0000-0000-00000000000b', 'staff@gym.com');
UPDATE profiles SET role = 'admin' WHERE id = '00000000-0000-0000-0000-00000000000a';
INSERT INTO staff_members (id, full_name) VALUES ('00000000-0000-0000-0000-0000000000f1', 'NV 1');
INSERT INTO products (id, name, price, stock_quantity) VALUES ('00000000-0000-0000-0000-0000000000d1', 'Pocari', 15000, 2);
INSERT INTO services (id, name, price) VALUES ('00000000-0000-0000-0000-0000000000e1', 'Tập ngày', 50000);

CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_sql TEXT, p_like TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_like THEN RAISE EXCEPTION 'Sai lỗi cho [%]: % (mong đợi %)', p_sql, SQLERRM, p_like; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Mong đợi lỗi nhưng chạy được: %', p_sql;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.check(p_ok BOOLEAN, p_msg TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF NOT COALESCE(p_ok, false) THEN RAISE EXCEPTION 'FAIL: %', p_msg; END IF; END $$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO PUBLIC;

-- ---------- anon ----------
SET ROLE anon;
SELECT pg_temp.expect_error('SELECT verify_all_payments_atomic()', '%permission denied%');
SELECT pg_temp.expect_error('SELECT * FROM payment_logs', '%permission denied%');
RESET ROLE;

-- ---------- staff ----------
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

SELECT pg_temp.check(NOT is_admin(), 'staff không phải admin');
SELECT open_shift('Ca 1', 100000, '', '00000000-0000-0000-0000-0000000000f1');
SELECT pg_temp.expect_error($$SELECT open_shift('Ca 2', 0, '', '00000000-0000-0000-0000-0000000000f1')$$, '%Đã có ca đang mở%');
CREATE TEMP TABLE ctx AS SELECT id AS shift_id FROM shifts WHERE status = 'open';

-- Tạo hội viên CK, 3 tháng
SELECT create_member_transaction('HV01', 'Anh A', 3, 'normal', 900000, 'CK', (SELECT shift_id FROM ctx),
  '00000000-0000-0000-0000-0000000000f1', false, '', local_today(), NOW() - INTERVAL '30 days', 'k1');
SELECT pg_temp.check((SELECT created_at > NOW() - INTERVAL '1 minute' FROM payment_logs WHERE payment_type = 'new'), 'B5: thời điểm do server ghi, không lấy p_created_at');
SELECT pg_temp.check((SELECT staff_id = '00000000-0000-0000-0000-00000000000b' FROM payment_logs WHERE payment_type = 'new'), 'staff_id = auth.uid()');

-- Bán nước: giá lấy từ products dù client gửi giá 1đ
SELECT sell_bottle_transaction('00000000-0000-0000-0000-0000000000d1', (SELECT shift_id FROM ctx), NULL, '00000000-0000-0000-0000-0000000000f1', 2, 1, 'TM', NOW());
SELECT pg_temp.check((SELECT total_price = 30000 FROM sales_logs), 'B5: giá bán tính từ products');
SELECT pg_temp.expect_error($$SELECT sell_bottle_transaction('00000000-0000-0000-0000-0000000000d1', (SELECT shift_id FROM ctx), NULL, NULL, 1, 0, 'TM', NOW())$$, '%Hết hàng%');
SELECT pg_temp.expect_error($$SELECT sell_bottle_transaction('00000000-0000-0000-0000-0000000000d1', (SELECT shift_id FROM ctx), NULL, NULL, -5, 0, 'TM', NOW())$$, '%Số lượng không hợp lệ%');
SELECT pg_temp.check((SELECT stock_quantity = 0 FROM products), 'tồn kho = 0');

-- Bán dịch vụ
SELECT sell_service_transaction('00000000-0000-0000-0000-0000000000e1', (SELECT shift_id FROM ctx), NULL, NULL, 2, 1, 'TM', NOW());
SELECT pg_temp.check((SELECT total_price = 100000 FROM service_sales), 'giá dịch vụ tính từ services');

-- Staff không ghi trực tiếp được bảng tiền
UPDATE payment_logs SET amount = 0;
SELECT pg_temp.check((SELECT bool_and(amount > 0) FROM payment_logs), 'B1: staff không sửa được payment_logs');
DELETE FROM sales_logs;
SELECT pg_temp.check((SELECT count(*) = 1 FROM sales_logs), 'B1: staff không xóa được sales_logs');
UPDATE salary_configs SET rate_per_shift = 0;
SELECT pg_temp.expect_error($$INSERT INTO salary_configs (shift_name, staff_type, rate_per_shift) VALUES ('Ca 1', 'CT', 1)$$, '%row-level security%');
UPDATE products SET stock_quantity = 999;
SELECT pg_temp.check((SELECT stock_quantity = 0 FROM products), 'B1: staff không sửa được kho');
-- Bản web cũ gửi kèm is_payment_verified: không lỗi, nhưng trạng thái duyệt bị bỏ (0400)
INSERT INTO member_logs (member_id, action, is_payment_verified, note) SELECT id, 'UPDATE', true, 'web cũ true' FROM members;
INSERT INTO member_logs (member_id, action, is_payment_verified, note) SELECT id, 'UPDATE', false, 'web cũ false' FROM members;
SELECT pg_temp.check((SELECT bool_and(is_payment_verified IS NULL) FROM member_logs WHERE note LIKE 'web cũ%'), 'staff không tự đặt trạng thái duyệt CK');
SELECT pg_temp.expect_error($$UPDATE members SET deleted_at = NOW()$$, '%trạng thái xóa/bảo lưu%');
UPDATE members SET note = 'staff sửa ghi chú được';
SELECT pg_temp.check((SELECT note = 'staff sửa ghi chú được' FROM members), 'staff sửa thông tin hội viên');

-- Staff không duyệt chuyển khoản được (B2), kể cả truyền UUID admin
SELECT pg_temp.check((SELECT (verify_all_payments_atomic('00000000-0000-0000-0000-00000000000a')->>'success')::boolean = false), 'B2: staff không duyệt được');
SELECT pg_temp.check((SELECT NOT is_verified FROM payment_logs WHERE payment_method = 'CK'), 'B2: payment vẫn chưa duyệt');

-- Chi tiêu trong ca đang mở
INSERT INTO shift_expenses (shift_id, amount, reason) SELECT shift_id, 20000, 'Đá' FROM ctx;

-- Hoàn tác bán nước: chỉ 1 lần, kho cộng lại đúng
SELECT rollback_sale((SELECT id FROM sales_logs), '00000000-0000-0000-0000-0000000000f1');
SELECT pg_temp.check((SELECT stock_quantity = 2 FROM products), 'L5: kho cộng lại 2');
SELECT pg_temp.expect_error($$SELECT rollback_sale('00000000-0000-0000-0000-000000000000')$$, '%Không tìm thấy giao dịch%');
SELECT rollback_service_sale((SELECT id FROM service_sales), NULL);
SELECT pg_temp.check((SELECT count(*) = 0 FROM service_sales), 'hoàn tác dịch vụ');

-- Bảo lưu / kích hoạt lại
SELECT suspend_member((SELECT id FROM members), '00000000-0000-0000-0000-0000000000f1', (SELECT shift_id FROM ctx));
SELECT reactivate_member((SELECT id FROM members), '00000000-0000-0000-0000-0000000000f1', (SELECT shift_id FROM ctx));
SELECT pg_temp.check((SELECT end_date = (SELECT end_date FROM member_logs WHERE action = 'REACTIVATE') FROM member_current_status), 'L1: end_date sau kích hoạt lại');

-- Staff không xóa hội viên được
SELECT pg_temp.expect_error($$SELECT delete_member((SELECT id FROM members))$$, '%Chỉ Admin%');

-- Chốt ca
SELECT close_shift((SELECT shift_id FROM ctx), 500000, 'ok', '00000000-0000-0000-0000-0000000000f1');
SELECT pg_temp.expect_error($$SELECT close_shift((SELECT shift_id FROM ctx), 1, 'chốt lại', NULL)$$, '%đã được chốt%');
SELECT pg_temp.check((SELECT ending_cash = 500000 FROM shifts), 'L7: không ghi đè tiền chốt ca');
SELECT pg_temp.expect_error($$INSERT INTO shift_expenses (shift_id, amount, reason) SELECT shift_id, 1, 'x' FROM ctx$$, '%row-level security%');
RESET ROLE;

-- ---------- admin ----------
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
SELECT pg_temp.check(is_admin(), 'admin');
SELECT pg_temp.check((SELECT (verify_all_payments_atomic()->>'count')::int = 1), 'admin duyệt CK');
SELECT pg_temp.check((SELECT is_verified AND verified_by = '00000000-0000-0000-0000-00000000000a' FROM payment_logs WHERE payment_type = 'new'), 'verified_by = admin');

SELECT pg_temp.check((SELECT ((get_revenue_summary()->>'member')::numeric) = 900000), 'L2: tổng doanh thu hội viên bằng SQL');

-- Xóa hội viên có hoàn tiền 300.000đ trong ca mới
SELECT open_shift('Ca 2', 0, '', '00000000-0000-0000-0000-0000000000f1');
SELECT delete_member((SELECT id FROM members), (SELECT id FROM shifts WHERE status = 'open'), '00000000-0000-0000-0000-0000000000f1', 300000, 'TM', 'Khách nghỉ');
SELECT pg_temp.check((SELECT amount = 900000 FROM payment_logs WHERE payment_type = 'new'), 'L3: khoản thu cũ giữ nguyên');
SELECT pg_temp.check((SELECT amount = -300000 AND shift_id = (SELECT id FROM shifts WHERE status = 'open') FROM payment_logs WHERE payment_type = 'refund'), 'L3: hoàn tiền âm ở ca hiện tại');
SELECT pg_temp.check((SELECT ((get_revenue_summary()->>'member')::numeric) = 600000), 'doanh thu sau hoàn tiền');
SELECT pg_temp.check((SELECT count(*) = 0 FROM member_current_status), 'hội viên đã ẩn');

-- Admin vẫn sửa trực tiếp được
UPDATE products SET stock_quantity = 10;
SELECT pg_temp.check((SELECT stock_quantity = 10 FROM products), 'admin sửa kho');
RESET ROLE;

-- ---------- Sửa nhập nhầm trong ca (0500) ----------
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
CREATE TEMP TABLE ctx2 AS SELECT id AS shift_id FROM shifts WHERE status = 'open';

SELECT create_member_transaction('HV02', 'Chị B', 1, 'normal', 350000, 'TM', (SELECT shift_id FROM ctx2),
  '00000000-0000-0000-0000-0000000000f1', false, '', local_today(), NULL, 'k2');
CREATE TEMP TABLE hv2 AS SELECT m.id AS member_id, l.id AS log_id FROM members m JOIN member_logs l ON l.member_id = m.id AND l.action = 'CREATE' WHERE m.member_code = 'HV02';

-- Chọn nhầm TM, đổi sang CK: tiền mặt ca giảm, hội viên chuyển sang chờ duyệt
SELECT change_payment_method((SELECT log_id FROM hv2), 'CK', '00000000-0000-0000-0000-0000000000f1');
SELECT pg_temp.check((SELECT payment_method = 'CK' AND NOT is_verified FROM payment_logs WHERE member_id = (SELECT member_id FROM hv2)), 'đổi TM→CK trên payment_logs');
SELECT pg_temp.check((SELECT payment_method = 'CK' AND NOT is_payment_verified FROM member_current_status WHERE id = (SELECT member_id FROM hv2)), 'hội viên chờ duyệt CK sau khi đổi');
SELECT change_payment_method((SELECT log_id FROM hv2), 'TM', '00000000-0000-0000-0000-0000000000f1');
SELECT pg_temp.check((SELECT payment_method = 'TM' AND is_verified FROM payment_logs WHERE member_id = (SELECT member_id FROM hv2)), 'đổi CK→TM');
SELECT pg_temp.expect_error($$SELECT change_payment_method((SELECT log_id FROM hv2), 'XX')$$, '%không hợp lệ%');

-- Log cũ không có payment_id vẫn tìm được khoản thu
RESET ROLE;
UPDATE member_logs SET details = details - 'payment_id' WHERE id = (SELECT log_id FROM hv2);
SET ROLE authenticated;
SELECT change_payment_method((SELECT log_id FROM hv2), 'CK');
SELECT pg_temp.check((SELECT payment_method = 'CK' FROM payment_logs WHERE member_id = (SELECT member_id FROM hv2)), 'đổi được với log cũ');
SELECT change_payment_method((SELECT log_id FROM hv2), 'TM');

-- Ca đã chốt: nhân viên không đổi được
SELECT pg_temp.expect_error($$SELECT change_payment_method((SELECT id FROM member_logs WHERE action = 'CREATE' AND member_id <> (SELECT member_id FROM hv2)), 'TM')$$, '%ca thu tiền còn mở%');

-- Nhân viên xóa thường: bị chặn; xóa do nhập nhầm: được, tiền ca về 0
SELECT pg_temp.expect_error($$SELECT delete_member((SELECT member_id FROM hv2), (SELECT shift_id FROM ctx2))$$, '%Chỉ Admin%');
SELECT delete_member((SELECT member_id FROM hv2), (SELECT shift_id FROM ctx2), '00000000-0000-0000-0000-0000000000f1', 0, 'TM', NULL, true);
SELECT pg_temp.check((SELECT SUM(amount) = 0 FROM payment_logs WHERE member_id = (SELECT member_id FROM hv2)), 'nhập nhầm: tổng thu của hội viên trong ca = 0');
SELECT pg_temp.check((SELECT payment_method = 'TM' AND amount = -350000 FROM payment_logs WHERE member_id = (SELECT member_id FROM hv2) AND payment_type = 'refund'), 'hoàn cùng hình thức TM');
SELECT pg_temp.check((SELECT deleted_at IS NOT NULL FROM members WHERE id = (SELECT member_id FROM hv2)), 'hội viên nhập nhầm đã xóa');

-- Hội viên có khoản thu ở ca khác: nhân viên không xóa kiểu nhập nhầm được
RESET ROLE;
UPDATE members SET deleted_at = NULL WHERE member_code LIKE 'HV01%';
SET ROLE authenticated;
SELECT pg_temp.expect_error($$SELECT delete_member((SELECT id FROM members WHERE member_code LIKE 'HV01%'), (SELECT shift_id FROM ctx2), NULL, 0, 'TM', NULL, true)$$, '%ca khác%');
RESET ROLE;

\echo 'TẤT CẢ KIỂM THỬ SQL ĐỀU QUA'
