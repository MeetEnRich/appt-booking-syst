import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import api from '../utils/api';
import { Bell, LogOut, Calendar, Shield, User, Menu } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const data = await api.notifications.list();
      setNotifications(data);
    } catch (err) {
      console.error('Error fetching notifications:', err.message);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll notifications every 20 seconds to simulate real-time updates
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle click outside to close notification dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.notifications.markRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
      );
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error(err.message);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!user) return null;

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <img 
          src="/logo.png" 
          alt="FULafia Logo" 
          style={{ width: '32px', height: '32px', objectFit: 'contain' }} 
        />
        <div>
          <span style={{ display: 'block', fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.1 }}>FULAFIA</span>
          <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>APPOINTMENT BOOKING</span>
        </div>
      </div>

      <div className="nav-links">
        {user.role === 'visitor' && (
          <>
            <NavLink to="/book" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Book Visit
            </NavLink>
            <NavLink to="/my-appointments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              My Appointments
            </NavLink>
          </>
        )}

        {user.role === 'secretary' && (
          <NavLink to="/secretary" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Secretary Dashboard
          </NavLink>
        )}

        {user.role === 'admin' && (
          <>
            <NavLink to="/admin" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Dashboard Stats
            </NavLink>
            <NavLink to="/admin/officials" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Manage Officials
            </NavLink>
          </>
        )}

        {/* Notifications Bell */}
        <div className="notification-bell-container" ref={dropdownRef}>
          <div className="bell-icon-wrapper" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <Bell size={20} />
            {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
          </div>

          {dropdownOpen && (
            <div className="notification-dropdown">
              <div className="dropdown-header">
                <span>Notifications ({unreadCount} unread)</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--secondary)',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="dropdown-list">
                {notifications.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No alerts in your inbox.
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`dropdown-item ${!n.is_read ? 'unread' : ''}`}
                      onClick={(e) => !n.is_read && handleMarkRead(n.id, e)}
                    >
                      <span style={{ fontWeight: !n.is_read ? 600 : 400 }}>{n.message}</span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                        <span className="dropdown-time">
                          {new Date(n.created_at).toLocaleDateString()} at {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {!n.is_read && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>
                            Mark read
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Details */}
        <div className="nav-user">
          <div style={{ textAlign: 'right', display: 'none', md: 'block' }}>
            <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>{user.full_name}</span>
            <span className="user-badge" style={{ fontSize: '0.7rem' }}>
              {user.role}
            </span>
          </div>
          <button className="btn btn-outline" onClick={handleLogout} style={{ padding: '0.4rem', border: '1px solid #cbd5e1' }} title="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
