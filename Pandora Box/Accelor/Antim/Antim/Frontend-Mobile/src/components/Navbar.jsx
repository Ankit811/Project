import React, { useEffect, useRef, useContext } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import Notification from './Notification';
import { AuthContext } from '../context/AuthContext';
import logo from '../assets/logo.png';
import io from 'socket.io-client';
import { Menu as MenuIcon } from 'lucide-react';

function Navbar() {
  const { user, logout, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const socketRef = useRef(null);

  // Define menu items with OD links added
  const menuItems = {
    Admin: [
      { text: 'Dashboard', path: '/admin/dashboard' },
      { text: 'My Dashboard', path: '/admin/employee-dashboard' },
      { text: 'Employees', path: '/admin/employees' },
      { text: 'Add Employee', path: '/admin/add-employee' },
      { text: 'Attendance', path: '/admin/attendance' },
      { text: 'Apply Leave', path: '/admin/leave' },
      { text: 'Approve Leave', path: '/admin/approve-leave' },
      { text: 'Apply OD', path: '/admin/od' }, // Added OD Form
      { text: 'Approve OD', path: '/admin/approve-od' }, // Added OD List
      { text: 'Approve OT', path: '/admin/approve-ot' },
    ],
    CEO: [
      { text: 'Dashboard', path: '/ceo/dashboard' },
      { text: 'Employees', path: '/ceo/employees' },
      { text: 'Approve Leaves', path: '/ceo/approve-leaves' },
      { text: 'Approve OD', path: '/ceo/approve-od' }, // Added OD List
      { text: 'Approve OT', path: '/ceo/approve-ot' },
    ],
    HOD: [
      { text: 'Dashboard', path: '/hod/dashboard' },
      { text: 'My Dashboard', path: '/hod/employee-dashboard' },
      { text: 'Employees', path: '/hod/employees' },
      { text: 'Attendance', path: '/hod/attendance' },
      { text: 'Apply Leave', path: '/hod/leave' },
      { text: 'Approve Leave', path: '/hod/approve-leave' },
      { text: 'Apply OD', path: '/hod/od' }, // Added OD Form
      { text: 'Approve OD', path: '/hod/approve-od' }, // Added OD List
      ...(user?.department?.name && ['Production', 'Testing', 'AMETL', 'Admin'].includes(user.department.name)
        ? [{ text: 'Approve OT', path: '/hod/approve-ot' }]
        : []),
    ],
    Employee: [
      { text: 'My Dashboard', path: '/employee/employee-dashboard' },
      { text: 'Apply Leave', path: '/employee/leave' },
      { text: 'Apply OD', path: '/employee/od' }, // Added OD Form
      { text: 'OD List', path: '/employee/od-list' }, // Added OD List
    ],
  };

  const handleLogoClick = () => {
    if (!user) return;
    const defaultPaths = {
      Admin: '/admin/dashboard',
      CEO: '/ceo/dashboard',
      HOD: '/hod/dashboard',
      Employee: '/employee/employee-dashboard',
    };
    navigate(defaultPaths[user?.loginType] || '/');
  };

  const handleNavigation = (item) => {
    if (item.path) {
      navigate(item.path);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io('http://localhost:5000', { withCredentials: true });
    }

    const socket = socketRef.current;

    if (user?.employeeId) {
      socket.emit('join', user.employeeId);
    }

    socket.on('notification', (data) => {
      alert('🔔 New Notification: ' + data.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || 'G';

  if (loading) {
    return (
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 120 }}
        className="fixed top-0 left-0 right-0 h-16 bg-gradient-to-r from-background to-muted shadow-lg z-50 rounded-md"
      >
        <div className="flex items-center justify-between h-full px-4 md:px-6">
          <motion.img
            src={logo}
            alt="Company Logo"
            className="h-12 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            onClick={handleLogoClick}
          />
          <div className="flex items-center space-x-4">
            <span className="text-foreground font-medium">Loading...</span>
          </div>
        </div>
      </motion.header>
    );
  }

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 120 }}
      className="fixed top-0 left-0 right-0 h-16 bg-gradient-to-r from-background to-muted shadow-lg z-50 rounded-md"
    >
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        <div className="flex items-center space-x-4">
          <motion.img
            src={logo}
            alt="Company Logo"
            className="h-12 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            onClick={handleLogoClick}
          />

          {user && (
            <nav className="hidden md:flex items-center space-x-2">
              {menuItems[user.loginType]?.map((item, index) => (
                <motion.div
                  key={index}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors duration-200 ${
                    location.pathname === item.path
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  onClick={() => handleNavigation(item)}
                >
                  {item.text}
                </motion.div>
              ))}
            </nav>
          )}

          {user && (
            <div className="md:hidden">
              <Menu as="div" className="relative inline-block text-left">
                <Menu.Button
                  as={motion.div}
                  whileHover={{ scale: 1.1 }}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <MenuIcon className="h-6 w-6" />
                </Menu.Button>
                <Transition
                  as={React.Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute left-0 mt-2 w-56 origin-top-left bg-popover rounded-lg shadow-xl p-2 z-50">
                    {menuItems[user.loginType]?.map((item, index) => (
                      <Menu.Item key={index}>
                        {({ active }) => (
                          <div
                            className={`px-4 py-2 text-sm cursor-pointer transition-colors duration-200 ${
                              location.pathname === item.path
                                ? 'bg-muted font-semibold text-foreground'
                                : active
                                ? 'bg-muted text-foreground'
                                : 'text-foreground'
                            }`}
                            onClick={() => handleNavigation(item)}
                          >
                            {item.text}
                          </div>
                        )}
                      </Menu.Item>
                    ))}
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <Notification />

          {user ? (
            <Menu as="div" className="relative inline-block text-left">
              <Menu.Button
                as={motion.div}
                whileHover={{ scale: 1.1 }}
                className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg cursor-pointer shadow-md"
              >
                {userInitial}
              </Menu.Button>
              <Transition
                as={React.Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right bg-popover rounded-lg shadow-xl p-2 z-50 border">
                  <div className="px-4 py-2 border-b border-border">
                    <p className="text-sm font-medium text-foreground">{user.name || 'Guest'}</p>
                    <p className="text-xs text-muted-foreground">{user.email || 'No email'}</p>
                  </div>
                  <Menu.Item>
                    {({ active }) => (
                      <div
                        className={`px-4 py-2 text-sm text-foreground cursor-pointer transition-colors duration-200 ${
                          active ? 'bg-gray-200' : ''
                        }`}
                        onClick={() => navigate(`/${user?.loginType.toLowerCase()}/profile`)}
                      >
                        Profile
                      </div>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <div
                        className={`px-4 py-2 text-sm text-foreground cursor-pointer transition-colors duration-200 ${
                          active ? 'bg-gray-200' : ''
                        }`}
                        onClick={handleLogout}
                      >
                        Logout
                      </div>
                    )}
                  </Menu.Item>
                </Menu.Items>
              </Transition>
            </Menu>
          ) : (
            <span className="text-foreground font-medium">Guest</span>
          )}
        </div>
      </div>
    </motion.header>
  );
}

export default Navbar;
