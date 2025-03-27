import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  StarIcon, 
  ChatBubbleLeftIcon, 
  EllipsisHorizontalIcon,
  TrashIcon,
  PencilIcon,
  XMarkIcon
} from '@heroicons/react/24/solid';
import PropTypes from 'prop-types';
import '../styles/contacts.css';

const ContactCard = ({ 
  contact, 
  onDelete, 
  onEdit, 
  onToggleFavorite 
}) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  
  const handleChat = () => {
    navigate(`/chat/${contact.id}`);
  };
  
  const toggleMenu = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };
  
  const handleToggleFavorite = (e) => {
    e.stopPropagation();
    onToggleFavorite(contact);
    setShowMenu(false);
  };
  
  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit(contact);
    setShowMenu(false);
  };
  
  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(contact);
    setShowMenu(false);
  };
  
  // Format last seen time
  const formatLastSeen = (dateString) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.abs(now - date);
    const diffMinutes = Math.floor(diff / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} min ago`;
    } else if (diffMinutes < 24 * 60) {
      return `${Math.floor(diffMinutes / 60)} hours ago`;
    } else {
      return `${Math.floor(diffMinutes / (60 * 24))} days ago`;
    }
  };
  
  return (
    <div className="contact-card">
      <div className="contact-card-content" onClick={handleChat}>
        <div className="contact-avatar">
          {contact.avatar_url ? (
            <img 
              src={contact.avatar_url} 
              alt={contact.name} 
              className="avatar-image"
            />
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
          {contact.is_online && <div className="online-indicator" />}
        </div>
        
        <div className="contact-info">
          <div className="contact-name">{contact.name}</div>
          <div className="contact-status">
            {contact.is_online ? (
              <span className="online-status">Online</span>
            ) : (
              <span className="last-seen">
                Last seen {formatLastSeen(contact.last_seen)}
              </span>
            )}
          </div>
        </div>
        
        <div className="contact-actions">
          <button 
            className="chat-button" 
            onClick={handleChat}
            aria-label="Chat with contact"
          >
            <ChatBubbleLeftIcon className="chat-icon" />
          </button>
          
          <button 
            className="menu-button" 
            onClick={toggleMenu}
            aria-label="Contact options"
          >
            <EllipsisHorizontalIcon className="menu-icon" />
          </button>
        </div>
      </div>
      
      {showMenu && (
        <div className="contact-menu">
          <button 
            className="menu-item" 
            onClick={handleToggleFavorite}
          >
            <StarIcon className="menu-item-icon" />
            <span>{contact.favorite ? 'Remove from favorites' : 'Add to favorites'}</span>
          </button>
          
          <button 
            className="menu-item" 
            onClick={handleEdit}
          >
            <PencilIcon className="menu-item-icon" />
            <span>Edit contact</span>
          </button>
          
          <button 
            className="menu-item delete" 
            onClick={handleDelete}
          >
            <TrashIcon className="menu-item-icon" />
            <span>Delete contact</span>
          </button>
          
          <button 
            className="menu-close" 
            onClick={toggleMenu}
          >
            <XMarkIcon className="close-icon" />
          </button>
        </div>
      )}
    </div>
  );
};

ContactCard.propTypes = {
  contact: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    avatar_url: PropTypes.string,
    is_online: PropTypes.bool,
    last_seen: PropTypes.string,
    favorite: PropTypes.bool
  }).isRequired,
  onDelete: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onToggleFavorite: PropTypes.func.isRequired
};

export default ContactCard;