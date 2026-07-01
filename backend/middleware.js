const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fulafia_secret_key_12345';

function authenticateToken(req, res, next) {
  // Support reading token from Authorization header or cookies
  let token = null;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers.cookie) {
    // Basic parser for cookies
    const cookieToken = req.headers.cookie
      .split('; ')
      .find(row => row.startsWith('token='));
    if (cookieToken) {
      token = cookieToken.split('=')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No session token provided.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired session token.' });
  }
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized access for this user role.' });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET
};
