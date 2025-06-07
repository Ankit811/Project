// config/routes.js
import authRoutes from './auth.js';
import dashboardRoutes from '../routes/dashboard.js';
import employeeRoutes from './employee.js';
import departmentRoutes from './departments.js';
import attendanceRoutes from './attendance.js';
import leaveRoutes from '../routes/leaves.js';
import notificationRoutes from '../routes/notifications.js';
import odRoutes from './OD.js';
import otRoutes from './OT.js';

const registerRoutes = (app) => {
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/employee', employeeRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/leaves', leaveRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/od', odRoutes);
  app.use('/api/ot', otRoutes);
};

export default registerRoutes;
