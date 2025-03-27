// AnalyticsService.js - Privacy-focused analytics for SecureChat
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

class AnalyticsService {
  /**
   * Initialize analytics
   * @returns {Promise<boolean>} Success status
   */
  static async initialize() {
    try {
      // Get user's analytics preferences
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      
      const { data: settings } = await supabase
        .from('user_settings')
        .select('analytics_enabled')
        .eq('user_id', user.id)
        .single();
      
      // Check if analytics are enabled
      const analyticsEnabled = settings?.analytics_enabled ?? true;
      
      // Set analytics flag in localStorage for quick reference
      localStorage.setItem('analytics_enabled', JSON.stringify(analyticsEnabled));
      
      return analyticsEnabled;
    } catch (error) {
      console.error('Error initializing analytics:', error);
      return false;
    }
  }
  
  /**
   * Check if analytics are enabled
   * @returns {boolean} Analytics enabled status
   */
  static isEnabled() {
    try {
      const analyticsEnabled = localStorage.getItem('analytics_enabled');
      return analyticsEnabled ? JSON.parse(analyticsEnabled) : false;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Track a user event
   * @param {string} eventName - Name of the event
   * @param {object} eventData - Additional event data
   * @returns {Promise<boolean>} Success status
   */
  static async trackEvent(eventName, eventData = {}) {
    try {
      // Skip tracking if analytics are disabled
      if (!this.isEnabled()) return false;
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      
      // Remove any sensitive data
      const sanitizedData = this.sanitizeData(eventData);
      
      // Add event to analytics table
      const { error } = await supabase
        .from('analytics_events')
        .insert({
          user_id: user.id,
          event_name: eventName,
          event_data: sanitizedData,
          created_at: new Date().toISOString(),
          user_agent: navigator.userAgent,
          screen_size: `${window.innerWidth}x${window.innerHeight}`
        });
        
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error tracking event:', error);
      return false;
    }
  }
  
  /**
   * Track a page view
   * @param {string} pageName - Name of the page
   * @returns {Promise<boolean>} Success status
   */
  static async trackPageView(pageName) {
    return this.trackEvent('page_view', { page: pageName });
  }
  
  /**
   * Track feature usage
   * @param {string} featureName - Name of the feature
   * @returns {Promise<boolean>} Success status
   */
  static async trackFeatureUsage(featureName) {
    return this.trackEvent('feature_usage', { feature: featureName });
  }
  
  /**
   * Track error occurrence
   * @param {string} errorType - Type of error
   * @param {string} errorMessage - Error message
   * @returns {Promise<boolean>} Success status
   */
  static async trackError(errorType, errorMessage) {
    return this.trackEvent('error', { 
      type: errorType,
      message: errorMessage
    });
  }
  
  /**
   * Update analytics preferences
   * @param {boolean} enabled - Whether analytics should be enabled
   * @returns {Promise<boolean>} Success status
   */
  static async updatePreferences(enabled) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      
      // Update user settings
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          analytics_enabled: enabled,
          updated_at: new Date().toISOString()
        });
        
      if (error) throw error;
      
      // Update local storage
      localStorage.setItem('analytics_enabled', JSON.stringify(enabled));
      
      return true;
    } catch (error) {
      console.error('Error updating analytics preferences:', error);
      return false;
    }
  }
  
  /**
   * Sanitize data to remove any sensitive information
   * @param {object} data - Data to sanitize
   * @returns {object} Sanitized data
   */
  static sanitizeData(data) {
    // Create a copy of the data
    const sanitized = { ...data };
    
    // List of keys that might contain sensitive data
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'credit', 'card',
      'ssn', 'social', 'address', 'phone', 'email', 'location'
    ];
    
    // Remove or mask sensitive data
    Object.keys(sanitized).forEach(key => {
      const lowerKey = key.toLowerCase();
      
      // Check if key contains any sensitive terms
      if (sensitiveKeys.some(term => lowerKey.includes(term))) {
        delete sanitized[key];
      }
      
      // Remove any values that look like emails
      if (typeof sanitized[key] === 'string' && 
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(sanitized[key])) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
}

export default AnalyticsService;