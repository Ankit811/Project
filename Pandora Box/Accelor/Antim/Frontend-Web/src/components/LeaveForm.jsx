import React, { useState, useContext, useEffect } from 'react';
import {
  Card,
  CardContent,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../components/ui/select";
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import ContentLayout from './ContentLayout';

function LeaveForm() {
  const { user } = useContext(AuthContext);
  const [form, setForm] = useState({
    leaveType: '',
    fullDay: { from: '', to: '' },
    halfDay: { date: '', session: 'forenoon' },
    reason: '',
    chargeGivenTo: '',
    emergencyContact: '',
    compensatoryEntryId: '', // New field for selected entry
    restrictedHoliday: '',
    projectDetails: '',
    duration: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [compensatoryBalance, setCompensatoryBalance] = useState(0);
  const [compensatoryEntries, setCompensatoryEntries] = useState([]); // New state for entries

  useEffect(() => {
    const fetchCompensatoryData = async () => {
      try {
        const res = await api.get('/dashboard/employee-info');
        setCompensatoryBalance(res.data.compensatoryLeaves || 0);
        setCompensatoryEntries(res.data.compensatoryAvailable || []);
      } catch (err) {
        console.error('Error fetching compensatory data:', err);
      }
    };
    fetchCompensatoryData();
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    if (name.includes('fullDay')) {
      setForm(prev => ({
        ...prev,
        fullDay: { ...prev.fullDay, [name.split('.')[1]]: value },
        halfDay: prev.duration === 'full' ? { date: '', session: 'forenoon' } : prev.halfDay,
      }));
    } else if (name.includes('halfDay')) {
      setForm(prev => ({
        ...prev,
        halfDay: { ...prev.halfDay, [name.split('.')[1]]: value },
        fullDay: prev.duration === 'half' ? { from: '', to: '' } : prev.fullDay,
      }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCompensatoryEntryChange = (value) => {
    setForm(prev => ({ ...prev, compensatoryEntryId: value }));
  };

  const calculateLeaveDays = () => {
    if (form.duration === 'half' && form.halfDay.date) {
      return 0.5;
    }
    if (form.duration === 'full' && form.fullDay.from && form.fullDay.to) {
      const from = new Date(form.fullDay.from);
      const to = new Date(form.fullDay.to);
      if (to >= from) {
        return ((to - from) / (1000 * 60 * 60 * 24)) + 1;
      }
    }
    return 0;
  };

  const validateForm = () => {
    if (!form.leaveType) return 'Leave Type is required';
    if (!form.reason) return 'Reason is required';
    if (!form.chargeGivenTo) return 'Charge Given To is required';
    if (!form.emergencyContact) return 'Emergency Contact is required';
    if (!form.duration) return 'Leave Duration is required';
    if (form.duration === 'half' && (!form.halfDay.date || !form.halfDay.session)) {
      return 'Half Day Date and Session are required';
    }
    if (form.duration === 'half' && (form.fullDay.from || form.fullDay.to)) {
      return 'Full Day dates must be empty for Half Day leave';
    }
    if (form.duration === 'full' && (!form.fullDay.from || !form.fullDay.to)) {
      return 'Full Day From and To dates are required';
    }
    if (form.duration === 'full' && (form.halfDay.date || form.halfDay.session !== 'forenoon')) {
      return 'Half Day fields must be empty for Full Day leave';
    }
    if (form.fullDay.from && form.fullDay.to && new Date(form.fullDay.to) < new Date(form.fullDay.from)) {
      return 'To Date cannot be earlier than From Date';
    }
    if (form.leaveType === 'Compensatory') {
      if (!form.compensatoryEntryId) return 'Compensatory leave entry is required';
      const entry = compensatoryEntries.find(e => e._id === form.compensatoryEntryId);
      if (!entry || entry.status !== 'Available') return 'Invalid or unavailable compensatory leave entry';
      const leaveDays = calculateLeaveDays();
      const hoursNeeded = leaveDays === 0.5 ? 4 : 8;
      if (entry.hours !== hoursNeeded) {
        return `Selected entry (${entry.hours} hours) does not match leave duration (${leaveDays === 0.5 ? 'Half Day (4 hours)' : 'Full Day (8 hours)'})`;
      }
    }
    if (form.leaveType === 'Restricted Holidays' && !form.restrictedHoliday) {
      return 'Please select a restricted holiday';
    }
    if (form.leaveType === 'Casual' && user?.employeeType === 'Confirmed' && form.duration === 'full') {
      const from = new Date(form.fullDay.from);
      const to = new Date(form.fullDay.to);
      const days = ((to - from) / (1000 * 60 * 60 * 24)) + 1;
      if (days > 3) {
        return 'Confirmed employees can only take up to 3 consecutive Casual leaves.';
      }
    }
    if (form.leaveType === 'Medical' && user?.employeeType !== 'Confirmed') {
      return 'Medical leave is only available for Confirmed employees';
    }
    if (form.leaveType === 'Medical' && form.duration === 'full') {
      const from = new Date(form.fullDay.from);
      const to = new Date(form.fullDay.to);
      const days = ((to - from) / (1000 * 60 * 60 * 24)) + 1;
      if (days !== 3 && days !== 4) {
        return 'Medical leave must be exactly 3 or 4 days';
      }
    }
    if (form.leaveType === 'Medical' && form.duration === 'half') {
      return 'Medical leave cannot be applied as a half-day leave';
    }
    if (form.leaveType === 'Maternity' && user?.gender !== 'Female') {
      return 'Maternity leave is only available for female employees';
    }
    if (form.leaveType === 'Maternity' && user?.employeeType !== 'Confirmed') {
      return 'Maternity leave is only available for Confirmed employees';
    }
    if (form.leaveType === 'Maternity' && form.duration === 'full') {
      const from = new Date(form.fullDay.from);
      const to = new Date(form.fullDay.to);
      const days = ((to - from) / (1000 * 60 * 60 * 24)) + 1;
      if (days !== 90) {
        return 'Maternity leave must be exactly 90 days';
      }
    }
    if (form.leaveType === 'Maternity' && form.duration === 'half') {
      return 'Maternity leave cannot be applied as a half-day leave';
    }
    if (form.leaveType === 'Paternity' && user?.gender !== 'Male') {
      return 'Paternity leave is only available for male employees';
    }
    if (form.leaveType === 'Paternity' && user?.employeeType !== 'Confirmed') {
      return 'Paternity leave is only available for Confirmed employees';
    }
    if (form.leaveType === 'Paternity' && form.duration === 'full') {
      const from = new Date(form.fullDay.from);
      const to = new Date(form.fullDay.to);
      const days = ((to - from) / (1000 * 60 * 60 * 24)) + 1;
      if (days !== 7) {
        return 'Paternity leave must be exactly 7 days';
      }
    }
    if (form.leaveType === 'Paternity' && form.duration === 'half') {
      return 'Paternity leave cannot be applied as a half-day leave';
    }
    return null;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      alert(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const leaveData = {
        leaveType: form.leaveType,
        fullDay: form.duration === 'full' ? {
          from: form.fullDay.from ? new Date(form.fullDay.from).toISOString() : null,
          to: form.fullDay.to ? new Date(form.fullDay.to).toISOString() : null,
        } : null,
        halfDay: form.duration === 'half' ? {
          date: form.halfDay.date ? new Date(form.halfDay.date).toISOString() : null,
          session: form.halfDay.session,
        } : null,
        reason: form.reason,
        chargeGivenTo: form.chargeGivenTo,
        emergencyContact: form.emergencyContact,
        compensatoryEntryId: form.leaveType === 'Compensatory' ? form.compensatoryEntryId : null, // Include entry ID
        restrictedHoliday: form.restrictedHoliday,
        projectDetails: form.projectDetails,
        user: user.id,
      };
      console.log('Submitting leave:', JSON.stringify(leaveData, null, 2));
      await api.post('/leaves', leaveData);
      alert('Leave submitted successfully');
      setForm({
        leaveType: '',
        fullDay: { from: '', to: '' },
        halfDay: { date: '', session: 'forenoon' },
        reason: '',
        chargeGivenTo: '',
        emergencyContact: '',
        compensatoryEntryId: '',
        restrictedHoliday: '',
        projectDetails: '',
        duration: '',
      });
      // Refresh compensatory data
      const res = await api.get('/dashboard/employee-info');
      setCompensatoryBalance(res.data.compensatoryLeaves || 0);
      setCompensatoryEntries(res.data.compensatoryAvailable || []);
    } catch (err) {
      console.error('Leave submit error:', err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || 'An error occurred while submitting the leave';
      alert(`Error: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ContentLayout title="Apply for Leave">
      <Card className="max-w-lg mx-auto shadow-lg border">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="leaveType">Leave Type</Label>
              <Select
                onValueChange={(value) => handleChange({ target: { name: 'leaveType', value } })}
                value={form.leaveType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Casual">Casual</SelectItem>
                  <SelectItem value="Medical">Medical</SelectItem>
                  <SelectItem value="Maternity">Maternity</SelectItem>
                  <SelectItem value="Paternity">Paternity</SelectItem>
                  <SelectItem value="Compensatory">Compensatory</SelectItem>
                  <SelectItem value="Restricted Holidays">Restricted Holidays</SelectItem>
                  <SelectItem value="Leave Without Pay(LWP)">Leave Without Pay (LWP)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.leaveType === 'Compensatory' && (
              <>
                <div className="col-span-2">
                  <Label htmlFor="compensatoryBalance">Compensatory Leave Balance</Label>
                  <p className="mt-1 text-sm text-gray-600">{compensatoryBalance} hours</p>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="compensatoryEntryId">Compensatory Leave Entry</Label>
                  <Select
                    onValueChange={handleCompensatoryEntryChange}
                    value={form.compensatoryEntryId}
                    disabled={compensatoryEntries.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={compensatoryEntries.length === 0 ? "No available entries" : "Select compensatory entry"} />
                    </SelectTrigger>
                    <SelectContent>
                      {compensatoryEntries
                        .filter(entry => entry.status === 'Available')
                        .map(entry => (
                          <SelectItem key={entry._id} value={entry._id}>
                            {new Date(entry.date).toLocaleDateString()} - {entry.hours} hours
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="projectDetails">Project Details</Label>
                  <Textarea
                    name="projectDetails"
                    value={form.projectDetails}
                    onChange={handleChange}
                    rows={2}
                  />
                </div>  
              </>
            )}

            {form.leaveType === 'Restricted Holidays' && (
              <div className="col-span-2">
                <Label htmlFor="restrictedHoliday">Restricted Holiday</Label>
                <Select
                  onValueChange={(value) => handleChange({ target: { name: 'restrictedHoliday', value } })}
                  value={form.restrictedHoliday}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select holiday" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Diwali">Diwali</SelectItem>
                    <SelectItem value="Christmas">Christmas</SelectItem>
                    <SelectItem value="Eid">Eid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="duration">Leave Duration</Label>
              <Select
                onValueChange={(value) => {
                  setForm(prev => ({
                    ...prev,
                    duration: value,
                    halfDay: value === 'half' ? { date: '', session: 'forenoon' } : { date: '', session: 'forenoon' },
                    fullDay: value === 'full' ? { from: '', to: '' } : { from: '', to: '' },
                  }));
                }}
                value={form.duration}
                aria-label="Select leave duration"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Day</SelectItem>
                  <SelectItem value="half">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.duration === 'half' ? (
              <>
                <div>
                  <Label htmlFor="halfDay.session">Session</Label>
                  <Select
                    onValueChange={(value) => handleChange({ target: { name: 'halfDay.session', value } })}
                    value={form.halfDay.session}
                    aria-label="Select session"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select session" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="forenoon">Forenoon</SelectItem>
                      <SelectItem value="afternoon">Afternoon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="halfDay.date">Half Day Date</Label>
                  <Input
                    id="halfDay.date"
                    name="halfDay.date"
                    type="date"
                    value={form.halfDay.date}
                    onChange={handleChange}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="fullDay.from">From Date</Label>
                  <Input
                    id="fullDay.from"
                    name="fullDay.from"
                    type="date"
                    value={form.fullDay.from}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <Label htmlFor="fullDay.to">To Date</Label>
                  <Input
                    id="fullDay.to"
                    name="fullDay.to"
                    type="date"
                    value={form.fullDay.to}
                    onChange={handleChange}
                  />
                </div>
              </>
            )}

            <div className="col-span-2">
              <Label>Leave Days</Label>
              <p className="mt-1 text-sm text-gray-600">{calculateLeaveDays()} days</p>
            </div>

            <div className="col-span-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                name="reason"
                value={form.reason}
                onChange={handleChange}
                rows={3}
                placeholder="Enter reason..."
              />
            </div>

            <div>
              <Label htmlFor="chargeGivenTo">Charge Given To</Label>
              <Input
                id="chargeGivenTo"
                name="chargeGivenTo"
                type="text"
                value={form.chargeGivenTo}
                onChange={handleChange}
                placeholder="Enter charge given to"
              />
            </div>

            <div>
              <Label htmlFor="emergencyContact">Emergency Contact</Label>
              <Input
                id="emergencyContact"
                name="emergencyContact"
                type="text"
                value={form.emergencyContact}
                onChange={handleChange}
                placeholder="Enter emergency contact"
              />
            </div>

            <div className="col-span-2 flex justify-center mt-4">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                {submitting ? 'Submitting...' : 'Submit Leave'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </ContentLayout>
  );
}

export default LeaveForm;
