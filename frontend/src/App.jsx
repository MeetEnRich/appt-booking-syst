import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './utils/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

// Page imports
import Login from './pages/Login';
import Register from './pages/Register';
import VisitorBook from './pages/VisitorBook';
import MyAppointments from './pages/MyAppointments';
import SecretaryDashboard from './pages/SecretaryDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminOfficials from './pages/AdminOfficials';

// Layout component with Nav Bar
const AppLayout = () => {
  return (
    <div className="app-container">
      <Navbar />
      <Outlet />
    </div>
  );
};

// Role-aware home router redirector
const HomeRedirector = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (user.role === 'secretary') {
    return <Navigate to="/secretary" replace />;
  }

  return <Navigate to="/book" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public authentication routes without Navbar */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected dashboard routes with Navbar */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomeRedirector />} />
            
            {/* Visitor Flow */}
            <Route
              path="/book"
              element={
                <ProtectedRoute allowedRoles={['visitor']}>
                  <VisitorBook />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-appointments"
              element={
                <ProtectedRoute allowedRoles={['visitor']}>
                  <MyAppointments />
                </ProtectedRoute>
              }
            />

            {/* Secretary Flow */}
            <Route
              path="/secretary"
              element={
                <ProtectedRoute allowedRoles={['secretary']}>
                  <SecretaryDashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin Flow */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/officials"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminOfficials />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
