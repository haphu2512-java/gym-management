import { useUIStore } from '../../store/useUIStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const colors = {
  success: '#10b981',
  error: '#ef4444',
  info: '#3b82f6',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none'
    }}>
      {toasts.map((toast) => {
        const Icon = icons[toast.type] || Info;
        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              background: '#ffffff',
              color: '#1f2937',
              padding: '12px 16px',
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minWidth: '280px',
              maxWidth: '400px',
              border: `1px solid ${colors[toast.type]}20`,
              borderLeft: `4px solid ${colors[toast.type]}`,
              animation: 'toast-slide-in 0.3s ease-out forwards'
            }}
          >
            <Icon size={20} style={{ color: colors[toast.type] }} />
            <div style={{ flex: 1, fontSize: '14px', fontWeight: '600' }}>{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toast-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
