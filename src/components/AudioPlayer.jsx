import React, { useState, useRef, useEffect } from 'react';
import { 
  PlayIcon, 
  PauseIcon, 
  ForwardIcon, 
  BackwardIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon
} from '@heroicons/react/24/solid';
import '../styles/media-player.css';

const AudioPlayer = ({ src, filename, isEncrypted = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const volumeRef = useRef(null);
  const animationRef = useRef(null);
  
  // Load audio metadata when component mounts or src changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    setIsLoaded(false);
    setError(null);
    
    // Set up event listeners
    const setAudioData = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };
    
    const handleError = (e) => {
      setError('Error loading audio file');
      setIsLoaded(false);
      console.error('Audio error:', e);
    };
    
    // Add event listeners
    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('error', handleError);
    
    // Set volume
    audio.volume = volume;
    
    // Clean up event listeners
    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('error', handleError);
      
      // Stop the animation frame when component unmounts
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [src, volume]);
  
  // Handle play/pause
  const togglePlayPause = () => {
    if (!isLoaded) return;
    
    const audio = audioRef.current;
    if (isPlaying) {
      audio.pause();
      cancelAnimationFrame(animationRef.current);
    } else {
      audio.play();
      animationRef.current = requestAnimationFrame(updateProgress);
    }
    setIsPlaying(!isPlaying);
  };
  
  // Update progress bar as audio plays
  const updateProgress = () => {
    const audio = audioRef.current;
    setCurrentTime(audio.currentTime);
    progressRef.current.value = audio.currentTime;
    
    // Continue updating as long as the audio is playing
    if (audio.ended) {
      setIsPlaying(false);
    } else if (isPlaying) {
      animationRef.current = requestAnimationFrame(updateProgress);
    }
  };
  
  // Handle seeking when user drags progress bar
  const handleProgressChange = (e) => {
    const audio = audioRef.current;
    audio.currentTime = e.target.value;
    setCurrentTime(audio.currentTime);
    
    // If the audio was playing, continue playing after seek
    if (isPlaying) {
      audio.play();
    }
  };
  
  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    audioRef.current.volume = newVolume;
    
    // If volume is set to 0, consider it muted
    if (newVolume === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  };
  
  // Toggle mute/unmute
  const toggleMute = () => {
    const audio = audioRef.current;
    
    if (isMuted) {
      audio.volume = volume || 0.7; // Restore previous volume or default
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };
  
  // Forward/backward 10 seconds
  const skipForward = () => {
    const audio = audioRef.current;
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
    setCurrentTime(audio.currentTime);
  };
  
  const skipBackward = () => {
    const audio = audioRef.current;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
    setCurrentTime(audio.currentTime);
  };
  
  // Format time in MM:SS format
  const formatTime = (time) => {
    if (isNaN(time)) return '00:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="audio-player">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {error ? (
        <div className="audio-error">
          <span>{error}</span>
        </div>
      ) : (
        <>
          <div className="audio-info">
            <div className="audio-filename">{filename || 'Audio file'}</div>
            {isEncrypted && (
              <div className="encrypted-badge">
                <span>End-to-end encrypted</span>
              </div>
            )}
          </div>
          
          <div className="player-controls">
            <button className="control-button" onClick={skipBackward} disabled={!isLoaded}>
              <BackwardIcon className="control-icon" />
            </button>
            
            <button className="play-pause-button" onClick={togglePlayPause} disabled={!isLoaded}>
              {isPlaying ? (
                <PauseIcon className="play-icon" />
              ) : (
                <PlayIcon className="play-icon" />
              )}
            </button>
            
            <button className="control-button" onClick={skipForward} disabled={!isLoaded}>
              <ForwardIcon className="control-icon" />
            </button>
          </div>
          
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
        </>
      )}
    </div>
  );
};

export default AudioPlayer;