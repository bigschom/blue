import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

class E2EEService {
  // Generate a new key pair for the user
  static async generateKeyPair() {
    try {
      // Use Web Crypto API for key generation
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 4096,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );

      // Export public key as spki format
      const publicKeyExported = await window.crypto.subtle.exportKey(
        'spki',
        keyPair.publicKey
      );

      // Export private key as pkcs8 format
      const privateKeyExported = await window.crypto.subtle.exportKey(
        'pkcs8',
        keyPair.privateKey
      );

      // Convert ArrayBuffer to base64 string for storage
      const publicKeyString = this._arrayBufferToBase64(publicKeyExported);
      const privateKeyString = this._arrayBufferToBase64(privateKeyExported);

      return {
        publicKey: publicKeyString,
        privateKey: privateKeyString
      };
    } catch (error) {
      console.error('Error generating key pair:', error);
      throw error;
    }
  }

  // Derive a key encryption key from user's passphrase
  static async deriveKeyEncryptionKey(passphrase, salt) {
    try {
      const encoder = new TextEncoder();
      const passphraseBuffer = encoder.encode(passphrase);
      
      const importedKey = await window.crypto.subtle.importKey(
        'raw', 
        passphraseBuffer, 
        { name: 'PBKDF2' }, 
        false, 
        ['deriveBits', 'deriveKey']
      );

      return window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 250000, // Increased iterations for better security
          hash: 'SHA-256'
        },
        importedKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Error deriving key encryption key:', error);
      throw error;
    }
  }

  // Securely store encrypted private key
  static async secureStorePrivateKey(privateKey, passphrase) {
    try {
      // Generate a cryptographically secure random salt
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      
      // Derive key encryption key from passphrase
      const keyEncryptionKey = await this.deriveKeyEncryptionKey(passphrase, salt);
      
      // Generate initialization vector
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Convert private key to ArrayBuffer
      const privateKeyBuffer = this._base64ToArrayBuffer(privateKey);
      
      // Encrypt private key
      const encryptedPrivateKey = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        keyEncryptionKey,
        privateKeyBuffer
      );

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Store encrypted key with metadata
      const encryptionMetadata = {
        encryptedKey: this._arrayBufferToBase64(encryptedPrivateKey),
        salt: this._arrayBufferToBase64(salt),
        iv: this._arrayBufferToBase64(iv),
        timestamp: new Date().toISOString()
      };

      localStorage.setItem(`${user.id}_encrypted_private_key`, JSON.stringify(encryptionMetadata));
      return true;
    } catch (error) {
      console.error('Error securely storing private key:', error);
      throw error;
    }
  }

  // Retrieve and decrypt private key
  static async retrievePrivateKey(passphrase) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Retrieve encrypted key metadata
      const encryptedKeyData = localStorage.getItem(`${user.id}_encrypted_private_key`);
      if (!encryptedKeyData) throw new Error('No encrypted private key found');

      const { encryptedKey, salt, iv } = JSON.parse(encryptedKeyData);

      // Derive key encryption key
      const keyEncryptionKey = await this.deriveKeyEncryptionKey(
        passphrase, 
        this._base64ToArrayBuffer(salt)
      );

      // Decrypt private key
      const decryptedPrivateKeyBuffer = await window.crypto.subtle.decrypt(
        { 
          name: 'AES-GCM', 
          iv: this._base64ToArrayBuffer(iv) 
        },
        keyEncryptionKey,
        this._base64ToArrayBuffer(encryptedKey)
      );

      // Convert decrypted key back to base64
      return this._arrayBufferToBase64(decryptedPrivateKeyBuffer);
    } catch (error) {
      console.error('Error retrieving private key:', error);
      throw new Error('Private key decryption failed. Check your passphrase.');
    }
  }

  // Initialize keys with secure storage
  static async initializeKeys(passphrase) {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Check if encrypted key already exists
      const existingEncryptedKey = localStorage.getItem(`${user.id}_encrypted_private_key`);
      
      if (existingEncryptedKey) {
        return true; // Keys are already set up
      }

      // Generate new key pair
      const { publicKey, privateKey } = await this.generateKeyPair();

      // Securely store private key with passphrase
      await this.secureStorePrivateKey(privateKey, passphrase);

      // Store public key in database for other users to access
      const { error } = await supabase
        .from('user_keys')
        .upsert({
          user_id: user.id,
          public_key: publicKey,
          created_at: new Date()
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error initializing keys:', error);
      return false;
    }
  }

  // Get public key for a contact
  static async getPublicKey(userId) {
    try {
      const { data, error } = await supabase
        .from('user_keys')
        .select('public_key')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data.public_key;
    } catch (error) {
      console.error('Error fetching public key:', error);
      throw new Error('Unable to retrieve public key for the specified user');
    }
  }

  // Encrypt message with recipient's public key
  static async encryptMessage(message, recipientPublicKeyString) {
    try {
      // Validate inputs
      if (!message || !recipientPublicKeyString) {
        throw new Error('Message and recipient public key are required');
      }

      // Convert base64 string to ArrayBuffer
      const publicKeyBuffer = this._base64ToArrayBuffer(recipientPublicKeyString);

      // Import public key
      const publicKey = await window.crypto.subtle.importKey(
        'spki',
        publicKeyBuffer,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        false, // not extractable
        ['encrypt']
      );

      // Convert message to ArrayBuffer
      const encoder = new TextEncoder();
      const messageBuffer = encoder.encode(message);

      // Encrypt the message
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP'
        },
        publicKey,
        messageBuffer
      );

      // Convert encrypted data to base64 string
      return this._arrayBufferToBase64(encryptedBuffer);
    } catch (error) {
      console.error('Error encrypting message:', error);
      throw new Error('Message encryption failed');
    }
  }

  // Decrypt message with user's private key
  static async decryptMessage(encryptedMessage, passphrase) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Retrieve and decrypt private key
      const privateKeyString = await this.retrievePrivateKey(passphrase);
      if (!privateKeyString) throw new Error('Private key retrieval failed');

      // Convert base64 string to ArrayBuffer
      const privateKeyBuffer = this._base64ToArrayBuffer(privateKeyString);
      const encryptedBuffer = this._base64ToArrayBuffer(encryptedMessage);

      // Import private key
      const privateKey = await window.crypto.subtle.importKey(
        'pkcs8',
        privateKeyBuffer,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        false, // not extractable
        ['decrypt']
      );

      // Decrypt the message
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'RSA-OAEP'
        },
        privateKey,
        encryptedBuffer
      );

      // Convert decrypted data to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error('Error decrypting message:', error);
      throw new Error('Message decryption failed');
    }
  }
  
  // Encrypt a file before upload
  static async encryptFile(file, recipientPublicKeyString) {
    try {
      // Validate inputs
      if (!file || !recipientPublicKeyString) {
        throw new Error('File and recipient public key are required');
      }

      // Generate a random symmetric key for file encryption
      const symmetricKey = await window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );
      
      // Read file as ArrayBuffer
      const fileBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
      
      // Generate a random IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt file with symmetric key
      const encryptedFileBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv
        },
        symmetricKey,
        fileBuffer
      );
      
      // Export symmetric key
      const exportedKey = await window.crypto.subtle.exportKey(
        'raw',
        symmetricKey
      );
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Encrypt the symmetric key with recipient's public key
      const encryptedSymmetricKey = await this.encryptMessage(
        this._arrayBufferToBase64(exportedKey), 
        recipientPublicKeyString
      );
      
      // Create a new file with encrypted content
      const encryptedFile = new File(
        [encryptedFileBuffer], 
        file.name,
        { type: 'application/octet-stream' }
      );
      
      // Store encryption metadata
      const metadata = {
        iv: this._arrayBufferToBase64(iv),
        encryptedSymmetricKey: encryptedSymmetricKey,
        originalType: file.type,
        encryptedBy: user.id,
        encryptedAt: new Date().toISOString(),
        originalName: file.name
      };
      
      // Return encrypted file and metadata
      return {
        file: encryptedFile,
        metadata: JSON.stringify(metadata)
      };
    } catch (error) {
      console.error('Error encrypting file:', error);
      throw new Error('File encryption failed');
    }
  }
  
  // Decrypt a file after download
  static async decryptFile(encryptedFileUrl, metadata, passphrase) {
    try {
      // Parse metadata
      const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      
      // Fetch encrypted file
      const response = await fetch(encryptedFileUrl);
      const encryptedFileBuffer = await response.arrayBuffer();
      
      // Decrypt the symmetric key
      const symmetricKeyBase64 = await this.decryptMessage(
        parsedMetadata.encryptedSymmetricKey, 
        passphrase
      );
      
      // Convert base64 strings back to ArrayBuffers
      const iv = this._base64ToArrayBuffer(parsedMetadata.iv);
      const keyData = this._base64ToArrayBuffer(symmetricKeyBase64);
      
      // Import symmetric key
      const symmetricKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: 'AES-GCM',
          length: 256
        },
        false, // not extractable
        ['decrypt']
      );
      
      // Decrypt file
      const decryptedFileBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv
        },
        symmetricKey,
        encryptedFileBuffer
      );
      
      // Create a new file with decrypted content and original type
      const decryptedFile = new File(
        [decryptedFileBuffer],
        parsedMetadata.originalName || 'decrypted-file',
        { type: parsedMetadata.originalType || 'application/octet-stream' }
      );
      
      return decryptedFile;
    } catch (error) {
      console.error('Error decrypting file:', error);
      throw new Error('File decryption failed');
    }
  }

  // Helper function to convert ArrayBuffer to base64 string
  static _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // Helper function to convert base64 string to ArrayBuffer
  static _base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export default E2EEService;