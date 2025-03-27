import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import NotificationService from '../services/NotificationService';

// Create context
const NotificationContext = createContext();

// Custom hook to use the notification context
export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('default');
  
  // Initialize notifications
  useEffect(() => {
    const initializeNotifications = async () => {
      if (!user) return;
      
      try {
        // Register service worker for notifications
        const registered = await NotificationService.registerDevice();
        setIsInitialized(registered.success);
        
        // Get notification permission status
        setPermissionStatus(Notification.permission);
        
        // Load user's notification settings
        const settings = await NotificationService.getSettings();
        
        // Get unread notifications count
        if (settings.success && settings.data.notifications_enabled) {
          await fetchUnreadNotifications();
        }
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };
    
    initializeNotifications();
    
    // Listen for push message events from service worker
    const handlePushMessage = (event) => {
      if (event.data && event.data.type === 'notification') {
        addNotification(event.data.notification);
      }
    };
    
    navigator.serviceWorker.addEventListener('message', handlePushMessage);
    
    return () => {
      navigator.serviceWorker.removeEventListener('message', handlePushMessage);
    };
  }, [user]);
  
  // Fetch unread notifications
  const fetchUnreadNotifications = async () => {
    try {
      if (!user) return;
      
      // In a real app, you would fetch from your backend
      // For this demo, we'll use a simple mock
      const { data: unreadData } = await fetch('/api/notifications/unread')
        .then(res => res.json())
        .catch(() => ({ 
          data: [
            {
              id: 'mock-notif-1',
              title: 'New message',
              body: 'You have a new message from Jane',
              timestamp: new Date().toISOString(),
              read: false,
              type: 'message',
              data: { conversationId: '123', senderId: '456' }
            }
          ] 
        }));
      
      if (unreadData) {
        setNotifications(prev => {
          // Merge with existing notifications, avoiding duplicates
          const existing = new Set(prev.map(n => n.id));
          const newItems = unreadData.filter(n => !existing.has(n.id));
          return [...prev, ...newItems];
        });
        
        setUnreadCount(unreadData.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
    }
  };
  
  // Add a new notification
  const addNotification = (notification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
    
    // Show system notification if app is in background
    if (document.visibilityState === 'hidden') {
      NotificationService.showLocalNotification(notification);
    }
  };
  
  // Mark a notification as read
  const markAsRead = async (notificationId) => {
    try {
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // In a real app, you would update this on the server
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST'
      }).catch(() => {
        // Mock implementation
        console.log(`Marked notification ${notificationId} as read`);
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
      
      // Reset unread count
      setUnreadCount(0);
      
      // In a real app, you would update this on the server
      await fetch('/api/notifications/read-all', {
        method: 'POST'
      }).catch(() => {
        // Mock implementation
        console.log('Marked all notifications as read');
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };
  
  // Remove a notification
  const removeNotification = async (notificationId) => {
    try {
      // Check if the notification is unread
      const isUnread = notifications.find(n => n.id === notificationId && !n.read);
      
      // Update local state
      setNotifications(prev => 
        prev.filter(n => n.id !== notificationId)
      );
      
      // Update unread count if needed
      if (isUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      // In a real app, you would update this on the server
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE'
      }).catch(() => {
        // Mock implementation
        console.log(`Removed notification ${notificationId}`);
      });
    } catch (error) {
      console.error('Error removing notification:', error);
    }
  };
  
  // Clear all notifications
  const clearAllNotifications = async () => {
    try {
      // Update local state
      setNotifications([]);
      setUnreadCount(0);
      
      // In a real app, you would update this on the server
      await fetch('/api/notifications/clear', {
        method: 'DELETE'
      }).catch(() => {
        // Mock implementation
        console.log('Cleared all notifications');
      });
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };
  
  // Request notification permission
  const requestPermission = async () => {
    try {
      if (!('Notification' in window)) {
        alert('This browser does not support notifications');
        return false;
      }
      
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      
      if (permission === 'granted') {
        const result = await NotificationService.registerDevice();
        setIsInitialized(result.success);
        return result.success;
      }
      
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };
  
  // Update notification settings
  const updateSettings = async (settings) => {
    try {
      const result = await NotificationService.updateSettings(settings);
      return result.success;
    } catch (error) {
      console.error('Error updating notification settings:', error);
      return false;
    }
  };
  
  // Context value
  const value = {
    notifications,
    unreadCount,
    isInitialized,
    permissionStatus,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
    requestPermission,
    updateSettings,
    fetchUnreadNotifications
  };
  
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;