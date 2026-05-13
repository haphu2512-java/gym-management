import { useUIStore } from '../../store/useUIStore';
import { HelpCircle } from 'lucide-react';

export default function ConfirmDialog() {
  const { confirmDialog, hideConfirm } = useUIStore();

  if (!confirmDialog) return null;

  const { title, message, onConfirm, onCancel, confirmText, cancelText, type } = confirmDialog;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    hideConfirm();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    hideConfirm();
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 9999 }}>
      <div 
        className="modal-panel" 
        style={{ 
          width: 'min(400px, 90vw)', 
          textAlign: 'center',
          padding: '24px'
        }}
      >
        <div style={{ 
          background: type === 'danger' ? '#fee2e2' : '#eff6ff',
          color: type === 'danger' ? '#dc2626' : '#2563eb',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <HelpCircle size={32} />
        </div>
        
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '800' }}>{title || 'Xác nhận'}</h3>
        <p style={{ margin: '0 0 24px', color: '#64748b', lineHeight: '1.5' }}>{message}</p>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="ghost-btn" 
            style={{ flex: 1 }} 
            onClick={handleCancel}
          >
            {cancelText || 'Hủy'}
          </button>
          <button 
            className="primary-btn" 
            style={{ 
              flex: 1, 
              background: type === 'danger' ? '#dc2626' : '#2563eb' 
            }} 
            onClick={handleConfirm}
          >
            {confirmText || 'Đồng ý'}
          </button>
        </div>
      </div>
    </div>
  );
}
