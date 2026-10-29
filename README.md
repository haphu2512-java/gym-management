# Max Power Gym – Hệ thống quản lý phòng gym

Web app quản lý hội viên, bán nước/dịch vụ, ca làm việc và lương nhân viên cho phòng gym.

## Công nghệ

- **Frontend:** React 19 + Vite, Zustand, React Router, CSS thuần (`src/App.css`)
- **Backend:** Supabase (PostgreSQL, Auth, RLS, hàm RPC)
- **Ảnh:** Cloudinary (upload trực tiếp từ trình duyệt)
- **Deploy:** Vercel (thư mục `gym-management/`)

## Cấu trúc thư mục

```
gym-management/              # app React
  src/
    pages/                   # mỗi trang một thư mục (Members, Shifts, Inventory, ...)
    services/                # gọi Supabase (bảng + RPC)
    store/                   # Zustand (auth, ca hiện tại, toast)
    utils/                   # hàm thuần: định dạng, trạng thái hội viên, tiền bàn giao...
  supabase/
    migrations/              # toàn bộ schema + hàm SQL, chạy theo thứ tự tên file
    tests/                   # test SQL (RLS + RPC) chạy trên Postgres thật
    seed.sql                 # dữ liệu mẫu cho môi trường dev
    README.md                # hướng dẫn chạy migration lên production
docs/notes/                  # ghi chú, đề xuất cũ (tham khảo)
.github/workflows/ci.yml     # CI: lint, test, build, test SQL
```

## Chạy local

```bash
cd gym-management
npm install
cp .env.example .env   # rồi điền các biến bên dưới
npm run dev
```

Biến môi trường (`gym-management/.env`):

| Biến | Ý nghĩa |
| --- | --- |
| `VITE_SUPABASE_URL` | URL project Supabase |
| `VITE_SUPABASE_ANON_KEY` | anon key của project |
| `VITE_CLOUDINARY_CLOUD_NAME` | tên cloud Cloudinary (upload ảnh) |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | upload preset không ký |
| `VITE_MASTER_SECRET` | mã admin dùng để kích hoạt thiết bị được phép đăng nhập và đổi mật khẩu |

## Kiểm thử

```bash
cd gym-management
npm run lint
npm test            # Vitest: hàm tiện ích, service, render component
npm run test:sql    # cần Postgres 16 local (xem supabase/tests/run.sh)
```

CI trên GitHub Actions chạy cả hai bộ test cho mỗi pull request.

## Quy tắc nghiệp vụ chính

- **Tiền chỉ ghi qua hàm server.** Bán hàng, gia hạn, tạo hội viên, mở/chốt ca, hoàn tác, xóa hội viên đều là hàm RPC `SECURITY DEFINER`. Hàm tự lấy giá từ bảng `products`/`services`, thời gian từ `NOW()`, người thao tác từ `auth.uid()`; giá trị client gửi lên bị bỏ qua.
- **Phải có ca đang mở** mới bán hàng, thu tiền hội viên hoặc ghi hoàn tiền.
- **Xóa hội viên** (chỉ admin) không sửa các khoản đã thu. Nếu hoàn tiền, hệ thống tạo một khoản `refund` âm trong ca đang mở, nên doanh thu các ca cũ giữ nguyên.
- **Quyền:** mọi tài khoản đăng nhập được xem dữ liệu; nhân viên ghi bảng tiền, kho, lương chỉ qua RPC; ghi trực tiếp chỉ admin. Chi tiêu trong ca sửa được khi ca còn mở.
- **Múi giờ:** ngày "hôm nay" trên server tính theo `Asia/Ho_Chi_Minh`.

## Deploy thay đổi database

Xem [gym-management/supabase/README.md](gym-management/supabase/README.md). Thứ tự quan trọng: một số migration phải chạy trước khi deploy frontend, một số chạy sau.
