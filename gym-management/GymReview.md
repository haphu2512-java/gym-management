# 📋 Review & Cải Thiện Nghiệp Vụ — MAX POWER GYM

## Tổng Quan Hệ Thống

Hệ thống quản lý phòng tập gồm 6 module:
- **Dashboard** (Admin) — Báo cáo tổng quan
- **Hội Viên** — Đăng ký, gia hạn, quản lý thành viên
- **Kho Nước** — Tồn kho và bán hàng
- **Ca Làm & Bàn Giao** — Mở/chốt ca trực
- **Nhân Viên & Lương** — Xếp ca, tính lương
- **Nhật Ký** (Admin) — Audit log hoạt động

---

## 🔴 Vấn Đề Nghiêm Trọng Cần Sửa Ngay

### 1. Bảng lương lưu trên `localStorage` — Rủi ro mất dữ liệu cao
**Vị trí:** `Staff.jsx` lines 15–37

Toàn bộ lịch xếp ca tuần, đơn giá lương, loại nhân viên (CT/TV), điều chỉnh hoa hồng/phạt đều lưu trong `localStorage` của trình duyệt.

**Hậu quả:**
- Xóa cache trình duyệt → mất toàn bộ bảng lương
- Mỗi máy tính lưu một bộ data khác nhau
- Admin xem trên điện thoại sẽ không thấy data đã nhập

**Giải pháp:** Tạo bảng `salary_configs` và `weekly_schedules` trong Supabase.

---

### 2. Thiếu `staff_id` trong bảng `shifts` — Không biết nhân viên nào mở/chốt ca
**Vị trí:** `Supabase.sql`, `shiftService.js`

Bảng `shifts` không lưu thông tin nhân viên đã mở ca. Khi Admin xem danh sách ca, không biết ai chịu trách nhiệm ca đó.

**Giải pháp:** Thêm cột `opened_by UUID REFERENCES profiles(id)` vào bảng `shifts`.

---

### 3. Doanh thu học viên không liên kết với ca — Bàn giao ca không chính xác
**Vị trí:** Bảng `members`

Khi hội viên đóng tiền, hệ thống không ghi lại "ca nào thu tiền". Điều này khiến:
- Không tính được "Ca X hôm nay thu bao nhiêu từ học viên"
- Nhân viên bàn giao ca không có con số chính xác để bàn giao

**Giải pháp:** Tạo bảng `payment_logs` riêng:

