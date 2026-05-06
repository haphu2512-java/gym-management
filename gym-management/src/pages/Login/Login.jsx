import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

export default function Login() {
  const navigate = useNavigate();
  const { login, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

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
      <div className="login-card-modern">
        <h1>GymMax Power Center</h1>
        <p>Đăng nhập vào hệ thống quản lý phòng tập</p>

        {error && <div className="modern-error">{error}</div>}

        <form onSubmit={handleSubmit} className="modern-form">
          <label>Email</label>
          <input
            type="email"
            placeholder="Nhập email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label>Mật khẩu</label>
          <input
            type="password"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <button type="submit" className="primary-btn large" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}

