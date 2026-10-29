import { DENOMINATIONS } from '../../utils/cashDenominations';

// Lưới nhập số tờ theo từng mệnh giá khi kết ca.
export default function CashCountPanel({ counts, onChange, total }) {
  return (
    <div style={{ margin: '8px 0 12px', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px 16px' }}>
        {DENOMINATIONS.map((value) => (
          <label key={value} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '14px' }}>
            <span style={{ whiteSpace: 'nowrap' }}>{value.toLocaleString('vi-VN')}đ</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={counts[value] ?? ''}
              onChange={(e) => onChange({ ...counts, [value]: e.target.value })}
              placeholder="0"
              aria-label={`Số tờ ${value.toLocaleString('vi-VN')}đ`}
              style={{ width: '72px', margin: 0 }}
            />
          </label>
        ))}
      </div>
      <div style={{ textAlign: 'right', fontWeight: 700, marginTop: '10px' }}>
        Tổng: {total.toLocaleString('vi-VN')}đ
      </div>
    </div>
  );
}
