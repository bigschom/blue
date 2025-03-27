// AuthContext.js - Authentication context for mobile app
import React, { createContext, useState, useContext, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Create context
const AuthContext = createContext();

// Create a custom secure storage provider for encryption keys
// We use SecureStore on mobile instead of localStorage
const secureStorageProvider = {
  async getItem(key) {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key, value) {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  async removeItem(key) {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

// Export the useAuth hook
export const useAuth = () => useContext(AuthContext);

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);

        // Check for existing session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (session?.user) {
          setUser(session.user);
          
          // Fetch user profile
          await fetchProfile(session.user.id);
          
          // Initialize E2EE keys
          await initializeE2EEKeys(session.user.id);
          
          // Update online status
          await updateOnlineStatus(true);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
          await initializeE2EEKeys(session.user.id);
          await updateOnlineStatus(true);
        } else if (event === 'SIGNED_OUT') {
          // Update status to offline before signing out
          if (user) {
            await updateOnlineStatus(false);
          }
          setUser(null);
          setProfile(null);
        } else if (event === 'USER_UPDATED') {
          setUser(session?.user ?? null);
        }
      }
    );

    // Initialize
    initializeAuth();

    // Cleanup
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Fetch user profile from database
  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      setProfile(data);
      return data;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  };

  // Initialize E2EE keys if not already set up
  const initializeE2EEKeys = async (userId) => {
    try {
      // Check if user already has keys in secure storage
      const privateKey = await secureStorageProvider.getItem(`${userId}_private_key`);
      
      if (privateKey) {
        return true; // Keys are already set up
      }

      // Generate new key pair for user
      const keyPair = await generateKeyPair();

      // Store private key in secure storage
      await secureStorageProvider.setItem(`${userId}_private_key`, keyPair.privateKey);

      // Store public key in database for other users to access
      const { error } = await supabase
        .from('user_keys')
        .upsert({
          user_id: userId,
          public_key: keyPair.publicKey,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error initializing E2EE keys:', err);
      return false;
    }
  };

  // Generate a new key pair
  const generateKeyPair = async () => {
    try {
      // Use Expo Crypto for key generation
      // We're using RSA-OAEP for asymmetric encryption
      // In a real implementation, this would be more sophisticated
      
      // For demo purposes, we'll generate a simple key pair
      // In production, use proper crypto libraries
      const privateKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `private-${Date.now()}-${Math.random()}`
      );
      
      const publicKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `public-${Date.now()}-${Math.random()}`
      );
      
      return {
        privateKey,
        publicKey
      };
    } catch (err) {
      console.error('Error generating key pair:', err);
      throw err;
    }
  };

  // Update online status in database
  const updateOnlineStatus = async (isOnline) => {
    if (!user) return;

    try {
      // Get device information
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
      };

      // Update status
      await supabase
        .from('user_status')
        .upsert({
          user_id: user.id,
          is_online: isOnline,
          last_seen: new Date().toISOString(),
          device_info: deviceInfo,
          updated_at: new Date().toISOString()
        });
    } catch (err) {
      console.error('Error updating online status:', err);
    }
  };

  // Sign up with email and password
  const signUp = async ({ email, password, username, displayName }) => {
    try {
      setLoading(true);
      setError(null);

      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create profile record
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            username,
            display_name: displayName || username,
            email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (profileError) throw profileError;

        // Create default settings
        await supabase
          .from('user_settings')
          .insert({
            user_id: authData.user.id,
            updated_at: new Date().toISOString()
          });

        return { success: true, user: authData.user };
      }
    } catch (err) {
      console.error('Error signing up:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign in with email and password
  const signIn = async ({ email, password }) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { success: true, user: data.user };
    } catch (err) {
      console.error('Error signing in:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setLoading(true);

      // Update online status before signing out
      await updateOnlineStatus(false);

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      return { success: true };
    } catch (err) {
      console.error('Error signing out:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Update user profile
  const updateProfile = async (updates) => {
    try {
      setLoading(true);

      if (!user) throw new Error('User not authenticated');

      // Update profile in database
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setProfile(data);

      return { success: true, profile: data };
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Reset password
  const resetPassword = async (email) => {
    try {
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) throw error;

      return { success: true };
    } catch (err) {
      console.error('Error resetting password:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Update password
  const updatePassword = async (password) => {
    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      return { success: true };
    } catch (err) {
      console.error('Error updating password:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Context value
  const value = {
    user,
    profile,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    updatePassword,
    supabase,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;