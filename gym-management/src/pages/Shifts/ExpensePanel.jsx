import { Banknote, Check, FileText, Pencil, Plus, Receipt, Trash2, X } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

// Tab "CHI": thêm, sửa, xóa khoản chi của ca đang mở
export default function ExpensePanel({
  activeShift,
  expenses,
  totalExpense,
  expenseForm,
  setExpenseForm,
  editingExpenseId,
  setEditingExpenseId,
  editingExpenseForm,
  setEditingExpenseForm,
  handleAddExpense,
  handleStartEditExpense,
  handleSaveExpense,
  handleDeleteExpense,
}) {
  return (
    <div className="modern-stack" style={{ maxWidth: '480px' }}>
      {/* Summary Card */}
      <div style={{ background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #fecaca', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.05)' }}>
        <div>
          <p style={{ margin: 0, color: '#991b1b', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tổng chi ca hiện tại</p>
          <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: '#7f1d1d' }}>
            {Number(totalExpense || 0).toLocaleString('vi-VN')}<span style={{ fontSize: '18px', marginLeft: '2px' }}>đ</span>
          </h3>
        </div>
        <div style={{ width: '48px', height: '48px', background: '#ffffff', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <Receipt size={24} strokeWidth={2.5} />
        </div>
      </div>

      {/* Add Expense Form */}
      <form className="modern-form" onSubmit={handleAddExpense} style={{ background: '#ffffff', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> Ghi nhận khoản chi mới
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}><Banknote size={16} /></div>
            <input
              type="number"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              placeholder="Số tiền chi (VNĐ)"
              style={{ paddingLeft: '36px' }}
              required
            />
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}><FileText size={16} /></div>
            <input
              type="text"
              value={expenseForm.reason}
              onChange={(e) => setExpenseForm({ ...expenseForm, reason: e.target.value })}
              placeholder="Lý do chi (vd: Hoàn id, Clinh)"
              style={{ paddingLeft: '36px' }}
              required
            />
          </div>
          <button type="submit" className="primary-btn" style={{ width: '100%', marginTop: '4px' }} disabled={!activeShift}>
            Thêm khoản chi
          </button>
        </div>
      </form>

      {/* Modern List of Expenses */}
      <div style={{ marginTop: '4px' }}>
        <h4 style={{ margin: '0 0 12px 4px', fontSize: '14px', fontWeight: '700', color: '#64748b' }}>Lịch sử chi trong ca ({expenses.length})</h4>
        <div className="modern-list">
          {expenses.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', background: '#f8fafc', borderRadius: '12px', color: '#94a3b8', fontSize: '14px', border: '1px dashed #cbd5e1' }}>
              Chưa có khoản chi nào
            </div>
          )}
          {expenses.map((item) => (
            <div key={item.id} className="modern-list-item" style={{ background: '#ffffff', border: '1px solid #f1f5f9', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ width: '40px', height: '40px', background: '#fef2f2', color: '#ef4444', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Banknote size={18} />
              </div>
              {editingExpenseId === item.id ? (
                <div className="flex-1" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={editingExpenseForm.amount}
                    onChange={(e) => setEditingExpenseForm({ ...editingExpenseForm, amount: e.target.value })}
                    placeholder="Số tiền"
                    style={{ width: '100px', padding: '4px 8px', fontSize: '13px' }}
                  />
                  <input
                    type="text"
                    value={editingExpenseForm.reason}
                    onChange={(e) => setEditingExpenseForm({ ...editingExpenseForm, reason: e.target.value })}
                    placeholder="Lý do"
                    style={{ flex: 1, padding: '4px 8px', fontSize: '13px' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveExpense(item.id)}
                    style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer' }}
                    title="Lưu thay đổi"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingExpenseId(null)}
                    style={{ background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer' }}
                    title="Hủy"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <p style={{ margin: 0, fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>{item.reason || 'Không có lý do'}</p>
                    <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '12px' }}>{formatDateTime(item.created_at)}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ fontWeight: '700', color: '#dc2626', fontSize: '15px' }}>
                      -{Number(item.amount || 0).toLocaleString('vi-VN')}đ
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStartEditExpense(item)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                      title="Sửa khoản chi"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(item.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                      title="Xóa khoản chi"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
