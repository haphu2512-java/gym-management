import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuthStore();

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(profile?.role)) {
    return <Navigate to="/members" replace />;
  }

  return children;
}
