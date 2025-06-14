import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet, Text, Button } from 'react-native';
import { AuthProvider, AuthContext } from './context/AuthContext.jsx';
import LoginScreen from './screens/LoginScreen.jsx';
import EmployeeScreen from './screens/Employee.jsx';
import HODDashboard from './screens/HODDashboard.jsx';

const Stack = createNativeStackNavigator();

const AppContent = () => {
  const { user, loading, error } = React.useContext(AuthContext);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#6b21a8" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error.message}</Text>
        <Button title="Try Again" onPress={() => window.location.reload()} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!user ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              headerShown: true,
              headerTitle: 'Login',
              headerStyle: { backgroundColor: '#6b21a8' },
              headerTintColor: '#fff'
            }}
          />
        ) :
          user.loginType === 'HOD' ? (
            <Stack.Screen
              name="HOD"
              component={HODDashboard}
              options={{
                headerShown: true,
                headerTitle: 'HOD Dashboard',
                headerStyle: { backgroundColor: '#6b21a8' },
                headerTintColor: '#fff'
              }}
            />
          ) : (
            <Stack.Screen
              name="Employee"
              component={EmployeeScreen}
              options={{
                headerShown: true,
                headerTitle: 'Employee Dashboard',
                headerStyle: { backgroundColor: '#6b21a8' },
                headerTintColor: '#fff'
              }}
            />
          )
        }
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#6b21a8',
    fontSize: 16,
  }
});

// Initialize token refresh when app starts
// setupTokenRefresh();
