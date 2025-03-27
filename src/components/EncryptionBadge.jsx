import React, { useState } from 'react';
import { LockClosedIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/solid';
import PropTypes from 'prop-types';
import '../styles/chat.css';

const EncryptionBadge = ({ type = 'default' }) => {
  const [showInfo, setShowInfo] = useState(false);
  
  const toggleInfo = () => {
    setShowInfo(!showInfo);
  };
  
  const getEncryptionMessage = () => {
    switch (type) {
      case 'message':
        return 'This message is protected with end-to-end encryption';
      case 'file':
        return 'This file is protected with end-to-end encryption';
      case 'call':
        return 'This call is protected with end-to-end encryption';
      default:
        return 'Messages are end-to-end encrypted';
    }
  };
  
  return (
    <div className="encryption-badge-container">
      <div className="encryption-badge" onClick={toggleInfo}>
        <LockClosedIcon className="lock-icon" />
        <span className="encryption-text">{getEncryptionMessage()}</span>
        <QuestionMarkCircleIcon className="info-icon" />
      </div>
      
      {showInfo && (
        <div className="encryption-info">
          <div className="info-header">
            <LockClosedIcon className="info-lock-icon" />
            <h3>End-to-End Encryption</h3>
          </div>
          <p>
            SecureChat uses end-to-end encryption to secure your messages. This means:
          </p>
          <ul>
            <li>Only you and the recipient can read your messages</li>
            <li>Even we cannot access your message content</li>
            <li>Your messages are encrypted on your device before being sent</li>
            <li>Messages are only decrypted on the recipient's device</li>
          </ul>
          <p>
            All files, voice messages, and calls are also protected with the same level of encryption.
          </p>
          <button 
            className="close-info-button"
            onClick={toggleInfo}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

EncryptionBadge.propTypes = {
  type: PropTypes.oneOf(['default', 'message', 'file', 'call'])
};

export default EncryptionBadge;