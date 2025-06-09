import { Router } from 'express';
const router = Router();
import Employee from '../models/Employee.js';

// Import the extracted utilities and middleware
import { auth } from '../middleware/auth.js';
import { createLoginLimiter } from '../middleware/rate-limit.js';
import { generateToken } from '../utils/sauth/jwt_token.js';
import { validatePassword } from '../utils/sauth/password.js';

//WORKS :)
router.post('/login', createLoginLimiter(), async (req, res) => {
  try {

    const { email, password } = req.body.basicInfo || req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await Employee.findOne({ email }).populate('department');
    if (!user) {
      return res.status(400).json({ message: 'Invalid username' });
    }
    // Validate password using extracted utility
    const isMatch = await validatePassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }
    const payload = { 
      id: user._id,
      loginType: user.loginType,
      employeeId: user.employeeId
    };
    const token = generateToken(payload, '24h'); // Use 24h for token expiration
    // console.log('Generated token:', token); // Add this line
    // Return response with user data (excluding password)
    res.json({
      token,
      user: {
        id: user._id,
        loginType: user.loginType,
        name: user.name,
        email: user.email,
        employeeId: user.employeeId,
        department: user.department ? { name: user.department.name } : null, // Include department name

      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Individual Profile
//WORKS :) (SEMI :(
router.get('/me', auth,async (req, res) => {
  try {
    // Fetch user data using ID from authenticated token
    const user = await Employee.findById(req.user.id).select('-password').populate('department');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      loginType: user.loginType,
      name: user.name,
      email: user.email,
      employeeId: user.employeeId,
      department: user.department ? { name: user.department.name } : null, // Include department name
      // Include other relevant user fields
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});




export default router;

