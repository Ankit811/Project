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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import Pagination from "./Pagination";
import api from '../services/api';
import ContentLayout from './ContentLayout';
import { AuthContext } from '../context/AuthContext';

function ODList() {
  const { user } = useContext(AuthContext);
  const [odRecords, setOdRecords] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    fromDate: '',
    toDate: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedOD, setSelectedOD] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);

  const fetchODs = useCallback(async (currentPage = page, currentLimit = limit) => {
    try {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams({
        status: filters.status,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        page: currentPage,
        limit: currentLimit,
      }).toString();
      const res = await api.get(`/od?${query}`);
      setOdRecords(res.data.odRecords);
      setFiltered(res.data.odRecords);
      setTotal(res.data.total);
      setPage(res.data.page);
    } catch (err) {
      console.error('Error fetching OD list:', err);
      setError(err.response?.data?.message || 'Failed to fetch OD records. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => {
    fetchODs();
  }, [fetchODs]);

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
      status: newFilters.status,
      fromDate: newFilters.fromDate,
      toDate: newFilters.toDate,
      page: 1,
      limit,
    }).toString();
    setLoading(true);
    api.get(`/od?${query}`)
      .then(res => {
        setOdRecords(res.data.odRecords);
        setFiltered(res.data.odRecords);
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
      const odData = { status };
      await api.put(`/od/${id}/approve`, odData);
      const updatedODs = odRecords.map(od => {
        if (od._id === id) {
          const newStatus = { ...od.status, [currentStage]: status };
          // Update the next stage based on the current stage and status
          if (status === 'Approved' || status === 'Acknowledged') {
            if (currentStage === 'hod') {
              newStatus.ceo = 'Pending';
            } else if (currentStage === 'ceo') {
              newStatus.admin = 'Pending';
            }
          }
          return { ...od, status: newStatus };
        }
        return od;
      });
      setOdRecords(updatedODs);
      setFiltered(updatedODs);
      alert(`OD ${status.toLowerCase()} successfully.`);
    } catch (err) {
      console.error('Approval error:', err);
      alert(`Error processing OD approval: ${err.response?.data?.message || err.message}`);
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchODs(newPage, limit);
  };

  const handlePageSizeChange = (newSize) => {
    setLimit(newSize);
    setPage(1);
    fetchODs(1, newSize);
  };

  return (
    <ContentLayout title="OD List">
      <Card className="max-w-5xl mx-auto shadow-lg border">
        <CardContent className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
          <div className="flex justify-between mb-4">
            <h2 className="text-lg font-semibold">OD Records</h2>
            <Button
              onClick={() => fetchODs(1)}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 mb-6">
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
                  <SelectItem value="Acknowledged">Acknowledged</SelectItem>
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
                  <TableHead className="font-semibold text">Date Out</TableHead>
                  <TableHead className="font-semibold text">Date In</TableHead>
                  <TableHead className="font-semibold text">Purpose</TableHead>
                  <TableHead className="font-semibold text">Place/Unit</TableHead>
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
                      colSpan={['HOD', 'Admin', 'CEO'].includes(user?.loginType) ? 10 : 9}
                      className="text-center text py-4"
                    >
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={['HOD', 'Admin', 'CEO'].includes(user?.loginType) ? 10 : 9}
                      className="text-center text py-4"
                    >
                      No OD records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((od) => (
                    <TableRow key={od._id} className="hover:bg-gray-50">
                      <TableCell className="text">{od.name}</TableCell>
                      <TableCell className="text">{new Date(od.dateOut).toLocaleDateString()}</TableCell>
                      <TableCell className="text">{new Date(od.dateIn).toLocaleDateString()}</TableCell>
                      <TableCell className="text">{od.purpose}</TableCell>
                      <TableCell className="text">{od.placeUnitVisit}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => setSelectedOD(od)}
                          className="bg-blue-600 text-white"
                        >
                          View
                        </Button>
                      </TableCell>
                      <TableCell className="text">{od.status.hod || 'Pending'}</TableCell>
                      <TableCell className="text">{od.status.ceo || 'Pending'}</TableCell>
                      <TableCell className="text">{od.status.admin || 'Pending'}</TableCell>
                      {['HOD', 'Admin', 'CEO'].includes(user?.loginType) && (
                        <TableCell>
                          {user.loginType === 'HOD' && od.status.hod === 'Pending' && (
                            <div className="flex gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => handleApproval(od._id, 'Approved', 'hod')}
                                disabled={loading || od.status.hod !== 'Pending'}
                                aria-label={`Approve OD for ${od.name}`}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={() => handleApproval(od._id, 'Rejected', 'hod')}
                                disabled={loading || od.status.hod !== 'Pending'}
                                aria-label={`Reject OD for ${od.name}`}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                          {user.loginType === 'CEO' && od.status.hod === 'Approved' && od.status.ceo === 'Pending' && (
                            <div className="flex gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => handleApproval(od._id, 'Approved', 'ceo')}
                                disabled={loading || od.status.ceo !== 'Pending'}
                                aria-label={`Approve OD for ${od.name}`}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={() => handleApproval(od._id, 'Rejected', 'ceo')}
                                disabled={loading || od.status.ceo !== 'Pending'}
                                aria-label={`Reject OD for ${od.name}`}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                          {user.loginType === 'Admin' && od.status.ceo === 'Approved' && od.status.admin === 'Pending' && (
                            <div className="flex gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => handleApproval(od._id, 'Acknowledged', 'admin')}
                                disabled={loading || od.status.admin !== 'Pending'}
                                aria-label={`Acknowledge OD for ${od.name}`}
                              >
                                Acknowledged
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
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

            <Dialog open={!!selectedOD} onOpenChange={() => setSelectedOD(null)}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>OD Details</DialogTitle>
                  <DialogDescription>
                    Complete details of the selected OD request.
                  </DialogDescription>
                </DialogHeader>
                {selectedOD && (
                  <div className="space-y-3">
                    <p><strong>Date Out:</strong> {new Date(selectedOD.dateOut).toLocaleDateString()}</p>
                    <p><strong>Time Out:</strong> {selectedOD.timeOut || 'N/A'}</p>
                    <p><strong>Date In:</strong> {new Date(selectedOD.dateIn).toLocaleDateString()}</p>
                    <p><strong>Time In:</strong> {selectedOD.timeIn || 'N/A'}</p>
                    <p><strong>Purpose:</strong> {selectedOD.purpose}</p>
                    <p><strong>Place/Unit Visit:</strong> {selectedOD.placeUnitVisit}</p>
                  </div>
                )}
                <DialogFooter className="mt-4">
                  <Button onClick={() => setSelectedOD(null)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </ContentLayout>
  );
}

export default ODList;
