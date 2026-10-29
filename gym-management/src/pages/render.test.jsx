// Smoke test: render các component tách ra từ Shifts/Inventory/Members bằng dữ liệu mẫu,
// bắt lỗi kiểu biến chưa khai báo hoặc prop thiếu (chỉ lộ ra khi chạy).
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ExpensePanel from './Shifts/ExpensePanel';
import HandoverNotesPanel from './Shifts/HandoverNotesPanel';
import ShiftDetailModal from './Shifts/ShiftDetailModal';
import ShiftHistory from './Shifts/ShiftHistory';
import DeleteProductModal from './Inventory/DeleteProductModal';
import ProductFormModal from './Inventory/ProductFormModal';
import ProductSalesGrid from './Inventory/ProductSalesGrid';
import SalesStatsView from './Inventory/SalesStatsView';
import SellConfirmModal from './Inventory/SellConfirmModal';
import StockTable from './Inventory/StockTable';
import DeleteConfirmModal from './Members/DeleteConfirmModal';

const noop = () => {};
const shift = {
  id: 's1', shift_name: 'Ca 1', status: 'closed', start_time: '2026-10-29T00:00:00Z', end_time: '2026-10-29T03:00:00Z',
  starting_cash: 500000, ending_cash: 900000, note: 'Bàn giao ok', staff_members: { full_name: 'NV 1' },
};
const product = { id: 'p1', name: 'Pocari', price: 15000, stock_quantity: 5, note: '', image_url: '' };

describe('render các component đã tách', () => {
  it('ShiftDetailModal tính tiền dự kiến (có hoàn tiền)', () => {
    const html = renderToStaticMarkup(
      <ShiftDetailModal
        loading={false}
        onClose={noop}
        summary={{
          shift,
          payments: [
            { id: 'a', amount: 350000, payment_method: 'TM', is_verified: true, members: { member_code: 'HV1', full_name: 'A' } },
            { id: 'b', amount: -100000, payment_method: 'TM', is_verified: true, members: { member_code: 'HV2', full_name: 'B' } },
            { id: 'c', amount: 795000, payment_method: 'CK', is_verified: false, members: { member_code: 'HV3', full_name: 'C' } },
          ],
          serviceSales: [{ id: 'd', quantity: 1, total_price: 50000, payment_method: 'TM', services: { name: 'Tập ngày' } }],
          sales: [{ id: 'e', quantity: 2, total_price: 30000, payment_method: 'TM', products: { name: 'Pocari' } }],
          expenses: [{ id: 'f', amount: 20000, reason: 'Đá' }],
        }}
      />
    );
    // 500.000 + 350.000 - 100.000 + 50.000 + 30.000 - 20.000
    expect(html).toContain((810000).toLocaleString());
    expect(html).toContain('Tập ngày');
  });

  it('ShiftHistory, HandoverNotesPanel, ExpensePanel', () => {
    expect(renderToStaticMarkup(<ShiftHistory shifts={[shift]} filterDate="2026-10-29" onFilterDateChange={noop} onOpenDetail={noop} />)).toContain('Ca 1');
    expect(renderToStaticMarkup(<HandoverNotesPanel shifts={[shift]} isAdmin onDeleteNote={noop} />)).toContain('Bàn giao ok');
    const html = renderToStaticMarkup(
      <ExpensePanel
        activeShift={shift}
        expenses={[{ id: 'x', amount: 20000, reason: 'Đá', created_at: '2026-10-29T01:00:00Z' }]}
        totalExpense={20000}
        expenseForm={{ amount: '', reason: '' }}
        setExpenseForm={noop}
        editingExpenseId={null}
        setEditingExpenseId={noop}
        editingExpenseForm={{ amount: '', reason: '' }}
        setEditingExpenseForm={noop}
        handleAddExpense={noop}
        handleStartEditExpense={noop}
        handleSaveExpense={noop}
        handleDeleteExpense={noop}
      />
    );
    expect(html).toContain('Đá');
  });

  it('các component của trang Kho', () => {
    expect(renderToStaticMarkup(
      <ProductSalesGrid products={[product]} salesSearchTerm="" setSalesSearchTerm={noop} sellQuantities={{}} handleQtyChange={noop} setSellingItem={noop} />
    )).toContain('Pocari');
    expect(renderToStaticMarkup(<StockTable loading={false} products={[product]} handleOpenEdit={noop} setDeletingProduct={noop} />)).toContain('Pocari');
    expect(renderToStaticMarkup(
      <SalesStatsView
        loading={false}
        salesLogs={[{ id: 'l1', sold_at: '2026-10-29T01:00:00Z', quantity: 1, total_price: 15000, payment_method: 'TM', products: { name: 'Pocari' } }]}
        statsDate="2026-10-29" setStatsDate={noop}
        statsShiftName="" setStatsShiftName={noop}
        statsPaymentMethod="" setStatsPaymentMethod={noop}
        canRollback={() => true} handleRollback={noop}
      />
    )).toContain('Hoàn tác');
    expect(renderToStaticMarkup(
      <ProductFormModal
        editingProduct={null}
        form={{ name: '', price: '', stock_quantity: '', restock_quantity: '0', note: '', image_url: '' }}
        setForm={noop} imageFile={null} setImageFile={noop} uploadingImage={false}
        handleAddOrUpdate={noop} setShowModal={noop}
      />
    )).toContain('Thêm sản phẩm');
    expect(renderToStaticMarkup(
      <SellConfirmModal sellingItem={product} setSellingItem={noop} sellQuantities={{ p1: 2 }} submitting={false} handleSell={noop} />
    )).toContain('30.000');
    expect(renderToStaticMarkup(<DeleteProductModal deletingProduct={product} setDeletingProduct={noop} handleConfirmDelete={noop} />)).toContain('Pocari');
  });

  it('DeleteConfirmModal của hội viên', () => {
    const html = renderToStaticMarkup(<DeleteConfirmModal member={{ full_name: 'Anh A', member_code: 'HV1' }} hasActiveShift onConfirm={noop} onCancel={noop} />);
    expect(html).toContain('Anh A');
    expect(html).toContain('hoàn lại');
  });
});
