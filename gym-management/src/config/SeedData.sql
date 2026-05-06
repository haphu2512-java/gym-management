-- Lưu ý: Bạn cần copy toàn bộ nội dung file này và dán vào mục SQL Editor trên Dashboard của Supabase, sau đó ấn Run.

-- 1. Insert người dùng mẫu cho profiles
-- (Nếu có lỗi ở auth.users, bạn cần tạo user thủ công ở màn hình Authentication trước. 
-- Giả sử đã có một UUID của Admin, thay 'YOUR-ADMIN-UUID' bằng id thật của tài khoản đó. 
-- Ở đây insert vào mục products, members, shifts trước để làm biểu đồ/dashboard)

INSERT INTO products (name, price, stock_quantity, note) VALUES 
  ('Nước khoáng Lavie', 10000, 50, 'Nước khoáng đóng chai 500ml'),
  ('Nước tăng lực Redbull', 15000, 30, 'Bò húc Thái'),
  ('Nước ép STING Dâu', 12000, 25, 'Sting đỏ'),
  ('Whey Protein Lẻ (1 Muỗng)', 30000, 100, 'Gold Standard Whey'),
  ('Trà Ô Long', 12000, 40, 'Chai 500ml');

INSERT INTO members (full_name, package_type, start_date, end_date, fee, payment_method, fingerprint_status, note) VALUES
  ('Nguyễn Văn A', 3, CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '80 days', 900000, 'TM', true, 'Khách quen'),
  ('Trần Thị B', 1, CURRENT_DATE - INTERVAL '40 days', CURRENT_DATE - INTERVAL '10 days', 350000, 'R', false, 'Đã hết hạn'),
  ('Lê Hoàng C', 12, CURRENT_DATE - INTERVAL '100 days', CURRENT_DATE + INTERVAL '265 days', 2500000, 'R', true, 'Gói năm vip'),
  ('Phạm Văn D', 1, CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '28 days', 350000, 'TM', true, 'Mới đăng ký'),
  ('Vũ Thị E', 1, CURRENT_DATE - INTERVAL '35 days', CURRENT_DATE - INTERVAL '5 days', 350000, 'TM', true, 'Đã hết hạn 5 ngày');

INSERT INTO shifts (shift_name, default_start, default_end, start_time, end_time, starting_cash, ending_cash, status, note) VALUES
  ('Ca 1 (5h-9h)', '05:00:00', '09:00:00', CURRENT_TIMESTAMP - INTERVAL '4 hours', CURRENT_TIMESTAMP, 500000, 1200000, 'closed', 'Ca sáng trơn tru'),
  ('Ca 2 (9h-13h)', '09:00:00', '13:00:00', CURRENT_TIMESTAMP, null, 1200000, null, 'open', 'Đang tiếp nhận ca');
