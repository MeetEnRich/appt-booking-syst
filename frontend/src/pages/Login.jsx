import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { LogIn, Info } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemoCreds, setShowDemoCreds] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      // Role-aware routing
      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'secretary') {
        navigate('/secretary');
      } else {
        navigate('/book');
      }
    } catch (err) {
      setError(err.message || 'Failed to authenticate. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="auth-wrapper">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '480px' }}>
        <div className="auth-card">
          <div className="auth-header">
            <img 
              src="/logo.png" 
              alt="FULafia Logo" 
              style={{ width: '60px', height: '60px', objectFit: 'contain', margin: '0 auto 0.5rem auto', display: 'block' }} 
            />
            <h2>FULafia Appointment Portal</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.15rem' }}>
              Central Administrative Appointment Booking Platform
            </p>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
            <div className="form-group">
              <label className="form-label">Institutional Email</label>
              <input
                type="email"
                className="form-control"
                placeholder="e.g. name@fulafia.edu.ng"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.75rem' }}>
              <label className="form-label">Password</label>
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
              style={{ width: '100%', padding: '0.8rem' }}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : (
                <>
                  <LogIn size={18} /> Sign In
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            Don't have an account? <Link to="/register">Register as Visitor</Link>
          </div>
        </div>

        {/* Demo Credentials Panel for defense review */}
        {showDemoCreds && (
          <div className="card" style={{ padding: '0.75rem', margin: 0, borderRadius: 'var(--radius-md)', border: '1px dashed var(--secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.4rem' }}>
              <Info size={16} />
              <span>Project Review Demo Accounts (Password: password123)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', fontSize: '0.8rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '0.5rem', borderRadius: '4px' }}>
                <span><strong>Admin:</strong> admin@fulafia.edu.ng</span>
                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => fillCredentials('admin@fulafia.edu.ng', 'password123')}>Fill</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '0.5rem', borderRadius: '4px' }}>
                <span><strong>Secretary (VC):</strong> vc_sec@fulafia.edu.ng</span>
                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => fillCredentials('vc_sec@fulafia.edu.ng', 'password123')}>Fill</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '0.5rem', borderRadius: '4px' }}>
                <span><strong>Visitor (Student):</strong> student@fulafia.edu.ng</span>
                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => fillCredentials('student@fulafia.edu.ng', 'password123')}>Fill</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '0.5rem', borderRadius: '4px' }}>
                <span><strong>Visitor (Staff):</strong> staff@fulafia.edu.ng</span>
                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => fillCredentials('staff@fulafia.edu.ng', 'password123')}>Fill</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
