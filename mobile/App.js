// App.js - Main entry point for React Native mobile app
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, DefaultTheme, DarkTheme } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// Import screens
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ChatScreen from './screens/ChatScreen';
import ChatDetailScreen from './screens/ChatDetailScreen';
import ContactsScreen from './screens/ContactsScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import SplashScreen from './screens/SplashScreen';

// Import contexts
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Import components
import TabBar from './components/TabBar';
import { IconButton } from 'react-native-paper';

// Import icons
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Create navigation stacks
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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

// Create tab navigator
const TabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={props => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen 
        name="ChatStack" 
        component={ChatStackNavigator} 
        options={{
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color, size }) => (
            <Icon name="chat" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="Contacts" 
        component={ContactsScreen} 
        options={{
          tabBarLabel: 'Contacts',
          tabBarIcon: ({ color, size }) => (
            <Icon name="account-multiple" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Icon name="account" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Icon name="cog" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// Create chat stack navigator
const ChatStackNavigator = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Chats" 
        component={ChatScreen} 
        options={({ navigation }) => ({
          headerRight: () => (
            <IconButton
              icon="magnify"
              onPress={() => navigation.navigate('Search')}
            />
          ),
        })}
      />
      <Stack.Screen 
        name="ChatDetail" 
        component={ChatDetailScreen} 
        options={({ route }) => ({
          title: route.params?.contactName || 'Chat',
          headerBackTitleVisible: false,
        })}
      />
    </Stack.Navigator>
  );
};

// Main App component
export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const colorScheme = useColorScheme();
  
  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setUserToken(data?.session?.access_token || null);
      } catch (error) {
        console.error('Error checking auth:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  // Define themes
  const lightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: '#3a86ff',
      accent: '#4361ee',
      background: '#f7f9fc',
      surface: '#ffffff',
      text: '#1a202c',
      error: '#ef476f',
    },
  };
  
  const darkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: '#4f94ff',
      accent: '#6c7ae0',
      background: '#111827',
      surface: '#1f2937',
      text: '#f7fafc',
      error: '#f25e7a',
    },
  };
  
  // Show splash screen while loading
  if (isLoading) {
    return <SplashScreen />;
  }
  
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PaperProvider theme={colorScheme === 'dark' ? darkTheme : lightTheme}>
          <AuthProvider>
            <NavigationContainer theme={colorScheme === 'dark' ? darkTheme : lightTheme}>
              <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                {userToken == null ? (
                  // Auth screens
                  <>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Register" component={RegisterScreen} />
                  </>
                ) : (
                  // App screens
                  <Stack.Screen name="Main" component={TabNavigator} />
                )}
              </Stack.Navigator>
            </NavigationContainer>
          </AuthProvider>
        </PaperProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}