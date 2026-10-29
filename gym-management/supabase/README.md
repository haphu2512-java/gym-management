# Database (Supabase)

Toàn bộ schema, hàm RPC và RLS nằm trong `migrations/`, chạy theo thứ tự tên file.

| File | Nội dung | Khi nào chạy trên production |
| --- | --- | --- |
| `20261029000000_baseline.sql` | Schema gốc (trước 29/10/2026) | **Không chạy lại**, production đã có |
| `20261029000100_safe_fixes.sql` | Chặn anon gọi RPC, sửa view trạng thái hội viên, sửa `suspend_member` | Trước khi deploy frontend mới |
| `20261029000200_server_side_logic.sql` | Hàm server cho bán hàng, ca, xóa hội viên, doanh thu; constraint | Trước khi deploy frontend mới |
| `20261029000300_tighten_rls.sql` | Siết RLS: nhân viên chỉ ghi bảng tiền qua RPC | **Sau khi** frontend mới đã chạy |

`0100` và `0200` tương thích với frontend cũ, nên web vẫn chạy bình thường trong lúc chờ deploy.
`0300` sẽ chặn các thao tác ghi trực tiếp mà frontend cũ còn dùng, vì vậy phải chạy sau cùng.

## Các bước deploy lần này

1. **Backup**: Supabase Dashboard → Database → Backups (hoặc `pg_dump`).
2. **Tắt đăng ký tự do** nếu chưa tắt: Authentication → Providers → Email → bỏ chọn "Allow new users to sign up". Tài khoản nhân viên do admin tạo.
3. Mở SQL Editor, chạy lần lượt nội dung `0100`, rồi `0200`. Mỗi file nằm trong `BEGIN … COMMIT`, lỗi sẽ không để lại thay đổi dở dang.
4. Merge pull request để Vercel deploy frontend mới. Mở web, thử: mở ca, bán 1 chai nước, gia hạn 1 hội viên, chốt ca.
5. Chạy `0300` trong SQL Editor.
6. Đăng nhập bằng tài khoản nhân viên (không phải admin) thử lại bước 4 để chắc chắn quyền đúng.

**Quay lui nếu có sự cố sau bước 5:** tạo lại policy "Full access" cho bảng bị ảnh hưởng (các dòng `CREATE POLICY "Full access …"` trong `baseline.sql`), rồi báo lại lỗi.

## Nếu dùng Supabase CLI

```bash
supabase link --project-ref <ref>
supabase migration repair --status applied 20261029000000   # đánh dấu baseline đã có
supabase db push                                             # chạy các file còn lại
```

Lưu ý `db push` chạy luôn cả `0300`; chỉ dùng khi frontend mới đã deploy, nếu không thì chạy tay theo các bước ở trên.

## Thêm thay đổi mới

- Tạo file mới `YYYYMMDDHHMMSS_mo_ta.sql` trong `migrations/`, không sửa file đã chạy trên production.
- Hàm RPC: `SECURITY DEFINER`, `SET search_path = public`, kiểm tra `auth.uid()`/`is_admin()` bên trong, `REVOKE EXECUTE … FROM PUBLIC, anon` và `GRANT … TO authenticated`.
- Thêm kiểm thử vào `tests/rls_and_rpc_test.sql`, chạy `npm run test:sql`.

## Test SQL local

```bash
# Cần Postgres 16. Database gym_test sẽ bị xóa và tạo lại.
PGHOST=localhost PGPORT=5432 PGUSER=postgres npm run test:sql
```

Script giả lập phần Supabase có sẵn (role `anon`/`authenticated`, `auth.uid()`), chạy mọi migration rồi chạy các kiểm thử quyền và nghiệp vụ.

`seed.sql` là dữ liệu mẫu cho môi trường dev, không chạy trên production.
