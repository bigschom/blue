import React, { useState, useRef, useEffect } from 'react';
import { 
  PlayIcon, 
  PauseIcon, 
  ForwardIcon, 
  BackwardIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  LockClosedIcon
} from '@heroicons/react/24/solid';
import '../styles/media-player.css';

const VideoPlayer = ({ src, filename, isEncrypted = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState(null);
  
  const videoRef = useRef(null);
  const videoContainerRef = useRef(null);
  const progressRef = useRef(null);
  const volumeRef = useRef(null);
  const animationRef = useRef(null);
  
  // Load video metadata when component mounts or src changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    setIsLoaded(false);
    setError(null);
    
    // Set up event listeners
    const setVideoData = () => {
      setDuration(video.duration);
      setIsLoaded(true);
    };
    
    const handleError = (e) => {
      setError('Error loading video file');
      setIsLoaded(false);
      console.error('Video error:', e);
    };
    
    const handleEnd = () => {
      setIsPlaying(false);
      cancelAnimationFrame(animationRef.current);
    };
    
    // Add event listeners
    video.addEventListener('loadedmetadata', setVideoData);
    video.addEventListener('error', handleError);
    video.addEventListener('ended', handleEnd);
    
    // Set volume
    video.volume = volume;
    
    // Clean up event listeners
    return () => {
      video.removeEventListener('loadedmetadata', setVideoData);
      video.removeEventListener('error', handleError);
      video.removeEventListener('ended', handleEnd);
      
      // Stop the animation frame when component unmounts
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      // Clear the controls timeout
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
    };
  }, [src, volume]);
  
  // Handle showing/hiding controls
  useEffect(() => {
    // Clear previous timeout
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
    
    // Set timeout to hide controls after 3 seconds of inactivity
    if (isControlsVisible && isPlaying) {
      const timeout = setTimeout(() => {
        setIsControlsVisible(false);
      }, 3000);
      
      setControlsTimeout(timeout);
    }
    
    return () => {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
    };
  }, [isControlsVisible, isPlaying]);
  
  // Handle play/pause
  const togglePlayPause = () => {
    if (!isLoaded) return;
    
    const video = videoRef.current;
    if (isPlaying) {
      video.pause();
      cancelAnimationFrame(animationRef.current);
    } else {
      video.play();
      animationRef.current = requestAnimationFrame(updateProgress);
    }
    setIsPlaying(!isPlaying);
  };
  
  // Update progress bar as video plays
  const updateProgress = () => {
    const video = videoRef.current;
    setCurrentTime(video.currentTime);
    progressRef.current.value = video.currentTime;
    
    // Continue updating as long as the video is playing
    if (video.ended) {
      setIsPlaying(false);
    } else if (isPlaying) {
      animationRef.current = requestAnimationFrame(updateProgress);
    }
  };
  
  // Handle seeking when user drags progress bar
  const handleProgressChange = (e) => {
    const video = videoRef.current;
    video.currentTime = e.target.value;
    setCurrentTime(video.currentTime);
    
    // If the video was playing, continue playing after seek
    if (isPlaying) {
      video.play();
    }
  };
  
  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    videoRef.current.volume = newVolume;
    
    // If volume is set to 0, consider it muted
    if (newVolume === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  };
  
  // Toggle mute/unmute
  const toggleMute = () => {
    const video = videoRef.current;
    
    if (isMuted) {
      video.volume = volume || 0.7; // Restore previous volume or default
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  };
  
  // Forward/backward 10 seconds
  const skipForward = () => {
    const video = videoRef.current;
    video.currentTime = Math.min(video.duration, video.currentTime + 10);
    setCurrentTime(video.currentTime);
  };
  
  const skipBackward = () => {
    const video = videoRef.current;
    video.currentTime = Math.max(0, video.currentTime - 10);
    setCurrentTime(video.currentTime);
  };
  
  // Toggle fullscreen
  const toggleFullscreen = () => {
    const container = videoContainerRef.current;
    
    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };
  
  // Show controls when user moves mouse over video
  const handleMouseMove = () => {
    setIsControlsVisible(true);
  };
  
  // Format time in MM:SS format
  const formatTime = (time) => {
    if (isNaN(time)) return '00:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div 
      className={`video-player ${isFullscreen ? 'fullscreen' : ''}`}
      ref={videoContainerRef}
      onMouseMove={handleMouseMove}
    >
      <video 
        ref={videoRef}
        src={src}
        className="video-element"
        onClick={togglePlayPause}
        preload="metadata"
      />
      
      {error ? (
        <div className="video-error">
          <span>{error}</span>
        </div>
      ) : (
        <>
          {/* Video Title and Security Badge */}
          <div className={`video-info ${isControlsVisible ? 'visible' : 'hidden'}`}>
            <div className="video-filename">{filename || 'Video file'}</div>
            {isEncrypted && (
              <div className="encrypted-badge">
                <LockClosedIcon className="lock-icon" />
                <span>End-to-end encrypted</span>
              </div>
            )}
          </div>
          
          {/* Video Controls */}
          <div className={`video-controls ${isControlsVisible ? 'visible' : 'hidden'}`}>
            <div className="progress-container">
              <span className="time-display">{formatTime(currentTime)}</span>
              <input
                type="range"
                ref={progressRef}
                className="progress-bar"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={handleProgressChange}
                disabled={!isLoaded}
              />
              <span className="time-display">{formatTime(duration)}</span>
            </div>
            
            <div className="controls-row">
              <div className="left-controls">
                <button className="control-button" onClick={togglePlayPause} disabled={!isLoaded}>
                  {isPlaying ? (
                    <PauseIcon className="control-icon" />
                  ) : (
                    <PlayIcon className="control-icon" />
                  )}
                </button>
                
                <button className="control-button" onClick={skipBackward} disabled={!isLoaded}>
                  <BackwardIcon className="control-icon" />
                </button>
                
                <button className="control-button" onClick={skipForward} disabled={!isLoaded}>
                  <ForwardIcon className="control-icon" />
                </button>
                
                <div className="volume-container">
                  <button className="volume-button" onClick={toggleMute} disabled={!isLoaded}>
                    {isMuted ? (
                      <SpeakerXMarkIcon className="volume-icon" />
                    ) : (
                      <SpeakerWaveIcon className="volume-icon" />
                    )}
                  </button>
                  
                  <input
                    type="range"
                    ref={volumeRef}
                    className="volume-bar"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    disabled={!isLoaded}
                  />
                </div>
              </div>
              
              <div className="right-controls">
                <button className="control-button" onClick={toggleFullscreen} disabled={!isLoaded}>
                  <ArrowsPointingOutIcon className="control-icon" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Play/Pause Overlay */}
          {!isPlaying && isLoaded && (
            <div className="play-overlay" onClick={togglePlayPause}>
              <button className="play-button">
                <PlayIcon className="play-icon" />
              </button>
            </div>
          )}
          
          {/* Loading Spinner */}
          {!isLoaded && !error && (
            <div className="loading-spinner-container">
              <div className="loading-spinner"></div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VideoPlayer;