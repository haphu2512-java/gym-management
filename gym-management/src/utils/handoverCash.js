// Tiền dự kiến cuối ca = tiền đầu ca + tiền mặt thu (hội viên, dịch vụ, nước) - chi trong ca.
// Thu hội viên đã gồm các khoản hoàn tiền (số âm).
export function computeHandoverCash({ startingCash = 0, memberCash = 0, serviceCash = 0, drinkCash = 0, expenses = 0 }) {
  return (Number(startingCash) || 0)
    + (Number(memberCash) || 0)
    + (Number(serviceCash) || 0)
    + (Number(drinkCash) || 0)
    - (Number(expenses) || 0);
}
