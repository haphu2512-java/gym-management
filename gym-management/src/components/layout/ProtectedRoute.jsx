import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return <div className="loading">Äang táº£i...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

