// MessageBubble.js - Message bubble component for the mobile app
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Dimensions,
} from 'react-native';
import { Avatar, useTheme } from 'react-native-paper';
import { format } from 'date-fns';
import AttachmentPreview from './AttachmentPreview';

const window = Dimensions.get('window');
const MAX_BUBBLE_WIDTH = window.width * 0.75;

const MessageBubble = ({ message, isOwn, onLongPress, repliedToMessage }) => {
  const theme = useTheme();
  
  // Format message time
  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'h:mm a');
    } catch (error) {
      return '';
    }
  };
  
  // Parse attachments if any
  const attachments = message.attachments 
    ? JSON.parse(message.attachments) 
    : [];
  
  return (
    <View style={[
      styles.container,
      isOwn ? styles.ownContainer : styles.otherContainer
    ]}>
      {/* Sender Avatar (for messages from others) */}
      {!isOwn && (
        <Avatar.Image
          size={30}
          source={
            message.profiles?.avatar_url 
              ? { uri: message.profiles.avatar_url } 
              : require('../assets/default-avatar.png')
          }
          style={styles.avatar}
        />
      )}
      
      {/* Message Content */}
      <Pressable
        onLongPress={() => onLongPress(message)}
        style={({ pressed }) => [
          styles.bubbleContainer,
          pressed && styles.pressed
        ]}
      >
        {/* Replied Message Preview */}
        {repliedToMessage && (
          <View style={[
            styles.replyPreview,
            { 
              backgroundColor: isOwn 
                ? 'rgba(255, 255, 255, 0.2)' 
                : 'rgba(0, 0, 0, 0.05)' 
            }
          ]}>
            <Text style={[
              styles.replyName,
              { color: isOwn ? 'rgba(255, 255, 255, 0.9)' : theme.colors.primary }
            ]}>
              {repliedToMessage.profiles?.display_name || 'User'}
            </Text>
            <Text 
              style={[
                styles.replyContent,
                { 
                  color: isOwn ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)' 
                }
              ]}
              numberOfLines={1}
            >
              {repliedToMessage.is_deleted 
                ? 'This message was deleted' 
                : repliedToMessage.content || 'Attachment'}
            </Text>
          </View>
        )}
        
        {/* Bubble */}
        <View style={[
          styles.bubble,
          isOwn 
            ? [styles.ownBubble, { backgroundColor: theme.colors.primary }] 
            : [styles.otherBubble, { backgroundColor: theme.colors.surface }],
        ]}>
          {/* Sender Name (for messages from others) */}
          {!isOwn && !message.is_deleted && (
            <Text style={styles.senderName}>
              {message.profiles?.display_name || message.profiles?.username || 'User'}
            </Text>
          )}
          
          {/* Message Text Content */}
          {message.is_deleted ? (
            <Text style={[
              styles.deletedText,
              { color: isOwn ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)' }
            ]}>
              This message was deleted
            </Text>
          ) : (
            <>
              {message.content && (
                <Text style={[
                  styles.messageText,
                  { color: isOwn ? 'white' : theme.colors.text }
                ]}>
                  {message.content}
                </Text>
              )}
              
              {/* Attachments */}
              {attachments.length > 0 && (
                <View style={styles.attachmentsContainer}>
                  {attachments.map((attachment, index) => (
                    <AttachmentPreview
                      key={`attachment-${message.id}-${index}`}
                      attachment={attachment}
                      inMessage={true}
                      isOwn={isOwn}
                    />
                  ))}
                </View>
              )}
            </>
          )}
          
          {/* Timestamp */}
          <Text style={[
            styles.timeText,
            { color: isOwn ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)' }
          ]}>
            {formatTime(message.created_at)}
            {message.is_edited && ' (edited)'}
          </Text>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 8,
    maxWidth: MAX_BUBBLE_WIDTH,
  },
  ownContainer: {
    alignSelf: 'flex-end',
    marginLeft: 50,
  },
  otherContainer: {
    alignSelf: 'flex-start',
    marginRight: 50,
  },
  avatar: {
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  bubbleContainer: {
    maxWidth: '100%',
  },
  pressed: {
    opacity: 0.8,
  },
  bubble: {
    borderRadius: 16,
    padding: 12,
    minWidth: 80,
  },
  ownBubble: {
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  senderName: {
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  deletedText: {
    fontStyle: 'italic',
    fontSize: 14,
  },
  timeText: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  replyPreview: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#4caf50',
  },
  replyName: {
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 2,
  },
  replyContent: {
    fontSize: 12,
  },
  attachmentsContainer: {
    marginTop: 8,
  },
});

export default MessageBubble;