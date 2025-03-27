import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowsPointingOutIcon, 
  ArrowsPointingInIcon,
  PlusIcon,
  MinusIcon,
  ArrowUturnLeftIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  LockClosedIcon
} from '@heroicons/react/24/solid';
import '../styles/image-viewer.css';

const ImageViewer = ({ src, alt, filename, isEncrypted = false, onClose }) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  
  // Load image and handle errors
  useEffect(() => {
    const image = imageRef.current;
    
    const handleLoad = () => {
      setIsLoading(false);
    };
    
    const handleError = () => {
      setIsLoading(false);
      setError('Failed to load image');
    };
    
    if (image) {
      image.addEventListener('load', handleLoad);
      image.addEventListener('error', handleError);
      
      // Check if image is already loaded
      if (image.complete) {
        setIsLoading(false);
      }
    }
    
    return () => {
      if (image) {
        image.removeEventListener('load', handleLoad);
        image.removeEventListener('error', handleError);
      }
    };
  }, [src]);
  
  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);
  
  // Reset transforms when image changes
  useEffect(() => {
    resetTransforms();
  }, [src]);
  
  // Handle zoom in/out
  const zoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.25, 5));
  };
  
  const zoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.25, 0.25));
  };
  
  // Handle rotation
  const rotateLeft = () => {
    setRotation((prevRotation) => prevRotation - 90);
  };
  
  // Reset all transforms
  const resetTransforms = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };
  
  // Toggle fullscreen
  const toggleFullscreen = () => {
    const container = containerRef.current;
    
    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };
  
  // Handle image dragging
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };
  
  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Handle mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    
    if (e.deltaY < 0) {
      // Zoom in
      setScale((prevScale) => Math.min(prevScale + 0.1, 5));
    } else {
      // Zoom out
      setScale((prevScale) => Math.max(prevScale - 0.1, 0.25));
    }
  };
  
  // Handle download image
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = filename || 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Set up transform style
  const imageStyle = {
    transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
    cursor: isDragging ? 'grabbing' : 'grab'
  };
  
  // Format file size
  const formatImageFileSize = (bytes) => {
    if (!bytes) return '';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };
  
  return (
    <div 
      className={`image-viewer-container ${isFullscreen ? 'fullscreen' : ''}`} 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {isLoading && (
        <div className="image-loading">
          <div className="loading-spinner"></div>
          <span>Loading image...</span>
        </div>
      )}
      
      {error && (
        <div className="image-error">
          <XMarkIcon className="error-icon" />
          <span>{error}</span>
        </div>
      )}
      
      {!isLoading && !error && (
        <>
          <div className="image-wrapper">
            <img
              ref={imageRef}
              src={src}
              alt={alt || 'Image'}
              style={imageStyle}
              className="image"
              onMouseDown={handleMouseDown}
              draggable={false}
            />
          </div>
          
          <div className="image-controls">
            <div className="image-info">
              <span className="image-filename">{filename || 'Image'}</span>
              
              {isEncrypted && (
                <div className="encrypted-badge">
                  <LockClosedIcon className="lock-icon" />
                  <span>End-to-end encrypted</span>
                </div>
              )}
            </div>
            
            <div className="control-buttons">
              <button className="control-button" onClick={zoomIn} title="Zoom in">
                <PlusIcon className="control-icon" />
              </button>
              
              <button className="control-button" onClick={zoomOut} title="Zoom out">
                <MinusIcon className="control-icon" />
              </button>
              
              <button className="control-button" onClick={rotateLeft} title="Rotate left">
                <ArrowUturnLeftIcon className="control-icon" />
              </button>
              
              <button className="control-button" onClick={resetTransforms} title="Reset">
                <ArrowsPointingInIcon className="control-icon" />
              </button>
              
              <button className="control-button" onClick={toggleFullscreen} title="Toggle fullscreen">
                {isFullscreen ? (
                  <ArrowsPointingInIcon className="control-icon" />
                ) : (
                  <ArrowsPointingOutIcon className="control-icon" />
                )}
              </button>
              
              <button className="control-button" onClick={handleDownload} title="Download">
                <ArrowDownTrayIcon className="control-icon" />
              </button>
              
              {onClose && (
                <button className="control-button close-button" onClick={onClose} title="Close">
                  <XMarkIcon className="control-icon" />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ImageViewer;