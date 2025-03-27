// SettingsScreen.js - Settings screen for mobile app
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Linking,
  Switch
} from 'react-native';
import {
  List,
  Text,
  Divider,
  Button,
  Dialog,
  Portal,
  Paragraph,
  RadioButton,
  useTheme,
  TouchableRipple,
  Appbar,
  TextInput,
  ActivityIndicator
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme as useAppTheme } from '../contexts/ThemeContext';
import * as FileSystem from 'expo-file-system';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';

const SettingsScreen = ({ navigation }) => {
  const { user, profile, signOut, supabase } = useAuth();
  const paperTheme = useTheme();
  const { theme, setTheme, actualTheme } = useAppTheme();
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cacheSize, setCacheSize] = useState(0);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [showMediaDialog, setShowMediaDialog] = useState(false);
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Get user settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          throw error;
        }
        
        // If no settings found, use defaults
        setSettings(data || {
          theme: 'system',
          notifications_enabled: true,
          message_preview_enabled: true,
          read_receipts_enabled: true,
          typing_indicators_enabled: true,
          last_active_status_enabled: true,
          media_auto_download: 'wifi',
          language: 'en'
        });
        
        // Calculate cache size
        calculateCacheSize();
      } catch (error) {
        console.error('Error fetching settings:', error);
        Alert.alert('Error', 'Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSettings();
  }, [user?.id]);
  
  // Calculate app cache size
  const calculateCacheSize = async () => {
    try {
      // Get cache directory info
      const cacheInfo = await FileSystem.getInfoAsync(FileSystem.cacheDirectory);
      
      if (cacheInfo.exists && cacheInfo.isDirectory) {
        setCacheSize(cacheInfo.size || 0);
      }
    } catch (error) {
      console.error('Error calculating cache size:', error);
    }
  };
  
  // Format bytes to human readable size
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  // Update a setting
  const updateSetting = async (key, value) => {
    try {
      // Update local state
      setSettings(prev => ({
        ...prev,
        [key]: value
      }));
      
      // Update in database
      await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          [key]: value,
          updated_at: new Date().toISOString()
        });
        
      // Special handling for theme
      if (key === 'theme') {
        setTheme(value);
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert('Error', 'Failed to update setting');
      
      // Revert change on error
      setSettings(prev => ({
        ...prev,
        [key]: prev[key]
      }));
    }
  };
  
  // Clear cache
  const clearCache = async () => {
    try {
      // Ask for confirmation
      Alert.alert(
        'Clear Cache',
        'This will clear temporary files and images. Are you sure?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Clear',
            style: 'destructive',
            onPress: async () => {
              try {
                // Get all files in cache directory
                const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
                
                // Delete each file
                await Promise.all(
                  files.map(file => 
                    FileSystem.deleteAsync(FileSystem.cacheDirectory + file, { idempotent: true })
                  )
                );
                
                // Recalculate cache size
                calculateCacheSize();
                
                Alert.alert('Success', 'Cache has been cleared');
              } catch (error) {
                console.error('Error clearing cache:', error);
                Alert.alert('Error', 'Failed to clear cache');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error clearing cache:', error);
      Alert.alert('Error', 'Failed to clear cache');
    }
  };
  
  // Handle sign out
  const handleSignOut = async () => {
    try {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Sign Out',
            onPress: signOut
          }
        ]
      );
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };
  
  // Delete account
  const deleteAccount = async () => {
    try {
      if (deleteConfirmText !== user.email) {
        Alert.alert('Error', 'Email confirmation does not match');
        return;
      }
      
      // Close dialog and show loading
      setShowDeleteAccountDialog(false);
      Alert.alert('Processing', 'Deleting account...');
      
      // Delete user data
      await supabase.rpc('delete_user_account', {
        user_id: user.id
      });
      
      // Sign out
      await signOut();
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', 'Failed to delete account: ' + error.message);
    }
  };

  // Get app version
  const getAppVersion = () => {
    return Platform.OS === 'ios'
      ? Application.nativeApplicationVersion
      : Application.nativeBuildVersion;
  };
  
  // Render theme dialog
  const renderThemeDialog = () => (
    <Portal>
      <Dialog
        visible={showThemeDialog}
        onDismiss={() => setShowThemeDialog(false)}
      >
        <Dialog.Title>Theme</Dialog.Title>
        <Dialog.Content>
          <RadioButton.Group
            value={settings?.theme || 'system'}
            onValueChange={value => {
              updateSetting('theme', value);
              setShowThemeDialog(false);
            }}
          >
            <RadioButton.Item
              label="System Default"
              value="system"
              color={paperTheme.colors.primary}
            />
            <RadioButton.Item
              label="Light"
              value="light"
              color={paperTheme.colors.primary}
            />
            <RadioButton.Item
              label="Dark"
              value="dark"
              color={paperTheme.colors.primary}
            />
          </RadioButton.Group>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setShowThemeDialog(false)}>Cancel</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
  
  // Render media auto-download dialog
  const renderMediaDialog = () => (
    <Portal>
      <Dialog
        visible={showMediaDialog}
        onDismiss={() => setShowMediaDialog(false)}
      >
        <Dialog.Title>Media Auto-Download</Dialog.Title>
        <Dialog.Content>
          <RadioButton.Group
            value={settings?.media_auto_download || 'wifi'}
            onValueChange={value => {
              updateSetting('media_auto_download', value);
              setShowMediaDialog(false);
            }}
          >
            <RadioButton.Item
              label="Always"
              value="always"
              color={paperTheme.colors.primary}
            />
            <RadioButton.Item
              label="Wi-Fi Only"
              value="wifi"
              color={paperTheme.colors.primary}
            />
            <RadioButton.Item
              label="Never"
              value="never"
              color={paperTheme.colors.primary}
            />
          </RadioButton.Group>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setShowMediaDialog(false)}>Cancel</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
  
  // Render language dialog
  const renderLanguageDialog = () => (
    <Portal>
      <Dialog
        visible={showLanguageDialog}
        onDismiss={() => setShowLanguageDialog(false)}
      >
        <Dialog.Title>Language</Dialog.Title>
        <Dialog.Content>
          <RadioButton.Group
            value={settings?.language || 'en'}
            onValueChange={value => {
              updateSetting('language', value);
              setShowLanguageDialog(false);
            }}
          >
            <RadioButton.Item
              label="English"
              value="en"
              color={paperTheme.colors.primary}
            />
            <RadioButton.Item
              label="Español"
              value="es"
              color={paperTheme.colors.primary}
            />
            <RadioButton.Item
              label="Français"
              value="fr"
              color={paperTheme.colors.primary}
            />
            <RadioButton.Item
              label="Deutsch"
              value="de"
              color={paperTheme.colors.primary}
            />
          </RadioButton.Group>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setShowLanguageDialog(false)}>Cancel</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
  
  // Render delete account dialog
  const renderDeleteAccountDialog = () => (
    <Portal>
      <Dialog
        visible={showDeleteAccountDialog}
        onDismiss={() => setShowDeleteAccountDialog(false)}
      >
        <Dialog.Title>Delete Account</Dialog.Title>
        <Dialog.Content>
          <Paragraph style={styles.deleteWarning}>
            This action cannot be undone. All your messages, files, and data will be permanently deleted.
          </Paragraph>
          <Paragraph>
            To confirm, please type your email address: {user?.email}
          </Paragraph>
          <TextInput
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
            placeholder="Enter your email"
            style={styles.deleteInput}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setShowDeleteAccountDialog(false)}>Cancel</Button>
          <Button 
            onPress={deleteAccount}
            disabled={deleteConfirmText !== user?.email}
            color="red"
          >
            Delete
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
  
  if (isLoading || !settings) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: paperTheme.colors.background }]}>
        <Appbar.Header>
          <Appbar.Content title="Settings" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={paperTheme.colors.primary} />
          <Text style={{ marginTop: 16 }}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: paperTheme.colors.background }]}>
      <Appbar.Header>
        <Appbar.Content title="Settings" />
      </Appbar.Header>
      
      <ScrollView style={styles.scrollView}>
        {/* Appearance Section */}
        <List.Section>
          <List.Subheader>Appearance</List.Subheader>
          
          <TouchableRipple onPress={() => setShowThemeDialog(true)}>
            <List.Item
              title="Theme"
              description={
                settings.theme === 'system' 
                  ? 'System Default' 
                  : settings.theme === 'dark' 
                    ? 'Dark' 
                    : 'Light'
              }
              left={props => <List.Icon {...props} icon={actualTheme === 'dark' ? 'moon-waxing-crescent' : 'white-balance-sunny'} />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
            />
          </TouchableRipple>
          
          <TouchableRipple onPress={() => setShowLanguageDialog(true)}>
            <List.Item
              title="Language"
              description={
                settings.language === 'en' 
                  ? 'English' 
                  : settings.language === 'es' 
                    ? 'Español' 
                    : settings.language === 'fr' 
                      ? 'Français' 
                      : 'Deutsch'
              }
              left={props => <List.Icon {...props} icon="translate" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
            />
          </TouchableRipple>
        </List.Section>
        
        <Divider />
        
        {/* Notifications Section */}
        <List.Section>
          <List.Subheader>Notifications</List.Subheader>
          
          <List.Item
            title="Notifications"
            description="Receive notifications for new messages"
            left={props => <List.Icon {...props} icon="bell" />}
            right={() => (
              <Switch
                value={settings.notifications_enabled}
                onValueChange={value => updateSetting('notifications_enabled', value)}
                color={paperTheme.colors.primary}
              />
            )}
          />
          
          <List.Item
            title="Message Preview"
            description="Show message content in notifications"
            left={props => <List.Icon {...props} icon="message-text" />}
            right={() => (
              <Switch
                value={settings.message_preview_enabled}
                onValueChange={value => updateSetting('message_preview_enabled', value)}
                disabled={!settings.notifications_enabled}
                color={paperTheme.colors.primary}
              />
            )}
          />
        </List.Section>
        
        <Divider />
        
        {/* Privacy Section */}
        <List.Section>
          <List.Subheader>Privacy</List.Subheader>
          
          <List.Item
            title="Read Receipts"
            description="Show when you've read messages"
            left={props => <List.Icon {...props} icon="check-all" />}
            right={() => (
              <Switch
                value={settings.read_receipts_enabled}
                onValueChange={value => updateSetting('read_receipts_enabled', value)}
                color={paperTheme.colors.primary}
              />
            )}
          />
          
          <List.Item
            title="Typing Indicators"
            description="Show when you're typing a message"
            left={props => <List.Icon {...props} icon="keyboard" />}
            right={() => (
              <Switch
                value={settings.typing_indicators_enabled}
                onValueChange={value => updateSetting('typing_indicators_enabled', value)}
                color={paperTheme.colors.primary}
              />
            )}
          />
          
          <List.Item
            title="Last Active Status"
            description="Show when you were last online"
            left={props => <List.Icon {...props} icon="clock-outline" />}
            right={() => (
              <Switch
                value={settings.last_active_status_enabled}
                onValueChange={value => updateSetting('last_active_status_enabled', value)}
                color={paperTheme.colors.primary}
              />
            )}
          />
        </List.Section>
        
        <Divider />
        
        {/* Data & Storage Section */}
        <List.Section>
          <List.Subheader>Data & Storage</List.Subheader>
          
          <TouchableRipple onPress={() => setShowMediaDialog(true)}>
            <List.Item
              title="Media Auto-Download"
              description={
                settings.media_auto_download === 'always' 
                  ? 'Always' 
                  : settings.media_auto_download === 'wifi' 
                    ? 'Wi-Fi Only' 
                    : 'Never'
              }
              left={props => <List.Icon {...props} icon="image" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
            />
          </TouchableRipple>
          
          <List.Item
            title="Storage Usage"
            description={`Cache: ${formatBytes(cacheSize)}`}
            left={props => <List.Icon {...props} icon="folder" />}
          />
          
          <TouchableRipple onPress={clearCache}>
            <List.Item
              title="Clear Cache"
              description="Delete temporary files and images"
              left={props => <List.Icon {...props} icon="broom" />}
            />
          </TouchableRipple>
        </List.Section>
        
        <Divider />
        
        {/* Security Section */}
        <List.Section>
          <List.Subheader>Security</List.Subheader>
          
          <List.Item
            title="End-to-End Encryption"
            description="All messages and calls are secured with E2EE"
            left={props => <List.Icon {...props} icon="shield-check" />}
            right={() => <Text style={{ color: paperTheme.colors.primary, marginRight: 8 }}>Enabled</Text>}
          />
          
          <TouchableRipple onPress={() => navigation.navigate('ChangePassword')}>
            <List.Item
              title="Change Password"
              description="Update your account password"
              left={props => <List.Icon {...props} icon="lock" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
            />
          </TouchableRipple>
        </List.Section>
        
        <Divider />
        
        {/* Account Section */}
        <List.Section>
          <List.Subheader>Account</List.Subheader>
          
          <TouchableRipple onPress={() => navigation.navigate('Profile')}>
            <List.Item
              title="Edit Profile"
              description="Change your name, username, and photo"
              left={props => <List.Icon {...props} icon="account-edit" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
            />
          </TouchableRipple>
          
          <TouchableRipple onPress={handleSignOut}>
            <List.Item
              title="Sign Out"
              description="Sign out of your account"
              left={props => <List.Icon {...props} icon="logout" />}
            />
          </TouchableRipple>
          
          <TouchableRipple onPress={() => setShowDeleteAccountDialog(true)}>
            <List.Item
              title="Delete Account"
              description="Permanently delete your account"
              titleStyle={{ color: 'red' }}
              left={props => <List.Icon {...props} icon="delete" color="red" />}
            />
          </TouchableRipple>
        </List.Section>
        
        <Divider />
        
        {/* About Section */}
        <List.Section>
          <List.Subheader>About</List.Subheader>
          
          <List.Item
            title="SecureChat"
            description={`Version ${getAppVersion()}`}
            left={props => <List.Icon {...props} icon="information" />}
          />
          
          <TouchableRipple onPress={() => Linking.openURL('https://securechat.com/privacy')}>
            <List.Item
              title="Privacy Policy"
              left={props => <List.Icon {...props} icon="shield-account" />}
              right={props => <List.Icon {...props} icon="open-in-new" />}
            />
          </TouchableRipple>
          
          <TouchableRipple onPress={() => Linking.openURL('https://securechat.com/terms')}>
            <List.Item
              title="Terms of Service"
              left={props => <List.Icon {...props} icon="file-document" />}
              right={props => <List.Icon {...props} icon="open-in-new" />}
            />
          </TouchableRipple>
        </List.Section>
      </ScrollView>
      
      {/* Dialogs */}
      {renderThemeDialog()}
      {renderMediaDialog()}
      {renderLanguageDialog()}
      {renderDeleteAccountDialog()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteWarning: {
    color: 'red',
    marginBottom: 16,
  },
  deleteInput: {
    marginTop: 8,
    backgroundColor: 'transparent',
  },
});

export default SettingsScreen;