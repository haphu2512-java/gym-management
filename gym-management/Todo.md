# 📝 DANH SÁCH CÔNG VIỆC CẦN LÀM (TODO) — MAX POWER GYM

Dựa trên kết quả rà soát từ `GymReview.md` và các nâng cấp Database đã thực hiện.

## 🏁 Đã Hoàn Thành (Done)
- [x] Thêm `opened_by` vào bảng `shifts` (Database & Code).
- [x] Tạo bảng `payment_logs` và tích hợp vào quy trình Thêm/Gia hạn hội viên.
- [x] Chặn bán nước khi chưa mở ca làm việc.
- [x] Di chuyển toàn bộ dữ liệu Lương & Lịch xếp ca từ `localStorage` lên Supabase.
- [x] Cập nhật Dashboard sử dụng `payment_logs` để tính doanh thu học viên chính xác.

---

## 🚀 Ưu Tiên Cao (High Priority - Giai đoạn 2)

### 1. Quản lý Ca làm việc (Shifts)
- [ ] **Tính toán tiền bàn giao**: Trong modal Chốt ca, tự động tính tổng tiền mặt (`TM`) thu được từ bán nước và học phí để gợi ý số dư cuối ca.
- [ ] **Chống xung đột ca**: Cập nhật `shiftService.validateShiftForLogin` để xử lý trường hợp có nhiều ca `open` (hiển thị danh sách ca hoặc bắt buộc đóng ca cũ).

### 2. Quản lý Hội viên (Members)
- [ ] **Cảnh báo hết hạn**: Đánh dấu màu (ví dụ: Vàng/Đỏ) cho các hội viên còn dưới 7 ngày hạn tập trong danh sách.
- [ ] **Tính năng Check-in**: Tạo một ô tìm kiếm nhanh (Scan/Search) ở Dashboard hoặc trang Hội viên để xác nhận khách vào tập, hiển thị trạng thái "Còn hạn" to/rõ.

### 3. Báo cáo & Dashboard
- [ ] **Doanh thu hôm nay**: Thêm widget hiển thị riêng doanh thu thu được trong ngày hiện tại (Nước + Học viên).
- [ ] **Lọc báo cáo**: Cho phép Dashboard hiển thị dữ liệu theo khoảng thời gian (Tuần này, Tháng này).

---

## 🛠️ Tối Ưu & Nâng Cao (Giai đoạn 3)

### 4. Tài chính & Chứng từ
- [ ] **In biên lai**: Hỗ trợ in biên lai (PDF/Máy in nhiệt) khi học viên đóng tiền học phí.
- [ ] **Xuất Excel**: Cho phép Admin xuất danh sách hội viên và báo cáo doanh thu ra file Excel.

### 5. Thông báo & Trải nghiệm
- [ ] **Thông báo Real-time**: Hiển thị thông báo ngay khi có giao dịch Chuyển khoản (CK) cần duyệt mà không cần F5 trang.
- [ ] **Đồng bộ hóa Payment Log**: Xóa cột `fee` trong bảng `members` để chuyển hẳn sang dùng kiến trúc Event-Sourcing (tính tổng từ logs).

---

> [!NOTE]
> Các công việc trên sẽ được thực hiện tuần tự để đảm bảo tính ổn định của hệ thống hiện tại.
