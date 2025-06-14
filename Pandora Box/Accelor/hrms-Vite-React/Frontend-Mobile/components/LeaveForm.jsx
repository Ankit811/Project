
import React, { useState, useContext, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { Card, Modal, Portal, Button, Provider as PaperProvider } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker, Menu } from 'react-native-paper';

const LeaveForm = ({ navigation }) => {
    const { user } = useContext(AuthContext);
    const [form, setForm] = useState({
        leaveType: '',
        duration: 'full',
        fullDay: { from: '', to: '' },
        halfDay: { date: '', session: 'forenoon' },
        compensatoryEntry: '',
        projectDetails: '',
        restrictedHoliday: '',
        compensatoryEntryId: '',
        designation: user.designation
    });

    // State for dropdown menus
    const [leaveTypeVisible, setLeaveTypeVisible] = useState(false);
    const [restrictedHolidayVisible, setRestrictedHolidayVisible] = useState(false);
    const [sessionVisible, setSessionVisible] = useState(false);
    const [compensatoryVisible, setCompensatoryVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [compensatoryBalance, setCompensatoryBalance] = useState(0);
    const [compensatoryEntries, setCompensatoryEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    // State for date picker visibility
    const [showDatePicker, setShowDatePicker] = useState({
        fromDate: false,
        toDate: false,
        date: false
    });
    const [leaveRecords, setLeaveRecords] = useState([]);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);

    const fetchLeaveRecords = async () => {
        try {
            const response = await api.get('/leaves',{
                params:{
                    limit: 10,
                    page: 1,
                    sort: 'createdAt:-1',
                    mine: true
                }
            });
            const records = response.data.leaves || [];
            setLeaveRecords(records);
        } catch (error) {
            console.error('Error fetching leave records:', error);
            Alert.alert('Error', 'Failed to fetch leave records');
            setLeaveRecords([]);
        }
    };

    useEffect(() => {
        const fetchCompensatoryData = async () => {
            try {
                const res = await api.get('/dashboard/employee-info');
                setCompensatoryBalance(res.data.compensatoryLeaves || 0);
                setCompensatoryEntries(res.data.compensatoryAvailable || []);
                setIsLoading(false);
            } catch (err) {
                console.error('Error fetching compensatory data:', err);
                setIsLoading(false);
            }
        };
        fetchCompensatoryData();
        fetchLeaveRecords();
    }, []);

    const getFinalStatus = (status) => {
        if (!status) return 'Pending';
        if (status.hod === 'Rejected' || status.ceo === 'Rejected') return 'Rejected';
        if (status.ceo === 'Approved') return 'Approved';
        if (status.hod === 'Approved') return 'Approved by HOD';
        return 'Pending';
    };

    const getStatusColor = (status) => {
        if (status === 'Rejected') return '#ef4444';
        if (status === 'Approved') return '#10b981';
        if (status.includes('Approved by')) return '#3b82f6';
        return '#f59e0b';
    };

    const handleChange = (name, value) => {
        if (name.includes('fullDay')) {
            const field = name.split('.')[1];
            setForm(prev => ({
                ...prev,
                fullDay: { ...prev.fullDay, [field]: value },
                ...(prev.duration === 'full' && { halfDay: { date: '', session: 'forenoon' } })
            }));
        } else if (name.includes('halfDay')) {
            const field = name.split('.')[1];
            setForm(prev => ({
                ...prev,
                halfDay: { ...prev.halfDay, [field]: value },
                ...(prev.duration === 'half' && { fullDay: { from: '', to: '' } })
            }));
        } else {
            setForm(prev => ({ ...prev, [name]: value }));
        }
    };

    const onDateChange = (event, selectedDate, field) => {
        console.log('onDateChange called:', { field, selectedDate, event });

        // For Android, close the picker when a date is selected
        if (Platform.OS === 'android') {
            setShowDatePicker(prev => ({
                ...prev,
                [field]: false
            }));
        }

        if (event.type === 'dismissed') {
            return;
        }

        if (selectedDate) {
            const formattedDate = selectedDate.toISOString().split('T')[0];
            if (field === 'fromDate' || field === 'toDate') {
                const fieldName = field === 'fromDate' ? 'from' : 'to';
                setForm(prev => ({
                    ...prev,
                    fullDay: {
                        ...prev.fullDay,
                        [fieldName]: formattedDate
                    }
                }));

                // If setting fromDate and toDate is empty or before fromDate, update toDate
                if (field === 'fromDate' && (!form.fullDay.to || new Date(form.fullDay.to) < new Date(formattedDate))) {
                    setForm(prev => ({
                        ...prev,
                        fullDay: {
                            ...prev.fullDay,
                            to: formattedDate
                        }
                    }));
                }
            } else if (field === 'date') {
                setForm(prev => ({
                    ...prev,
                    halfDay: {
                        ...prev.halfDay,
                        date: formattedDate
                    }
                }));
            }
        }
    };

    const showDatepicker = (field) => {
        console.log('showDatepicker called:', field);
        setShowDatePicker(prev => ({ ...prev, [field]: true }));
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
            Alert.alert(validationError);
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
                compensatoryEntryId: form.leaveType === 'Compensatory' ? form.compensatoryEntryId : null,
                restrictedHoliday: form.restrictedHoliday,
                projectDetails: form.projectDetails,
                user: user.id,
            };
            console.log('Leave data:', leaveData);
            await api.post('/leaves', leaveData);
            Alert.alert('Leave submitted successfully');
            await fetchLeaveRecords();
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
            const res = await api.get('/dashboard/employee-info');
            setCompensatoryBalance(res.data.compensatoryLeaves || 0);
            setCompensatoryEntries(res.data.compensatoryAvailable || []);
        } catch (err) {
            console.error('Leave submit error:', err.response?.data || err.message);
            const errorMessage = err.response?.data?.message || 'An error occurred while submitting the leave';
            Alert.alert('Error', errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loader}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    return (
        <PaperProvider>
            <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
                <Card style={styles.card}>
                    <Card.Content>
                        <Text style={styles.title}>Apply for Leave</Text>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Leave Type</Text>
                            <Menu
                                visible={leaveTypeVisible}
                                onDismiss={() => setLeaveTypeVisible(false)}
                                contentStyle={{ backgroundColor: '#ffffff' }}
                                style={{ marginTop: -80 }}
                                anchor={
                                    <TouchableOpacity
                                        style={styles.dropdownButton}
                                        onPress={() => setLeaveTypeVisible(true)}
                                    >
                                        <Text style={form.leaveType ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
                                            {form.leaveType || 'Select Leave Type'}
                                        </Text>
                                    </TouchableOpacity>
                                }
                            >
                                {['Casual', 'Medical', 'Maternity', 'Paternity', 'Emergency', 'Compensatory', 'Restricted Holidays', 'Leave Without Pay(LWP)'].map((type) => (
                                    <Menu.Item
                                        key={type}
                                        onPress={() => {
                                            console.log('Leave Type changed:', type);
                                            handleChange('leaveType', type);
                                            setLeaveTypeVisible(false);
                                        }}
                                        title={type}
                                        titleStyle={styles.dropdownItemText}
                                    />
                                ))}
                            </Menu>
                        </View>

                        {form.leaveType === 'Compensatory' && (
                            <View style={styles.compensatorySection}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Compensatory Leave Balance</Text>
                                    <Text style={styles.balanceText}>{compensatoryBalance} hours</Text>
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Compensatory Leave Entry</Text>
                                    <Menu
                                        visible={compensatoryVisible}
                                        onDismiss={() => setCompensatoryVisible(false)}
                                        anchor={
                                            <TouchableOpacity
                                                style={[styles.dropdownButton, !compensatoryEntries.length && styles.disabledButton]}
                                                onPress={() => compensatoryEntries.length > 0 && setCompensatoryVisible(true)}
                                                disabled={!compensatoryEntries.length}
                                            >
                                                <Text style={form.compensatoryEntryId ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
                                                    {compensatoryEntries.length === 0
                                                        ? "No available entries"
                                                        : form.compensatoryEntryId
                                                            ? compensatoryEntries.find(e => e._id === form.compensatoryEntryId)?.date
                                                                ? `${new Date(compensatoryEntries.find(e => e._id === form.compensatoryEntryId).date).toLocaleDateString()} - ${compensatoryEntries.find(e => e._id === form.compensatoryEntryId).hours} hours`
                                                                : 'Select compensatory entry'
                                                            : 'Select compensatory entry'}
                                                </Text>
                                            </TouchableOpacity>
                                        }
                                    >
                                        {compensatoryEntries
                                            .filter(entry => entry.status === 'Available')
                                            .map(entry => (
                                                <Menu.Item
                                                    key={entry._id}
                                                    onPress={() => {
                                                        console.log('Compensatory Entry changed:', entry._id);
                                                        handleCompensatoryEntryChange(entry._id);
                                                        setCompensatoryVisible(false);
                                                    }}
                                                    title={`${new Date(entry.date).toLocaleDateString()} - ${entry.hours} hours`}
                                                    titleStyle={styles.dropdownItemText}
                                                />
                                            ))}
                                    </Menu>
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Project Details</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        value={form.projectDetails}
                                        onChangeText={(text) => handleChange('projectDetails', text)}
                                        multiline
                                        numberOfLines={4}
                                        placeholder="Enter project details"
                                    />
                                </View>
                            </View>
                        )}

                        {form.leaveType === 'Restricted Holidays' && (
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Restricted Holiday</Text>
                                <Menu
                                    visible={restrictedHolidayVisible}
                                    onDismiss={() => setRestrictedHolidayVisible(false)}
                                    contentStyle={{ backgroundColor: '#ffffff' }}
                                    style={{ marginTop: -80 }}

                                    anchor={
                                        <TouchableOpacity
                                            style={styles.dropdownButton}
                                            onPress={() => setRestrictedHolidayVisible(true)}
                                        >
                                            <Text style={form.restrictedHoliday ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
                                                {form.restrictedHoliday || 'Select Holiday'}
                                            </Text>
                                        </TouchableOpacity>
                                    }
                                >
                                    {['Diwali', 'Christmas', 'Eid'].map((holiday) => (
                                        <Menu.Item
                                            key={holiday}
                                            onPress={() => {
                                                console.log('Restricted Holiday changed:', holiday);
                                                handleChange('restrictedHoliday', holiday);
                                                setRestrictedHolidayVisible(false);
                                            }}
                                            title={holiday}
                                            titleStyle={styles.dropdownItemText}
                                        />
                                    ))}
                                </Menu>
                            </View>
                        )}

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Leave Duration</Text>
                            <View style={styles.durationContainer}>
                                <TouchableOpacity
                                    style={[
                                        styles.durationButton,
                                        form.duration === 'full' && styles.activeDuration
                                    ]}
                                    onPress={() => {
                                        setForm(prev => ({
                                            ...prev,
                                            duration: 'full',
                                            halfDay: { date: '', session: 'forenoon' }
                                        }));
                                    }}
                                >
                                    <Text style={form.duration === 'full' ? styles.activeText : styles.inactiveText}>
                                        Full Day
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.durationButton,
                                        form.duration === 'half' && styles.activeDuration
                                    ]}
                                    onPress={() => {
                                        setForm(prev => ({
                                            ...prev,
                                            duration: 'half',
                                            fullDay: { from: '', to: '' }
                                        }));
                                    }}
                                >
                                    <Text style={form.duration === 'half' ? styles.activeText : styles.inactiveText}>
                                        Half Day
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {form.duration === 'half' ? (
                            <View style={styles.halfDayContainer}>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.label}>Session</Text>
                                    <Menu
                                        visible={sessionVisible}
                                        onDismiss={() => setSessionVisible(false)}
                                        contentStyle={{ backgroundColor: '#ffffff' }}
                                        style={{ marginTop: -80 }}
                                        anchor={
                                            <TouchableOpacity
                                                style={[styles.dropdownButton, { flex: 1 }]}
                                                onPress={() => setSessionVisible(true)}
                                            >
                                                <Text style={styles.dropdownButtonText}>
                                                    {form.halfDay.session.charAt(0).toUpperCase() + form.halfDay.session.slice(1)}
                                                </Text>
                                            </TouchableOpacity>
                                        }
                                    >
                                        {['forenoon', 'afternoon'].map((session) => (
                                            <Menu.Item
                                                key={session}
                                                onPress={() => {
                                                    console.log('Session changed:', session);
                                                    handleChange('halfDay.session', session);
                                                    setSessionVisible(false);
                                                }}
                                                title={session.charAt(0).toUpperCase() + session.slice(1)}
                                                titleStyle={styles.dropdownItemText}
                                            />
                                        ))}
                                    </Menu>
                                </View>
                                <View style={[styles.formGroup, { flex: 1, marginLeft: 10 }]}>
                                    <Text style={styles.label}>Date</Text>
                                    <TouchableOpacity
                                        style={[styles.input, { justifyContent: 'center' }]}
                                        onPress={() => showDatepicker('date')}
                                    >
                                        <Text style={form.halfDay.date ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
                                            {form.halfDay.date || 'Select date'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.fullDayContainer}>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.label}>From Date</Text>
                                    <TouchableOpacity
                                        style={[styles.input, { justifyContent: 'center' }]}
                                        onPress={() => showDatepicker('fromDate')}
                                    >
                                        <Text style={form.fullDay.from ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
                                            {form.fullDay.from || 'Select date'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={[styles.formGroup, { flex: 1, marginLeft: 10 }]}>
                                    <Text style={styles.label}>To Date</Text>
                                    <TouchableOpacity
                                        style={[styles.input, {
                                            justifyContent: 'center',
                                            opacity: !form.fullDay.from ? 0.6 : 1
                                        }]}
                                        onPress={() => form.fullDay.from && showDatepicker('toDate')}
                                        disabled={!form.fullDay.from}
                                    >
                                        <Text style={form.fullDay.to ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
                                            {form.fullDay.to || 'Select date'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Date Pickers - Inline */}
                        {showDatePicker.fromDate && (
                            <View style={styles.datePickerContainer}>
                                <DateTimePicker
                                    value={form.fullDay.from ? new Date(form.fullDay.from) : new Date()}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(event, date) => onDateChange(event, date, 'fromDate')}
                                    minimumDate={form.leaveType === 'Medical' ? null : new Date()}
                                />
                                {Platform.OS === 'ios' && (
                                    <Button
                                        mode="contained"
                                        onPress={() => setShowDatePicker(prev => ({ ...prev, fromDate: false }))}
                                        style={styles.doneButton}
                                    >
                                        Done
                                    </Button>
                                )}
                            </View>
                        )}

                        {showDatePicker.toDate && (
                            <View style={styles.datePickerContainer}>
                                <DateTimePicker
                                    value={form.fullDay.to ? new Date(form.fullDay.to) : new Date()}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(event, date) => onDateChange(event, date, 'toDate')}
                                    minimumDate={form.leaveType === 'Medical' ? null : new Date()}
                                />
                                {Platform.OS === 'ios' && (
                                    <Button
                                        mode="contained"
                                        onPress={() => setShowDatePicker(prev => ({ ...prev, toDate: false }))}
                                        style={styles.doneButton}
                                    >
                                        Done
                                    </Button>
                                )}
                            </View>
                        )}

                        {showDatePicker.date && (
                            <View style={styles.datePickerContainer}>
                                <DateTimePicker
                                    value={form.halfDay.date ? new Date(form.halfDay.date) : new Date()}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(event, date) => onDateChange(event, date, 'date')}
                                    minimumDate={new Date()}
                                />
                                {Platform.OS === 'ios' && (
                                    <Button
                                        mode="contained"
                                        onPress={() => setShowDatePicker(prev => ({ ...prev, date: false }))}
                                        style={styles.doneButton}
                                    >
                                        Done
                                    </Button>
                                )}
                            </View>
                        )}

                        <View style={[styles.formGroup, { marginTop: 10 }]}>
                            <Text style={styles.label}>Leave Days</Text>
                            <Text style={styles.daysText}>{calculateLeaveDays()} days</Text>
                        </View>

                        <View style={[styles.formGroup, { marginTop: 10 }]}>
                            <Text style={styles.label}>Reason</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={form.reason}
                                onChangeText={(text) => handleChange('reason', text)}
                                multiline
                                numberOfLines={4}
                                placeholder="Enter reason"
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Charge Given To</Text>
                            <TextInput
                                style={styles.input}
                                value={form.chargeGivenTo}
                                onChangeText={(text) => handleChange('chargeGivenTo', text)}
                                placeholder="Enter name"
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Emergency Contact</Text>
                            <TextInput
                                style={styles.input}
                                value={form.emergencyContact}
                                onChangeText={(text) => handleChange('emergencyContact', text)}
                                placeholder="Enter contact number"
                                keyboardType="phone-pad"
                            />
                        </View>

                        <View>
                            <TouchableOpacity
                                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                                onPress={handleSubmit}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.submitButtonText}>
                                        Submit Leave
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Card.Content>
                </Card>

                <View style={{ marginTop: 24, marginBottom: 40 }}>
                    <Text style={styles.sectionTitle}>Your Leave Records</Text>

                    {Array.isArray(leaveRecords) && leaveRecords.length === 0 ? (
                        <Text style={styles.noRecords}>No Leave records found</Text>
                    ) : (
                        <>
                            <View style={[styles.row, styles.tableHeader]}>
                                <Text style={[styles.cell, styles.headerCell, { flex: 2 }]}>Duration</Text>
                                <Text style={[styles.cell, styles.headerCell, { flex: 2 }]}>Leave Type</Text>
                                <Text style={[styles.cell, styles.headerCell, { flex: 2 }]}>Status</Text>
                                <Text style={[styles.cell, styles.headerCell, { flex: 1 }]}>Details</Text>
                            </View>
                            {Array.isArray(leaveRecords) ? (
                                [...leaveRecords].map((record) => {
                                    let fromDate = null;
                                    let toDate = null;
                                    let date = null;
                                    if (!record.halfDay) {
                                        fromDate = record.fullDay.from ? new Date(record.fullDay.from) : null;
                                        toDate = record.fullDay.to ? new Date(record.fullDay.to) : null;
                                    } else {
                                        date = record.halfDay.date ? new Date(record.halfDay.date) : null;
                                    }
                                    const leaveType = record.leaveType;
                                    const status = getFinalStatus(record.status);
                                    return (
                                        <View key={record._id} style={styles.row}>
                                            <Text style={[styles.cell, { flex: 2 }]}>
                                                {!record.halfDay ? (
                                                    fromDate && !isNaN(fromDate.getTime()) && toDate && !isNaN(toDate.getTime())
                                                        ? `${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`
                                                        : 'N/A'
                                                ) : (
                                                    date && !isNaN(date.getTime())
                                                        ? date.toLocaleDateString()
                                                        : 'N/A'
                                                )}
                                            </Text>
                                            <Text style={[styles.cell, { flex: 2 }]}>
                                                {leaveType}
                                            </Text>
                                            <View style={[styles.cell, { flex: 2 }]}>
                                                <Text
                                                    style={[
                                                        styles.statusBadge,
                                                        {
                                                            backgroundColor: getStatusColor(status) + '20',
                                                            color: getStatusColor(status),
                                                        }
                                                    ]}
                                                >
                                                    {status}
                                                </Text>
                                            </View>
                                            <View style={[styles.cell, { flex: 1 }]}>
                                                <TouchableOpacity
                                                    style={styles.actionButton}
                                                    onPress={() => {
                                                        setSelectedRecord(record);
                                                        setModalVisible(true);
                                                    }}
                                                >
                                                    <Text style={styles.actionButtonText}>View</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })
                            ) : (
                                <Text style={styles.noRecords}>Invalid Leave records data</Text>
                            )}
                        </>
                    )}
                </View>

                <Portal>
                    <Modal
                        visible={modalVisible}
                        onDismiss={() => setModalVisible(false)}
                        contentContainerStyle={styles.modalContainer}
                    >
                        {console.log('selectedRecord', selectedRecord)}
                        {selectedRecord && (
                            <ScrollView>
                                <Text style={styles.modalTitle}>Leave Request Details</Text>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Employee:</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedRecord.employee?.name || selectedRecord.name || 'N/A'}
                                    </Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Department:</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedRecord.department?.name || 'N/A'}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Designation:</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedRecord.designation || 'N/A'}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Full/Half Day:</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedRecord.halfDay ? 'Half Day' : 'Full Day'}
                                    </Text>
                                </View>
                                {selectedRecord.halfDay && (
                                    <>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Date:</Text>
                                            <Text style={styles.detailValue}>
                                                {selectedRecord.halfDay.date ? new Date(selectedRecord.halfDay.date).toLocaleDateString() : 'N/A'}
                                            </Text>
                                        </View>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Session:</Text>
                                            <Text style={styles.detailValue}>
                                                {selectedRecord.halfDay.session || 'N/A'}
                                            </Text>
                                        </View>
                                    </>
                                )}
                                {selectedRecord.fullDay && (
                                    <>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>From Date:</Text>
                                            <Text style={styles.detailValue}>
                                                {selectedRecord.fullDay.from ? new Date(selectedRecord.fullDay.from).toLocaleDateString() : 'N/A'}
                                            </Text>
                                        </View>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>To Date:</Text>
                                            <Text style={styles.detailValue}>
                                                {selectedRecord.fullDay.to ? new Date(selectedRecord.fullDay.to).toLocaleDateString() : 'N/A'}
                                            </Text>
                                        </View>
                                    </>
                                )}

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Leave Type:</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedRecord.leaveType || 'N/A'}
                                    </Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Reason:</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedRecord.reason || 'N/A'}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Charge Given To:</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedRecord.chargeGivenTo || 'N/A'}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Emergency Contact:</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedRecord.emergencyContact || 'N/A'}
                                    </Text>
                                </View>
                                <View style={{ marginTop: 16 }}>
                                    <Text style={[styles.detailLabel, { marginBottom: 8 }]}>Approval Status:</Text>

                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>• HOD:</Text>
                                        <Text style={[
                                            styles.detailValue,
                                            {
                                                color: selectedRecord.status?.hod === 'Approved' ? '#10b981' :
                                                    selectedRecord.status?.hod === 'Rejected' ? '#ef4444' : '#64748b'
                                            }
                                        ]}>
                                            {selectedRecord.status?.hod || 'Pending'}
                                        </Text>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>• CEO:</Text>
                                        <Text style={[
                                            styles.detailValue,
                                            {
                                                color: selectedRecord.status?.ceo === 'Approved' ? '#10b981' :
                                                    selectedRecord.status?.ceo === 'Rejected' ? '#ef4444' : '#64748b'
                                            }
                                        ]}>
                                            {selectedRecord.status?.ceo || 'Pending'}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ ...styles.detailRow, marginTop: 16 }}>
                                    <Text style={styles.detailLabel}>Remarks:</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedRecord.remarks || selectedRecord.status?.remarks || 'N/A'}
                                    </Text>
                                </View>
                                <Button
                                    mode="contained"
                                    onPress={() => setModalVisible(false)}
                                    style={{ marginTop: 24, backgroundColor: '#2563eb' }}
                                >
                                    Close
                                </Button>
                            </ScrollView>
                        )}
                    </Modal>
                </Portal>
            </ScrollView>
        </PaperProvider>
    );
}

