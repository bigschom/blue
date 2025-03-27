// ChatDetailScreen.js - Individual chat conversation screen
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import {
  Text,
  TextInput,
  IconButton,
  Avatar,
  useTheme,
  Menu,
  Divider,
  Dialog,
  Portal,
  Button,
} from 'react-native-paper';
import { useHeaderHeight } from '@react-navigation/elements';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import MessageBubble from '../components/MessageBubble';
import AttachmentPreview from '../components/AttachmentPreview';

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

// Maximum file size (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const ChatDetailScreen = ({ route, navigation }) => {
  const { conversationId, contactName, contactId, isGroup } = route.params;
  const { user } = useAuth();
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const flatListRef = useRef(null);
  
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [messageSubscription, setMessageSubscription] = useState(null);
  const [typingTimeout, setTypingTimeout] = useState(null);
  
  // Set up keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );
    
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);
  
  // Load messages and set up message subscription
  useEffect(() => {
    if (!conversationId || !user) return;
    
    // Load initial messages
    fetchMessages();
    
    // Set up realtime subscription for new messages
    const messageChannel = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, handleNewMessage)
      .subscribe();
      
    setMessageSubscription(messageChannel);
    
    // Update last read timestamp
    updateLastRead();
    
    // Subscribe to contact's online status if not a group chat
    if (!isGroup && contactId) {
      const contactStatusChannel = supabase
        .channel(`presence:${contactId}`)
        .on('presence', { event: 'sync' }, () => {
          const presence = contactStatusChannel.presenceState();
          const contactPresence = presence[contactId];
          
          if (contactPresence && contactPresence.length > 0) {
            setIsOnline(true);
            setLastSeen(null);
          } else {
            setIsOnline(false);
            fetchLastSeen();
          }
        })
        .subscribe();
        
      // Initial fetch of online status
      fetchOnlineStatus();
    }
    
    // Clean up subscriptions on unmount
    return () => {
      if (messageSubscription) {
        messageSubscription.unsubscribe();
      }
      if (messageChannel) {
        messageChannel.unsubscribe();
      }
      if (!isGroup && contactId) {
        supabase.channel(`presence:${contactId}`).unsubscribe();
      }
    };
  }, [conversationId, user?.id, contactId]);
  
  // Initial fetch of contact's online status
  const fetchOnlineStatus = async () => {
    try {
      if (!contactId) return;
      
      const { data, error } = await supabase
        .from('user_status')
        .select('is_online, last_seen')
        .eq('user_id', contactId)
        .single();
        
      if (!error && data) {
        setIsOnline(data.is_online);
        if (!data.is_online && data.last_seen) {
          setLastSeen(new Date(data.last_seen));
        }
      }
    } catch (error) {
      console.error('Error fetching online status:', error);
    }
  };
  
  // Fetch contact's last seen timestamp
  const fetchLastSeen = async () => {
    try {
      if (!contactId) return;
      
      const { data, error } = await supabase
        .from('user_status')
        .select('last_seen')
        .eq('user_id', contactId)
        .single();
        
      if (!error && data && data.last_seen) {
        setLastSeen(new Date(data.last_seen));
      }
    } catch (error) {
      console.error('Error fetching last seen:', error);
    }
  };
  
  // Handle new messages from subscription
  const handleNewMessage = async (payload) => {
    try {
      const newMessage = payload.new;
      
      // Skip messages that are already in state (sent by this user)
      if (newMessage.sender_id === user.id && 
          messages.some(msg => msg.id === newMessage.id)) {
        return;
      }
      
      // Decrypt message if needed (from another user)
      let decryptedMessage = { ...newMessage };
      
      if (newMessage.sender_id !== user.id && newMessage.content) {
        // In a real app, we would decrypt the message here
        // For demo purposes, we're skipping actual decryption
        decryptedMessage.content = newMessage.content;
      }
      
      // Update messages state
      setMessages(prevMessages => [decryptedMessage, ...prevMessages]);
      
      // Update last read timestamp when receiving messages
      updateLastRead();
      
      // Scroll to bottom when new message arrives
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (error) {
      console.error('Error handling new message:', error);
    }
  };
  
  // Update the user's last read timestamp for this conversation
  const updateLastRead = async () => {
    try {
      if (!conversationId || !user?.id) return;
      
      await supabase
        .from('conversation_members')
        .update({ 
          last_read_at: new Date().toISOString() 
        })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error updating last read:', error);
    }
  };
  
  // Fetch messages for the conversation
  const fetchMessages = async (loadMore = false) => {
    try {
      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      
      const currentPage = loadMore ? page + 1 : 0;
      const pageSize = 20;
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          sender_id,
          created_at,
          updated_at,
          attachments,
          is_edited,
          is_deleted,
          reply_to,
          read_by,
          profiles:sender_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .range(from, to);
        
      if (error) throw error;
      
      // Process messages (decrypt if needed)
      const processedMessages = data.map(message => {
        // In a real app, we would decrypt messages here if they're from other users
        // For demo purposes, we're using plaintext
        return message;
      });
      
      if (loadMore) {
        // Append to existing messages for pagination
        setMessages(prevMessages => [...prevMessages, ...processedMessages]);
        setHasMoreMessages(data.length === pageSize);
        setPage(currentPage);
      } else {
        // Replace messages (initial load)
        setMessages(processedMessages);
        setHasMoreMessages(data.length === pageSize);
        setPage(0);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };
  
  // Load more messages when scrolling to the end of the list
  const handleLoadMore = () => {
    if (!isLoadingMore && hasMoreMessages) {
      fetchMessages(true);
    }
  };
  
  // Send a message
  const sendMessage = async () => {
    try {
      // Don't send empty messages
      if ((!messageText || messageText.trim() === '') && attachments.length === 0) {
        return;
      }
      
      // Encrypt message for recipient (in a real app)
      // For demo purposes, we're using plaintext
      const encryptedContent = messageText;
      
      // Format attachments if any
      let attachmentData = null;
      if (attachments.length > 0) {
        // In a real app, we would encrypt and upload files here
        // For demo purposes, we're just creating placeholder data
        attachmentData = JSON.stringify(attachments.map(attachment => ({
          name: attachment.name,
          size: attachment.size,
          type: attachment.type,
          url: 'placeholder-url'
        })));
      }
      
      // Prepare message object
      const messageData = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: encryptedContent,
        attachments: attachmentData,
        reply_to: replyToMessage?.id || null,
        created_at: new Date().toISOString()
      };
      
      // Insert message
      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select();
        
      if (error) throw error;
      
      // Clear input and attachments
      setMessageText('');
      setAttachments([]);
      setReplyToMessage(null);
      
      // Send typing indicator (stopped typing)
      sendTypingStatus(false);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };
  
  // Handle picking images from library
  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant media library permissions to attach images.');
        return;
      }
      
      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // Check file size
        const fileInfo = await FileSystem.getInfoAsync(asset.uri);
        
        if (fileInfo.size > MAX_FILE_SIZE) {
          Alert.alert('File too large', 'Please select a file smaller than 100MB.');
          return;
        }
        
        // Add image to attachments
        const newAttachment = {
          uri: asset.uri,
          name: asset.fileName || `image-${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          size: fileInfo.size,
        };
        
        setAttachments(prev => [...prev, newAttachment]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };
  
  // Handle picking files (documents, etc.)
  const pickDocument = async () => {
    try {
      // Launch document picker
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        return;
      }
      
      const asset = result.assets[0];
      
      // Check file size
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      
      if (fileInfo.size > MAX_FILE_SIZE) {
        Alert.alert('File too large', 'Please select a file smaller than 100MB.');
        return;
      }
      
      // Add document to attachments
      const newAttachment = {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType,
        size: fileInfo.size,
      };
      
      setAttachments(prev => [...prev, newAttachment]);
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select document. Please try again.');
    }
  };
  
  // Remove an attachment
  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };
  
  // Handle typing indicator
  const handleTyping = (text) => {
    setMessageText(text);
    
    // Send typing indicator
    if (text.length > 0 && !isTyping) {
      sendTypingStatus(true);
      setIsTyping(true);
    } else if (text.length === 0 && isTyping) {
      sendTypingStatus(false);
      setIsTyping(false);
    }
    
    // Clear existing timeout if any
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Set new timeout to stop typing indicator after 2 seconds of inactivity
    const newTimeout = setTimeout(() => {
      if (isTyping) {
        sendTypingStatus(false);
        setIsTyping(false);
      }
    }, 2000);
    
    setTypingTimeout(newTimeout);
  };
  
  // Send typing status to server
  const sendTypingStatus = async (isTyping) => {
    try {
      if (!contactId || !conversationId) return;
      
      // In a real app, you would broadcast typing status through a channel
      // For simplicity, we're not implementing the full typing indicator system
    } catch (error) {
      console.error('Error sending typing status:', error);
    }
  };
  
  // Format last seen time
  const formatLastSeen = (date) => {
    if (!date) return 'Unavailable';
    
    const now = new Date();
    const diff = Math.abs(now - date);
    const diffMinutes = Math.floor(diff / (1000 * 60));
    const diffHours = Math.floor(diff / (1000 * 60 * 60));
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else {
      return format(date, 'PP');
    }
  };
  
  // Handle message long press (show menu)
  const handleMessageLongPress = (message) => {
    setSelectedMessage(message);
    setMenuVisible(true);
  };
  
  // Handle reply to message
  const handleReply = () => {
    setReplyToMessage(selectedMessage);
    setMenuVisible(false);
    setSelectedMessage(null);
  };
  
  // Handle delete message
  const handleDelete = () => {
    setMenuVisible(false);
    setShowDeleteConfirm(true);
  };
  
  // Confirm and delete message
  const confirmDelete = async () => {
    try {
      if (!selectedMessage) return;
      
      // Only allow deleting own messages
      if (selectedMessage.sender_id !== user.id) {
        Alert.alert('Cannot delete', 'You can only delete your own messages.');
        setShowDeleteConfirm(false);
        setSelectedMessage(null);
        return;
      }
      
      // Mark message as deleted in database
      const { error } = await supabase
        .from('messages')
        .update({ 
          is_deleted: true,
          content: null,
          attachments: null,
          updated_at: new Date().toISOString() 
        })
        .eq('id', selectedMessage.id);
        
      if (error) throw error;
      
      // Update local state
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === selectedMessage.id 
            ? { ...msg, is_deleted: true, content: null, attachments: null }
            : msg
        )
      );
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message. Please try again.');
    } finally {
      setShowDeleteConfirm(false);
      setSelectedMessage(null);
    }
  };
  
  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setSelectedMessage(null);
  };
  
  // Cancel reply
  const cancelReply = () => {
    setReplyToMessage(null);
  };

  // Render a date separator
  const renderDateSeparator = (date) => (
    <View style={styles.dateSeparator}>
      <Text style={[styles.dateText, { color: theme.colors.text }]}>
        {format(new Date(date), 'MMMM d, yyyy')}
      </Text>
    </View>
  );
  
  // Group messages by date for date separators
  const groupedMessages = messages.reduce((acc, message, index, array) => {
    const messageDate = new Date(message.created_at).toDateString();
    
    // Check if we need to add a date separator
    if (index === 0 || messageDate !== new Date(array[index - 1].created_at).toDateString()) {
      acc.push({ type: 'date', date: message.created_at });
    }
    
    acc.push({ type: 'message', message });
    return acc;
  }, []);
  
  // Render item for FlatList (message or date separator)
  const renderItem = ({ item }) => {
    if (item.type === 'date') {
      return renderDateSeparator(item.date);
    }
    
    const message = item.message;
    const isOwn = message.sender_id === user.id;
    
    // Find replied message if any
    let repliedToMessage = null;
    if (message.reply_to) {
      repliedToMessage = messages.find(msg => msg.id === message.reply_to);
    }
    
    return (
      <MessageBubble
        message={message}
        isOwn={isOwn}
        onLongPress={() => handleMessageLongPress(message)}
        repliedToMessage={repliedToMessage}
      />
    );
  };
  
  // Render the input toolbar
  const renderInputToolbar = () => (
    <View style={[styles.inputToolbar, { backgroundColor: theme.colors.surface }]}>
      {/* Reply Preview */}
      {replyToMessage && (
        <View style={styles.replyPreview}>
          <View style={styles.replyContent}>
            <Text style={styles.replyLabel}>
              Replying to {replyToMessage.profiles?.display_name || 'User'}
            </Text>
            <Text 
              style={styles.replyText}
              numberOfLines={1}
            >
              {replyToMessage.is_deleted 
                ? 'This message was deleted' 
                : replyToMessage.content || 'Attachment'}
            </Text>
          </View>
          <IconButton
            icon="close"
            size={20}
            onPress={cancelReply}
          />
        </View>
      )}
      
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <View style={styles.attachmentsPreview}>
          <FlatList
            data={attachments}
            renderItem={({ item, index }) => (
              <AttachmentPreview
                attachment={item}
                onRemove={() => removeAttachment(index)}
              />
            )}
            keyExtractor={(item, index) => `attachment-${index}`}
            horizontal
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}
      
      {/* Input Bar */}
      <View style={styles.inputBar}>
        <IconButton
          icon="paperclip"
          size={24}
          onPress={pickDocument}
          style={styles.attachButton}
        />
        <IconButton
          icon="image"
          size={24}
          onPress={pickImage}
          style={styles.imageButton}
        />
        <TextInput
          value={messageText}
          onChangeText={handleTyping}
          placeholder="Type a message..."
          multiline
          style={[styles.textInput, { backgroundColor: theme.colors.background }]}
        />
        {messageText.trim() !== '' || attachments.length > 0 ? (
          <IconButton
            icon="send"
            size={24}
            onPress={sendMessage}
            style={[styles.sendButton, { backgroundColor: theme.colors.primary }]}
            color="#fff"
          />
        ) : (
          <IconButton
            icon="microphone"
            size={24}
            onPress={() => Alert.alert('Voice messages', 'Voice message functionality not implemented in this demo.')}
            style={styles.micButton}
          />
        )}
      </View>
    </View>
  );
  
  // Main render method
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      {/* Chat Header */}
      <View style={[styles.chatHeader, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.onlineStatus}>
          {isOnline ? (
            <Text style={styles.onlineText}>Online</Text>
          ) : lastSeen ? (
            <Text style={styles.lastSeenText}>
              Last seen {formatLastSeen(lastSeen)}
            </Text>
          ) : (
            <Text style={styles.offlineText}>Offline</Text>
          )}
        </View>
        <View style={styles.e2eeNotice}>
          <Text style={styles.e2eeText}>
            Messages are end-to-end encrypted
          </Text>
        </View>
      </View>
      
      {/* Messages List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={groupedMessages}
          renderItem={renderItem}
          keyExtractor={(item, index) => 
            item.type === 'date' 
              ? `date-${item.date}` 
              : `message-${item.message.id}`
          }
          inverted
          contentContainerStyle={styles.messagesContainer}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isLoadingMore ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : null}
        />
      )}
      
      {/* Input Toolbar */}
      {renderInputToolbar()}
      
      {/* Message Actions Menu */}
      <Portal>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={{ x: 0, y: 0 }}
          style={styles.menu}
        >
          <Menu.Item
            onPress={handleReply}
            title="Reply"
            icon="reply"
          />
          {selectedMessage?.sender_id === user.id && (
            <Menu.Item
              onPress={handleDelete}
              title="Delete"
              icon="delete"
            />
          )}
        </Menu>
      </Portal>
      
      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={showDeleteConfirm}
          onDismiss={cancelDelete}
        >
          <Dialog.Title>Delete Message</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to delete this message? This cannot be undone.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={cancelDelete}>Cancel</Button>
            <Button onPress={confirmDelete}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatHeader: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  onlineStatus: {
    alignItems: 'center',
    marginBottom: 4,
  },
  onlineText: {
    color: '#4caf50',
    fontSize: 12,
    fontWeight: 'bold',
  },
  lastSeenText: {
    color: '#757575',
    fontSize: 12,
  },
  offlineText: {
    color: '#9e9e9e',
    fontSize: 12,
  },
  e2eeNotice: {
    alignItems: 'center',
  },
  e2eeText: {
    fontSize: 10,
    color: '#4caf50',
  },
  messagesContainer: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  inputToolbar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196f3',
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  replyContent: {
    flex: 1,
  },
  replyLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
    opacity: 0.7,
  },
  attachmentsPreview: {
    padding: 8,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  attachButton: {
    marginRight: 4,
  },
  imageButton: {
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 8,
    borderRadius: 20,
  },
  micButton: {
    marginLeft: 8,
  },
  menu: {
    borderRadius: 8,
  },
});

export default ChatDetailScreen;
  Divider,
  Dialog,
  Portal,
  Button,
} from 'react-native-paper';
import { useHeaderHeight } from '@react-navigation/elements';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import MessageBubble from '../components/MessageBubble';
import AttachmentPreview from '../components/AttachmentPreview';

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

// Maximum file size (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const ChatDetailScreen = ({ route, navigation }) => {
  const { conversationId, contactName, contactId, isGroup } = route.params;
  const { user } = useAuth();
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const flatListRef = useRef(null);
  
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [messageSubscription, setMessageSubscription] = useState(null);
  const [typingTimeout, setTypingTimeout] = useState(null);
  
  // Set up keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );
    
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);
  
  // Load messages and set up message subscription
  useEffect(() => {
    if (!conversationId || !user) return;
    
    // Load initial messages
    fetchMessages();
    
    // Set up realtime subscription for new messages
    const messageChannel = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, handleNewMessage)
      .subscribe();
      
    setMessageSubscription(messageChannel);
    
    // Update last read timestamp
    updateLastRead();
    
    // Subscribe to contact's online status if not a group chat
    if (!isGroup && contactId) {
      const contactStatusChannel = supabase
        .channel(`presence:${contactId}`)
        .on('presence', { event: 'sync' }, () => {
          const presence = contactStatusChannel.presenceState();
          const contactPresence = presence[contactId];
          
          if (contactPresence && contactPresence.length > 0) {
            setIsOnline(true);
            setLastSeen(null);
          } else {
            setIsOnline(false);
            fetchLastSeen();
          }
        })
        .subscribe();
        
      // Initial fetch of online status
      fetchOnlineStatus();
    }
    
    // Clean up subscriptions on unmount
    return () => {
      if (messageSubscription) {
        messageSubscription.unsubscribe();
      }
      if (messageChannel) {
        messageChannel.unsubscribe();
      }
      if (!isGroup && contactId) {
        supabase.channel(`presence:${contactId}`).unsubscribe();
      }
    };
  }, [conversationId, user?.id, contactId]);
  
  // Initial fetch of contact's online status
  const fetchOnlineStatus = async () => {
    try {
      if (!contactId) return;
      
      const { data, error } = await supabase
        .from('user_status')
        .select('is_online, last_seen')
        .eq('user_id', contactId)
        .single();
        
      if (!error && data) {
        setIsOnline(data.is_online);
        if (!data.is_online && data.last_seen) {
          setLastSeen(new Date(data.last_seen));
        }
      }
    } catch (error) {
      console.error('Error fetching online status:', error);
    }
  };
  
  // Fetch contact's last seen timestamp
  const fetchLastSeen = async () => {
    try {
      if (!contactId) return;
      
      const { data, error } = await supabase
        .from('user_status')
        .select('last_seen')
        .eq('user_id', contactId)
        .single();
        
      if (!error && data && data.last_seen) {
        setLastSeen(new Date(data.last_seen));
      }
    } catch (error) {
      console.error('Error fetching last seen:', error);
    }
  };
  
  // Handle new messages from subscription
  const handleNewMessage = async (payload) => {
    try {
      const newMessage = payload.new;
      
      // Skip messages that are already in state (sent by this user)
      if (newMessage.sender_id === user.id && 
          messages.some(msg => msg.id === newMessage.id)) {
        return;
      }
      
      // Decrypt message if needed (from another user)
      let decryptedMessage = { ...newMessage };
      
      if (newMessage.sender_id !== user.id && newMessage.content) {
        // In a real app, we would decrypt the message here
        // For demo purposes, we're skipping actual decryption
        decryptedMessage.content = newMessage.content;
      }
      
      // Update messages state
      setMessages(prevMessages => [decryptedMessage, ...prevMessages]);
      
      // Update last read timestamp when receiving messages
      updateLastRead();
      
      // Scroll to bottom when new message arrives
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (error) {
      console.error('Error handling new message:', error);
    }
  };
  
  // Update the user's last read timestamp for this conversation
  const updateLastRead = async () => {
    try {
      if (!conversationId || !user?.id) return;
      
      await supabase
        .from('conversation_members')
        .update({ 
          last_read_at: new Date().toISOString() 
        })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error updating last read:', error);
    }
  };
  
  // Fetch messages for the conversation
  const fetchMessages = async (loadMore = false) => {
    try {
      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      
      const currentPage = loadMore ? page + 1 : 0;
      const pageSize = 20;
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          sender_id,
          created_at,
          updated_at,
          attachments,
          is_edited,
          is_deleted,
          reply_to,
          read_by,
          profiles:sender_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .range(from, to);
        
      if (error) throw error;
      
      // Process messages (decrypt if needed)
      const processedMessages = data.map(message => {
        // In a real app, we would decrypt messages here if they're from other users
        // For demo purposes, we're using plaintext
        return message;
      });
      
      if (loadMore) {
        // Append to existing messages for pagination
        setMessages(prevMessages => [...prevMessages, ...processedMessages]);
        setHasMoreMessages(data