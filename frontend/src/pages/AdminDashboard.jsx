import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Shield, Users, Mail, Percent, BookOpen, UserPlus, AlertCircle, RefreshCw, Clock } from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Pagination State for Logs
  const [logsPage, setLogsPage] = useState(1);
  const logsPerPage = 6;

  const loadData = async () => {
    try {
      const statsData = await api.admin.getStats();
      setStats(statsData);
      setLogsPage(1); // Reset pagination page on data reload
    } catch (err) {
      setError('Failed to fetch dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  const exportAppointmentsCSV = async () => {
    try {
      const data = await api.admin.getExportAppointments();
      if (data.length === 0) return alert('No appointments data to export.');
      
      const headers = ['ID', 'Visitor Name', 'Visitor Email', 'Visitor Identifier', 'Official Name', 'Office Title', 'Date', 'Time', 'Purpose', 'Status', 'Created At'];
      const csvRows = [
        headers.join(','),
        ...data.map(row => [
          row.id,
          `"${row.visitor_name.replace(/"/g, '""')}"`,
          row.visitor_email,
          row.visitor_identifier || '',
          `"${row.official_name.replace(/"/g, '""')}"`,
          `"${row.office_title.replace(/"/g, '""')}"`,
          row.requested_date,
          row.requested_time,
          `"${row.purpose.replace(/"/g, '""')}"`,
          row.status,
          row.created_at
        ].join(','))
      ];
      
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'appointments_audit.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to export appointments CSV: ' + err.message);
    }
  };

  const exportLogsCSV = async () => {
    try {
      const data = await api.admin.getExportLogs();
      if (data.length === 0) return alert('No dispatch logs data to export.');
      
      const headers = ['ID', 'Log Type', 'Recipient', 'Subject', 'Message', 'Created At'];
      const csvRows = [
        headers.join(','),
        ...data.map(row => [
          row.id,
          row.log_type,
          row.recipient,
          `"${row.subject.replace(/"/g, '""')}"`,
          `"${row.message.replace(/"/g, '""')}"`,
          row.created_at
        ].join(','))
      ];
      
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'notification_dispatch_logs.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to export logs CSV: ' + err.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Pagination Helper Calculations
  let currentLogs = [];
  let totalLogsPages = 1;
  if (stats && stats.logs) {
    const indexOfLastLog = logsPage * logsPerPage;
    const indexOfFirstLog = indexOfLastLog - logsPerPage;
    currentLogs = stats.logs.slice(indexOfFirstLog, indexOfLastLog);
    totalLogsPages = Math.ceil(stats.logs.length / logsPerPage);
  }

  return (
    <div className="main-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>System Administration Dashboard</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Monitor university scheduling statistics, view busiest offices, and audit dispatch logs.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={exportAppointmentsCSV} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
            Export Appointments
          </button>
          <button className="btn btn-outline" onClick={exportLogsCSV} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
            Export Dispatch Logs
          </button>
          <button className="btn btn-outline" onClick={loadData} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
            <RefreshCw size={14} /> Refresh Metrics
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Compiling statistics...</div>
      ) : (
        <>
          {/* Stats Cards Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-content">
                <span className="stat-label">Total Visits Logs</span>
                <span className="stat-value">{stats.totalCount}</span>
              </div>
              <div className="stat-icon">
                <BookOpen size={24} />
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-content">
                <span className="stat-label">Confirmed (Approved)</span>
                <span className="stat-value">{stats.statusCounts.approved}</span>
              </div>
              <div className="stat-icon" style={{ background: 'var(--status-approved-bg)', color: 'var(--status-approved)' }}>
                <Users size={24} />
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-content">
                <span className="stat-label">Completed Visits</span>
                <span className="stat-value">{stats.completedCount}</span>
              </div>
              <div className="stat-icon" style={{ background: 'var(--status-completed-bg)', color: 'var(--status-completed)' }}>
                <UserPlus size={24} />
              </div>
            </div>

            <div className="stat-card" title="Approved visits in the past that failed to complete check-in">
              <div className="stat-content">
                <span className="stat-label">No-Show Rate</span>
                <span className="stat-value">{stats.noShowRate}%</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>({stats.noShowCount} no-shows)</span>
              </div>
              <div className="stat-icon" style={{ background: 'var(--status-rejected-bg)', color: 'var(--status-rejected)' }}>
                <Percent size={24} />
              </div>
            </div>

            <div className="stat-card" title="Average duration in minutes from scheduled start to check-in completion">
              <div className="stat-content">
                <span className="stat-label">Average Wait Time</span>
                <span className="stat-value">{stats.avgWaitTime} mins</span>
              </div>
              <div className="stat-icon" style={{ background: 'var(--secondary-light)', color: 'var(--primary)' }}>
                <Clock size={24} />
              </div>
            </div>
          </div>

          <div className="dashboard-grid">
            {/* Left Column: Busiest Officials */}
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Busiest Officials</h3>
              {stats.busiestOfficials.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No scheduling transactions logged yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Official Name</th>
                        <th>Office Title</th>
                        <th style={{ textAlign: 'right' }}>Total Bookings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.busiestOfficials.map((bo, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{bo.name}</td>
                          <td>{bo.office_title}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                            {bo.appointment_count} visits
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right Column: Simulated Email Logs */}
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={20} style={{ color: 'var(--primary)' }} />
                Simulated Notification Dispatch Logs
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Auditing simulated emails logged during appointment status changes.
              </p>

              {stats.logs.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No notifications dispatched yet.</div>
              ) : (
                <>
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Recipient</th>
                          <th>Subject</th>
                          <th>Sent At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentLogs.map(log => (
                          <tr key={log.id} style={{ fontSize: '0.8rem' }}>
                            <td style={{ fontWeight: 600 }}>{log.recipient}</td>
                            <td style={{ color: 'var(--primary)', fontWeight: 500 }} title={log.message}>{log.subject}</td>
                            <td>
                              {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {totalLogsPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                      <button 
                        className="btn btn-outline" 
                        disabled={logsPage === 1} 
                        onClick={() => setLogsPage(prev => Math.max(prev - 1, 1))}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        Previous
                      </button>
                      <span style={{ color: 'var(--text-muted)' }}>Page {logsPage} of {totalLogsPages}</span>
                      <button 
                        className="btn btn-outline" 
                        disabled={logsPage === totalLogsPages} 
                        onClick={() => setLogsPage(prev => Math.min(prev + 1, totalLogsPages))}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
