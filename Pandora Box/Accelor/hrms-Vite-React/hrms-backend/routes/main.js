// config/routes.js
import authRoutes from './auth.js';
import dashboardRoutes from '../routes/dashboard.js';
import employeeRoutes from './employees.js';
import departmentRoutes from './departments.js';
import attendanceRoutes from './attendance.js';
import leaveRoutes from '../routes/leaves.js';
import notificationRoutes from '../routes/notifications.js';
import odRoutes from './od.js';
import otRoutes from './ot.js';

const registerRoutes = (app) => {
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/leaves', leaveRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/od', odRoutes);
  app.use('/api/ot', otRoutes);
};

export default registerRoutes;
