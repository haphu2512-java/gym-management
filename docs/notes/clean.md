# 🧹 Clean Supabase Database (Auth + Tokens + Sessions)

## 🎯 Mục tiêu

Giảm dung lượng database do:

* Refresh tokens (login nhiều lần)
* Sessions hết hạn
* Dữ liệu test
* Row rác trong PostgreSQL (MVCC)

---

## ⚠️ Lưu ý quan trọng

* Các lệnh dưới đây **xoá dữ liệu vĩnh viễn**
* Chỉ chạy trên môi trường **dev hoặc production có kiểm soát**
* Nên backup trước nếu cần

---

## 1. 🧽 Xoá Refresh Tokens cũ

```sql
DELETE FROM auth.refresh_tokens
WHERE created_at < now() - interval '7 days';
```

👉 Nên giữ lại 7 ngày (có thể chỉnh 3–30 ngày tuỳ hệ thống)

---

## 2. 🧽 Xoá Sessions hết hạn

```sql
DELETE FROM auth.sessions
WHERE not_after < now();
```

---

## 3. 🧽 Xoá User test (optional)

```sql
DELETE FROM auth.users
WHERE email LIKE '%test%';
```

⚠️ Cẩn thận: tránh xoá user thật

---

## 4. 🔄 VACUUM (BẮT BUỘC)

Sau khi DELETE, PostgreSQL chưa giải phóng disk ngay.

### Chạy nhẹ:

```sql
VACUUM ANALYZE;
```

### Chạy mạnh (giải phóng disk thật):

```sql
VACUUM FULL;
```

---

## 5. 🤖 Auto Cleanup bằng Cron (khuyến nghị)

### Enable pg_cron (nếu chưa có)

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

---

### Tự động dọn mỗi ngày (3h sáng)

```sql
SELECT cron.schedule(
  'cleanup_tokens_daily',
  '0 3 * * *',
  $$
  DELETE FROM auth.refresh_tokens
  WHERE created_at < now() - interval '7 days';
  $$
);
```

---

## 6. 🔐 Best Practice (QUAN TRỌNG NHẤT)

### ❌ Tránh

* Login mỗi lần mở app
* Không logout
* Cho phép nhiều session vô hạn

---

### ✅ Nên làm

#### ✔️ Giới hạn 1 session / user

```sql
DELETE FROM auth.refresh_tokens
WHERE user_id = 'USER_ID';
```

👉 Gọi khi user login mới

---

#### ✔️ Logout đúng cách

```js
await supabase.auth.signOut()
```

---

#### ✔️ Gắn session với nghiệp vụ (ví dụ: mở ca gym)

* Khi mở ca → lưu `access_token` hoặc `session_id`
* Khi chốt ca → kiểm tra đúng session mới cho phép

👉 Tránh bị login từ thiết bị khác để phá ca

---

## 7. 📊 Kiểm tra table nào chiếm dung lượng

```sql
SELECT
  schemaname,
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

---

## 🔥 Kết luận

* Disk tăng chủ yếu do: **refresh_tokens + sessions + MVCC**
* Cần:

  * Cleanup định kỳ
  * VACUUM
  * Thiết kế auth đúng

---

## 🚀 Gợi ý thêm

Nếu app có:

* Chat (messages)
* Post / Comment

👉 Nên:

* Xoá data cũ theo TTL
* Partition table nếu lớn
* Index hợp lý (tránh dư thừa)

---

**Author:** Internal Dev Notes
**Project:** Supabase Cleanup Strategy
