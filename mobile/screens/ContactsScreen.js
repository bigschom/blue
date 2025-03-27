// ContactsScreen.js - Contacts list and management screen for mobile app
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Searchbar,
  Avatar,
  IconButton,
  Divider,
  FAB,
  useTheme,
  Dialog,
  Portal,
  Button,
  TextInput,
  Menu,
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { BarCodeScanner } from 'expo-barcode-scanner';

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

const ContactsScreen = ({ navigation }) => {
  const { user, profile } = useAuth();
  const theme = useTheme();
  
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showShareQR, setShowShareQR] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [newContact, setNewContact] = useState({
    username: '',
    name: '',
    isSubmitting: false,
    error: '',
  });
  
  // Fetch contacts when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchContacts();
    }, [user?.id])
  );
  
  // Filter contacts based on search query
  useEffect(() => {
    if (!searchQuery) {
      setFilteredContacts(contacts);
      return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = contacts.filter(contact => {
      return (
        contact.name.toLowerCase().includes(query) ||
        (contact.profiles?.username && contact.profiles.username.toLowerCase().includes(query)) ||
        (contact.profiles?.display_name && contact.profiles.display_name.toLowerCase().includes(query))
      );
    });
    
    setFilteredContacts(filtered);
  }, [searchQuery, contacts]);
  
  // Fetch contacts from database
  const fetchContacts = async () => {
    try {
      setIsRefreshing(true);
      
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          name,
          favorite,
          blocked,
          created_at,
          contact_user_id,
          profiles:contact_user_id (
            username,
            display_name,
            avatar_url
          ),
          user_status:contact_user_id (
            is_online,
            last_seen
          )
        `)
        .eq('user_id', user.id)
        .order('name', { ascending: true });
        
      if (error) throw error;
      
      // Get the last message for each contact
      const contactsWithLastMessage = await Promise.all(data.map(async (contact) => {
        try {
          // Find conversation between current user and contact
          const { data: convoData, error: convoError } = await supabase
            .from('conversations')
            .select('id')
            .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
            .or(`user1_id.eq.${contact.contact_user_id},user2_id.eq.${contact.contact_user_id}`);
            
          if (convoError || !convoData?.length) {
            return { ...contact, last_message: null, last_message_time: null };
          }
          
          // Get the latest message from this conversation
          const { data: messageData, error: messageError } = await supabase
            .from('messages')
            .select('content, created_at, attachments')
            .eq('conversation_id', convoData[0].id)
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (messageError || !messageData?.length) {
            return { ...contact, last_message: null, last_message_time: null };
          }
          
          // Format message preview
          let messagePreview = messageData[0].content || '';
          
          if (messageData[0].attachments) {
            const attachments = JSON.parse(messageData[0].attachments);
            if (attachments.length > 0) {
              if (!messagePreview) {
                messagePreview = `Sent ${attachments.length} ${attachments.length === 1 ? 'file' : 'files'}`;
              } else {
                messagePreview += ` + ${attachments.length} ${attachments.length === 1 ? 'file' : 'files'}`;
              }
            }
          }
          
          return {
            ...contact,
            last_message: messagePreview,
            last_message_time: messageData[0].created_at
          };
        } catch (err) {
          console.error('Error getting last message:', err);
          return { ...contact, last_message: null, last_message_time: null };
        }
      }));
      
      setContacts(contactsWithLastMessage);
      setFilteredContacts(contactsWithLastMessage);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  // Handle refresh
  const onRefresh = () => {
    fetchContacts();
  };
  
  // Handle search
  const handleSearch = (query) => {
    setSearchQuery(query);
  };
  
  // Handle contact select
  const handleContactSelect = (contact) => {
    // Find existing conversation or create new one
    navigation.navigate('ChatDetail', {
      contactId: contact.contact_user_id,
      contactName: contact.name
    });
  };
  
  // Show contact menu
  const showMenu = (contact, event) => {
    // Get position from event
    const { pageX, pageY } = event.nativeEvent;
    setMenuPosition({ x: pageX, y: pageY });
    setSelectedContact(contact);
    setMenuVisible(true);
  };
  
  // Toggle favorite status
  const toggleFavorite = async () => {
    if (!selectedContact) return;
    
    try {
      setMenuVisible(false);
      
      const { error } = await supabase
        .from('contacts')
        .update({ favorite: !selectedContact.favorite })
        .eq('id', selectedContact.id);
        
      if (error) throw error;
      
      // Update local state
      setContacts(contacts.map(contact => 
        contact.id === selectedContact.id 
          ? { ...contact, favorite: !selectedContact.favorite } 
          : contact
      ));
      
      setFilteredContacts(filteredContacts.map(contact => 
        contact.id === selectedContact.id 
          ? { ...contact, favorite: !selectedContact.favorite } 
          : contact
      ));
    } catch (error) {
      console.error('Error toggling favorite status:', error);
      Alert.alert('Error', 'Failed to update contact');
    }
  };
  
  // Delete contact
  const deleteContact = async () => {
    if (!selectedContact) return;
    
    try {
      setMenuVisible(false);
      
      // Confirm deletion
      Alert.alert(
        'Delete Contact',
        `Are you sure you want to delete "${selectedContact.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: async () => {
              const { error } = await supabase
                .from('contacts')
                .delete()
                .eq('id', selectedContact.id);
                
              if (error) throw error;
              
              // Update local state
              setContacts(contacts.filter(contact => contact.id !== selectedContact.id));
              setFilteredContacts(filteredContacts.filter(contact => contact.id !== selectedContact.id));
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error deleting contact:', error);
      Alert.alert('Error', 'Failed to delete contact');
    }
  };
  
  // Request camera permission
  const requestCameraPermission = async () => {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    setHasPermission(status === 'granted');
    
    if (status === 'granted') {
      setShowQRScanner(true);
    } else {
      Alert.alert('Permission Denied', 'Camera permission is required to scan QR codes');
    }
  };
  
  // Handle QR code scan
  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true);
    setShowQRScanner(false);
    
    try {
      // Parse the QR code data
      const contactData = JSON.parse(data);
      
      if (contactData && contactData.username) {
        // Pre-fill the add contact form
        setNewContact({
          username: contactData.username,
          name: contactData.displayName || contactData.username,
          isSubmitting: false,
          error: ''
        });
        
        setShowAddDialog(true);
      } else {
        Alert.alert('Invalid QR Code', 'The scanned QR code is not a valid contact');
      }
    } catch (error) {
      Alert.alert('Invalid QR Code', 'Could not process the scanned QR code');
    }
  };
  
  // Handle add contact form submission
  const addContact = async () => {
    try {
      if (!newContact.username || !newContact.name) {
        setNewContact(prev => ({
          ...prev,
          error: 'Please fill in all fields'
        }));
        return;
      }
      
      setNewContact(prev => ({
        ...prev,
        isSubmitting: true,
        error: ''
      }));
      
      // Find user by username
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', newContact.username)
        .single();
        
      if (userError) {
        throw new Error('User not found');
      }
      
      // Check if already a contact
      const { data: existingContact, error: contactError } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .eq('contact_user_id', userData.id);
        
      if (existingContact && existingContact.length > 0) {
        throw new Error('This user is already in your contacts');
      }
      
      // Add contact
      const { data: newContactData, error: addError } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          contact_user_id: userData.id,
          name: newContact.name,
          created_at: new Date().toISOString()
        })
        .select();
        
      if (addError) throw addError;
      
      // Close dialog and refresh contacts
      setShowAddDialog(false);
      fetchContacts();
      
      // Reset form
      setNewContact({
        username: '',
        name: '',
        isSubmitting: false,
        error: ''
      });
    } catch (error) {
      console.error('Error adding contact:', error);
      setNewContact(prev => ({
        ...prev,
        isSubmitting: false,
        error: error.message
      }));
    }
  };
  
  // Format last seen time
  const formatLastSeen = (dateString) => {
    if (!dateString) return '';
    
    const now = new Date();
    const lastSeen = new Date(dateString);
    const diffTime = Math.abs(now - lastSeen);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    
    if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ago`;
    } else {
      return 'just now';
    }
  };
  
  // Render contact item
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={() => handleContactSelect(item)}
      onLongPress={(event) => showMenu(item, event)}
    >
      <View style={styles.avatarContainer}>
        <Avatar.Image
          size={50}
          source={item.profiles?.avatar_url ? { uri: item.profiles.avatar_url } : require('../assets/default-avatar.png')}
        />
        {item.user_status?.is_online && (
          <View style={[styles.onlineIndicator, { backgroundColor: theme.colors.primary }]} />
        )}
        {item.favorite && (
          <View style={[styles.favoriteIndicator, { backgroundColor: theme.colors.primary }]}>
            <IconButton
              icon="star"
              size={12}
              color="white"
              style={styles.favoriteIcon}
            />
          </View>
        )}
      </View>
      
      <View style={styles.contactInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.contactName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.last_message_time && (
            <Text style={styles.timeText}>
              {formatLastSeen(item.last_message_time)}
            </Text>
          )}
        </View>
        
        <View style={styles.statusRow}>
          {item.user_status?.is_online ? (
            <Text style={[styles.onlineStatus, { color: theme.colors.primary }]}>
              Online
            </Text>
          ) : item.user_status?.last_seen ? (
            <Text style={styles.offlineStatus}>
              Last seen {formatLastSeen(item.user_status.last_seen)}
            </Text>
          ) : (
            <Text style={styles.username}>
              @{item.profiles?.username || 'user'}
            </Text>
          )}
          
          <IconButton
            icon="dots-vertical"
            size={20}
            onPress={(event) => showMenu(item, event)}
            style={styles.menuButton}
          />
        </View>
        
        {item.last_message && (
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.last_message}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
  
  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <IconButton
        icon="account-multiple"
        size={50}
        color={theme.colors.primary}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyTitle}>No contacts found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? `No contacts match "${searchQuery}"`
          : "Add your first contact to start chatting"
        }
      </Text>
      
      {!searchQuery && (
        <Button
          mode="contained"
          onPress={() => setShowAddDialog(true)}
          style={styles.addButton}
        >
          Add Contact
        </Button>
      )}
    </View>
  );
  
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Search contacts"
        onChangeText={handleSearch}
        value={searchQuery}
        style={styles.searchBar}
      />
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <Divider />}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={filteredContacts.length === 0 ? styles.emptyList : null}
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
        onPress={() => setShowAddDialog(true)}
      />
      
      {/* Add Contact Dialog */}
      <Portal>
        <Dialog
          visible={showAddDialog}
          onDismiss={() => {
            setShowAddDialog(false);
            setNewContact({
              username: '',
              name: '',
              isSubmitting: false,
              error: ''
            });
          }}
        >
          <Dialog.Title>Add New Contact</Dialog.Title>
          <Dialog.Content>
            {newContact.error ? (
              <Text style={styles.errorText}>{newContact.error}</Text>
            ) : null}
            
            <TextInput
              label="Username"
              value={newContact.username}
              onChangeText={(text) => setNewContact(prev => ({ ...prev, username: text, error: '' }))}
              style={styles.input}
              left={<TextInput.Affix text="@" />}
            />
            
            <TextInput
              label="Display Name"
              value={newContact.name}
              onChangeText={(text) => setNewContact(prev => ({ ...prev, name: text, error: '' }))}
              style={styles.input}
            />
            
            <Button
              icon="qrcode-scan"
              mode="outlined"
              onPress={requestCameraPermission}
              style={styles.scanButton}
            >
              Scan QR Code
            </Button>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              onPress={addContact}
              loading={newContact.isSubmitting}
              disabled={newContact.isSubmitting}
            >
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* QR Scanner */}
      <Portal>
        <Dialog
          visible={showQRScanner}
          onDismiss={() => setShowQRScanner(false)}
          style={styles.scannerDialog}
        >
          <Dialog.Title>Scan Contact QR Code</Dialog.Title>
          <Dialog.Content>
            <View style={styles.scannerContainer}>
              {hasPermission === null ? (
                <Text>Requesting camera permission...</Text>
              ) : hasPermission === false ? (
                <Text>No access to camera</Text>
              ) : (
                <BarCodeScanner
                  onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                  style={styles.scanner}
                />
              )}
            </View>
            <Text style={styles.scannerInstructions}>
              Position the QR code within the frame to scan
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowQRScanner(false)}>Cancel</Button>
            {scanned && (
              <Button onPress={() => setScanned(false)}>Scan Again</Button>
            )}
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Contact Menu */}
      <Portal>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={menuPosition}
        >
          <Menu.Item
            onPress={() => handleContactSelect(selectedContact)}
            title="Message"
            icon="message-text"
          />
          <Menu.Item
            onPress={toggleFavorite}
            title={selectedContact?.favorite ? "Remove from favorites" : "Add to favorites"}
            icon="star"
          />
          <Menu.Item
            onPress={deleteContact}
            title="Delete contact"
            icon="delete"
          />
        </Menu>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    margin: 16,
    elevation: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactItem: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'white',
  },
  favoriteIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteIcon: {
    margin: 0,
    padding: 0,
  },
  contactInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontWeight: 'bold',
    fontSize: 16,
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    opacity: 0.6,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  onlineStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  offlineStatus: {
    fontSize: 14,
    opacity: 0.6,
  },
  username: {
    fontSize: 14,
    opacity: 0.6,
  },
  lastMessage: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  menuButton: {
    margin: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyIcon: {
    margin: 0,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    paddingHorizontal: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
  input: {
    marginBottom: 16,
  },
  scanButton: {
    marginTop: 8,
  },
  scannerDialog: {
    width: '90%',
    alignSelf: 'center',
  },
  scannerContainer: {
    width: '100%',
    height: 300,
    overflow: 'hidden',
    borderRadius: 8,
  },
  scanner: {
    width: '100%',
    height: '100%',
  },
  scannerInstructions: {
    marginTop: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});

export default ContactsScreen;