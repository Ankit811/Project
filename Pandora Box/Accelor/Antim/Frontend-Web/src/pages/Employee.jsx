import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Profile from '../components/Profile';
import LeaveForm from '../components/LeaveForm';
import ODForm from '../components/ODForm';
import ODList from '../components/ODList';
import MyDashboard from '../components/EmployeeDashboard';

function Employee() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-1 pt-16">
        <Routes>
          <Route path="profile" element={<Profile />} />
          <Route path="employee-dashboard" element={<MyDashboard />} />
          <Route path="leave" element={<LeaveForm />} />
          <Route path="od" element={<ODForm />} />
          <Route path="od-list" element={<ODList />} />
        </Routes>
      </div>
    </div>
  );
}

export default Employee;