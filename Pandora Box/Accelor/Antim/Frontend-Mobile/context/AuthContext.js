import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { jwtDecode } from 'jwt-decode';
import api from '../services/api.js';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const isTokenExpired = (token) => {
    try {
      const decoded = jwtDecode(token);
      return decoded.exp * 1000 < Date.now();
    }
    catch (err) {
      Alert.alert('Error', 'Failed to check authentication status');
    }
  };


  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token && !isTokenExpired(token)) {
        api.defaults.headers.Authorization = `Bearer ${token}`;
        setUser(jwtDecode(token));
      } else {
        await AsyncStorage.removeItem('token');
      }
    } catch (error) {
      console.error('checkAuthStatus error:', error);
      Alert.alert('Error', 'Failed to check authentication status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      await AsyncStorage.setItem('token', token);
      api.defaults.headers.Authorization = `Bearer ${token}`;
      setUser(user);
      return user;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      console.error('Login error:', errorMessage);
      Alert.alert('Error', errorMessage);
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      delete api.defaults.headers.Authorization;
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to clear session');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
