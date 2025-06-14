// components/EmploymentDetailsSection.jsx
import React from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const EmploymentDetailsSection = ({ profile, errors, onChange, isLocked }) => {
  const [isPickerVisible, setPickerVisible] = React.useState(false);
  
  const employeeTypes = [
    { label: 'Select', value: '' },
    { label: 'Intern', value: 'Intern' },
    { label: 'Probation', value: 'Probation' },
    { label: 'Confirmed', value: 'Confirmed' },
    { label: 'Contractual', value: 'Contractual' },
  ];
  
  const selectedType = employeeTypes.find(type => type.value === profile.employeeType) || employeeTypes[0];
  const handleField = (label, name, keyboardType = 'default', placeholder = '') => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, errors[name] && styles.inputError]}
        value={profile[name]}
        onChangeText={(text) => onChange(name, text)}
        editable={!isLocked}
        keyboardType={keyboardType}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
      />
      {errors[name] && <Text style={styles.errorText}>{errors[name]}</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        scrollEnabled={true}
        bounces={true}
        showsVerticalScrollIndicator={true}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employment Details</Text>

          {handleField('Reporting Manager', 'reportingManager.name')}
          {handleField('Designation', 'designation')}
          {handleField('Date of Resigning', 'dateOfResigning', 'default', 'YYYY-MM-DD')}
          {handleField('Department', 'department')}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Employee Type</Text>
            <TouchableOpacity 
              style={[styles.dropdownContainer, errors.employeeType && styles.inputError]}
              onPress={() => !isLocked && setPickerVisible(true)}
              disabled={isLocked}
            >
              <Text style={styles.dropdownText}>
                {selectedType.label}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={24} color="#666" />
            </TouchableOpacity>
            {errors.employeeType && <Text style={styles.errorText}>{errors.employeeType}</Text>}
            
            <Modal
              visible={isPickerVisible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setPickerVisible(false)}
            >
              <TouchableWithoutFeedback onPress={() => setPickerVisible(false)}>
                <View style={styles.modalOverlay} />
              </TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                {employeeTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={styles.option}
                    onPress={() => {
                      onChange('employeeType', type.value);
                      setPickerVisible(false);
                    }}
                  >
                    <Text style={[
                      styles.optionText,
                      type.value === profile.employeeType && styles.selectedOption
                    ]}>
                      {type.label}
                    </Text>
                    {type.value === profile.employeeType && (
                      <MaterialIcons name="check" size={20} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </Modal>
          </View>

          {profile.employeeType === 'Probation' && (
            <>
              {handleField('Probation Period (Months)', 'probationPeriod', 'numeric')}
              {handleField('Confirmation Date', 'confirmationDate', 'default', 'YYYY-MM-DD')}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    marginBottom: 5,
    backgroundColor: '#fff',
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 10,
    padding: 10,
    maxHeight: 300,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedOption: {
    color: '#007AFF',
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80, // Extra space for the save button
  },
  section: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    color: '#444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    backgroundColor: '#f9f9f9',
  },
  inputError: {
    borderColor: 'red',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    backgroundColor: '#f9f9f9',
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
  },
});

export default EmploymentDetailsSection;
