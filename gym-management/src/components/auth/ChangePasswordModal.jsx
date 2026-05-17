import { useState } from 'react';
import { X, KeyRound, Eye, EyeOff } from 'lucide-react';
import { authService } from '../../services/authService';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (adminSecret !== import.meta.env.VITE_MASTER_SECRET) {
      setError('Mã xác nhận Admin không hợp lệ.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải dài ít nhất 6 ký tự.');
      return;
    }

    setLoading(true);
    try {
      // Xác thực bằng mật khẩu cũ (đăng nhập tạm thời)
      await authService.login(email, oldPassword);
      
      // Đổi mật khẩu
      await authService.updatePassword(newPassword);
      
      // Đăng xuất ngay lập tức
      await authService.logout();

      setSuccess('Đổi mật khẩu thành công!');
      setTimeout(() => {
        onClose();
        setEmail('');
        setOldPassword('');
        setNewPassword('');
        setAdminSecret('');
        setSuccess('');
      }, 2000);
    } catch (err) {
      // Đảm bảo đã đăng xuất nếu lỡ lỗi giữa chừng
      authService.logout().catch(() => {});
      setError('Email hoặc mật khẩu cũ không đúng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="modal-content modern-card max-width-1" onClick={e => e.stopPropagation()} style={{ padding: '24px', width: '100%', maxWidth: '400px' }}>
        <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 className="modern-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <KeyRound size={20} className="primary-text" /> Đổi mật khẩu tài khoản
          </h3>
          <button type="button" className="ghost-btn" style={{ padding: '4px' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && <div className="modern-error" style={{ marginBottom: '16px' }}>{error}</div>}
        {success && <div className="modern-success" style={{ marginBottom: '16px', color: '#059669', background: '#d1fae5' }}>{success}</div>}

        <form onSubmit={handleSubmit} className="modern-form">
          <div style={{ marginBottom: '12px' }}>
            <label className="field-label">Email tài khoản</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email"
              required
            />
          </div>

          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <label className="field-label">Mật khẩu cũ</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Nhập mật khẩu hiện tại"
                required
                style={{ paddingRight: '40px' }}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <label className="field-label">Mật khẩu mới</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới"
                required
                style={{ paddingRight: '40px' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label className="field-label" style={{ color: '#dc2626' }}>Mã Master (Admin Secret)</label>
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="Nhập mã bảo mật Master"
              required
            />
          </div>

          <button type="submit" className="primary-btn" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  );
}
