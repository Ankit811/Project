import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    FlatList,
    TextInput,
    Alert,
    Platform,
    PermissionsAndroid,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Button, Card } from 'react-native-paper';
import { Button as RNButton } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
// import * as FileSystem from 'expo-file-system';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

function Attendance() {
    const { user } = useContext(AuthContext);
    const [attendance, setAttendance] = useState([]);
        const [filters, setFilters] = useState({
        employeeId: '',
        departmentId: user?.department?._id || '',
        fromDate: new Date().toISOString().split('T')[0],
        toDate: new Date().toISOString().split('T')[0],
        status: 'all',
    });
    const [employeeFilter, setEmployeeFilter] = useState(''); // For HOD to filter by employee ID
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [showDatePicker, setShowDatePicker] = useState({ from: false, to: false });

    useEffect(() => {
        // Set employee ID for non-HOD users
        if (user?.loginType !== 'HOD' && user?.employeeId) {
            setFilters(prev => ({ ...prev, employeeId: user.employeeId }));
        }
        // Only fetch departments for HOD users
        if (user?.loginType === 'HOD') {
            if (user?.department) {
                setDepartments([{ _id: user.department._id, name: user.department.name }]);
                setFilters(prev => ({ ...prev, departmentId: user.department._id }));
            } else {
                fetchDepartments();
            }
        }
        fetchAttendance();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    useEffect(() => {
        if (user?.department?._id && !employeeFilter) {
            setFilters(prev => ({
                ...prev,
                departmentId: user.department._id
            }));
        }
    }, [user?.department?._id, employeeFilter]);

    const fetchDepartments = async () => {
        try {
            const res = await api.get('/departments');
            setDepartments(res.data);
        } catch (err) {
            if (err.response?.status === 403) {
                console.log('User does not have permission to view departments');
                setDepartments([]); // Set empty array if no permission
            } else {
                console.error('Error fetching departments:', err);
                setError('Failed to load departments');
            }
        }
    };

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const params = {
                fromDate: filters.fromDate || '',
                toDate: filters.toDate || '',
                status: filters.status !== 'all' ? filters.status : undefined,
            };

            // For HOD users
            if (user?.loginType === 'HOD') {
                // If employee filter is provided, use it
                if (employeeFilter) {
                    params.employeeId = employeeFilter;
                    delete params.departmentId; // No need for department filter when specific employee is selected
                } else {
                    // Otherwise, show all department records
                    params.departmentId = user?.department?._id || filters.departmentId;
                }
            } 
            // For non-HOD users, only fetch their own attendance
            else if (user?.employeeId) {
                params.employeeId = user.employeeId;
            } else {
                setError('User ID not available');
                setLoading(false);
                return;
            }

            console.log('Fetching attendance with params:', params);
            const res = await api.get('/attendance', { params });
            setAttendance(res.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching attendance:', err);
            if (err.response?.status === 403) {
                setError('You do not have permission to view attendance records');
            } else {
                setError('Failed to load attendance data');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (event, selectedDate, field) => {
        // On Android, we need to check the event type first
        if (Platform.OS === 'android') {
            // Hide the date picker immediately on Android
            setShowDatePicker({ from: false, to: false });

            // If user cancels the picker, don't update the date
            if (event.type === 'dismissed' || !selectedDate) {
                return;
            }
            
            // Format the date as YYYY-MM-DD for consistency
            const formattedDate = selectedDate.toISOString().split('T')[0];
            
            // Create an update object with the new date
            const update = { [field]: formattedDate };
            
            // If we're setting the fromDate and toDate is empty, set toDate to the same date
            if (field === 'fromDate' && !filters.toDate) {
                update.toDate = formattedDate;
            }
            
            // Update the state once with all changes
            setFilters(prev => ({
                ...prev,
                ...update
            }));
            return;
        }
        
        // For iOS, use the existing logic
        const formattedDate = selectedDate.toISOString().split('T')[0];
        
        // Create an update object with the new date
        const update = { [field]: formattedDate };
        
        // If we're setting the fromDate and toDate is empty, set toDate to the same date
        if (field === 'fromDate' && !filters.toDate) {
            update.toDate = formattedDate;
        }
        
        // Update the state once with all changes
        setFilters(prev => ({
            ...prev,
            ...update
        }));
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
        setCurrentPage(1); // Reset to first page when applying new filters
    };

    // Calculate pagination
    const totalPages = Math.ceil(attendance.length / itemsPerPage);
    const paginatedAttendance = attendance.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const formatTime = (minutes) => {
        if (!minutes) return '00:00';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const renderItem = ({ item }) => (
        <Card style={styles.card}>
            <Card.Content>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text>Employee ID: {item.employeeId}</Text>
                <Text>Date: {new Date(item.logDate).toLocaleDateString()}</Text>
                <Text>Time In: {item.timeIn || '-'}</Text>
                <Text>Time Out: {item.timeOut || '-'}</Text>
                <Text>Status: {item.status}{item.halfDay ? ` (${item.halfDay})` : ''}</Text>
                <Text>OT: {formatTime(item.ot)}</Text>
            </Card.Content>
        </Card>
    );

    const hodDepartmentName = user?.loginType === 'HOD' && user?.department
        ? departments.find(dep => dep._id === user.department._id)?.name || 'Unknown'
        : '';

    return (
        <View style={styles.container}>
            <FlatList
                data={paginatedAttendance}
                renderItem={renderItem}
                keyExtractor={(item, index) => item._id ? item._id : `${item.employeeId}-${item.logDate}-${index}`}
                contentContainerStyle={styles.list}
                ListHeaderComponent={
                    <View style={styles.filterContainer}>
                        {user?.loginType === 'HOD' && (
                            <View style={styles.filterRow}>
                                <View style={styles.employeeFilterContainer}>
                                    <Text style={styles.filterLabel}>Employee ID:</Text>
                                    <TextInput
                                        style={styles.employeeInput}
                                        placeholder="Filter by Employee ID"
                                        value={employeeFilter}
                                        onChangeText={setEmployeeFilter}
                                        onSubmitEditing={fetchAttendance}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>
                        )}
                        {user?.loginType === 'HOD' && (
                            <View style={styles.filterRow2}>
                                <Text style={[styles.filterLabel, { paddingTop: 10 }]}>Department:</Text>
                                <Text style={styles.departmentText}>
                                    {user?.department?.name || 'N/A'}
                                </Text>
                            </View>
                        )}
                        <View style={styles.dateInputsContainer}>
                            <View style={styles.dateInputsContainer}>
                                <TouchableOpacity
                                    style={styles.dateInput}
                                    onPress={() => setShowDatePicker({ from: true, to: false })}
                                >
                                    <Text>From: {filters.fromDate}</Text>
                                </TouchableOpacity>
                                {(showDatePicker.from) && (
                                    <View><DateTimePicker
                                        value={new Date(filters.fromDate || new Date())}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={(event, date) => handleDateChange(event, date, 'fromDate')}
                                    />
                                        {Platform.OS === 'ios' && (
                                            <Button
                                                mode="contained"
                                                onPress={() => setShowDatePicker(prev => ({ ...prev, from: false }))}
                                                style={styles.doneButton}
                                            >
                                                Done
                                            </Button>)}</View>
                                )}
                            </View>

                            <View style={styles.dateInputsContainer}>
                                <TouchableOpacity
                                    style={styles.dateInput}
                                    onPress={() => setShowDatePicker({ from: false, to: true })}
                                >
                                    <Text>To: {filters.toDate}</Text>
                                </TouchableOpacity>
                                {(showDatePicker.to) && (
                                    <View><DateTimePicker
                                        value={new Date(filters.toDate || new Date())}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={(event, date) => handleDateChange(event, date, 'toDate')}
                                    />
                                        {Platform.OS === 'ios' && (
                                            <Button
                                                mode="contained"
                                                onPress={() => setShowDatePicker(prev => ({ ...prev, to: false }))}
                                                style={styles.doneButton}
                                            >
                                                Done
                                            </Button>)}
                                    </View>
                                )}
                            </View>
                        </View>

                        <Button
                            mode="contained"
                            onPress={handleFilter}
                            style={styles.filterButton}
                        >
                            Apply Filters
                        </Button>
                    </View>
                }
                ListFooterComponent={
                    < View style={styles.pagination} >
                        <View style={styles.individual}><RNButton
                            title="Previous"
                            onPress={handlePreviousPage}
                            disabled={currentPage === 1}
                        /></View><View style={styles.individual2}>
                            <Text>Page {currentPage} of {totalPages || 1}</Text></View>
                        <View style={styles.individua}><RNButton
                            title="Next"
                            onPress={handleNextPage}
                            disabled={currentPage >= totalPages}
                        /></View>
                    </View >
                }
                ListEmptyComponent={
                    loading ? (
                        <ActivityIndicator size="large" style={styles.loader} />
                    ) : error ? (
                        <Text style={styles.error}>{error}</Text>
                    ) : (
                        <Text style={styles.noData}>No attendance records found.</Text>
                    )
                }
                style={{ flex: 1 }}
                scrollEnabled={true}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    list: {
        flexGrow: 1,
        padding: 16,
    },
    filterContainer: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
    },
    input: {
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 4,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 4,
        marginBottom: 12,
        backgroundColor: 'white',
    },
    picker: {
        height: 50,
    },
    dateInputsContainer: {
        marginBottom: 12,
    },
    dateInput: {
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#ddd',
        marginBottom: 8,
    },
    filterRow2: {
        flexDirection: 'row',
        marginTop: -5,
        justifyContent: 'space-between',
        marginBottom: 8,

    },
    employeeFilterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    filterLabel: {
        marginRight: 8,
        minWidth: 100,
        fontWeight: 'bold',
        paddingLeft: 10,
    },
    departmentText: {
        flex: 1,
        padding: 10,
        backgroundColor: 'white',
        borderRadius: 4,

    },
    employeeInput: {
        flex: 1,
        backgroundColor: 'white',
        padding: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 4,
        marginRight: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    applyButton: {
        marginLeft: 8,
    },
    filterButton: {
        marginTop: 8,
    },
    card: {
        marginBottom: 16,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    loader: {
        margin: 20,
    },
    error: {
        color: 'red',
        textAlign: 'center',
        margin: 20,
    },
    noData: {
        textAlign: 'center',
        margin: 20,
        color: '#666',
    },
    dateInput: {
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 4,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    userInfo: {
        backgroundColor: '#e3f2fd',
        padding: 12,
        borderRadius: 4,
        marginBottom: 12,
    },
    userInfoText: {
        color: '#1976d2',
        textAlign: 'center',
        fontWeight: '500',
    },
    filterButton: {
        marginTop: 8,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    error: {
        color: 'red',
        textAlign: 'center',
        marginTop: 20,
        padding: 16,
    },
    noData: {
        textAlign: 'center',
        marginTop: 20,
        color: '#666',
        padding: 16,
    },
    loader: {
        marginVertical: 20,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 16,
        padding: 16,
        backgroundColor: 'white',
        borderRadius: 8,
    },
    warning: {
        color: 'orange',
        textAlign: 'center',
        marginVertical: 8,
        fontStyle: 'italic',
        padding: 8,
    },
    individual2: {
        flex: 1,
        alignItems: 'center',
        marginLeft: -15,
    },
});

export default Attendance;