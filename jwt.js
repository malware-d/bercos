const jwt = require('jsonwebtoken');
const { users } = require('./db');

const JWT_SECRET = 'd1f8a9b3c5e7f2a4d6c8b0e5f3a7d2c1b5e8f3a6d9c2b7e4f1a8d3c6b9e5f2a1';

// Generate JWT Token
const generateToken = (user) => {
  const payload = {
    customer_id: user.customer_id,
    email: user.email,
    role: user.role,
    branch_code: user.branch_code,
    department: user.department,
    approval_level: user.approval_level,
    status: user.status,
    email_verified: user.email_verified,
    sms_verified: user.sms_verified,
    daily_limit: user.daily_limit,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };

  return jwt.sign(payload, JWT_SECRET);
};

// Verify JWT Token Middleware
const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        code: 401,
        message: 'Access token is required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if token is expired
    if (decoded.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({
        code: 401,
        message: 'Token has expired'
      });
    }

    // Verify user still exists and is active
    const user = users.find(u => u.customer_id === decoded.customer_id);
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        code: 401,
        message: 'Invalid or inactive user'
      });
    }

    // Add user info to request
    req.user = {
      ...decoded,
      ...user
    };

    next();
  } catch (error) {
    return res.status(401).json({
      code: 401,
      message: 'Invalid token',
      error: error.message
    });
  }
};

// Login endpoint
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        code: 400,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = users.find(u => u.email === email);
    
    if (!user || user.password !== password) {
      return res.status(401).json({
        code: 401,
        message: 'Invalid credentials'
      });
    }

    if (user.status !== 'active') {
      return res.status(401).json({
        code: 401,
        message: 'Account is not active'
      });
    }

    // Generate token
    const token = generateToken(user);

    // Return token and user info (excluding password)
    const { password: _, ...userInfo } = user;
    
    res.json({
      code: 200,
      message: 'Login successful',
      data: {
        token,
        user: userInfo
      }
    });

  } catch (error) {
    res.status(500).json({
      code: 500,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  generateToken,
  verifyToken,
  login,
  JWT_SECRET
};