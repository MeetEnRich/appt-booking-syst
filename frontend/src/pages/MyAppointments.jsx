import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Calendar, Clock, User, QrCode, FileText, Check, AlertTriangle, XCircle, Info } from 'lucide-react';
import QRCode from 'qrcode';

const MyAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Modal states
  const [selectedApp, setSelectedApp] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const appointmentsPerPage = 5;

  const loadAppointments = async () => {
    try {
      const data = await api.appointments.getMine();
      setAppointments(data);
      setCurrentPage(1); // Reset page on list reload
    } catch (err) {
      setError('Failed to fetch your appointments list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();

    const handleWsAlert = () => {
      loadAppointments();
    };
    window.addEventListener('ws_notification', handleWsAlert);

    return () => {
      window.removeEventListener('ws_notification', handleWsAlert);
    };
  }, []);

  // Generate QR Code URL when selected appointment changes
  useEffect(() => {
    if (selectedApp && selectedApp.qr_code_token) {
      QRCode.toDataURL(selectedApp.qr_code_token, { width: 180, margin: 2 }, (err, url) => {
        if (err) {
          console.error('QR code generation error:', err);
        } else {
          setQrCodeUrl(url);
        }
      });
    } else {
      setQrCodeUrl('');
    }
  }, [selectedApp]);

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    setActionLoading(true);
    try {
      await api.appointments.cancel(id);
      loadAppointments();
    } catch (err) {
      alert(err.message || 'Failed to cancel appointment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptReschedule = async (id) => {
    if (!window.confirm('Do you want to accept this rescheduled time slot?')) return;
    setActionLoading(true);
    try {
      const res = await api.appointments.acceptReschedule(id);
      loadAppointments();
      alert('Rescheduled time accepted! Your appointment is now approved.');
    } catch (err) {
      alert(err.message || 'Failed to accept reschedule.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="main-content">
      <div style={{ marginBottom: '2rem' }}>
        <h2>My Appointments</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Track the status of your booking requests, review reschedule offers, and download confirmation slips.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading your appointments...</div>
      ) : appointments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Info size={40} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
          <h3>No Appointments Found</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>You have not requested any appointments yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(() => {
            const indexOfLastApp = currentPage * appointmentsPerPage;
            const indexOfFirstApp = indexOfLastApp - appointmentsPerPage;
            const currentAppointments = appointments.slice(indexOfFirstApp, indexOfLastApp);
            const totalPages = Math.ceil(appointments.length / appointmentsPerPage);

            return (
              <>
                {currentAppointments.map(app => (
                  <div key={app.id} className="card" style={{ margin: 0, padding: '0.85rem 1rem', borderLeft: `5px solid var(--status-${app.status})` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <span className={`status-badge ${app.status}`} style={{ marginBottom: '0.4rem' }}>
                          {app.status}
                        </span>
                        <h3 style={{ fontSize: '1.15rem', marginBottom: '0.15rem' }}>{app.official_name}</h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {app.official_title}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {app.status === 'approved' && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => setSelectedApp(app)}
                            style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                          >
                            <QrCode size={15} /> View QR Slip
                          </button>
                        )}
                        
                        {app.status === 'rescheduled' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => handleAcceptReschedule(app.id)}
                                disabled={actionLoading}
                                style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                            >
                              <Check size={15} /> Accept Slot
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() => handleCancel(app.id)}
                              disabled={actionLoading}
                              style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                            >
                              <XCircle size={15} /> Decline & Cancel
                            </button>
                          </div>
                        )}

                        {(app.status === 'pending' || app.status === 'approved') && (
                          <button
                            className="btn btn-outline"
                            onClick={() => handleCancel(app.id)}
                            disabled={actionLoading}
                            style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', borderColor: 'var(--status-rejected)', color: 'var(--status-rejected)' }}
                          >
                            Cancel Visit
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Appointment details details */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={14} style={{ color: 'var(--primary)' }} />
                        <div>
                          <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)' }}>DATE</span>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{app.requested_date}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={14} style={{ color: 'var(--primary)' }} />
                        <div>
                          <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)' }}>TIME</span>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{app.requested_time} hrs</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', gridColumn: 'span 2' }}>
                        <FileText size={14} style={{ color: 'var(--primary)' }} />
                        <div>
                          <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)' }}>PURPOSE</span>
                          <span style={{ fontSize: '0.8rem' }}>{app.purpose}</span>
                        </div>
                      </div>
                    </div>

                    {/* Proposed Rescheduled details display */}
                    {app.status === 'rescheduled' && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--status-rescheduled-bg)', border: '1px solid #b3e5fc', borderRadius: 'var(--radius-sm)' }}>
                        <h4 style={{ fontSize: '0.85rem', color: '#0288d1', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <AlertTriangle size={15} />
                          Proposed Rescheduled Details
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <span><strong>New Date:</strong> {app.rescheduled_date}</span>
                          <span><strong>New Time:</strong> {app.rescheduled_time} hrs</span>
                        </div>
                        {app.secretary_note && (
                          <p style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#333', borderTop: '1px solid #b3e5fc', paddingTop: '0.4rem', marginBottom: 0 }}>
                            <strong>Secretary's Reason:</strong> "{app.secretary_note}"
                          </p>
                        )}
                      </div>
                    )}

                    {/* Rejection/Secretary Notes */}
                    {app.status === 'rejected' && app.secretary_note && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--status-rejected-bg)', border: '1px solid #ffcdd2', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                        <strong>Rejection Reason:</strong> "{app.secretary_note}"
                      </div>
                    )}
                  </div>
                ))}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                    <button 
                      className="btn btn-outline" 
                      disabled={currentPage === 1} 
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Previous
                    </button>
                    <span style={{ color: 'var(--text-muted)' }}>Page {currentPage} of {totalPages}</span>
                    <button 
                      className="btn btn-outline" 
                      disabled={currentPage === totalPages} 
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* QR Confirmation Slip Modal */}
      {selectedApp && (
        <div className="modal-overlay" onClick={() => setSelectedApp(null)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="slip-container" style={{ margin: 0, padding: '1.5rem 1rem' }}>
              <div className="slip-header">
                <div className="slip-logo">FULafia Crest</div>
                <div className="slip-title">Official Appointment Slip</div>
              </div>

              <div className="qr-canvas-wrapper">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="Confirmation QR Code" style={{ width: '180px', height: '180px' }} />
                ) : (
                  <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Generating QR...</div>
                )}
              </div>

              <div className="slip-details">
                <div className="slip-item">
                  <span className="slip-item-label">Visitor</span>
                  <span className="slip-item-value">{selectedApp.visitor_name || 'Visitor'}</span>
                </div>
                <div className="slip-item">
                  <span className="slip-item-label">Office / Official</span>
                  <span className="slip-item-value">{selectedApp.official_name}</span>
                </div>
                <div className="slip-item">
                  <span className="slip-item-label">Date & Time</span>
                  <span className="slip-item-value">{selectedApp.requested_date} @ {selectedApp.requested_time}</span>
                </div>
                <div className="slip-item">
                  <span className="slip-item-label">Verification Token</span>
                  <span className="slip-item-value" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{selectedApp.qr_code_token}</span>
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', width: '100%' }}>
                Present this QR code to the Office Secretary or security details upon arrival at the Executive Chambers.
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setSelectedApp(null)}>
                Close Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyAppointments;
