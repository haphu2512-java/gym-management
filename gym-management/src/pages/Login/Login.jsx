import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import logo from '../../assets/logo-wide.png';
import ChangePasswordModal from '../../components/auth/ChangePasswordModal';

export default function Login() {
  const navigate = useNavigate();
  const { login, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-modern">
      <section className="login-brand-panel">
        <img src={logo} alt="Max Power Gym Center" />
        <p className="login-slogan">Mạnh hơn<span>mỗi ngày</span></p>
        <p className="login-brand-foot">Hệ thống quản lý hội viên, ca trực và quầy nước.</p>
      </section>

      <section className="login-form-panel">
        <div className="login-card-modern">
          <h1>Đăng nhập</h1>
          <p>Dành cho quản lý và nhân viên quầy.</p>

          {error && <div className="modern-error" style={{ marginBottom: '14px' }}>{error}</div>}

          <form onSubmit={handleSubmit} className="modern-form">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="ten@maxpower.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <label htmlFor="login-password">Mật khẩu</label>
            <input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <button type="submit" className="primary-btn large" disabled={loading}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="login-help">
            <button
              type="button"
              className="link-btn"
              onClick={() => setShowPasswordModal(true)}
            >
              Đổi mật khẩu
            </button>
          </div>
        </div>
      </section>

      <ChangePasswordModal 
        isOpen={showPasswordModal} 
        onClose={() => setShowPasswordModal(false)} 
      />
    </div>
  );
}

