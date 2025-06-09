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

function OTApproval() {
  const { user } = useContext(AuthContext);
  const [claims, setClaims] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    fromDate: '',
    toDate: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);

  const fetchOtClaims = useCallback(async (currentPage = page, currentLimit = limit) => {
    try {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams({
        status: filters.status,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        page: currentPage.toString(),
        limit: currentLimit.toString(),
      }).toString();
      const res = await api.get(`/ot?${query}`);
      setClaims(res.data.otClaims);
      setTotal(res.data.total);
      setPage(res.data.page);
    } catch (err) {
      console.error('Error fetching OT claims:', err);
      setError(err.response?.data?.message || 'Failed to fetch OT claims. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => {
    fetchOtClaims();
  }, [fetchOtClaims]);

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
    fetchOtClaims(1, limit);
  };

  const handleApproval = async (id, status, currentStage) => {
    try {
      await api.put(`/ot/${id}/approve`, { status });
      const updatedClaims = claims.map(claim => {
        if (claim._id === id) {
          const newStatus = { ...claim.status, [currentStage]: status };
          // Update the next stage based on the current stage and status
          if (status === 'Approved') {
            if (currentStage === 'hod') {
              newStatus.ceo = 'Pending';
            } else if (currentStage === 'ceo') {
              newStatus.admin = 'Pending';
            }
          }
          return { ...claim, status: newStatus };
        }
        return claim;
      });
      setClaims(updatedClaims);
      alert(`OT claim ${status.toLowerCase()} successfully.`);
    } catch (err) {
      console.error('Approval error:', err);
      alert(`Error processing OT claim approval: ${err.response?.data?.message || err.message}`);
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchOtClaims(newPage, limit);
  };

  const handlePageSizeChange = (newSize) => {
    setLimit(newSize);
    setPage(1);
    fetchOtClaims(1, newSize);
  };

  return (
    <ContentLayout title="OT Claims Approval">
      <Card className="max-w-5xl mx-auto shadow-lg border">
        <CardContent className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
          <div className="flex justify-between mb-4">
            <h2 className="text-lg font-semibold">OT Claim Records</h2>
            <Button
              onClick={() => fetchOtClaims(1)}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="status">Approval Status (Any Stage)</Label>
              <Select
                onValueChange={(value) => handleFilterChange('status', value)}
                value={filters.status}
                disabled={loading}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                name="fromDate"
                type="date"
                value={filters.fromDate}
                onChange={(e) => handleFilterChange('fromDate', e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                name="toDate"
                type="date"
                value={filters.toDate}
                onChange={(e) => handleFilterChange('toDate', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="font-semibold">Employee</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Hours</TableHead>
                  <TableHead className="font-semibold">Claim Type</TableHead>
                  <TableHead className="font-semibold">View</TableHead>
                  <TableHead className="font-semibold">Status (HOD)</TableHead>
                  <TableHead className="font-semibold">Status (CEO)</TableHead>
                  <TableHead className="font-semibold">Status (Admin)</TableHead>
                  {['HOD', 'Admin', 'CEO'].includes(user?.loginType) && (
                    <TableHead className="font-semibold">Action</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={['HOD', 'Admin', 'CEO'].includes(user?.loginType) ? 9 : 8} className="text-center py-4">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : claims.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={['HOD', 'Admin', 'CEO'].includes(user?.loginType) ? 9 : 8} className="text-center py-4">
                      No OT claim records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  claims.map((claim) => (
                    <TableRow key={claim._id} className="hover:bg-gray-50">
                      <TableCell>{claim.name}</TableCell>
                      <TableCell>{new Date(claim.date).toLocaleDateString()}</TableCell>
                      <TableCell>{claim.hours}</TableCell>
                      <TableCell>{claim.claimType || 'N/A'}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => setSelectedClaim(claim)}
                          className="bg-blue-600 text-white"
                        >
                          View
                        </Button>
                      </TableCell>
                      <TableCell>{claim.status.hod || 'Pending'}</TableCell>
                      <TableCell>{claim.status.ceo || 'Pending'}</TableCell>
                      <TableCell>{claim.status.admin || 'Pending'}</TableCell>
                      {['HOD', 'Admin', 'CEO'].includes(user.loginType) && (
                        <TableCell>
                          {user.loginType === 'HOD' && claim.status.hod === 'Pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => handleApproval(claim._id, 'Approved', 'hod')}
                                disabled={loading || claim.status.hod !== 'Pending'}
                                aria-label={`Approve OT claim for ${claim.name}`}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={() => handleApproval(claim._id, 'Rejected', 'hod')}
                                disabled={loading || claim.status.hod !== 'Pending'}
                                aria-label={`Reject OT claim for ${claim.name}`}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                          {user.loginType === 'CEO' && claim.status.hod === 'Approved' && claim.status.ceo === 'Pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => handleApproval(claim._id, 'Approved', 'ceo')}
                                disabled={loading || claim.status.ceo !== 'Pending'}
                                aria-label={`Approve OT claim for ${claim.name}`}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={() => handleApproval(claim._id, 'Rejected', 'ceo')}
                                disabled={loading || claim.status.ceo !== 'Pending'}
                                aria-label={`Reject OT claim for ${claim.name}`}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                          {user.loginType === 'Admin' && claim.status.ceo === 'Approved' && claim.status.admin === 'Pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => handleApproval(claim._id, 'Approved', 'admin')}
                                disabled={loading || claim.status.admin !== 'Pending'}
                                aria-label={`Approve OT claim for ${claim.name}`}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={() => handleApproval(claim._id, 'Rejected', 'admin')}
                                disabled={loading || claim.status.admin !== 'Pending'}
                                aria-label={`Reject OT claim for ${claim.name}`}
                              >
                                Reject
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
            <Dialog open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>OT Claim Details</DialogTitle>
                  <DialogDescription>Complete details of the selected OT claim.</DialogDescription>
                </DialogHeader>
                {selectedClaim && (
                  <div className="space-y-3">
                    <p><strong>Employee:</strong> {selectedClaim.name}</p>
                    <p><strong>Date:</strong> {new Date(selectedClaim.date).toLocaleDateString()}</p>
                    <p><strong>Hours:</strong> {selectedClaim.hours}</p>
                    <p><strong>Claim Type:</strong> {selectedClaim.claimType || 'N/A'}</p>
                    <p><strong>Project Details:</strong> {selectedClaim.projectDetails}</p>
                    <p><strong>Compensatory Hours:</strong> {selectedClaim.compensatoryHours || 0}</p>
                    <p><strong>Payment Amount:</strong> {selectedClaim.paymentAmount || 0}</p>
                  </div>
                )}
                <DialogFooter className="mt-4">
                  <Button onClick={() => setSelectedClaim(null)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </ContentLayout>
  );
}

export default OTApproval;
