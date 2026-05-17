import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';

import ProtectedRoute from './components/layout/ProtectedRoute';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';

import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Members from './pages/Members/Members';
import Inventory from './pages/Inventory/Inventory';
import Shifts from './pages/Shifts/Shifts';
import Staff from './pages/Staff/Staff';
import Logs from './pages/Logs/Logs';
import Statistics from './pages/Statistics/Statistics';
import Notes from './pages/Notes/Notes';
import ToastContainer from './components/common/ToastContainer';
import ConfirmDialog from './components/common/ConfirmDialog';

import { useAuthStore } from './store/useAuthStore';
import supabase from './config/supabase';

function App() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const profile = useAuthStore((state) => state.profile);

  useEffect(() => {
    // 1. Khởi tạo auth lần đầu (đọc từ localStorage)
    initializeAuth();

    // 2. Lắng nghe thay đổi (ví dụ: đăng xuất từ tab khác)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        useAuthStore.getState().clearLocalState();
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        initializeAuth();
      }
    });

    return () => subscription.unsubscribe();
  }, [initializeAuth]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastContainer />
      <ConfirmDialog />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/*"
          element={
            <ProtectedRoute>
            <div className={`modern-shell ${!isSidebarOpen ? 'sidebar-closed' : ''}`}>
              <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
              <div className="modern-main">
                <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} isSidebarOpen={isSidebarOpen} />
                  <div className="modern-content">
                    <Routes>
                      <Route
                        path="/dashboard"
                        element={
                          <ProtectedRoute allowedRoles={['admin']}>
                            <Dashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/members" element={<Members />} />
                      <Route path="/inventory" element={<Inventory />} />
                      <Route path="/shifts" element={<Shifts />} />
                      <Route path="/notes" element={<Notes />} />
                      <Route
                        path="/staff"
                        element={
                          <ProtectedRoute allowedRoles={['admin']}>
                            <Staff />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/logs"
                        element={
                          <ProtectedRoute allowedRoles={['admin']}>
                            <Logs />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/statistics"
                        element={
                          <ProtectedRoute allowedRoles={['admin']}>
                            <Statistics />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/"
                        element={<Navigate to={profile?.role === 'staff' ? '/members' : '/dashboard'} replace />}
                      />
                    </Routes>
                  </div>
                </div>

                {isSidebarOpen && (
                  <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
                )}
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

