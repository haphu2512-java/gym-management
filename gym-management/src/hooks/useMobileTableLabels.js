import { useEffect } from 'react';

// Bảng có class "stack-mobile" sẽ hiện thành từng thẻ trên điện thoại (xem App.css).
// Mỗi ô cần nhãn cột để hiện bên trái, nên hook này chép chữ ở <th> vào data-label của <td>.
// Theo dõi DOM để bảng render lại (đổi trang, lọc...) vẫn có nhãn.
function labelTable(table) {
  const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim());
  if (headers.length === 0) return;
  table.querySelectorAll('tbody tr').forEach((row) => {
    let col = 0;
    Array.from(row.children).forEach((cell) => {
      const span = Number(cell.getAttribute('colspan') || 1);
      const label = span === 1 ? headers[col] || '' : '';
      if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
      col += span;
    });
  });
}

export default function useMobileTableLabels() {
  useEffect(() => {
    let frame = 0;
    const run = () => {
      frame = 0;
      document.querySelectorAll('table.stack-mobile').forEach(labelTable);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run);
    };
    run();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}
