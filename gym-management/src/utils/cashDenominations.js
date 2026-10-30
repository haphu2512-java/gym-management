// Các mệnh giá tiền mặt VNĐ dùng khi đếm két lúc mở/kết ca.
export const DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500];

// Tổng tiền từ số tờ của từng mệnh giá. Bỏ qua ô trống, số âm hoặc không phải số nguyên.
export function sumDenominations(counts = {}) {
  return DENOMINATIONS.reduce((sum, value) => {
    const qty = Number(counts[value]);
    return Number.isInteger(qty) && qty > 0 ? sum + value * qty : sum;
  }, 0);
}

// Chỉ giữ các mệnh giá có số tờ > 0, để lưu log gọn.
export function compactDenominations(counts = {}) {
  return DENOMINATIONS.reduce((acc, value) => {
    const qty = Number(counts[value]);
    if (Number.isInteger(qty) && qty > 0) acc[value] = qty;
    return acc;
  }, {});
}
