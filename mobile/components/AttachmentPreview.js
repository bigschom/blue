// AttachmentPreview.js - Attachment preview component for the mobile app
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme, IconButton } from 'react-native-paper';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';

const AttachmentPreview = ({ attachment, onRemove, inMessage = false, isOwn = false }) => {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  // Get file extension
  const getFileExtension = (filename) => {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
  };
  
  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Determine file type and icon
  const getFileInfo = () => {
    const { name, type } = attachment;
    let iconName = 'file-document-outline';
    let iconColor = '#607d8b';
    
    if (!type && name) {
      // Try to determine type from the filename
      const ext = getFileExtension(name);
      
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        return { iconName: 'file-image-outline', iconColor: '#4caf50', isImage: true };
      } else if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) {
        return { iconName: 'file-video-outline', iconColor: '#f44336', isVideo: true };
      } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
        return { iconName: 'file-music-outline', iconColor: '#ff9800', isAudio: true };
      } else if (['pdf'].includes(ext)) {
        return { iconName: 'file-pdf-box-outline', iconColor: '#f44336', isPdf: true };
      } else if (['doc', 'docx'].includes(ext)) {
        return { iconName: 'file-word-outline', iconColor: '#2196f3', isDoc: true };
      } else if (['xls', 'xlsx'].includes(ext)) {
        return { iconName: 'file-excel-outline', iconColor: '#4caf50', isExcel: true };
      } else if (['ppt', 'pptx'].includes(ext)) {
        return { iconName: 'file-powerpoint-outline', iconColor: '#ff9800', isPpt: true };
      } else if (['zip', 'rar', '7z'].includes(ext)) {
        return { iconName: 'zip-box-outline', iconColor: '#795548', isArchive: true };
      }
      
      return { iconName, iconColor, isOther: true };
    }
    
    // Determine type from MIME type
    if (type?.startsWith('image/')) {
      return { iconName: 'file-image-outline', iconColor: '#4caf50', isImage: true };
    } else if (type?.startsWith('video/')) {
      return { iconName: 'file-video-outline', iconColor: '#f44336', isVideo: true };
    } else if (type?.startsWith('audio/')) {
      return { iconName: 'file-music-outline', iconColor: '#ff9800', isAudio: true };
    } else if (type === 'application/pdf') {
      return { iconName: 'file-pdf-box-outline', iconColor: '#f44336', isPdf: true };
    } else if (type?.includes('word') || type?.includes('document')) {
      return { iconName: 'file-word-outline', iconColor: '#2196f3', isDoc: true };
    } else if (type?.includes('excel') || type?.includes('sheet')) {
      return { iconName: 'file-excel-outline', iconColor: '#4caf50', isExcel: true };
    } else if (type?.includes('powerpoint') || type?.includes('presentation')) {
      return { iconName: 'file-powerpoint-outline', iconColor: '#ff9800', isPpt: true };
    } else if (type?.includes('zip') || type?.includes('compressed')) {
      return { iconName: 'zip-box-outline', iconColor: '#795548', isArchive: true };
    }
    
    return { iconName, iconColor, isOther: true };
  };
  
  const fileInfo = getFileInfo();
  
  // Handle attachment tap (preview/download)
  const handleAttachmentTap = async () => {
    try {
      // In a real app, we would:
      // 1. Download the encrypted file
      // 2. Decrypt it
      // 3. Save it temporarily
      // 4. Open it or share it
      
      if (inMessage) {
        setIsLoading(true);
        setDownloadProgress(0);
        
        // Simulate download and decryption
        let progress = 0;
        const interval = setInterval(() => {
          progress += 0.1;
          setDownloadProgress(Math.min(progress, 0.95));
          
          if (progress >= 1) {
            clearInterval(interval);
          }
        }, 200);
        
        // Simulate a delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Clear the interval if it's still running
        clearInterval(interval);
        setDownloadProgress(1);
        
        // For the demo, just show an alert
        Alert.alert(
          'Attachment',
          'In a real app, this would download, decrypt, and open the file.',
          [{ text: 'OK' }]
        );
        
        setIsLoading(false);
        setDownloadProgress(0);
      }
    } catch (error) {
      console.error('Error handling attachment:', error);
      Alert.alert('Error', 'Failed to handle attachment');
      setIsLoading(false);
      setDownloadProgress(0);
    }
  };
  
  // Render an image preview
  const renderImagePreview = () => {
    if (inMessage) {
      // For received images in messages, we would show a placeholder or thumbnail
      return (
        <View style={[
          styles.imagePreview,
          { backgroundColor: isOwn ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.05)' }
        ]}>
          <Text style={[
            styles.imagePlaceholder,
            { color: isOwn ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)' }
          ]}>
            Image: {attachment.name}
          </Text>
        </View>
      );
    }
    
    // For images being composed/sent, show the actual image preview
    if (attachment.uri) {
      return (
        <Image 
          source={{ uri: attachment.uri }}
          style={styles.image}
          resizeMode="cover"
        />
      );
    }
    
    return null;
  };
  
  // Main render method
  return (
    <TouchableOpacity
      style={[
        styles.container,
        inMessage 
          ? [
              styles.inMessage,
              isOwn 
                ? { backgroundColor: 'rgba(255, 255, 255, 0.2)' } 
                : { backgroundColor: 'rgba(0, 0, 0, 0.05)' }
            ]
          : styles.inComposer
      ]}
      onPress={handleAttachmentTap}
      disabled={isLoading}
    >
      {fileInfo.isImage && attachment.uri ? (
        renderImagePreview()
      ) : (
        <View style={styles.fileInfo}>
          <IconButton
            icon={fileInfo.iconName}
            size={24}
            color={fileInfo.iconColor}
            style={styles.fileIcon}
          />
          <View style={styles.fileDetails}>
            <Text 
              style={[
                styles.fileName,
                { 
                  color: inMessage 
                    ? (isOwn ? 'rgba(255, 255, 255, 0.9)' : theme.colors.text) 
                    : theme.colors.text 
                }
              ]}
              numberOfLines={1}
            >
              {attachment.name}
            </Text>
            <Text 
              style={[
                styles.fileSize,
                { 
                  color: inMessage 
                    ? (isOwn ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)') 
                    : theme.colors.text 
                }
              ]}
            >
              {formatFileSize(attachment.size)}
            </Text>
          </View>
        </View>
      )}
      
      {isLoading && inMessage ? (
        <View style={styles.progressContainer}>
          <ActivityIndicator 
            size="small" 
            color={isOwn ? 'white' : theme.colors.primary} 
            style={styles.progressIndicator}
          />
          <Text style={[
            styles.progressText,
            { color: isOwn ? 'white' : theme.colors.text }
          ]}>
            {Math.round(downloadProgress * 100)}%
          </Text>
        </View>
      ) : inMessage ? (
        <IconButton
          icon="download"
          size={20}
          color={isOwn ? 'white' : theme.colors.primary}
          style={styles.downloadIcon}
        />
      ) : (
        <IconButton
          icon="close"
          size={16}
          onPress={onRemove}
          style={styles.removeIcon}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    margin: 4,
    overflow: 'hidden',
  },
  inMessage: {
    padding: 8,
    marginVertical: 4,
  },
  inComposer: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileIcon: {
    margin: 0,
  },
  fileDetails: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 4,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 12,
  },
  imagePreview: {
    width: 200,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  imagePlaceholder: {
    fontSize: 14,
    textAlign: 'center',
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  removeIcon: {
    margin: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  downloadIcon: {
    margin: 0,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressIndicator: {
    marginRight: 4,
  },
  progressText: {
    fontSize: 12,
  },
});

export default AttachmentPreview;