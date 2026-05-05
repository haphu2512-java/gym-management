readme_content = """# 🏋️‍♂️ Gym Management System - Max Power Gym

Hệ thống quản lý phòng gym hiện đại, hỗ trợ đa nền tảng (Web Responsive), được thiết kế để tối ưu hóa quy trình vận hành, quản lý học viên, kho hàng và ca làm việc của nhân viên.

## 🚀 Tech Stack
* **Frontend:** ReactJS (Vite)
* **Styling:** Tailwind CSS (Responsive UI cho PC & Mobile)
* **Backend & Database:** Supabase (PostgreSQL, Auth, Real-time)
* **Icons:** Lucide React

## ✨ Tính Năng Chính (Features)

### 1. Quản Lý Hội Viên & Gia Hạn
* **Theo dõi danh sách:** Quản lý học viên theo gói tập (1 tháng, 3 tháng...).
* **Quy trình Gia hạn:** Tự động tính toán ngày bắt đầu và kết thúc. Cảnh báo trạng thái hết hạn bằng màu sắc.
* **Lịch sử thanh toán:** Lưu lại mọi lần đóng phí, hình thức thanh toán (Tiền mặt/Chuyển khoản).
* **Ghi chú:** Mỗi học viên và mỗi lần gia hạn đều có trường `note` để lưu thông tin đặc biệt.

### 2. Quản Lý Kho & Bán Nước
* **Danh mục sản phẩm:** Quản lý tồn kho các loại đồ uống (Pocari, Revive, Monster...).
* **Bán hàng nhanh:** Giao diện tối ưu cho nhân viên thực hiện bán hàng ngay tại quầy.
* **Báo cáo doanh thu:** Tự động tổng kết tiền nước theo từng ca và từng ngày.

### 3. Quản Lý Ca Làm Việc (Shift Handover)
* **Lịch làm việc:** Chia làm 5 ca cố định trong ngày.
* **Bàn giao dòng tiền:** Nhân viên nhập số tiền đầu ca và chốt số tiền cuối ca.
* **Minh bạch:** Hệ thống ghi lại người trực ca, thời gian bắt đầu/kết thúc và ghi chú bàn giao.

### 4. Phân Quyền (RBAC)
* **Admin:** Xem toàn bộ doanh thu, quản lý kho, quản lý nhân sự.
* **Nhân viên:** Thực hiện check-in, bán nước, gia hạn và báo cáo ca làm.

## 🗄️ Database Schema
Hệ thống sử dụng các bảng chính trong Supabase:
* `profiles`: Thông tin nhân viên và vai trò (Admin/Staff).
* `members`: Thông tin cơ bản của học viên.
* `membership_renewals`: Chi tiết các lần gia hạn và đóng phí.
* `products`: Quản lý danh mục và tồn kho nước.
* `orders` & `order_items`: Lưu vết giao dịch bán hàng.
* `shifts`: Quản lý log ca làm việc và bàn giao tiền.
* *Tất cả các bảng đều tích hợp trường `note` (TEXT) để tăng tính linh hoạt.*

## 🛠️ Cài Đặt (Installation)

1. **Clone project:**
   ```bash
   git clone [https://github.com/haphu2512-java/gym-management.git]
   cd gym-management