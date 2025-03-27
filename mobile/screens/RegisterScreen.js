// RegisterScreen.js - Registration screen for mobile app
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Surface,
  useTheme,
  HelperText,
} from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';

const RegisterScreen = ({ navigation }) => {
  const { signUp } = useAuth();
  const theme = useTheme();
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    displayName: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Username validation (alphanumeric, underscore, hyphen, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!formData.username || !usernameRegex.test(formData.username)) {
      newErrors.username = 'Username must be 3-20 characters and may contain letters, numbers, underscores, and hyphens';
    }
    
    // Display name validation
    if (!formData.displayName || formData.displayName.length < 2) {
      newErrors.displayName = 'Display name must be at least 2 characters';
    }
    
    // Password validation (min 8 chars, at least 1 uppercase, 1 lowercase, 1 number)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!formData.password || !passwordRegex.test(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters with at least one uppercase letter, one lowercase letter, and one number';
    }
    
    // Confirm password
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error when typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      
      const { success, error, user } = await signUp({
        email: formData.email,
        password: formData.password,
        username: formData.username,
        displayName: formData.displayName,
      });
      
      if (!success) {
        Alert.alert('Registration Failed', error || 'Please check your information and try again.');
      } else {
        Alert.alert(
          'Registration Successful',
          'Your account has been created. You will be redirected to the app.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to check password criteria
  const checkPasswordCriteria = (password) => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
    };
  };

  const passwordCriteria = checkPasswordCriteria(formData.password);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/logo-dark.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.appName, { color: theme.colors.primary }]}>SecureChat</Text>
          </View>

          <Surface style={styles.formContainer}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: theme.colors.text }]}>
              Join SecureChat for private, encrypted messaging
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                label="Email"
                value={formData.email}
                onChangeText={(text) => handleInputChange('email', text)}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                left={<TextInput.Icon icon="email" />}
                error={!!errors.email}
                style={styles.input}
              />
              {errors.email && <HelperText type="error">{errors.email}</HelperText>}

              <TextInput
                label="Username"
                value={formData.username}
                onChangeText={(text) => handleInputChange('username', text)}
                mode="outlined"
                autoCapitalize="none"
                left={<TextInput.Icon icon="account" />}
                error={!!errors.username}
                style={styles.input}
              />
              {errors.username && <HelperText type="error">{errors.username}</HelperText>}

              <TextInput
                label="Display Name"
                value={formData.displayName}
                onChangeText={(text) => handleInputChange('displayName', text)}
                mode="outlined"
                left={<TextInput.Icon icon="badge-account" />}
                error={!!errors.displayName}
                style={styles.input}
              />
              {errors.displayName && <HelperText type="error">{errors.displayName}</HelperText>}

              <TextInput
                label="Password"
                value={formData.password}
                onChangeText={(text) => handleInputChange('password', text)}
                mode="outlined"
                secureTextEntry={!showPassword}
                left={<TextInput.Icon icon="lock" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? "eye-off" : "eye"}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
                error={!!errors.password}
                style={styles.input}
              />
              {errors.password && <HelperText type="error">{errors.password}</HelperText>}

              {/* Password requirements indicator */}
              <View style={styles.passwordRequirements}>
                <Text style={[styles.requirementsTitle, { color: theme.colors.text }]}>
                  Password must have:
                </Text>
                <View style={styles.requirementItem}>
                  <Text
                    style={[
                      styles.requirementText,
                      { color: passwordCriteria.length ? theme.colors.success : theme.colors.text }
                    ]}
                  >
                    • At least 8 characters
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Text
                    style={[
                      styles.requirementText,
                      { color: passwordCriteria.uppercase ? theme.colors.success : theme.colors.text }
                    ]}
                  >
                    • At least one uppercase letter
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Text
                    style={[
                      styles.requirementText,
                      { color: passwordCriteria.lowercase ? theme.colors.success : theme.colors.text }
                    ]}
                  >
                    • At least one lowercase letter
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Text
                    style={[
                      styles.requirementText,
                      { color: passwordCriteria.number ? theme.colors.success : theme.colors.text }
                    ]}
                  >
                    • At least one number
                  </Text>
                </View>
              </View>

              <TextInput
                label="Confirm Password"
                value={formData.confirmPassword}
                onChangeText={(text) => handleInputChange('confirmPassword', text)}
                mode="outlined"
                secureTextEntry={!showConfirmPassword}
                left={<TextInput.Icon icon="lock-check" />}
                right={
                  <TextInput.Icon
                    icon={showConfirmPassword ? "eye-off" : "eye"}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                }
                error={!!errors.confirmPassword}
                style={styles.input}
              />
              {errors.confirmPassword && <HelperText type="error">{errors.confirmPassword}</HelperText>}
            </View>

            <Button
              mode="contained"
              onPress={handleRegister}
              loading={isLoading}
              disabled={isLoading}
              style={styles.registerButton}
              contentStyle={styles.buttonContent}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.colors.text }]} />
              <Text style={[styles.dividerText, { color: theme.colors.text }]}>
                Already have an account?
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.colors.text }]} />
            </View>

            <Button
              mode="outlined"
              onPress={() => navigation.navigate('Login')}
              style={styles.loginButton}
              contentStyle={styles.buttonContent}
            >
              Sign In
            </Button>
          </Surface>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.colors.text }]}>
              By creating an account, you agree to our{' '}
              <Text
                style={[styles.link, { color: theme.colors.primary }]}
                onPress={() => Alert.alert('Terms of Service', 'Terms of Service will be displayed here.')}
              >
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text
                style={[styles.link, { color: theme.colors.primary }]}
                onPress={() => Alert.alert('Privacy Policy', 'Privacy Policy will be displayed here.')}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  logo: {
    width: 80,
    height: 80,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  formContainer: {
    padding: 20,
    borderRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    opacity: 0.7,
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    marginTop: 8,
  },
  passwordRequirements: {
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  requirementsTitle: {
    fontSize: 12,
    marginBottom: 4,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  requirementText: {
    fontSize: 12,
  },
  registerButton: {
    marginBottom: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.3,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    opacity: 0.7,
  },
  loginButton: {
    marginBottom: 8,
  },
  footer: {
    marginTop: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
  },
  link: {
    fontWeight: 'bold',
  },
});

export default RegisterScreen;