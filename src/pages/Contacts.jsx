import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  QrCodeIcon,
  UserPlusIcon,
  StarIcon,
  TrashIcon,
  UserIcon
} from '@heroicons/react/24/solid';
import Navigation from '../components/Navigation';
import QRCodeScanner from '../components/QRCodeScanner';
import '../styles/contacts.css';

const Contacts = () => {
  const { user, supabase } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(null);
  const [newContactForm, setNewContactForm] = useState({
    username: '',
    name: '',
    isSubmitting: false,
    error: ''
  });
  
  // Fetch contacts
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        setIsLoading(true);
        
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
            
            // Check if message has attachments
            let lastMessageText = messageData[0].content || '';
            
            if (messageData[0].attachments) {
              const attachments = JSON.parse(messageData[0].attachments);
              if (attachments.length > 0) {
                if (!lastMessageText) {
                  lastMessageText = `Sent ${attachments.length} ${attachments.length === 1 ? 'file' : 'files'}`;
                } else {
                  lastMessageText += ` + ${attachments.length} ${attachments.length === 1 ? 'file' : 'files'}`;
                }
              }
            }
            
            return {
              ...contact,
              last_message: lastMessageText,
              last_message_time: messageData[0].created_at
            };
          } catch (err) {
            console.error('Error getting last message:', err);
            return { ...contact, last_message: null, last_message_time: null };
          }
        }));
        
        setContacts(contactsWithLastMessage);
      } catch (error) {
        console.error('Error fetching contacts:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchContacts();
  }, [user.id, supabase]);
  
  // Filter contacts by search query
  const filteredContacts = contacts.filter(contact => {
    const searchLower = searchQuery.toLowerCase();
    const name = contact.name.toLowerCase();
    const username = contact.profiles?.username?.toLowerCase() || '';
    const displayName = contact.profiles?.display_name?.toLowerCase() || '';
    
    return name.includes(searchLower) || 
           username.includes(searchLower) || 
           displayName.includes(searchLower);
  });
  
  // Sort contacts: favorites first, then online, then alphabetical
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    // Favorites first
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    
    // Then online users
    if (a.user_status?.is_online && !b.user_status?.is_online) return -1;
    if (!a.user_status?.is_online && b.user_status?.is_online) return 1;
    
    // Then alphabetical by name
    return a.name.localeCompare(b.name);
  });
  
  // Group contacts by first letter
  const groupedContacts = sortedContacts.reduce((groups, contact) => {
    // Use the first letter of the name as the group key
    const firstChar = contact.name.charAt(0).toUpperCase();
    
    // Create the group if it doesn't exist
    if (!groups[firstChar]) {
      groups[firstChar] = [];
    }
    
    // Add the contact to its group
    groups[firstChar].push(contact);
    
    return groups;
  }, {});
  
  // Format last seen time
  const formatLastSeen = (dateString) => {
    if (!dateString) return 'Never';
    
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
      return 'Just now';
    }
  };
  
  // Format last message time
  const formatLastMessageTime = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // If it's today, show time
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If it's yesterday, show "Yesterday"
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // If it's this year, show month and day
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    
    // Otherwise show date with year
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };
  
  // Handle opening chat with a contact
  const openChat = (contactId) => {
    navigate(`/chat/${contactId}`);
  };
  
  // Toggle contact menu
  const toggleContactMenu = (contactId, e) => {
    e.stopPropagation();
    setShowContactMenu(showContactMenu === contactId ? null : contactId);
  };
  
  // Toggle favorite status
  const toggleFavorite = async (contactId, currentStatus, e) => {
    e.stopPropagation();
    setShowContactMenu(null);
    
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ favorite: !currentStatus })
        .eq('id', contactId);
        
      if (error) throw error;
      
      // Update local state
      setContacts(contacts.map(contact => 
        contact.id === contactId 
          ? { ...contact, favorite: !currentStatus } 
          : contact
      ));
    } catch (error) {
      console.error('Error toggling favorite status:', error);
    }
  };
  
  // Delete contact
  const deleteContact = async (contactId, e) => {
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this contact?')) {
      return;
    }
    
    setShowContactMenu(null);
    
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);
        
      if (error) throw error;
      
      // Update local state
      setContacts(contacts.filter(contact => contact.id !== contactId));
    } catch (error) {
      console.error('Error deleting contact:', error);
    }
  };
  
  // Toggle QR scanner
  const toggleQRScanner = () => {
    setShowQRScanner(!showQRScanner);
    if (showAddModal) {
      setShowAddModal(false);
    }
  };
  
  // Toggle add contact modal
  const toggleAddModal = () => {
    setShowAddModal(!showAddModal);
    setNewContactForm({
      username: '',
      name: '',
      isSubmitting: false,
      error: ''
    });
    if (showQRScanner) {
      setShowQRScanner(false);
    }
  };
  
  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewContactForm(prev => ({
      ...prev,
      [name]: value,
      error: ''
    }));
  };
  
  // Handle QR scan result
  const handleQRScanResult = (result) => {
    try {
      const contactData = JSON.parse(result);
      if (contactData.username) {
        setNewContactForm(prev => ({
          ...prev,
          username: contactData.username,
          name: contactData.displayName || contactData.username
        }));
        setShowQRScanner(false);
        setShowAddModal(true);
      }
    } catch (error) {
      console.error('Invalid QR code:', error);
      alert('Invalid QR code format');
    }
  };
  
  // Add new contact
  const addContact = async (e) => {
    e.preventDefault();
    
    if (!newContactForm.username || !newContactForm.name) {
      setNewContactForm(prev => ({
        ...prev,
        error: 'Please fill in all fields'
      }));
      return;
    }
    
    try {
      setNewContactForm(prev => ({
        ...prev,
        isSubmitting: true,
        error: ''
      }));
      
      // Find user by username
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', newContactForm.username)
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
      const { data: newContact, error: addError } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          contact_user_id: userData.id,
          name: newContactForm.name,
          created_at: new Date().toISOString()
        })
        .select();
        
      if (addError) throw addError;
      
      // Close modal and refresh contacts
      toggleAddModal();
      
      // Add new contact to state
      const { data: contactData, error: fetchError } = await supabase
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
        .eq('id', newContact[0].id)
        .single();
        
      if (!fetchError) {
        setContacts([...contacts, { ...contactData, last_message: null, last_message_time: null }]);
      }
    } catch (error) {
      console.error('Error adding contact:', error);
      setNewContactForm(prev => ({
        ...prev,
        error: error.message
      }));
    } finally {
      setNewContactForm(prev => ({
        ...prev,
        isSubmitting: false
      }));
    }
  };
  
  return (
    <div className="contacts-container">
      <Navigation activeTab="contacts" />
      
      <div className="contacts-content">
        <div className="contacts-header">
          <h1>Contacts</h1>
          
          <div className="contacts-actions">
            <button 
              className="action-button qr-button"
              onClick={toggleQRScanner}
              title="Scan QR code"
            >
              <QrCodeIcon className="action-icon" />
            </button>
            <button 
              className="action-button add-button"
              onClick={toggleAddModal}
              title="Add contact"
            >
              <PlusIcon className="action-icon" />
            </button>
          </div>
        </div>
        
        <div className="search-container">
          <MagnifyingGlassIcon className="search-icon" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        {isLoading ? (
          <div className="loading-indicator">Loading contacts...</div>
        ) : (
          <div className="contacts-list">
            {Object.keys(groupedContacts).length === 0 ? (
              <div className="no-contacts">
                <UserIcon className="no-contacts-icon" />
                <p>No contacts found</p>
                <button className="add-contact-button" onClick={toggleAddModal}>
                  Add your first contact
                </button>
              </div>
            ) : (
              Object.keys(groupedContacts).sort().map(letter => (
                <div key={letter} className="contact-group">
                  <div className="group-header">{letter}</div>
                  
                  {groupedContacts[letter].map(contact => (
                    <div 
                      key={contact.id} 
                      className={`contact-item ${contact.user_status?.is_online ? 'online' : ''} ${contact.favorite ? 'favorite' : ''}`}
                      onClick={() => openChat(contact.id)}
                    >
                      <div className="contact-avatar">
                        {contact.profiles?.avatar_url ? (
                          <img src={contact.profiles.avatar_url} alt={contact.name} />
                        ) : (
                          <div className="avatar-placeholder">
                            {contact.name.charAt(0)}
                          </div>
                        )}
                        {contact.favorite && (
                          <div className="favorite-badge">
                            <StarIcon className="favorite-icon" />
                          </div>
                        )}
                        {contact.user_status?.is_online && (
                          <div className="online-indicator" />
                        )}
                      </div>
                      
                      <div className="contact-details">
                        <div className="contact-name">{contact.name}</div>
                        <div className="contact-status">
                          {contact.user_status?.is_online ? (
                            <span className="online-status">Online</span>
                          ) : (
                            <span className="last-seen">
                              {contact.user_status?.last_seen ? formatLastSeen(contact.user_status.last_seen) : 'Offline'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {contact.last_message && (
                        <div className="last-message">
                          <div className="message-preview">{contact.last_message}</div>
                          <div className="message-time">{formatLastMessageTime(contact.last_message_time)}</div>
                        </div>
                      )}
                      
                      <button 
                        className="contact-menu-button"
                        onClick={(e) => toggleContactMenu(contact.id, e)}
                      >
                        <span className="menu-dots">•••</span>
                      </button>
                      
                      {showContactMenu === contact.id && (
                        <div className="contact-menu">
                          <button 
                            className="menu-item"
                            onClick={(e) => toggleFavorite(contact.id, contact.favorite, e)}
                          >
                            <StarIcon className="menu-icon" />
                            <span>{contact.favorite ? 'Remove from favorites' : 'Add to favorites'}</span>
                          </button>
                          
                          <button 
                            className="menu-item delete"
                            onClick={(e) => deleteContact(contact.id, e)}
                          >
                            <TrashIcon className="menu-icon" />
                            <span>Delete contact</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      
      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2>Add New Contact</h2>
              <button className="close-button" onClick={toggleAddModal}>✕</button>
            </div>
            
            <form onSubmit={addContact} className="contact-form">
              {newContactForm.error && (
                <div className="form-error">{newContactForm.error}</div>
              )}
              
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={newContactForm.username}
                  onChange={handleInputChange}
                  placeholder="Enter username"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="name">Display Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={newContactForm.name}
                  onChange={handleInputChange}
                  placeholder="Enter a name for this contact"
                  required
                />
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={toggleAddModal}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="submit-button"
                  disabled={newContactForm.isSubmitting}
                >
                  {newContactForm.isSubmitting ? 'Adding...' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="modal-overlay">
          <div className="modal-container qr-scanner-modal">
            <div className="modal-header">
              <h2>Scan Contact QR Code</h2>
              <button className="close-button" onClick={toggleQRScanner}>✕</button>
            </div>
            
            <div className="qr-scanner-container">
              <QRCodeScanner onScan={handleQRScanResult} />
            </div>
            
            <div className="qr-instructions">
              <p>Position the QR code within the frame to scan</p>
            </div>
            
            <button 
              className="cancel-button"
              onClick={toggleQRScanner}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts; 