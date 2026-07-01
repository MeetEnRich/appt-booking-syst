import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Calendar, Clock, User, MessageSquare, ChevronRight, AlertCircle } from 'lucide-react';

const VisitorBook = () => {
  const navigate = useNavigate();
  const [officials, setOfficials] = useState([]);
  const [selectedOfficial, setSelectedOfficial] = useState(null);
  const [isSuspended, setIsSuspended] = useState(false);
  
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [purpose, setPurpose] = useState('');
  
  const [loadingOfficials, setLoadingOfficials] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [availabilityMsg, setAvailabilityMsg] = useState('');

  // Fetch officials and check visitor no-shows on mount
  useEffect(() => {
    async function loadOfficials() {
      try {
        const [officialsList, mineList] = await Promise.all([
          api.officials.list(),
          api.appointments.getMine()
        ]);
        setOfficials(officialsList);

        // Compute no-shows: approved appointments where requested_date is in the past
        const today = new Date().toISOString().split('T')[0];
        const noShowCount = mineList.filter(
          a => a.status === 'approved' && a.requested_date < today
        ).length;

        if (noShowCount > 2) {
          setIsSuspended(true);
        }
      } catch (err) {
        setError('Failed to load portal configuration: ' + err.message);
      } finally {
        setLoadingOfficials(false);
      }
    }
    loadOfficials();
  }, []);

  // Fetch available slots when official or date changes
  useEffect(() => {
    if (isSuspended || !selectedOfficial || !date) {
      setSlots([]);
      setSelectedSlot('');
      return;
    }

    async function loadSlots() {
      setLoadingSlots(true);
      setError('');
      setSelectedSlot('');
      setAvailabilityMsg('');
      try {
        const res = await api.officials.getAvailability(selectedOfficial.id, date);
        if (res.available) {
          setSlots(res.slots);
        } else {
          setSlots([]);
          setAvailabilityMsg(res.reason || 'Official is not available on this date.');
        }
      } catch (err) {
        setError('Failed to fetch slot availability.');
      } finally {
        setLoadingSlots(false);
      }
    }

    loadSlots();
  }, [selectedOfficial, date, isSuspended]);

  const handleSelectOfficial = (off) => {
    if (isSuspended) return;
    setSelectedOfficial(off);
    setDate('');
    setSlots([]);
    setSelectedSlot('');
  };

  const handleBook = async (e) => {
    e.preventDefault();
    if (isSuspended) return;
    if (!selectedOfficial || !date || !selectedSlot || !purpose) {
      return setError('Please complete all form fields.');
    }

    setBooking(true);
    setError('');

    try {
      await api.appointments.create(selectedOfficial.id, date, selectedSlot, purpose);
      navigate('/my-appointments');
    } catch (err) {
      setError(err.message || 'Failed to submit appointment request.');
    } finally {
      setBooking(false);
    }
  };

  // Helper date limits
  const todayStr = new Date().toISOString().split('T')[0];
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 14);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  return (
    <div className="main-content">
      <div style={{ marginBottom: '2rem' }}>
        <h2>Book a Principal Office Visit</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Check real-time availability and submit a booking request. Your visit will be routed to the delegated Secretary for review.
        </p>
      </div>

      {error && <div className="alert alert-danger"><AlertCircle size={18} /> {error}</div>}

      {isSuspended && (
        <div className="alert alert-danger" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', padding: '1.25rem', marginBottom: '1.5rem', background: 'var(--status-rejected-bg)', color: 'var(--status-rejected)', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '1rem' }}>
            <AlertCircle size={20} />
            Booking privileges suspended
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4' }}>
            Your account is temporarily locked because you have missed 3 or more approved appointments (no-shows). Please contact the administrative office to resolve your appointment audit logs.
          </p>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Left Side: Steps Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Step 1: Select Official */}
          <div className="card" style={{ margin: 0 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '1.2rem' }}>
              <span style={{ background: 'var(--primary)', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyCentert: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>1</span>
              Select Principal Officer
            </h3>

            {loadingOfficials ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading officials...</div>
            ) : (
              <div className="official-selector-grid">
                {officials.map(off => (
                  <div
                    key={off.id}
                    className={`official-card ${selectedOfficial?.id === off.id ? 'selected' : ''} ${isSuspended ? 'disabled' : ''}`}
                    style={isSuspended ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
                    onClick={() => handleSelectOfficial(off)}
                  >
                    <div className="official-title-text">{off.name}</div>
                    <div className="official-dept-text">{off.office_title}</div>
                    <div className="official-meta">
                      <div className="official-meta-item">
                        <Calendar size={14} />
                        <span>Days: {off.available_days.join(', ')}</span>
                      </div>
                      <div className="official-meta-item">
                        <Clock size={14} />
                        <span>Hours: {off.available_start_time} - {off.available_end_time}</span>
                      </div>
                      <div className="official-meta-item">
                        <Clock size={14} />
                        <span>Duration: {off.slot_duration_minutes} minutes per slot</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Date & Slot Pickers */}
          {!isSuspended && selectedOfficial && (
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '1.2rem' }}>
                <span style={{ background: 'var(--primary)', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>2</span>
                Choose Date & Slot
              </h3>

              <div className="form-group">
                <label className="form-label">Select Date (Next 2 weeks)</label>
                <input
                  type="date"
                  className="form-control"
                  min={todayStr}
                  max={maxDateStr}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {date && (
                <div className="slot-picker-container">
                  <h4 style={{ fontSize: '1rem', color: 'var(--text-dark)' }}>Time Slot Availability</h4>
                  {loadingSlots ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>Calculating real-time availability...</div>
                  ) : availabilityMsg ? (
                    <div className="alert alert-danger" style={{ marginTop: '1rem' }}>{availabilityMsg}</div>
                  ) : slots.length === 0 ? (
                    <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>No slots found for this date.</p>
                  ) : (
                    <div className="slot-grid">
                      {slots.map(slot => (
                        <button
                          key={slot.time}
                          type="button"
                          className={`slot-button ${slot.available ? 'available' : 'booked'} ${selectedSlot === slot.time ? 'selected' : ''}`}
                          onClick={() => slot.available && setSelectedSlot(slot.time)}
                          disabled={!slot.available}
                          title={slot.reason}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Booking Form Details */}
          {!isSuspended && selectedOfficial && date && selectedSlot && (
            <div className="card" style={{ margin: 0 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '1.2rem' }}>
                <span style={{ background: 'var(--primary)', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>3</span>
                Provide Purpose & Submit
              </h3>

              <form onSubmit={handleBook}>
                <div className="form-group">
                  <label className="form-label">Purpose of Visit</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="Briefly state your reason for requesting this audience..."
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.8rem', marginTop: '0.5rem' }}
                  disabled={booking}
                >
                  {booking ? 'Submitting Request...' : 'Confirm & Request Appointment'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Side: Quick Booking Summary */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card" style={{ borderTop: '5px solid var(--secondary)', position: 'sticky', top: '90px' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem' }}>Request Details</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <User size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Principal Officer</span>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {selectedOfficial ? selectedOfficial.name : <em style={{ color: 'var(--text-muted)' }}>None selected</em>}
                  </span>
                  {selectedOfficial && (
                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {selectedOfficial.office_title}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Calendar size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Scheduled Date</span>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {date ? new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : <em style={{ color: 'var(--text-muted)' }}>None selected</em>}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Clock size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Selected Time Slot</span>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {selectedSlot ? `${selectedSlot} hrs` : <em style={{ color: 'var(--text-muted)' }}>None selected</em>}
                  </span>
                </div>
              </div>

              {purpose && (
                <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <MessageSquare size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Stated Purpose</span>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)', marginTop: '0.15rem', fontStyle: 'italic' }}>
                      "{purpose}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitorBook;
