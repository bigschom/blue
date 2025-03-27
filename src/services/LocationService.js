// LocationService.js - For handling location sharing in the chat
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

class LocationService {
  /**
   * Get current user's location
   * @returns {Promise<{latitude: number, longitude: number}>} Location coordinates
   */
  static async getCurrentLocation() {
    try {
      // Request user permission to access location
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser');
      }
      
      // Get current position
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });
      
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };
    } catch (error) {
      console.error('Error getting location:', error);
      throw error;
    }
  }
  
  /**
   * Share location in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {object} location - Location data (latitude, longitude)
   * @returns {Promise<object>} Shared location message
   */
  static async shareLocation(conversationId, location) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Format location data for message
      const locationData = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        shared_at: new Date().toISOString()
      };
      
      // Create a message with location type
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: 'Shared a location', // Text fallback
          location_data: locationData,
          created_at: new Date().toISOString()
        })
        .select();
        
      if (error) throw error;
      
      return data[0];
    } catch (error) {
      console.error('Error sharing location:', error);
      throw error;
    }
  }
  
  /**
   * Get location information (reverse geocoding)
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Promise<object>} Location information
   */
  static async getLocationInfo(latitude, longitude) {
    try {
      // Use a free reverse geocoding API
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'SecureChat/1.0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to get location information');
      }
      
      const data = await response.json();
      
      return {
        address: data.display_name,
        details: data.address
      };
    } catch (error) {
      console.error('Error getting location info:', error);
      return null;
    }
  }
  
  /**
   * Generate a Google Maps link for a location
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {string} Google Maps URL
   */
  static generateMapLink(latitude, longitude) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
}

export default LocationService;