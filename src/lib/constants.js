// constants.js - Application-wide constants

// App information
export const APP_NAME = 'SecureChat';
export const APP_VERSION = '1.0.0';
export const APP_WEBSITE = 'https://securechat.example.com';

// File limits
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const ACCEPTABLE_FILE_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  
  // Video
  'video/mp4',
  'video/webm',
  'video/ogg',
  
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip'
];

// Timeout values
export const TYPING_INDICATOR_TIMEOUT = 3000; // 3 seconds
export const MESSAGE_FETCH_LIMIT = 30;
export const PRESENCE_TIMEOUT = 60 * 1000; // 1 minute

// Encryption constants
export const KEY_ALGORITHM = 'RSA-OAEP';
export const KEY_LENGTH = 4096;
export const HASH_ALGORITHM = 'SHA-256';

// Theme constants
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  CHAT: '/chat',
  CHAT_DETAIL: '/chat/:id',
  CONTACTS: '/contacts',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  ADMIN: '/admin',
  NOT_FOUND: '*'
};

// Local storage keys
export const STORAGE_KEYS = {
  THEME: 'theme',
  AUTH_TOKEN: 'authToken',
  USER_DATA: 'userData',
  ANALYTICS_ENABLED: 'analytics_enabled'
};

// API routes and endpoints
export const API = {
  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh'
  },
  MESSAGES: {
    GET: '/messages',
    SEND: '/messages/send',
    DELETE: '/messages/delete'
  },
  FILES: {
    UPLOAD: '/files/upload',
    DOWNLOAD: '/files/download'
  }
};

// Error messages
export const ERROR_MESSAGES = {
  GENERIC: 'Something went wrong. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password.',
    EMAIL_EXISTS: 'Email is already registered.',
    USERNAME_EXISTS: 'Username is already taken.',
    WEAK_PASSWORD: 'Password is too weak. It should be at least 8 characters with numbers and letters.',
    UNAUTHORIZED: 'You must be logged in to perform this action.'
  },
  CHAT: {
    MESSAGE_FAILED: 'Failed to send message. Please try again.',
    FETCH_FAILED: 'Failed to load messages. Please try again.'
  },
  FILE: {
    TOO_LARGE: `File size exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    INVALID_TYPE: 'File type is not supported.',
    UPLOAD_FAILED: 'Failed to upload file. Please try again.'
  }
};

// Success messages
export const SUCCESS_MESSAGES = {
  AUTH: {
    REGISTER: 'Registration successful! Welcome to SecureChat.',
    LOGIN: 'Login successful! Welcome back.',
    LOGOUT: 'You have been logged out successfully.',
    PASSWORD_RESET: 'Password reset email has been sent.'
  },
  PROFILE: {
    UPDATE: 'Profile updated successfully.'
  },
  SETTINGS: {
    UPDATE: 'Settings updated successfully.'
  }
};

// Default settings
export const DEFAULT_SETTINGS = {
  theme: THEMES.SYSTEM,
  notifications_enabled: true,
  message_preview_enabled: true,
  read_receipts_enabled: true,
  typing_indicators_enabled: true,
  last_active_status_enabled: true,
  media_auto_download: 'wifi',
  language: 'en',
  analytics_enabled: true
};