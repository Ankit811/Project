import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import {API_URL} from '@env';

// Create an axios instance with a base URL
const api = axios.create({
    baseURL: API_URL, // e.g., http://10.0.2.2:3000/api
    headers: {
      'Content-Type': 'application/json',
    },
  });

// Request interceptor to add the Authorization header
api.interceptors.request.use(
    async (config) => {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  
// Utility function to fetch a file as a blob
export const fetchFileAsBlob = async (fileId) => {
    try {
      const response = await api.get(`/employees/files/${fileId}`, {
        responseType: 'arraybuffer', // Use 'arraybuffer' for React Native
      });
      console.log('File response:', response);
  
      // Convert the arraybuffer to a base64 string for React Native compatibility
      const base64 = Buffer.from(response.data, 'binary').toString('base64');
      return { base64, contentType: response.headers['content-type'] };
    } catch (error) {
      console.error(`Error fetching file ${fileId}:`, error.response?.data || error.message);
      Alert.alert('Error', `Failed to fetch file: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  };
  
  export default api;