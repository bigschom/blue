// ProfileScreen.js - User profile screen for mobile app
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Avatar,
  IconButton,
  useTheme,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../contexts/AuthContext';
import QRCode from 'react-native-qrcode-svg';

const ProfileScreen = ({ navigation }) => {
  const { user, profile, updateProfile } = useAuth();
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    bio: '',
    error: ''
  });

  // Load profile data when component mounts
  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
        error: ''
      });
    }
  }, [profile]);

  // Handle form input changes
  const handleChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: value,
      error: ''
    }));
  };

  // Toggle edit mode
  const toggleEdit = () => {
    if (isEditing && (
      formData.display_name !== profile?.display_name ||
      formData.username !== profile?.username ||
      formData.bio !== profile?.bio ||
      avatar
    )) {
      // Confirm discarding changes
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { 
            text: 'Discard', 
            style: 'destructive',
            onPress: () => {
              resetForm();
              setIsEditing(false);
            }
          }
        ]
      );
    } else {
      setIsEditing(!isEditing);
    }
  };

  // Reset form to initial values
  const resetForm = () => {
    setFormData({
      display_name: profile?.display_name || '',
      username: profile?.username || '',
      bio: profile?.bio || '',
      error: ''
    });
    setAvatar(null);
  };

  // Save profile changes
  const saveProfile = async () => {
    try {
      // Validate form
      if (!formData.display_name.trim() || !formData.username.trim()) {
        setFormData(prev => ({
          ...prev,
          error: 'Name and username are required.'
        }));
        return;
      }

      // Username validation (alphanumeric, underscore, hyphen, 3-20 chars)
      const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
      if (!usernameRegex.test(formData.username)) {
        setFormData(prev => ({
          ...prev,
          error: 'Username must be 3-20 characters and may contain letters, numbers, underscores, and hyphens.'
        }));
        return;
      }

      setIsLoading(true);

      // Check if username is taken (only if changed)
      if (formData.username !== profile?.username) {
        const { data: existingUser, error: usernameError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', formData.username)
          .neq('id', user.id)
          .single();

        if (existingUser) {
          setFormData(prev => ({
            ...prev,
            error: 'Username is already taken.'
          }));
          setIsLoading(false);
          return;
        }
      }

      // Upload avatar if changed
      let avatar_url = profile?.avatar_url;
      if (avatar) {
        // Get file extension
        const fileUri = avatar;
        const fileExtension = fileUri.split('.').pop();
        const fileName = `avatar-${Date.now()}.${fileExtension}`;
        const filePath = `avatars/${user.id}/${fileName}`;

        // Upload to Supabase Storage
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists) {
          throw new Error("File does not exist");
        }

        const fileContents = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64
        });

        const { error: uploadError } = await supabase.storage
          .from('user-content')
          .upload(filePath, fileContents, {
            contentType: `image/${fileExtension}`,
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('user-content')
          .getPublicUrl(filePath);

        avatar_url = publicUrl;
      }

      // Update profile
      const updates = {
        display_name: formData.display_name,
        username: formData.username,
        bio: formData.bio,
        avatar_url,
        updated_at: new Date().toISOString()
      };

      const { error } = await updateProfile(updates);

      if (error) throw error;

      // Exit edit mode
      setIsEditing(false);
      setAvatar(null);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      setFormData(prev => ({
        ...prev,
        error: error.message || 'Failed to update profile.'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Pick an image from the gallery
  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please grant camera roll permissions to change your avatar');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  // Toggle QR code view
  const toggleQR = () => {
    setShowQR(!showQR);
  };

  // Generate QR code data
  const getQRData = () => {
    if (!profile) return '';

    const data = {
      username: profile.username,
      displayName: profile.display_name,
      id: user.id
    };

    return JSON.stringify(data);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {showQR ? (
            <View style={styles.qrContainer}>
              <View style={styles.qrHeader}>
                <IconButton
                  icon="arrow-left"
                  size={24}
                  onPress={toggleQR}
                />
                <Text style={[styles.qrTitle, { color: theme.colors.text }]}>My QR Code</Text>
              </View>
              
              <View style={[styles.qrCodeWrapper, { backgroundColor: 'white' }]}>
                <QRCode
                  value={getQRData()}
                  size={250}
                  color="black"
                  backgroundColor="white"
                  logo={require('../assets/icon.png')}
                  logoSize={50}
                  logoBackgroundColor="white"
                />
              </View>
              
              <Text style={[styles.qrInstructions, { color: theme.colors.text }]}>
                Scan this code with another SecureChat user to add you as a contact
              </Text>
              
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: theme.colors.text }]}>
                  {profile?.display_name}
                </Text>
                <Text style={[styles.userUsername, { color: theme.colors.text }]}>
                  @{profile?.username}
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                  {isEditing ? 'Edit Profile' : 'Profile'}
                </Text>
                
                {!isEditing && (
                  <IconButton
                    icon="qrcode"
                    size={24}
                    onPress={toggleQR}
                    style={styles.qrButton}
                  />
                )}
                
                <IconButton
                  icon={isEditing ? "close" : "pencil"}
                  size={24}
                  onPress={toggleEdit}
                  disabled={isLoading}
                />
                
                {isEditing && (
                  <IconButton
                    icon="check"
                    size={24}
                    onPress={saveProfile}
                    disabled={isLoading}
                  />
                )}
              </View>
              
              {formData.error && (
                <View style={[styles.errorContainer, { backgroundColor: theme.colors.error }]}>
                  <Text style={styles.errorText}>{formData.error}</Text>
                </View>
              )}
              
              <View style={styles.avatarSection}>
                <TouchableOpacity
                  onPress={isEditing ? pickImage : null}
                  disabled={!isEditing || isLoading}
                  style={[
                    styles.avatarWrapper,
                    isEditing && styles.avatarWrapperEditing
                  ]}
                >
                  <Avatar.Image
                    size={120}
                    source={
                      avatar 
                        ? { uri: avatar } 
                        : profile?.avatar_url 
                          ? { uri: profile.avatar_url } 
                          : require('../assets/default-avatar.png')
                    }
                  />
                  
                  {isEditing && (
                    <View style={styles.avatarOverlay}>
                      <IconButton
                        icon="camera"
                        size={24}
                        color="#fff"
                      />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              
              <View style={styles.formContainer}>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>
                    Display Name
                  </Text>
                  {isEditing ? (
                    <TextInput
                      value={formData.display_name}
                      onChangeText={(text) => handleChange('display_name', text)}
                      mode="outlined"
                      placeholder="Your full name"
                      disabled={isLoading}
                    />
                  ) : (
                    <Text style={[styles.valueText, { color: theme.colors.text }]}>
                      {profile?.display_name}
                    </Text>
                  )}
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>
                    Username
                  </Text>
                  {isEditing ? (
                    <TextInput
                      value={formData.username}
                      onChangeText={(text) => handleChange('username', text)}
                      mode="outlined"
                      placeholder="username"
                      disabled={isLoading}
                      left={<TextInput.Affix text="@" />}
                    />
                  ) : (
                    <Text style={[styles.valueText, { color: theme.colors.text }]}>
                      @{profile?.username}
                    </Text>
                  )}
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>
                    Email
                  </Text>
                  <Text style={[styles.valueText, { color: theme.colors.text }]}>
                    {user?.email}
                    <Text style={[styles.verifiedBadge, { color: theme.colors.primary }]}>
                      {" "}Verified
                    </Text>
                  </Text>
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>
                    Bio
                  </Text>
                  {isEditing ? (
                    <TextInput
                      value={formData.bio}
                      onChangeText={(text) => handleChange('bio', text)}
                      mode="outlined"
                      placeholder="Write something about yourself"
                      multiline
                      numberOfLines={3}
                      disabled={isLoading}
                    />
                  ) : (
                    <Text style={[styles.valueText, { color: theme.colors.text }]}>
                      {profile?.bio || 'No bio yet'}
                    </Text>
                  )}
                </View>
                
                {isEditing && (
                  <Text style={[styles.helperText, { color: theme.colors.text }]}>
                    Your display name and bio are visible to your contacts. 
                    Username is used to find and add you as a contact.
                  </Text>
                )}
              </View>
              
              {!isEditing && (
                <View style={styles.actionButtons}>
                  <Button
                    mode="contained"
                    onPress={() => navigation.navigate('Settings')}
                    style={styles.settingsButton}
                  >
                    More Settings
                  </Button>
                </View>
              )}
              
              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  qrButton: {
    marginRight: 8,
  },
  errorContainer: {
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  errorText: {
    color: 'white',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarWrapperEditing: {
    opacity: 0.8,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  valueText: {
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  verifiedBadge: {
    fontWeight: 'bold',
  },
  helperText: {
    fontSize: 12,
    marginTop: 8,
    opacity: 0.7,
  },
  actionButtons: {
    marginTop: 16,
  },
  settingsButton: {
    marginBottom: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  qrContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  qrCodeWrapper: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  qrInstructions: {
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 32,
  },
  userInfo: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    width: '100%',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userUsername: {
    fontSize: 16,
    opacity: 0.7,
  },
});

export default ProfileScreen;