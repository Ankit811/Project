import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet, AppRegistry } from 'react-native';
import { AuthProvider, AuthContext } from './context/AuthContext.js';
import LoginScreen from './screens/LoginScreen.jsx';
import EmployeeDashboard from './screens/EmployeeDashboard.jsx';
import HODDashboard from './screens/HODDashboard.jsx';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Stack = createNativeStackNavigator();


const AppNavigator = () => {
  const { user, loading, error } = useContext(AuthContext);
  
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error.message}</Text>
        <Button title="Try Again" onPress={() => window.location.reload()} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#6b21a8" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
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
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user?.loginType === 'HOD' ? (
          <Stack.Screen 
            name="HODDashboard" 
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
            name="EmployeeDashboard" 
            component={EmployeeDashboard} 
            options={{
              headerShown: true,
              headerTitle: 'Employee Dashboard',
              headerStyle: { backgroundColor: '#6b21a8' },
              headerTintColor: '#fff'
            }}
          />
        )};
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
};


// Register the app
AppRegistry.registerComponent('main', () => App);

export default App;

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
setupTokenRefresh();
