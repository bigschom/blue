// SplashScreen.js - Loading screen for the mobile app
import React from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';

const SplashScreen = () => {
  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/adaptive-icon.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>SecureChat</Text>
      <Text style={styles.subtitle}>End-to-end encrypted messaging</Text>
      <ActivityIndicator size="large" color="#3a86ff" style={styles.loader} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3a86ff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#4a5568',
    marginBottom: 32,
  },
  loader: {
    marginTop: 20,
  },
});

export default SplashScreen;