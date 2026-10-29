import { describe, expect, it, vi } from 'vitest';
import { fetchAllRows } from './fetchAllRows';

function fakeQuery(total) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const range = vi.fn(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }));
  return { build: () => ({ range }), range };
}

describe('fetchAllRows', () => {
  it('tải hết qua nhiều trang 1000 dòng', async () => {
    const q = fakeQuery(2500);
    const rows = await fetchAllRows(q.build);
    expect(rows).toHaveLength(2500);
    expect(q.range).toHaveBeenCalledTimes(3);
    expect(q.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
  it('dừng khi trang đầu chưa đầy', async () => {
    const q = fakeQuery(10);
    expect(await fetchAllRows(q.build)).toHaveLength(10);
    expect(q.range).toHaveBeenCalledTimes(1);
  });
  it('đúng 1000 dòng thì gọi thêm 1 trang rỗng', async () => {
    const q = fakeQuery(1000);
    expect(await fetchAllRows(q.build)).toHaveLength(1000);
    expect(q.range).toHaveBeenCalledTimes(2);
  });
  it('báo lỗi thay vì trả thiếu dữ liệu', async () => {
    const build = () => ({ range: async () => ({ data: null, error: { message: 'boom' } }) });
    await expect(fetchAllRows(build)).rejects.toThrow('boom');
  });
});
