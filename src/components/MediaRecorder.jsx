import React, { useState, useEffect, useRef } from 'react';
import { MicrophoneIcon, StopIcon, TrashIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid';
import PropTypes from 'prop-types';
import '../styles/chat.css';

const MediaRecorder = ({ onSend, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioElementRef = useRef(null);
  
  // Request microphone permission
  useEffect(() => {
    return () => {
      // Clean up timer and media stream on unmount
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new window.MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.addEventListener('dataavailable', event => {
        audioChunksRef.current.push(event.data);
      });
      
      mediaRecorderRef.current.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setAudioBlob(audioBlob);
        setAudioUrl(audioUrl);
        setIsRecording(false);
        
        // Stop the recording timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        
        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());
      });
      
      // Start recording
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      
      // Start the recording timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prevTime => prevTime + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions and try again.');
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };
  
  const pauseResumeRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setRecordingTime(prevTime => prevTime + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }
      
      setIsPaused(!isPaused);
    }
  };
  
  const cancelRecording = () => {
    // Stop recording if in progress
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      setIsRecording(false);
    }
    
    // Clean up audio blob URL
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    
    setAudioBlob(null);
    setRecordingTime(0);
    
    if (onCancel) {
      onCancel();
    }
  };
  
  const sendRecording = () => {
    if (audioBlob && onSend) {
      // Create a File object from the Blob for consistency with other attachments
      const audioFile = new File([audioBlob], `voice-message-${Date.now()}.webm`, {
        type: 'audio/webm'
      });
      
      onSend(audioFile);
      
      // Clean up
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingTime(0);
    }
  };
  
  // Format recording time as MM:SS
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="media-recorder">
      {!isRecording && !audioBlob ? (
        <button 
          className="record-button"
          onClick={startRecording}
          aria-label="Start recording"
        >
          <MicrophoneIcon className="record-icon" />
          <span>Record Voice Message</span>
        </button>
      ) : isRecording ? (
        <div className="recording-controls">
          <div className="recording-indicator">
            <div className={`indicator-dot ${isPaused ? 'paused' : ''}`}></div>
            <span className="recording-time">{formatTime(recordingTime)}</span>
          </div>
          
          <div className="recording-buttons">
            <button 
              className="stop-button"
              onClick={stopRecording}
              aria-label="Stop recording"
            >
              <StopIcon className="stop-icon" />
            </button>
            
            <button 
              className="cancel-button"
              onClick={cancelRecording}
              aria-label="Cancel recording"
            >
              <TrashIcon className="cancel-icon" />
            </button>
          </div>
        </div>
      ) : (
        <div className="playback-controls">
          <audio 
            ref={audioElementRef}
            src={audioUrl} 
            controls 
            className="audio-player"
          ></audio>
          
          <div className="playback-buttons">
            <button 
              className="send-button"
              onClick={sendRecording}
              aria-label="Send recording"
            >
              <PaperAirplaneIcon className="send-icon" />
              <span>Send</span>
            </button>
            
            <button 
              className="cancel-button"
              onClick={cancelRecording}
              aria-label="Discard recording"
            >
              <TrashIcon className="cancel-icon" />
              <span>Discard</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

MediaRecorder.propTypes = {
  onSend: PropTypes.func.isRequired,
  onCancel: PropTypes.func
};

export default MediaRecorder;