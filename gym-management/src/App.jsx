import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import ProtectedRoute from './components/layout/ProtectedRoute';

import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Members from './pages/Members/Members';
import Inventory from './pages/Inventory/Inventory';
import Shifts from './pages/Shifts/Shifts';
import Staff from './pages/Staff/Staff';
import { useAuthStore } from './store/useAuthStore';

function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const profile = useAuthStore((state) => state.profile);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="app-layout">
                <Sidebar />
                <div className="main-content">
                  <Header />
                  <div className="page-content">
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/members" element={<Members />} />
                      <Route path="/inventory" element={<Inventory />} />
                      <Route path="/shifts" element={<Shifts />} />
                      <Route path="/staff" element={<Staff />} />
                      <Route path="/" element={<Navigate to={profile?.role === 'staff' ? '/members' : '/dashboard'} replace />} />
                    </Routes>
                  </div>
                </div>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
