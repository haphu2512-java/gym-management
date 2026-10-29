import { Plus, Search, FileSpreadsheet, CheckCheck } from 'lucide-react';

export default function MembersToolbar({
  activeTab,
  setActiveTab,
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  filterDate,
  setFilterDate,
  onAddMember,
  onExportExcel,
  profile,
  pendingCkCount = 0,
  onVerifyAllPendingCk,
  verifyingAll = false
}) {
  return (
    <>
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Hội viên đang tập
        </button>
        <button
          className={`tab-btn ${activeTab === 'suspended' ? 'active' : ''}`}
          onClick={() => setActiveTab('suspended')}
        >
          Danh sách bảo lưu
        </button>
        <button
          className={`tab-btn ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          Dịch vụ (Tập ngày, PT...)
        </button>
      </div>

      {activeTab !== 'services' && (
        <div className="modern-toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              value={searchTerm}
              placeholder="Tìm theo tên hoặc Mã HV..."
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{ padding: '8px', borderRadius: 'var(--radius)', border: '1px solid var(--line)', minWidth: '130px' }}
            title="Lọc theo ngày đăng ký hoặc hết hạn"
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '8px', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}
          >
            <option value="all">Tất cả</option>
            {profile?.role === 'admin' && <option value="pending_ck">Chờ duyệt CK</option>}
            <option value="missing_code">Chưa gắn Mã HV</option>
            <option value="expired">Hết hạn</option>
          </select>
          {profile?.role === 'admin' && (
            <button
              type="button"
              className="ghost-btn"
              onClick={onVerifyAllPendingCk}
              disabled={verifyingAll || pendingCkCount === 0}
              title={
                pendingCkCount > 0
                  ? `Duyệt chuyển khoản cho tất cả ${pendingCkCount} hội viên đang chờ duyệt`
                  : 'Hiện không có chuyển khoản nào chờ duyệt'
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: pendingCkCount > 0 ? 'var(--ok)' : 'var(--subtle)',
                background: pendingCkCount > 0 ? 'var(--ok-soft)' : 'var(--surface-2)',
                border: `1px solid ${pendingCkCount > 0 ? 'var(--ok-line)' : 'var(--line-strong)'}`,
                fontWeight: '600',
                cursor: pendingCkCount > 0 && !verifyingAll ? 'pointer' : 'not-allowed',
                opacity: verifyingAll ? 0.6 : 1,
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <CheckCheck size={16} />
              <span>
                {verifyingAll ? 'Đang duyệt...' : `Duyệt CK tất cả${pendingCkCount > 0 ? ` (${pendingCkCount})` : ''}`}
              </span>
            </button>
          )}
          {profile?.role === 'admin' && (
            <button
              type="button"
              className="ghost-btn"
              onClick={onExportExcel}
              title="Xuất danh sách hội viên ra Excel"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ok)', border: '1px solid var(--ok)' }}
            >
              <FileSpreadsheet size={16} /> Xuất Excel
            </button>
          )}
          <button type="button" className="primary-btn" onClick={onAddMember} style={{ marginLeft: 'auto' }}>
            <Plus size={16} /> Thêm hội viên
          </button>
        </div>
      )}
    </>
  );
}
