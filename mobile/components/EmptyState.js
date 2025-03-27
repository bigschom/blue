// EmptyState.js - Empty state component for the mobile app
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const EmptyState = ({ 
  icon, 
  title, 
  message, 
  buttonText, 
  onButtonPress 
}) => {
  const theme = useTheme();
  
  return (
    <View style={styles.container}>
      <Icon 
        name={icon || 'information-outline'} 
        size={80} 
        color={theme.colors.primary}
        style={styles.icon}
      />
      
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {title || 'Nothing here'}
      </Text>
      
      <Text style={[styles.message, { color: theme.colors.text }]}>
        {message || 'There are no items to display.'}
      </Text>
      
      {buttonText && onButtonPress && (
        <Button 
          mode="contained" 
          onPress={onButtonPress}
          style={styles.button}
        >
          {buttonText}
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  icon: {
    marginBottom: 16,
    opacity: 0.8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  button: {
    marginTop: 8,
  },
});

export default EmptyState;