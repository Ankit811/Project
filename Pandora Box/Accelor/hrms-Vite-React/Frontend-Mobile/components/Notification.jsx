import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    Platform,
    StatusBar
} from 'react-native';
import { Bell, X } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const Notification = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);


    const fetchNotifications = async () => {
        if (!user?.token) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await api.get('/notifications');
            setNotifications(response.data);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            setError('Failed to load notifications');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen, user?.token]);



    const markAllAsRead = async () => {
      if (unreadCount === 0) return;

      try {
          await api.put('/notifications/mark-all-as-read');
          setNotifications(notifications.map(n => ({ ...n, read: true })));
      } catch (err) {
          console.error('Error marking all notifications as read:', err);
      }
  };

  const handleIconPress = () => {
    setIsOpen(true);
    if (!isOpen) {
        fetchNotifications();
        markAllAsRead();
    }
};

const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <View style={styles.container}>
          <TouchableOpacity 
            onPress={handleIconPress}
            style={styles.notificationButton}
            accessibilityLabel="Notifications"
          >
            <View style={styles.bellContainer}>
              <Bell size={24} color="#4B5563" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
    
          <Modal
            visible={isOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setIsOpen(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Notifications</Text>
                  <TouchableOpacity 
                    onPress={() => setIsOpen(false)}
                    style={styles.closeButton}
                  >
                    <X size={24} color="#4B5563" />
                  </TouchableOpacity>
                </View>
                
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <Text>Loading...</Text>
                  </View>
                ) : error ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity 
                      onPress={fetchNotifications}
                      style={styles.retryButton}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : notifications.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No notifications</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.notificationsList}>
                    {notifications.map((notification) => (
                      <View
                        key={notification._id}
                        style={[
                          styles.notificationItem,
                          !notification.read && styles.unreadNotification
                        ]}
                      >
                        <Text style={styles.notificationMessage}>
                          {notification.message}
                        </Text>
                        <Text style={styles.notificationTime}>
                          {new Date(notification.createdAt).toLocaleString()}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>
        </View>
      );
    };
    
    const styles = StyleSheet.create({
      container: {
        marginRight: 10,
      },
      notificationButton: {
        padding: 8,
        position: 'relative',
      },
      bellContainer: {
        position: 'relative',
      },
      badge: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
      },
      badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
      },
      modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
      },
      modalContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        paddingTop: 10,
        paddingBottom: Platform.OS === 'ios' ? 30 : 20,
      },
      modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
      },
      modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
      },
      closeButton: {
        padding: 5,
      },
      loadingContainer: {
        padding: 20,
        alignItems: 'center',
      },
      errorContainer: {
        padding: 20,
        alignItems: 'center',
      },
      errorText: {
        color: '#EF4444',
        marginBottom: 10,
      },
      retryButton: {
        padding: 10,
        backgroundColor: '#F3F4F6',
        borderRadius: 5,
      },
      retryButtonText: {
        color: '#4B5563',
      },
      emptyContainer: {
        padding: 20,
        alignItems: 'center',
      },
      emptyText: {
        color: '#6B7280',
      },
      notificationsList: {
        maxHeight: '100%',
      },
      notificationItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
      },
      unreadNotification: {
        backgroundColor: '#F9FAFB',
      },
      notificationMessage: {
        fontSize: 14,
        color: '#111827',
        marginBottom: 4,
      },
      notificationTime: {
        fontSize: 12,
        color: '#6B7280',
      },
    });
    
    export default Notification;