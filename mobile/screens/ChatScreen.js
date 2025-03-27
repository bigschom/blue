// ChatScreen.js - Main chat list screen for mobile app
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Searchbar,
  Avatar,
  Badge,
  Divider,
  FAB,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import EmptyState from '../components/EmptyState';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';

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

const ChatScreen = ({ navigation }) => {
  const { user } = useAuth();
  const theme = useTheme();
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [subscription, setSubscription] = useState(null);

  // Fetch conversations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchConversations();
      setupSubscription();
      
      return () => {
        // Clean up subscription when screen loses focus
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }, [user?.id])
  );

  // Setup real-time subscription for new messages
  const setupSubscription = async () => {
    if (!user?.id) return;
    
    try {
      // Get all conversations the user is part of
      const { data: membershipData } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);
        
      if (!membershipData || membershipData.length === 0) return;
      
      // Create a list of conversation IDs
      const conversationIds = membershipData.map(m => m.conversation_id);
      
      // Subscribe to new messages in any of user's conversations
      const newSub = supabase
        .channel('new_messages')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=in.(${conversationIds.join(',')})`,
        }, (payload) => {
          // Refresh conversations when new message is received
          fetchConversations();
        })
        .subscribe();
        
      setSubscription(newSub);
    } catch (error) {
      console.error('Error setting up message subscription:', error);
    }
  };

  // Fetch conversations with latest messages
  const fetchConversations = async () => {
    try {
      setIsRefreshing(true);
      
      if (!user?.id) return;
      
      // Get conversations the user is part of
      const { data: membershipData, error: membershipError } = await supabase
        .from('conversation_members')
        .select(`
          conversation_id,
          conversations:conversation_id (
            id,
            name,
            is_group,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id);
        
      if (membershipError) throw membershipError;
      
      if (!membershipData || membershipData.length === 0) {
        setConversations([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }
      
      // Extract conversation IDs
      const conversationIds = membershipData.map(m => m.conversation_id);
      
      // For each conversation, get the latest message and participants
      const conversationsWithDetails = await Promise.all(membershipData.map(async (membership) => {
        try {
          const conversation = membership.conversations;
          
          // Get latest message
          const { data: latestMessageData, error: messageError } = await supabase
            .from('messages')
            .select('id, content, sender_id, created_at, attachments, is_deleted')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (messageError) throw messageError;
          
          const latestMessage = latestMessageData && latestMessageData.length > 0 
            ? latestMessageData[0] 
            : null;
            
          // For 1-on-1 chats, get the other participant's details
          let otherParticipant = null;
          
          if (!conversation.is_group) {
            // Get the other participant in the conversation
            const { data: participantsData, error: participantsError } = await supabase
              .from('conversation_members')
              .select(`
                user_id,
                profiles:user_id (
                  username,
                  display_name,
                  avatar_url
                )
              `)
              .eq('conversation_id', conversation.id)
              .neq('user_id', user.id)
              .single();
              
            if (!participantsError && participantsData) {
              otherParticipant = {
                id: participantsData.user_id,
                username: participantsData.profiles.username,
                display_name: participantsData.profiles.display_name,
                avatar_url: participantsData.profiles.avatar_url
              };
            }
          }
          
          // Get unread message count
          const { data: memberData, error: memberError } = await supabase
            .from('conversation_members')
            .select('last_read_at')
            .eq('conversation_id', conversation.id)
            .eq('user_id', user.id)
            .single();
            
          let unreadCount = 0;
          
          if (!memberError && memberData && memberData.last_read_at) {
            const { count, error: countError } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conversation.id)
              .gt('created_at', memberData.last_read_at)
              .neq('sender_id', user.id);
              
            if (!countError) {
              unreadCount = count || 0;
            }
          }
          
          // Format message preview
          let messagePreview = '';
          
          if (latestMessage) {
            if (latestMessage.is_deleted) {
              messagePreview = 'This message was deleted';
            } else if (latestMessage.content) {
              messagePreview = latestMessage.content;
            } else if (latestMessage.attachments) {
              const attachments = JSON.parse(latestMessage.attachments);
              if (attachments.length > 0) {
                messagePreview = `Sent ${attachments.length} ${attachments.length === 1 ? 'file' : 'files'}`;
              }
            }
          }
          
          return {
            id: conversation.id,
            name: conversation.is_group ? conversation.name : otherParticipant?.display_name || otherParticipant?.username || 'Unknown User',
            is_group: conversation.is_group,
            last_message: messagePreview,
            last_message_time: latestMessage?.created_at,
            unread_count: unreadCount,
            avatar_url: otherParticipant?.avatar_url || null,
            other_user_id: otherParticipant?.id || null
          };
        } catch (error) {
          console.error('Error getting conversation details:', error);
          return null;
        }
      }));
      
      // Filter out null values and sort by latest message
      const validConversations = conversationsWithDetails
        .filter(conv => conv !== null)
        .sort((a, b) => {
          if (!a.last_message_time) return 1;
          if (!b.last_message_time) return -1;
          return new Date(b.last_message_time) - new Date(a.last_message_time);
        });
      
      setConversations(validConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Handle refresh pull-down
  const onRefresh = () => {
    fetchConversations();
  };

  // Filter conversations by search query
  const filteredConversations = searchQuery
    ? conversations.filter(conv => 
        conv.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  // Format time for display
  const formatMessageTime = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return '';
    }
  };

  // Render conversation item
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => navigation.navigate('ChatDetail', { 
        conversationId: item.id,
        contactName: item.name,
        contactId: item.other_user_id,
        isGroup: item.is_group
      })}
    >
      <Avatar.Image
        size={50}
        source={item.avatar_url ? { uri: item.avatar_url } : require('../assets/default-avatar.png')}
        style={styles.avatar}
      />
      <View style={styles.conversationDetails}>
        <View style={styles.nameRow}>
          <Text
            style={[
              styles.conversationName,
              { color: theme.colors.text }
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={[
              styles.timeText,
              { color: theme.colors.text }
            ]}
          >
            {formatMessageTime(item.last_message_time)}
          </Text>
        </View>
        <View style={styles.messageRow}>
          <Text
            style={[
              styles.messagePreview,
              { color: theme.colors.text }
            ]}
            numberOfLines={1}
          >
            {item.last_message || 'Start a conversation'}
          </Text>
          {item.unread_count > 0 && (
            <Badge
              style={[
                styles.unreadBadge,
                { backgroundColor: theme.colors.primary }
              ]}
            >
              {item.unread_count}
            </Badge>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Search conversations"
        onChangeText={query => setSearchQuery(query)}
        value={searchQuery}
        style={styles.searchbar}
      />
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : filteredConversations.length === 0 ? (
        <EmptyState
          icon="chat-outline"
          title="No conversations yet"
          message="Start chatting with your contacts"
          buttonText="Go to Contacts"
          onButtonPress={() => navigation.navigate('Contacts')}
        />
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          ItemSeparatorComponent={() => <Divider />}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
            />
          }
        />
      )}
      
      <FAB
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        icon="plus"
        onPress={() => navigation.navigate('Contacts')}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchbar: {
    margin: 16,
    elevation: 2,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  avatar: {
    marginRight: 16,
  },
  conversationDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontWeight: 'bold',
    fontSize: 16,
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    opacity: 0.6,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messagePreview: {
    fontSize: 14,
    opacity: 0.8,
    flex: 1,
  },
  unreadBadge: {
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default ChatScreen;