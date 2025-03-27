import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Contacts from './pages/Contacts';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import Error404 from './pages/Error404';
import AnalyticsService from './services/AnalyticsService';
import { ROUTES } from './lib/constants';
import './styles/global.css';

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

// Admin route component
const AdminRoute = ({ children }) => {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  // Check if user is an admin (this would be determined by your actual admin check logic)
  const isAdmin = profile?.is_admin || false;
  
  if (!isAdmin) {
    return <Navigate to="/chat" />;
  }
  
  return children;
};

// Main app component
const App = () => {
  useEffect(() => {
    // Register service worker for PWA support
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/serviceWorker.js')
          .then(registration => {
            console.log('Service Worker registered with scope:', registration.scope);
          })
          .catch(error => {
            console.error('Service Worker registration failed:', error);
          });
      });
    }
    
    // Initialize analytics
    AnalyticsService.initialize();
  }, []);
  
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path={ROUTES.LOGIN} element={<Login />} />
            <Route path={ROUTES.REGISTER} element={<Register />} />
            
            {/* Protected routes */}
            <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.CHAT} />} />
            <Route 
              path={ROUTES.CHAT}
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={`${ROUTES.CHAT}/:contactId?`}
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={ROUTES.CONTACTS}
              element={
                <ProtectedRoute>
                  <Contacts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={ROUTES.PROFILE}
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path={ROUTES.SETTINGS}
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            
            {/* Admin route */}
            <Route 
              path={ROUTES.ADMIN}
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              } 
            />
            
            {/* 404 Not Found */}
            <Route path={ROUTES.NOT_FOUND} element={<Error404 />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;