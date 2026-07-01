import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Calendar, Clock, Check, X, RefreshCw, Eye, MessageSquare, AlertCircle, FileText, Search, UserCheck, Settings } from 'lucide-react';

const SecretaryDashboard = () => {
  const [official, setOfficial] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'confirmed', 'all'

  // Modal / Action States
  const [noteModalApp, setNoteModalApp] = useState(null); // App being rejected
  const [rejectionNote, setRejectionNote] = useState('');

  const [rescheduleModalApp, setRescheduleModalApp] = useState(null); // App being rescheduled
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleNote, setRescheduleNote] = useState('');

  // QR Check-in Simulator State
  const [verificationToken, setVerificationToken] = useState('');
  const [checkInMsg, setCheckInMsg] = useState('');
  const [checkInErr, setCheckInErr] = useState('');

  // Office Config States
  const [configDays, setConfigDays] = useState([]);
  const [configStartTime, setConfigStartTime] = useState('');
  const [configEndTime, setConfigEndTime] = useState('');
  const [configSlotDuration, setConfigSlotDuration] = useState(30);
  const [configBuffer, setConfigBuffer] = useState(10);
  const [configRestStart, setConfigRestStart] = useState('13:00');
  const [configRestEnd, setConfigRestEnd] = useState('14:00');
  const [configSaving, setConfigSaving] = useState(false);
  const [configSuccess, setConfigSuccess] = useState('');
  const [configError, setConfigError] = useState('');
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Blackout Dates sub-modal States
  const [modalSubTab, setModalSubTab] = useState('hours'); // 'hours' or 'blackouts'
  const [blackoutList, setBlackoutList] = useState([]);
  const [newBlackoutDate, setNewBlackoutDate] = useState('');
  const [newBlackoutReason, setNewBlackoutReason] = useState('');
  const [blackoutSaving, setBlackoutSaving] = useState(false);
  const [blackoutError, setBlackoutError] = useState('');
  
  // Pagination State for table
  const [appointmentsPage, setAppointmentsPage] = useState(1);
  const appointmentsPerPage = 8;

  const loadData = async () => {
    try {
      const data = await api.secretary.getAppointments();
      setOfficial(data.official);
      setAppointments(data.appointments);
      setAppointmentsPage(1); // Reset page on data reload
      
      // Initialize office config states
      if (data.official) {
        setConfigDays(data.official.available_days || []);
        setConfigStartTime(data.official.available_start_time || '');
        setConfigEndTime(data.official.available_end_time || '');
        setConfigSlotDuration(data.official.slot_duration_minutes || 30);
        setConfigBuffer(data.official.buffer_duration_minutes || 10);
        setConfigRestStart(data.official.rest_start_time || '13:00');
        setConfigRestEnd(data.official.rest_end_time || '14:00');
      }
    } catch (err) {
      setError('Failed to retrieve appointments data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleWsAlert = () => {
      loadData();
    };
    window.addEventListener('ws_notification', handleWsAlert);

    return () => {
      window.removeEventListener('ws_notification', handleWsAlert);
    };
  }, []);

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this appointment request?')) return;
    setActionLoading(true);
    try {
      await api.secretary.approve(id);
      loadData();
      alert('Appointment approved successfully!');
    } catch (err) {
      alert(err.message || 'Failed to approve request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionNote.trim()) return;
    setActionLoading(true);
    try {
      await api.secretary.reject(noteModalApp.id, rejectionNote);
      setNoteModalApp(null);
      setRejectionNote('');
      loadData();
      alert('Appointment request rejected.');
    } catch (err) {
      alert(err.message || 'Failed to reject request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleDate || !rescheduleTime || !rescheduleNote.trim()) {
      return alert('All fields are required for reschedule proposal.');
    }
    setActionLoading(true);
    try {
      await api.secretary.reschedule(rescheduleModalApp.id, rescheduleDate, rescheduleTime, rescheduleNote);
      setRescheduleModalApp(null);
      setRescheduleDate('');
      setRescheduleTime('');
      setRescheduleNote('');
      loadData();
      alert('Reschedule proposal sent to visitor.');
    } catch (err) {
      alert(err.message || 'Failed to reschedule.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckInSimulator = async (e) => {
    e.preventDefault();
    setCheckInMsg('');
    setCheckInErr('');

    if (!verificationToken.trim()) {
      return setCheckInErr('Please select or input a verification token.');
    }

    // Find the corresponding approved appointment matching this QR token
    const matchingApp = appointments.find(a => a.qr_code_token === verificationToken.trim());
    if (!matchingApp) {
      return setCheckInErr('No matching approved appointment found with this QR token.');
    }

    if (matchingApp.status !== 'approved') {
      return setCheckInErr(`Cannot check in. Appointment status is currently "${matchingApp.status}".`);
    }

    try {
      await api.secretary.checkIn(matchingApp.id, verificationToken.trim());
      setCheckInMsg(`Success! Checked in ${matchingApp.visitor_name} for appointment ${matchingApp.id}.`);
      setVerificationToken('');
      loadData();
    } catch (err) {
      setCheckInErr(err.message || 'Check-in validation failed.');
    }
  };

  const handleOpenSettings = async () => {
    setConfigSuccess('');
    setConfigError('');
    setSettingsModalOpen(true);
    setModalSubTab('hours');
    try {
      const list = await api.secretary.getBlackoutDates();
      setBlackoutList(list);
    } catch (err) {
      console.error('Failed to load blackout dates:', err);
    }
  };

  const handleUpdateAvailability = async (e) => {
    e.preventDefault();
    setConfigSuccess('');
    setConfigError('');

    if (configDays.length === 0 || !configStartTime || !configEndTime) {
      return setConfigError('Please select at least one day and set both start and end times.');
    }

    setConfigSaving(true);
    try {
      await api.secretary.updateOfficialAvailability({
        available_days: configDays,
        available_start_time: configStartTime,
        available_end_time: configEndTime,
        slot_duration_minutes: configSlotDuration,
        buffer_duration_minutes: configBuffer,
        rest_start_time: configRestStart,
        rest_end_time: configRestEnd
      });
      setConfigSuccess('Office availability updated successfully!');
      await loadData();
      setTimeout(() => {
        setSettingsModalOpen(false);
      }, 1500);
    } catch (err) {
      setConfigError(err.message || 'Failed to update office configuration.');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleAddBlackout = async (e) => {
    e.preventDefault();
    if (!newBlackoutDate) return;
    setBlackoutSaving(true);
    setBlackoutError('');
    try {
      await api.secretary.addBlackoutDate(newBlackoutDate, newBlackoutReason);
      setNewBlackoutDate('');
      setNewBlackoutReason('');
      const list = await api.secretary.getBlackoutDates();
      setBlackoutList(list);
    } catch (err) {
      setBlackoutError(err.message || 'Failed to add blackout date.');
    } finally {
      setBlackoutSaving(false);
    }
  };

  const handleDeleteBlackout = async (id) => {
    if (!window.confirm('Are you sure you want to remove this blackout date?')) return;
    try {
      await api.secretary.deleteBlackoutDate(id);
      const list = await api.secretary.getBlackoutDates();
      setBlackoutList(list);
    } catch (err) {
      alert(err.message || 'Failed to delete blackout date.');
    }
  };

  const handleConfigDayToggle = (day) => {
    if (configDays.includes(day)) {
      setConfigDays(prev => prev.filter(d => d !== day));
    } else {
      setConfigDays(prev => [...prev, day]);
    }
  };

  // Filters
  const pendingRequests = appointments.filter(a => a.status === 'pending');
  const confirmedSchedule = appointments.filter(a => a.status === 'approved');
  
  const getFilteredAppointments = () => {
    if (activeTab === 'pending') return pendingRequests;
    if (activeTab === 'confirmed') return confirmedSchedule;
    return appointments; // Show all
  };

  const filteredList = getFilteredAppointments();

  // Helper date limits for rescheduling
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="main-content">
      {/* Official Header */}
      {official && (
        <div className="card" style={{ background: 'var(--primary)', color: '#fff', borderTop: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.85 }}>DELEGATED SECRETARY FOR:</span>
            <h2 style={{ color: 'var(--secondary)', fontSize: '1.6rem', marginTop: '0.15rem', marginBottom: '0.15rem' }}>{official.name}</h2>
            <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{official.office_title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.85rem', textAlign: 'right', background: 'rgba(255,255,255,0.08)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)' }}>
              <strong>Standard Office Hours:</strong> {official.available_days.join(', ')} @ {official.available_start_time} - {official.available_end_time}
            </div>
            <button
              className="btn btn-outline"
              onClick={handleOpenSettings}
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Configure Office Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="dashboard-grid">
        {/* Left Side: Inbox List */}
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <button
              className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setActiveTab('pending'); setAppointmentsPage(1); }}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              Pending Requests ({pendingRequests.length})
            </button>
            <button
              className={`btn ${activeTab === 'confirmed' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setActiveTab('confirmed'); setAppointmentsPage(1); }}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              Confirmed Schedule ({confirmedSchedule.length})
            </button>
            <button
              className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setActiveTab('all'); setAppointmentsPage(1); }}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              All Records ({appointments.length})
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading records...</div>
          ) : filteredList.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <AlertCircle size={40} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
              <h3>No Appointments in this tab</h3>
              <p style={{ color: 'var(--text-muted)' }}>There are no scheduling records to display here.</p>
            </div>
          ) : (
            (() => {
              const indexOfLastApp = appointmentsPage * appointmentsPerPage;
              const indexOfFirstApp = indexOfLastApp - appointmentsPerPage;
              const currentAppointments = filteredList.slice(indexOfFirstApp, indexOfLastApp);
              const totalPages = Math.ceil(filteredList.length / appointmentsPerPage);

              return (
                <>
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Visitor Details</th>
                          <th>Requested Date/Time</th>
                          <th>Purpose</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentAppointments.map(app => (
                          <tr key={app.id}>
                            <td>
                              <span style={{ display: 'block', fontWeight: 600 }}>{app.visitor_name}</span>
                              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{app.visitor_email}</span>
                              {app.visitor_identifier && (
                                <span className="user-badge" style={{ fontSize: '0.65rem', padding: '1px 6px', marginTop: '0.2rem', display: 'inline-block' }}>
                                  {app.visitor_identifier}
                                </span>
                              )}
                            </td>
                            <td>
                              <span style={{ display: 'block', fontWeight: 600 }}>{app.requested_date}</span>
                              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{app.requested_time} hrs</span>
                            </td>
                            <td style={{ maxWidth: '240px', fontSize: '0.85rem' }}>
                              <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={app.purpose}>
                                {app.purpose}
                              </p>
                            </td>
                            <td>
                              <span className={`status-badge ${app.status}`} style={{ fontSize: '0.75rem' }}>
                                {app.status}
                              </span>
                            </td>
                            <td className="actions-cell">
                              {app.status === 'pending' && (
                                <>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                                    onClick={() => handleApprove(app.id)}
                                    disabled={actionLoading}
                                    title="Approve Visit"
                                  >
                                    <Check size={14} /> Approve
                                  </button>
                                  <button
                                    className="btn btn-outline"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', borderColor: 'var(--status-rescheduled)', color: 'var(--status-rescheduled)' }}
                                    onClick={() => setRescheduleModalApp(app)}
                                    disabled={actionLoading}
                                    title="Reschedule Proposal"
                                  >
                                    <RefreshCw size={14} /> Reschedule
                                  </button>
                                  <button
                                    className="btn btn-danger"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                                    onClick={() => setNoteModalApp(app)}
                                    disabled={actionLoading}
                                    title="Reject Visit"
                                  >
                                    <X size={14} /> Reject
                                  </button>
                                </>
                              )}

                              {app.status === 'approved' && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  Token: {app.qr_code_token}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                      <button 
                        className="btn btn-outline" 
                        disabled={appointmentsPage === 1} 
                        onClick={() => setAppointmentsPage(prev => Math.max(prev - 1, 1))}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        Previous
                      </button>
                      <span style={{ color: 'var(--text-muted)' }}>Page {appointmentsPage} of {totalPages}</span>
                      <button 
                        className="btn btn-outline" 
                        disabled={appointmentsPage === totalPages} 
                        onClick={() => setAppointmentsPage(prev => Math.min(prev + 1, totalPages))}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              );
            })()
          )}
        </div>

        {/* Right Side: QR Code Simulator Check-in */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="card" style={{ borderTop: '5px solid var(--secondary)', margin: 0 }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserCheck size={20} style={{ color: 'var(--primary)' }} />
              QR Check-in Simulator
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Simulates checking in visitors at the door by entering or scanning their confirmation slip QR token.
            </p>

            {checkInMsg && <div className="alert alert-success" style={{ fontSize: '0.8rem' }}>{checkInMsg}</div>}
            {checkInErr && <div className="alert alert-danger" style={{ fontSize: '0.8rem' }}><AlertCircle size={16} /> {checkInErr}</div>}

            <form onSubmit={handleCheckInSimulator}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Select Approved Visitor</label>
                <select
                  className="form-control"
                  style={{ fontSize: '0.85rem' }}
                  value={verificationToken}
                  onChange={(e) => setVerificationToken(e.target.value)}
                >
                  <option value="">-- Select Confirmed Visitor --</option>
                  {confirmedSchedule.map(a => (
                    <option key={a.id} value={a.qr_code_token}>
                      {a.visitor_name} ({a.requested_time} hrs) - {a.qr_code_token}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ textAlign: 'center', margin: '0.75rem 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>OR ENTER TOKEN MANUALLY</div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. qr_4_17198..."
                  value={verificationToken}
                  onChange={(e) => setVerificationToken(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '0.85rem', padding: '0.6rem' }}
              >
                Validate & Mark Completed
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {noteModalApp && (
        <div className="modal-overlay" onClick={() => setNoteModalApp(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reject Booking Request</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                State the reason for rejecting {noteModalApp.visitor_name}'s visit.
              </p>
            </div>
            <form onSubmit={handleRejectSubmit}>
              <div className="form-group">
                <label className="form-label">Rejection Note (sent via email)</label>
                <textarea
                  className="form-control"
                  rows="4"
                  placeholder="e.g., The Vice Chancellor is attending a state council meeting in Abuja."
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setNoteModalApp(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={actionLoading}>
                  {actionLoading ? 'Rejecting...' : 'Reject Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Proposal Modal */}
      {rescheduleModalApp && (
        <div className="modal-overlay" onClick={() => setRescheduleModalApp(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Propose Reschedule Slot</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                Suggest a new date/time slot to {rescheduleModalApp.visitor_name}.
              </p>
            </div>
            <form onSubmit={handleRescheduleSubmit}>
              <div className="form-group">
                <label className="form-label">Proposed New Date</label>
                <input
                  type="date"
                  className="form-control"
                  min={todayStr}
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Proposed New Time (HH:MM)</label>
                <input
                  type="time"
                  className="form-control"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Rescheduling</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Explain why the original slot was unavailable..."
                  value={rescheduleNote}
                  onChange={(e) => setRescheduleNote(e.target.value)}
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setRescheduleModalApp(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Sending...' : 'Propose Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Office Configuration Modal Overlay */}
      {settingsModalOpen && official && (
        <div className="modal-overlay" onClick={() => setSettingsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Office Settings</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                Configure standard hours, rest periods, meeting buffers, and blackout dates.
              </p>
            </div>

            {/* Modal Sub-Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => setModalSubTab('hours')}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: modalSubTab === 'hours' ? '3px solid var(--primary)' : 'none',
                  padding: '0.5rem',
                  fontWeight: modalSubTab === 'hours' ? '700' : '500',
                  color: modalSubTab === 'hours' ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Hours & Buffers
              </button>
              <button
                type="button"
                onClick={() => setModalSubTab('blackouts')}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: modalSubTab === 'blackouts' ? '3px solid var(--primary)' : 'none',
                  padding: '0.5rem',
                  fontWeight: modalSubTab === 'blackouts' ? '700' : '500',
                  color: modalSubTab === 'blackouts' ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Blackout Dates ({blackoutList.length})
              </button>
            </div>

            {modalSubTab === 'hours' ? (
              <form onSubmit={handleUpdateAvailability}>
                {configSuccess && <div className="alert alert-success" style={{ fontSize: '0.85rem' }}>{configSuccess}</div>}
                {configError && <div className="alert alert-danger" style={{ fontSize: '0.85rem' }}><AlertCircle size={16} /> {configError}</div>}

                {/* Row 1: Start Time, End Time, Slot Duration */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Start Time</label>
                    <input
                      type="time"
                      className="form-control"
                      value={configStartTime}
                      onChange={(e) => setConfigStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">End Time</label>
                    <input
                      type="time"
                      className="form-control"
                      value={configEndTime}
                      onChange={(e) => setConfigEndTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Slot Duration</label>
                    <select
                      className="form-control"
                      value={configSlotDuration}
                      onChange={(e) => setConfigSlotDuration(Number(e.target.value))}
                    >
                      <option value={15}>15m</option>
                      <option value={20}>20m</option>
                      <option value={30}>30m</option>
                      <option value={45}>45m</option>
                      <option value={60}>60m</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Buffer Time, Rest Start, Rest End */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Buffer Time</label>
                    <select
                      className="form-control"
                      value={configBuffer}
                      onChange={(e) => setConfigBuffer(Number(e.target.value))}
                    >
                      <option value={0}>0m</option>
                      <option value={5}>5m</option>
                      <option value={10}>10m</option>
                      <option value={15}>15m</option>
                      <option value={20}>20m</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Rest Start</label>
                    <input
                      type="time"
                      className="form-control"
                      value={configRestStart}
                      onChange={(e) => setConfigRestStart(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Rest End</label>
                    <input
                      type="time"
                      className="form-control"
                      value={configRestEnd}
                      onChange={(e) => setConfigRestEnd(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Available Weekdays</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.2rem' }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                      const isChecked = configDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleConfigDayToggle(day)}
                          className={`btn ${isChecked ? 'btn-primary' : 'btn-outline'}`}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.3rem 0.6rem',
                            margin: 0,
                            borderRadius: '16px'
                          }}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={() => setSettingsModalOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={configSaving}
                  >
                    {configSaving ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                {blackoutError && <div className="alert alert-danger" style={{ fontSize: '0.85rem' }}><AlertCircle size={16} /> {blackoutError}</div>}
                
                {/* Add Blackout Form */}
                <form onSubmit={handleAddBlackout} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '0.5rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Select Date</label>
                      <input
                        type="date"
                        className="form-control"
                        min={todayStr}
                        value={newBlackoutDate}
                        onChange={(e) => setNewBlackoutDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Reason / Occasion</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Council Meeting"
                        value={newBlackoutReason}
                        onChange={(e) => setNewBlackoutReason(e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.45rem', marginTop: '0.25rem' }}
                    disabled={blackoutSaving}
                  >
                    {blackoutSaving ? 'Adding...' : 'Register Blackout Date'}
                  </button>
                </form>

                {/* Blackout Dates List */}
                <h4 style={{ fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 600, color: 'var(--primary)' }}>Active Blackout Dates</h4>
                {blackoutList.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>No blackout dates registered.</p>
                ) : (
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <table className="table" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Reason</th>
                          <th style={{ textAlign: 'center', width: '60px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {blackoutList.map(b => (
                          <tr key={b.id}>
                            <td style={{ fontWeight: 600 }}>{b.date}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{b.reason || 'None'}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-danger"
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                                onClick={() => handleDeleteBlackout(b.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="modal-footer" style={{ marginTop: '1rem' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setSettingsModalOpen(false)}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SecretaryDashboard;