```sql
CREATE TABLE payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id),
  shift_id UUID REFERENCES shifts(id),
  collected_by UUID REFERENCES profiles(id),
  amount NUMERIC NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('TM', 'CK')),
  payment_type TEXT CHECK (payment_type IN ('new', 'renew')),
  note TEXT,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### 4. Không kiểm tra ca mở khi bán nước — Dữ liệu bị mất liên kết ca
**Vị trí:** `Inventory.jsx` — `handleSell()`

Khi không có ca nào đang mở, `shiftId` là `null` và giao dịch bán nước vẫn ghi vào `sales_logs` với `shift_id = null`, mất khả năng theo dõi doanh thu theo ca.

**Giải pháp:** Cảnh báo nhân viên nếu chưa mở ca trước khi bán.

---

## 🟡 Vấn Đề Nghiệp Vụ Quan Trọng

### 5. Không có check-in / xác minh hội viên khi vào tập
Hệ thống chỉ lưu thông tin, không có tính năng check hội viên vào/ra. Nhân viên phải tự nhớ ai còn hạn.

**Gợi ý:** Thêm thanh tìm kiếm nhanh với trạng thái Còn hạn / Hết hạn hiện nổi bật.

---

### 6. Gia hạn hội viên không tạo payment log
**Vị trí:** `Members.jsx` — `handleRenew()`

Khi gia hạn, chỉ cập nhật bản ghi `members` nhưng không ghi lại giao dịch thu tiền. Mất vết doanh thu từ gia hạn.

---

### 7. Lịch xếp ca tuần không liên kết với ca thực tế
**Vị trí:** `Staff.jsx`

Bảng xếp ca ở trang Nhân Viên là lưới thủ công không liên kết với bảng `shifts`. Lịch xếp ca và ca thực tế hoạt động độc lập, không nhất quán.

---

### 8. Logic ca mở có thể xung đột khi nhiều ca cùng mở
**Vị trí:** `shiftService.validateShiftForLogin()`

Hàm tìm ca `status = 'open'` đầu tiên trong ngày — nếu có 2 ca mở cùng lúc, sẽ lấy sai ca.

---

## 🟢 Những Điều Tốt Đã Có

| Điểm tốt | Lý do |
|---|---|
| RLS (Row Level Security) trên tất cả bảng | Bảo mật đúng chuẩn Supabase |
| Phân quyền Admin/Staff rõ ràng | UI ẩn/hiện menu theo role |
| `staff_logs` ghi lại mọi hành động | Audit trail tốt |
| `sales_logs` tách riêng giao dịch nước | Đúng nghiệp vụ |
| Checkbox duyệt CK thay vì button | Chống bấm nhầm |
| `is_payment_verified` kiểm soát CK | Phân luồng thanh toán rõ |
| Doanh thu nước & hội viên tách biệt trên Dashboard | Báo cáo đúng |

---

## 📐 Lộ Trình Cải Thiện (Ưu tiên)

### Giai đoạn 1 — Sửa ngay (Critical)
| # | Việc cần làm | Ảnh hưởng |
|---|---|---|
| 1 | Thêm `opened_by` vào bảng `shifts` | Biết ai chịu trách nhiệm ca |
| 2 | Tạo bảng `payment_logs` | Theo dõi doanh thu học viên theo ca |
| 3 | Chặn bán nước khi chưa mở ca | Tránh dữ liệu orphan |
| 4 | Di chuyển dữ liệu lương lên Supabase | Không mất data khi xóa cache |

### Giai đoạn 2 — Cải thiện nghiệp vụ
| # | Việc cần làm | Ảnh hưởng |
|---|---|---|
| 5 | Hiển thị tổng thu ca khi chốt ca | Bàn giao ca chính xác |
| 6 | Tạo `payment_log` khi thêm & gia hạn hội viên | Doanh thu đầy đủ |
| 7 | Cảnh báo hội viên sắp hết hạn (còn 7 ngày) | Chủ động nhắc nhở |
| 8 | Dashboard: Doanh thu hôm nay (nước + học viên) | Báo cáo theo ngày |

### Giai đoạn 3 — Tối ưu
| # | Việc cần làm | Ảnh hưởng |
|---|---|---|
| 9 | Báo cáo doanh thu theo tháng | Quyết định kinh doanh |
| 10 | Xuất Excel / in biên lai | Tài liệu cho chủ |
| 11 | Thông báo khi có CK chờ duyệt | Chủ động xử lý |

---

## 🏗️ Database Schema Đề Xuất Thêm

```sql
-- 1. Biết ai mở ca
ALTER TABLE shifts 
ADD COLUMN opened_by UUID REFERENCES profiles(id);

-- 2. Ghi nhận thanh toán học viên theo ca
CREATE TABLE payment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  collected_by UUID REFERENCES profiles(id),
  amount NUMERIC NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('TM', 'CK')),
  payment_type TEXT CHECK (payment_type IN ('new', 'renew')),
  is_verified BOOLEAN DEFAULT FALSE,
  note TEXT,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_logs_policy"
ON payment_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Cấu hình đơn giá lương (thay localStorage)
CREATE TABLE salary_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_name TEXT NOT NULL,
  staff_type TEXT CHECK (staff_type IN ('CT', 'TV')),
  rate_per_shift NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE salary_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salary_configs_policy"
ON salary_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

> [!IMPORTANT]
> **Ưu tiên số 1**: Di chuyển bảng lương từ `localStorage` lên Supabase để tránh mất dữ liệu. Đây là rủi ro cao nhất hiện tại.

> [!TIP]
> Khi tạo `payment_logs`, bạn có thể xóa cột `fee` trong bảng `members` và tính tổng doanh thu từ `payment_logs` thay thế — giúp theo dõi gia hạn nhiều lần của cùng 1 hội viên chính xác hơn.
