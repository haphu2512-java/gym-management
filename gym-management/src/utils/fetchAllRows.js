// Supabase (PostgREST) trả tối đa 1000 dòng mỗi request và không báo lỗi khi bị cắt.
// Hàm này tải lần lượt từng trang cho tới khi hết dữ liệu.
// buildQuery phải trả về một query MỚI mỗi lần gọi và có .order() ổn định để phân trang không bị trùng/sót.
const PAGE_SIZE = 1000;

export async function fetchAllRows(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}
