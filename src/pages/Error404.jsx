import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const Error404 = () => {
  const { theme } = useTheme();
  
  return (
    <div className="error-page">
      <div className="error-container">
        <img 
          src={theme === 'dark' ? '/images/logo-light.svg' : '/images/logo-dark.svg'} 
          alt="SecureChat Logo" 
          className="error-logo" 
        />
        
        <div className="error-content">
          <h1 className="error-code">404</h1>
          <h2 className="error-title">Page Not Found</h2>
          <p className="error-message">
            The page you are looking for doesn't exist or has been moved.
          </p>
        </div>
        
        <div className="error-actions">
          <Link to="/" className="error-button primary-button">
            Go to Home
          </Link>
          <Link to="/chat" className="error-button secondary-button">
            Go to Chat
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Error404;