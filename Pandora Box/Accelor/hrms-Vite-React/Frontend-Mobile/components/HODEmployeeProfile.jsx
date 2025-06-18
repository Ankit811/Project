import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import BasicInfoSection from './BasicInfoSection';
import EmploymentDetailsSection from './EmploymentDetailsSection';
import BankDetailsSection from './BankDetailsSection';
import StatutoryDetailsSection from './StatutoryDetailsSection';
import DocumentUploadSection from './DocumentUploadSection';
import { useImagePicker } from '../Hooks/ImagePicker';

const Tab = createMaterialTopTabNavigator();

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useContext(AuthContext);

  const [profile, setProfile] = useState(null);
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [fileErrors, setFileErrors] = useState({});
  const [isLocked, setIsLocked] = useState(false);

  const employeeId = route.params?.employeeId || user?.id;
  const { handleImagePick } = useImagePicker({ setProfile, setFiles });

  const fetchProfile = useCallback(async () => {
    if (!employeeId) {
      navigation?.navigate('Login');
      return;
    }

    try {
      const res = await api.get(`/employees/${employeeId}`);
      setProfile({ ...res.data, statutoryDetails: res.data.statutoryDetails || {} });
      setIsLocked(res.data.locked || false);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  }, [employeeId, navigation]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setProfile(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setProfile(prev => ({ ...prev, [field]: value }));
    }
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleSubmit = async () => {
    if (isLocked) {
      Alert.alert('Locked', 'Profile is locked. Contact admin.');
      return;
    }

    const requiredFields = [
      'name', 'mobileNumber', 'dateOfBirth', 'fatherName', 'motherName',
      'permanentAddress', 'currentAddress', 'email', 'aadharNumber',
      'bloodGroup', 'gender', 'maritalStatus', 'emergencyContactName',
      'emergencyContactNumber', 'dateOfJoining', 'status'
    ];

    const newErrors = {};
    requiredFields.forEach(field => {
      const value = profile[field];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        const fieldName = field.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase());
        newErrors[field] = `${fieldName} is required`;
      }
    });

    if (profile.maritalStatus === 'Married' && !profile.spouseName?.trim()) {
      newErrors.spouseName = 'Spouse name is required when married';
    }

    if (profile.status === 'Resigned' && !profile.dateOfResigning?.trim()) {
      newErrors.dateOfResigning = 'Date of resigning is required';
    }

    if (profile.status === 'Working') {
      if (!profile.employeeType?.trim()) {
        newErrors.employeeType = 'Employee type is required';
      } else if (profile.employeeType === 'Probation') {
        if (!profile.probationPeriod) {
          newErrors.probationPeriod = 'Probation period is required';
        }
        if (!profile.confirmationDate) {
          newErrors.confirmationDate = 'Confirmation date is required';
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Alert.alert('Validation Error', 'Please fix the errors in the form.');
      return;
    }

    const formData = new FormData();
    Object.entries(profile).forEach(([key, value]) => {
      formData.append(key, typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
    });

    Object.entries(files).forEach(([key, file]) => {
      if (file) {
        formData.append(key, {
          uri: file.uri,
          type: file.mimeType || 'image/jpeg',
          name: file.name || `file-${Date.now()}`
        });
      }
    });

    try {
      const res = await api.put(`/employees/${user.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      Alert.alert('Success', res.data.message || 'Profile updated successfully');
    } catch (err) {
      console.error('Profile update error:', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to update profile');
      if (err.response?.data?.errors) {
        setErrors(prev => ({ ...prev, ...err.response.data.errors }));
      }
    }
  };

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;
  if (!profile) return null;

  const commonProps = {
    profile,
    setProfile,
    handleChange,
    errors,
    setErrors,
    isLocked,
  };

  return (
    <>
      {/* <View style={styles.header}>
        <Text style={styles.headerTitle}>Employee Profile</Text>
      </View> */}

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <Tab.Navigator
          screenOptions={{
            tabBarLabelStyle: { fontSize: 12 },
            tabBarItemStyle: { height: 50 },
            tabBarStyle: { backgroundColor: '#fff' },
            tabBarActiveTintColor: '#4CAF50',
            tabBarInactiveTintColor: '#666',
            tabBarIndicatorStyle: { backgroundColor: '#4CAF50' },
            swipeEnabled: true,
          }}
        >
          <Tab.Screen name="Basic Info">
            {() => <BasicInfoSection {...commonProps} onImagePick={handleImagePick} />}
          </Tab.Screen>
          <Tab.Screen name="Employment">
            {() => <EmploymentDetailsSection {...commonProps} />}
          </Tab.Screen>
          <Tab.Screen name="Bank">
            {() => <BankDetailsSection {...commonProps} />}
          </Tab.Screen>
          <Tab.Screen name="Statutory">
            {() => <StatutoryDetailsSection {...commonProps} />}
          </Tab.Screen>
          <Tab.Screen name="Documents">
            {() => (
              <DocumentUploadSection
                {...commonProps}
                files={files}
                setFiles={setFiles}
                fileErrors={fileErrors}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>

        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, isLocked && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={isLocked}
          >
            <Text style={styles.saveButtonText}>
              {isLocked ? 'Profile is locked' : 'Save Profile'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6b21a8',
    marginLeft: 10,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  saveButtonContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    padding: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
});

export default ProfileScreen;
