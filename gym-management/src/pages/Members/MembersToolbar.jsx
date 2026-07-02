import { Plus, Search, FileSpreadsheet } from 'lucide-react';

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
  profile
}) {
  return (
    <>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button
          className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'active' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'active' ? 'white' : '#64748b',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Hội viên đang tập
        </button>
        <button
          className={`tab-btn ${activeTab === 'suspended' ? 'active' : ''}`}
          onClick={() => setActiveTab('suspended')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'suspended' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'suspended' ? 'white' : '#64748b',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Danh sách bảo lưu
        </button>
        <button
          className={`tab-btn ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => setActiveTab('services')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'services' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'services' ? 'white' : '#64748b',
            fontWeight: '600',
            cursor: 'pointer'
          }}
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
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '130px' }}
            title="Lọc theo ngày đăng ký hoặc hết hạn"
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
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
              onClick={onExportExcel}
              title="Xuất danh sách hội viên ra Excel"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', border: '1px solid #16a34a' }}
            >
              <FileSpreadsheet size={16} /> Xuất Excel
            </button>
          )}
          <button type="button" className="primary-btn" onClick={onAddMember}>
            <Plus size={16} /> Thêm hội viên
          </button>
        </div>
      )}
    </>
  );
}
