import React, { useEffect, useState, useContext, useCallback } from 'react';
import {
  Card,
  CardContent,
} from "../components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import Pagination from "./Pagination";
import api from '../services/api';
import ContentLayout from './ContentLayout';
import { AuthContext } from '../context/AuthContext';

function LeaveList() {
  const { user } = useContext(AuthContext);
  const [leaves, setLeaves] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [filters, setFilters] = useState({
    leaveType: 'all',
    status: 'all',
    fromDate: '',
    toDate: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);

  const fetchLeaves = useCallback(async (currentPage = page, currentLimit = limit) => {
    try {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams({
        leaveType: filters.leaveType,
        status: filters.status,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        page: currentPage,
        limit: currentLimit,
      }).toString();
      const res = await api.get(`/leaves?${query}`);
      setLeaves(res.data.leaves);
      setFiltered(res.data.leaves);
      setTotal(res.data.total);
      setPage(res.data.page);
    } catch (err) {
      console.error('Error fetching leave list:', err);
      setError(err.response?.data?.message || 'Failed to fetch leaves. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const handleFilterChange = (name, value) => {
    let newFilters = { ...filters, [name]: value };

    if (name === 'fromDate' || name === 'toDate') {
      const fromDate = name === 'fromDate' ? value : filters.fromDate;
      const toDate = name === 'toDate' ? value : filters.toDate;
      if (fromDate && toDate && new Date(toDate) < new Date(fromDate)) {
        setError('To Date cannot be earlier than From Date.');
        return;
      }
    }

    setFilters(newFilters);
    setPage(1);
    const query = new URLSearchParams({
      leaveType: newFilters.leaveType,
      status: newFilters.status,
      fromDate: newFilters.fromDate,
      toDate: newFilters.toDate,
      page: 1,
      limit,
    }).toString();
    setLoading(true);
    api.get(`/leaves?${query}`)
      .then(res => {
        setLeaves(res.data.leaves);
        setFiltered(res.data.leaves);
        setTotal(res.data.total);
        setPage(res.data.page);
        setError(null);
      })
      .catch(err => {
        console.error('Error applying filters:', err);
        setError(err.response?.data?.message || 'Failed to apply filters.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleApproval = async (id, status, currentStage) => {
    try {
      const leaveData = { status };
      await api.put(`/leaves/${id}/approve`, leaveData);
      const updatedLeaves = leaves.map(l => {
        if (l._id === id) {
          const newStatus = { ...l.status, [currentStage]: status };
          // Update the next stage based on the current stage and status
          if (status === 'Approved') {
            if (currentStage === 'hod') {
              newStatus.ceo = 'Pending';
            } else if (currentStage === 'ceo') {
              newStatus.admin = 'Pending';
            }
          }
          return { ...l, status: newStatus };
        }
        return l;
      });
      setLeaves(updatedLeaves);
      setFiltered(updatedLeaves);
      alert(`Leave ${status.toLowerCase()} successfully.`);
    } catch (err) {
      console.error('Approval error:', err);
      alert(`Error processing leave approval: ${err.response?.data?.message || err.message}`);
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchLeaves(newPage, limit);
  };

  const handlePageSizeChange = (newSize) => {
    setLimit(newSize);
    setPage(1);
    fetchLeaves(1, newSize);
  };

  // Debug user loginType and leave status
  console.log('User loginType:', user?.loginType);
  console.log('Leaves:', leaves);

  return (
    <ContentLayout title="Leave List">
      <Card className="max-w-5xl mx-auto shadow-lg border">
        <CardContent className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
          <div className="flex justify-between mb-4">
            <h2 className="text-lg font-semibold">Leave Records</h2>
            <Button
              onClick={() => fetchLeaves(1)}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="leaveType" className="text-sm font-medium text">
                Leave Type
              </Label>
              <Select
                onValueChange={(value) => handleFilterChange('leaveType', value)}
                value={filters.leaveType}
                aria-label="Select leave type filter"
                disabled={loading}
              >
                <SelectTrigger id="leaveType" className="mt-1 border-gray-300 focus:ring-blue-500 focus:border-blue-500">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Casual">Casual</SelectItem>
                  <SelectItem value="Medical">Medical</SelectItem>
                  <SelectItem value="Maternity">Maternity</SelectItem>
                  <SelectItem value="Paternity">Paternity</SelectItem>
                  <SelectItem value="Compensatory">Compensatory</SelectItem>
                  <SelectItem value="Restricted Holidays">Restricted Holidays</SelectItem>
                  <SelectItem value="Leave Without Pay(LWP)">Leave Without Pay(LWP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="status" className="text-sm font-medium text">
                Approval Status (Any Stage)
              </Label>
              <Select
                onValueChange={(value) => handleFilterChange('status', value)}
                value={filters.status}
                aria-label="Select approval status filter"
                disabled={loading}
              >
                <SelectTrigger id="status" className="mt-1 border-gray-300 focus:ring-blue-500 focus:border-blue-500">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="fromDate" className="text-sm font-medium text-gray-700">
                From Date
              </Label>
              <Input
                id="fromDate"
                name="fromDate"
                type="date"
                value={filters.fromDate}
                onChange={(e) => handleFilterChange('fromDate', e.target.value)}
                className="mt-1 border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                aria-label="From Date"
                disabled={loading}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="toDate" className="text-sm font-medium text-gray-700">
                To Date
              </Label>
              <Input
                id="toDate"
                name="toDate"
                type="date"
                value={filters.toDate}
                onChange={(e) => handleFilterChange('toDate', e.target.value)}
                className="mt-1 border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                aria-label="To Date"
                disabled={loading}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="font-semibold text">Employee</TableHead>
                  <TableHead className="font-semibold text">Type</TableHead>
                  <TableHead className="font-semibold text">From</TableHead>
                  <TableHead className="font-semibold text">To</TableHead>
                  <TableHead className="font-semibold text">View</TableHead>
                  <TableHead className="font-semibold text">Status (HOD)</TableHead>
                  <TableHead className="font-semibold text">Status (CEO)</TableHead>
                  <TableHead className="font-semibold text">Status (Admin)</TableHead>
                  {['HOD', 'Admin', 'CEO'].includes(user?.loginType) && (
                    <TableHead className="font-semibold text">Action</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={['HOD', 'Admin', 'CEO'].includes(user?.loginType) ? 9 : 8}
                      className="text-center text py-4"
                    >
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={['HOD', 'Admin', 'CEO'].includes(user?.loginType) ? 9 : 8}
                      className="text-center text py-4"
                    >
                      No leave records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((leave) => {
                    console.log(`Leave ID: ${leave._id}, Status:`, leave.status, `User LoginType: ${user?.loginType}`);
                    return (
                      <TableRow key={leave._id} className="hover:bg-gray-50">
                        <TableCell className="text">{leave.name}</TableCell>
                        <TableCell className="text">{leave.leaveType}</TableCell>
                        <TableCell className="text">
                          {new Date(leave.fullDay?.from || leave.halfDay?.date || leave.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text">
                          {new Date(leave.fullDay?.to || leave.halfDay?.date || leave.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => setSelectedLeave(leave)}
                            className="bg-blue-600 text-white"
                          >
                            View
                          </Button>
                        </TableCell>
                        <TableCell className="text">{leave.status.hod || 'Pending'}</TableCell>
                        <TableCell className="text">{leave.status.ceo || 'Pending'}</TableCell>
                        <TableCell className="text">{leave.status.admin || 'Pending'}</TableCell>
                        {['HOD', 'Admin', 'CEO'].includes(user?.loginType) && (
                          <TableCell>
                            {user.loginType === 'HOD' && leave.status.hod === 'Pending' && (
                              <div className="flex gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => handleApproval(leave._id, 'Approved', 'hod')}
                                  disabled={loading || leave.status.hod !== 'Pending'}
                                  aria-label={`Approve leave for ${leave.name}`}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                  onClick={() => handleApproval(leave._id, 'Rejected', 'hod')}
                                  disabled={loading || leave.status.hod !== 'Pending'}
                                  aria-label={`Reject leave for ${leave.name}`}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                            {user.loginType === 'CEO' && leave.status.hod === 'Approved' && leave.status.ceo === 'Pending' && (
                              <div className="flex gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => handleApproval(leave._id, 'Approved', 'ceo')}
                                  disabled={loading || leave.status.ceo !== 'Pending'}
                                  aria-label={`Approve leave for ${leave.name}`}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                  onClick={() => handleApproval(leave._id, 'Rejected', 'ceo')}
                                  disabled={loading || leave.status.ceo !== 'Pending'}
                                  aria-label={`Reject leave for ${leave.name}`}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                            {user.loginType === 'Admin' && leave.status.ceo === 'Approved' && leave.status.admin === 'Pending' && (
                              <div className="flex gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => handleApproval(leave._id, 'Approved', 'admin')}
                                  disabled={loading || leave.status.admin !== 'Pending'}
                                  aria-label={`Approve leave for ${leave.name}`}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                  onClick={() => handleApproval(leave._id, 'Rejected', 'admin')}
                                  disabled={loading || leave.status.admin !== 'Pending'}
                                  aria-label={`Reject leave for ${leave.name}`}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            <Pagination
              currentPage={page}
              itemsPerPage={limit}
              totalItems={total}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />

            <Dialog open={!!selectedLeave} onOpenChange={() => setSelectedLeave(null)}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Leave Details</DialogTitle>
                  <DialogDescription>
                    Complete details of the selected leave application.
                  </DialogDescription>
                </DialogHeader>
                {selectedLeave && (
                  <div className="space-y-3">
                    <p><strong>Leave Type:</strong> {selectedLeave.leaveType}</p>
                    <p><strong>Reason:</strong> {selectedLeave.reason}</p>
                    <p><strong>Charge Given To:</strong> {selectedLeave.chargeGivenTo}</p>
                    <p><strong>Emergency Contact:</strong> {selectedLeave.emergencyContact}</p>
                    {selectedLeave.compensatoryDate && <p><strong>Compensatory Date:</strong> {new Date(selectedLeave.compensatoryDate).toLocaleDateString()}</p>}
                    {selectedLeave.projectDetails && <p><strong>Project Details:</strong> {selectedLeave.projectDetails}</p>}
                    {selectedLeave.restrictedHoliday && <p><strong>Restricted Holiday:</strong> {selectedLeave.restrictedHoliday}</p>}
                  </div>
                )}
                <DialogFooter className="mt-4">
                  <Button onClick={() => setSelectedLeave(null)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </ContentLayout>
  );
}

export default LeaveList;
