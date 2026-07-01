import React, { createContext, useState, useEffect, useContext } from 'react';
import api from './api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Check if user is logged in on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const data = await api.auth.getMe();
        if (data && data.user) {
          setUser(data.user);
        }
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  // WebSockets push connection listener
  useEffect(() => {
    if (!user) return;

    let ws = null;
    let reconnectTimeout = null;

    function connect() {
      // Connect to WebSocket server upgrade route on port 5000
      ws = new WebSocket('ws://localhost:5000/ws');

      ws.onopen = () => {
        // Authenticate WebSocket connection with active session userId
        ws.send(JSON.stringify({ type: 'auth', userId: user.id }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_appointment' || data.type === 'appointment_update') {
            setToast(data.message);
            // Dispatch a window event to trigger automatic page data reload in other components
            window.dispatchEvent(new CustomEvent('ws_notification', { detail: data }));
            
            // Auto close toast after 5 seconds
            setTimeout(() => {
              setToast(null);
            }, 5000);
          }
        } catch (err) {
          console.error('WS client message parse error:', err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(() => {
          if (user) connect();
        }, 3000);
      };
    }

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [user]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const data = await api.auth.login(email, password);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (fullName, email, password, matricStaffId) => {
    return await api.auth.register(fullName, email, password, matricStaffId);
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.auth.logout();
    } catch (err) {
      console.error('Logout error:', err.message);
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser, toast, setToast }}>
      {children}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '70px',
          right: '20px',
          background: 'var(--primary)',
          color: '#fff',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-sm)',
          borderLeft: '4px solid var(--secondary)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          zIndex: 9999,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontFamily: 'sans-serif'
        }}>
          <span>{toast}</span>
          <button 
            onClick={() => setToast(null)}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', marginLeft: '0.5rem' }}
          >
            ×
          </button>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