const styles = StyleSheet.create({
    dropdownButton: {
        borderWidth: 1,
        borderColor: '#9ca3af',
        borderRadius: 6,
        padding: 12,
        marginTop: 6,
        backgroundColor: 'white',
        justifyContent: 'center',
        height: 46,
    },
    dropdownButtonText: {
        color: '#1f2937',
        fontSize: 16,
    },
    dropdownButtonPlaceholder: {
        color: '#9ca3af',
        fontSize: 16,
    },
    dropdownItemText: {
        fontSize: 16,
        color: '#1f2937',
    },
    disabledButton: {
        backgroundColor: '#f3f4f6',
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
        marginBottom: 15,
        backgroundColor: '#fff',
    },
    picker: {
        width: '100%',
        height: Platform.OS === 'ios' ? 150 : 50,
    },
    pickerItem: {
        fontSize: 16,
        color: '#000',
    },
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 15,
    },
    card: {
        marginBottom: 20,
        borderRadius: 10,
        elevation: 3,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: '#333',
    },
    formGroup: {
        marginBottom: 15,
    },
    label: {
        fontSize: 14,
        marginBottom: 5,
        color: '#555',
        fontWeight: '500',
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#9ca3af',
        borderRadius: 5,
        padding: 12,
        fontSize: 16,
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    datePickerContainer: {
        marginTop: 10,
        marginBottom: 15,
        backgroundColor: '#ffffff',
        borderRadius: 5,
        padding: 10,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    doneButton: {
        marginTop: 10,
        backgroundColor: '#2563eb',
    },
    durationContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 5,
    },
    durationButton: {
        flex: 1,
        padding: 12,
        borderWidth: 1,
        borderColor: '#9ca3af',
        borderRadius: 5,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    activeDuration: {
        backgroundColor: '#1e88e5',
        borderColor: '#1976d2',
    },
    activeText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    inactiveText: {
        color: '#666',
    },
    halfDayContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    fullDayContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    compensatorySection: {
        marginVertical: 10,
        padding: 10,
        backgroundColor: '#f8f9fa',
        borderRadius: 5,
    },
    balanceText: {
        fontSize: 16,
        color: '#1976d2',
        fontWeight: 'bold',
    },
    daysText: {
        fontSize: 16,
        color: '#28a745',
        fontWeight: 'bold',
    },
    submitButton: {
        backgroundColor: '#1e88e5',
        padding: 15,
        borderRadius: 5,
        alignItems: 'center',
        marginTop: 20,
    },
    submitButtonDisabled: {
        backgroundColor: '#90caf9',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 24,
        marginBottom: 16,
        color: '#1e40af',
    },
    tableHeader: {
        backgroundColor: '#f1f5f9',
        flexDirection: 'row',
        padding: 12,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    headerCell: {
        fontWeight: 'bold',
        color: '#334155',
        fontSize: 14,
    },
    row: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        alignItems: 'center',
    },
    cell: {
        paddingHorizontal: 4,
    },
    actionButton: {
        padding: 6,
        borderRadius: 4,
        backgroundColor: '#3b82f6',
        alignSelf: 'flex-start',
    },
    actionButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '500',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
        fontSize: 12,
        fontWeight: '500',
    },
    modalContainer: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 20,
        maxHeight: '80%',
        justifyContent: 'center',
        flex: 1,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#1e40af',
        textAlign: 'center',
    },
    detailRow: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-start',
    },
    detailLabel: {
        width: 140,
        fontWeight: '600',
        color: '#475569',
        fontSize: 14,
    },
    detailValue: {
        flex: 1,
        fontSize: 14,
        color: '#1e293b',
    },
    noRecords: {
        textAlign: 'center',
        color: '#64748b',
        marginTop: 16,
        fontStyle: 'italic',
    },
});

export default LeaveForm;
