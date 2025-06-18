import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import ContentLayout from './ContentLayout';
import Pagination from './Pagination';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../components/ui/select";
import { Label } from "../components/ui/label";

function Attendance() {
  const { user } = useContext(AuthContext);
  const [attendance, setAttendance] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    employeeId: '',
    departmentId: '',
    fromDate: new Date().toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
    status: 'all',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (user?.loginType === 'HOD' && user?.department) {
      setDepartments([{ _id: user.department._id, name: user.department.name }]);
      setFilters((prev) => ({ ...prev, departmentId: user.department._id }));
    } else {
      fetchDepartments();
    }
    fetchAttendance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      console.error('Error fetching departments:', err);
      setError('Failed to load departments');
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await api.get('/attendance', { params: filters });
      setAttendance(res.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setError('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (name, value) => {
    setFilters({ ...filters, [name]: value });
  };

  const handleFilter = () => {
    const updatedFilters = { ...filters };
    if (filters.fromDate && !filters.toDate) {
      updatedFilters.toDate = filters.fromDate;
    }
    setFilters(updatedFilters);
    fetchAttendance();
    setCurrentPage(1);
  };

  const handleDownload = async (status) => {
    try {
      const params = { ...filters, status };
      const res = await api.get('/attendance/download', {
        params,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_${status}_${filters.fromDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error downloading Excel:', err);
      setError('Failed to download attendance report');
    }
  };

  const paginatedAttendance = attendance.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatTime = (minutes) => {
    if (!minutes) return '00:00';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const hodDepartmentName = user?.loginType === 'HOD' && user?.department
    ? departments.find(dep => dep._id === user.department._id)?.name || 'Unknown'
    : '';

  return (
    <ContentLayout title="Attendance List">
      <div className="w-full max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <input
            type="text"
            name="employeeId"
            value={filters.employeeId}
            onChange={(e) => handleChange('employeeId', e.target.value)}
            placeholder="Employee ID"
            className="max-w-sm border border-border px-4 py-2 rounded-md bg-background text-foreground"
          />
          {user?.loginType === 'HOD' ? (
            <input
              type="text"
              value={hodDepartmentName}
              readOnly
              className="max-w-sm border border-border px-4 py-2 rounded-md bg-gray-100 text-foreground cursor-not-allowed"
              placeholder="Your Department"
            />
          ) : (
            <select
              name="departmentId"
              value={filters.departmentId}
              onChange={(e) => handleChange('departmentId', e.target.value)}
              className="max-w-sm border border-border px-4 py-2 rounded-md bg-background text-foreground"
            >
              <option value="">All Departments</option>
              {departments.map(dep => (
                <option key={dep._id} value={dep._id}>{dep.name}</option>
              ))}
            </select>
          )}
          <input
            type="date"
            name="fromDate"
            value={filters.fromDate}
            onChange={(e) => handleChange('fromDate', e.target.value)}
            className="max-w-sm border border-border px-4 py-2 rounded-md bg-background text-foreground"
          />
          <input
            type="date"
            name="toDate"
            value={filters.toDate}
            onChange={(e) => handleChange('toDate', e.target.value)}
            className="max-w-sm border border-border px-4 py-2 rounded-md bg-background text-foreground"
          />
          <div className="flex gap-2">
            <button onClick={handleFilter} className="px-4 py-2 border border-border rounded-md bg-background">
              Filter
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : paginatedAttendance.length === 0 ? (
          <div className="text-center py-8 rounded-lg bg-background">
            <p className="text-lg font-semibold">No attendance records found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-border">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 border">Employee ID</th>
                    <th className="px-4 py-2 border">User ID</th>
                    <th className="px-4 py-2 border">Name</th>
                    <th className="px-4 py-2 border">Date</th>
                    <th className="px-4 py-2 border">Time IN</th>
                    <th className="px-4 py-2 border">Time OUT</th>
                    <th className="px-4 py-2 border">Status</th>
                    <th className="px-4 py-2 border">OT</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAttendance.map(a => (
                    <tr key={`${a.employeeId}-${a.logDate}`} className="hover:bg-muted/50 transition">
                      <td className="px-4 py-2 border">{a.employeeId}</td>
                      <td className="px-4 py-2 border">{a.userId}</td>
                      <td className="px-4 py-2 border">{a.name}</td>
                      <td className="px-4 py-2 border">{new Date(a.logDate).toLocaleDateString()}</td>
                      <td className="px-4 py-2 border">{a.timeIn || '-'}</td>
                      <td className="px-4 py-2 border">{a.timeOut || '-'}</td>
                      <td className="px-4 py-2 border">{a.status}{a.halfDay ? ` (${a.halfDay})` : ''}</td>
                      <td className="px-4 py-2 border">{formatTime(a.ot)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => handleDownload('Present')}
                className="px-4 py-2 border border-border rounded-md bg-green-600 text-white"
              >
                Download Present
              </button>
              <button
                onClick={() => handleDownload('Absent')}
                className="px-4 py-2 border border-border rounded-md bg-red-600 text-white"
              >
                Download Absent
              </button>
            </div>

            <Pagination
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              totalItems={attendance.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setItemsPerPage(size);
                setCurrentPage(1);
              }}
            />
          </>
        )}
      </div>
    </ContentLayout>
  );
}

export default Attendance;
