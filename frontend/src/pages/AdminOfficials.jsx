import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Settings, User, Edit2, Plus, Calendar, Clock, AlertCircle, UserPlus, Users } from 'lucide-react';

const AdminOfficials = () => {
  const [activeTab, setActiveTab] = useState('officials'); // 'officials' or 'secretaries'
  
  const [officials, setOfficials] = useState([]);
  const [unassignedSecretaries, setUnassignedSecretaries] = useState([]); // dropdown
  const [allSecretaries, setAllSecretaries] = useState([]); // all secretaries list
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pagination States
  const [officialsPage, setOfficialsPage] = useState(1);
  const [secretariesPage, setSecretariesPage] = useState(1);
  const itemsPerPage = 5;

  // Official Profile Form State
  const [editId, setEditId] = useState(null); // If editing
  const [name, setName] = useState('');
  const [officeTitle, setOfficeTitle] = useState('');
  const [secUserId, setSecUserId] = useState('');
  const [availableDays, setAvailableDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('16:00');
  const [slotDuration, setSlotDuration] = useState(30);
  const [savingOfficial, setSavingOfficial] = useState(false);

  // Secretary Account Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creatingSec, setCreatingSec] = useState(false);

  const loadData = async () => {
    try {
      const offList = await api.admin.getOfficials();
      setOfficials(offList);
      
      const secs = await api.admin.getUnassignedSecretaries();
      setUnassignedSecretaries(secs);
      
      const allSecs = await api.admin.getAllSecretaries();
      setAllSecretaries(allSecs);
    } catch (err) {
      setError('Failed to load official profiles and secretary directories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleWeekdayChange = (day) => {
    if (availableDays.includes(day)) {
      setAvailableDays(prev => prev.filter(d => d !== day));
    } else {
      setAvailableDays(prev => [...prev, day]);
    }
  };

  const handleEdit = (off) => {
    setEditId(off.id);
    setName(off.name);
    setOfficeTitle(off.office_title);
    setSecUserId(off.secretary_user_id || '');
    setAvailableDays(off.available_days);
    setStartTime(off.available_start_time);
    setEndTime(off.available_end_time);
    setSlotDuration(off.slot_duration_minutes);
    
    // Proactively pull secretaries, and append this official's currently assigned secretary if they have one
    // so it shows up as an option in the select list
    async function loadWithCurrentSec() {
      try {
        const secs = await api.admin.getUnassignedSecretaries();
        if (off.secretary_user_id) {
          const currentSecObj = {
            id: off.secretary_user_id,
            full_name: off.secretary_name,
            email: off.secretary_email
          };
          if (!secs.find(s => s.id === off.secretary_user_id)) {
            secs.push(currentSecObj);
          }
        }
        setUnassignedSecretaries(secs);
      } catch (err) {
        console.error(err);
      }
    }
    loadWithCurrentSec();
  };

  const handleResetForm = () => {
    setEditId(null);
    setName('');
    setOfficeTitle('');
    setSecUserId('');
    setAvailableDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setStartTime('09:00');
    setEndTime('16:00');
    setSlotDuration(30);
    api.admin.getUnassignedSecretaries().then(setUnassignedSecretaries);
  };

  const handleSubmitOfficial = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name || !officeTitle || availableDays.length === 0 || !startTime || !endTime) {
      return setError('Please fill all required fields and select at least one working day.');
    }

    setSavingOfficial(true);
    const payload = {
      name,
      office_title: officeTitle,
      secretary_user_id: secUserId ? parseInt(secUserId) : null,
      available_days: availableDays,
      available_start_time: startTime,
      available_end_time: endTime,
      slot_duration_minutes: parseInt(slotDuration)
    };

    try {
      if (editId) {
        await api.admin.updateOfficial(editId, payload);
        setSuccess('Official profile updated successfully.');
      } else {
        await api.admin.createOfficial(payload);
        setSuccess('New official profile generated successfully.');
      }
      handleResetForm();
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to save official profile details.');
    } finally {
      setSavingOfficial(false);
    }
  };

  const handleCreateSecretary = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName || !email || !password) {
      return setError('All secretary fields are required.');
    }

    setCreatingSec(true);

    try {
      await api.admin.createSecretary({ full_name: fullName, email, password });
      setSuccess('Secretary account registered successfully!');
      setFullName('');
      setEmail('');
      setPassword('');
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to register secretary account.');
    } finally {
      setCreatingSec(false);
    }
  };

  const weekdaysList = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Pagination Calculations
  const indexOfLastOff = officialsPage * itemsPerPage;
  const indexOfFirstOff = indexOfLastOff - itemsPerPage;
  const currentOfficials = officials.slice(indexOfFirstOff, indexOfLastOff);
  const totalOfficialsPages = Math.ceil(officials.length / itemsPerPage);

  const indexOfLastSec = secretariesPage * itemsPerPage;
  const indexOfFirstSec = indexOfLastSec - itemsPerPage;
  const currentSecretaries = allSecretaries.slice(indexOfFirstSec, indexOfLastSec);
  const totalSecretariesPages = Math.ceil(allSecretaries.length / itemsPerPage);

  return (
    <div className="main-content">
      <div style={{ marginBottom: '1.5rem' }}>
        <h2>Manage Official Registries</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Create profiles for university principal officers and register delegated secretary accounts.
        </p>
      </div>

      {/* Main Action Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          className={`btn ${activeTab === 'officials' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => {
            setError('');
            setSuccess('');
            setActiveTab('officials');
          }}
          style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}
        >
          Official Profiles ({officials.length})
        </button>
        <button
          className={`btn ${activeTab === 'secretaries' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => {
            setError('');
            setSuccess('');
            setActiveTab('secretaries');
          }}
          style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}
        >
          Delegated Secretaries ({allSecretaries.length})
        </button>
      </div>

      {error && <div className="alert alert-danger"><AlertCircle size={18} /> {error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading registries directories...</div>
      ) : activeTab === 'officials' ? (
        /* OFFICIALS MANAGER TAB */
        <div className="dashboard-grid">
          {/* Left Side: Officials list */}
          <div>
            {officials.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No official profiles recorded.</div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Official Details</th>
                        <th>Delegated Secretary</th>
                        <th>Working Schedule</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentOfficials.map(off => (
                        <tr key={off.id}>
                          <td>
                            <span style={{ display: 'block', fontWeight: 600 }}>{off.name}</span>
                            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              {off.office_title}
                            </span>
                          </td>
                          <td>
                            {off.secretary_name ? (
                              <div>
                                <span style={{ display: 'block', fontWeight: 500 }}>{off.secretary_name}</span>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{off.secretary_email}</span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--status-rejected)', fontSize: '0.85rem', fontWeight: 500 }}>
                                No Secretary Assigned
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary)', fontWeight: 500 }}>
                              <Clock size={12} />
                              <span>{off.available_start_time} - {off.available_end_time}</span>
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                              Days: {off.available_days.join(', ')} ({off.slot_duration_minutes}m slots)
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="btn btn-outline"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                              onClick={() => handleEdit(off)}
                            >
                              <Edit2 size={12} /> Edit Profile
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalOfficialsPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                    <button 
                      className="btn btn-outline" 
                      disabled={officialsPage === 1} 
                      onClick={() => setOfficialsPage(prev => Math.max(prev - 1, 1))}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Previous
                    </button>
                    <span style={{ color: 'var(--text-muted)' }}>Page {officialsPage} of {totalOfficialsPages}</span>
                    <button 
                      className="btn btn-outline" 
                      disabled={officialsPage === totalOfficialsPages} 
                      onClick={() => setOfficialsPage(prev => Math.min(prev + 1, totalOfficialsPages))}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Side: Create/Edit Official Form */}
          <div>
            <div className="card" style={{ borderTop: `5px solid ${editId ? 'var(--status-rescheduled)' : 'var(--secondary)'}`, margin: 0 }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={18} style={{ color: 'var(--primary)' }} />
                {editId ? 'Edit Official Profile' : 'Register Official Profile'}
              </h3>

              <form onSubmit={handleSubmitOfficial}>
                <div className="form-group">
                  <label className="form-label">Official Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Prof. Shehu Abdul Rahman"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Office Title</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Vice Chancellor"
                    value={officeTitle}
                    onChange={(e) => setOfficeTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Assign Secretary</label>
                  <select
                    className="form-control"
                    value={secUserId}
                    onChange={(e) => setSecUserId(e.target.value)}
                  >
                    <option value="">-- Select Delegated Secretary (Optional) --</option>
                    {unassignedSecretaries.map(sec => (
                      <option key={sec.id} value={sec.id}>
                        {sec.full_name} ({sec.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Start Time</label>
                    <input
                      type="time"
                      className="form-control"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">End Time</label>
                    <input
                      type="time"
                      className="form-control"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Slot Duration</label>
                    <select
                      className="form-control"
                      value={slotDuration}
                      onChange={(e) => setSlotDuration(e.target.value)}
                    >
                      <option value={15}>15m</option>
                      <option value={20}>20m</option>
                      <option value={30}>30m</option>
                      <option value={45}>45m</option>
                      <option value={60}>60m</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Available Weekdays</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
                    {weekdaysList.map(day => {
                      const isChecked = availableDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleWeekdayChange(day)}
                          className={`btn ${isChecked ? 'btn-primary' : 'btn-outline'}`}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.35rem 0.6rem',
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

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={savingOfficial}
                  >
                    {savingOfficial ? 'Saving...' : (editId ? 'Update Profile' : 'Register Official')}
                  </button>
                  
                  {editId && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={handleResetForm}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* SECRETARIES MANAGER TAB */
        <div className="dashboard-grid">
          {/* Left Side: Registered Secretaries List */}
          <div>

            {allSecretaries.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No secretaries registered.</div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Secretary Name</th>
                        <th>Email Address</th>
                        <th>Credentials Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSecretaries.map(sec => (
                        <tr key={sec.id}>
                          <td style={{ fontWeight: 600 }}>{sec.full_name}</td>
                          <td style={{ color: 'var(--primary)', fontWeight: 500 }}>{sec.email}</td>
                          <td>
                            <span className="user-badge" style={{ fontSize: '0.7rem' }}>Secretary User</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalSecretariesPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                    <button 
                      className="btn btn-outline" 
                      disabled={secretariesPage === 1} 
                      onClick={() => setSecretariesPage(prev => Math.max(prev - 1, 1))}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Previous
                    </button>
                    <span style={{ color: 'var(--text-muted)' }}>Page {secretariesPage} of {totalSecretariesPages}</span>
                    <button 
                      className="btn btn-outline" 
                      disabled={secretariesPage === totalSecretariesPages} 
                      onClick={() => setSecretariesPage(prev => Math.min(prev + 1, totalSecretariesPages))}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Side: Create Secretary Form */}
          <div>
            <div className="card" style={{ borderTop: '5px solid var(--secondary)', margin: 0 }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={18} style={{ color: 'var(--primary)' }} />
                Register Secretary Account
              </h3>

              <form onSubmit={handleCreateSecretary}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Grace John"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="e.g. grace_sec@fulafia.edu.ng"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Default Password</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={creatingSec}
                >
                  {creatingSec ? 'Registering Account...' : 'Create Secretary User'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOfficials;
