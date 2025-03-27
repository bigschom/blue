// Service Worker for SecureChat
// This file is registered in index.js

// Cache names
const STATIC_CACHE_NAME = 'securechat-static-v1';
const DYNAMIC_CACHE_NAME = 'securechat-dynamic-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/static/js/bundle.js',
  '/static/media/logo-dark.svg',
  '/static/media/logo-light.svg',
  '/static/media/chat-illustration.svg',
  '/images/icons/icon-192x192.png',
  '/manifest.json'
];

// Install event - Cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
  );
  
  self.skipWaiting();
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker');
  
  event.waitUntil(
    caches.keys()
      .then(keyList => {
        return Promise.all(keyList.map(key => {
          if (key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        }));
      })
  );
  
  return self.clients.claim();
});

// Fetch event - Network first with cache fallback strategy
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests and Supabase API calls
  if (!event.request.url.startsWith(self.location.origin) || 
      event.request.url.includes('/supabase/') ||
      event.request.url.includes('/auth/')) {
    return;
  }
  
  // For HTML navigation requests, use network first strategy
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache response for later use
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          // If network fails, try to serve from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If no cached response, serve offline page
              return caches.match('/offline.html');
            });
        })
    );
    return;
  }
  
  // For other requests (assets, api calls), use stale-while-revalidate
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Try to fetch from network in the background
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            // Cache the network response for future use
            const responseClone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE_NAME)
              .then(cache => cache.put(event.request, responseClone));
            return networkResponse;
          });
        
        // Return cached response immediately, or wait for network
        return cachedResponse || fetchPromise;
      })
  );
});

// Push notification event handler
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Notification received', event);
  
  let notificationData = {};
  
  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (e) {
      notificationData = {
        title: 'New Message',
        body: event.data.text(),
        icon: '/images/icons/icon-192x192.png'
      };
    }
  }
  
  const title = notificationData.title || 'SecureChat';
  const options = {
    body: notificationData.body || 'You have a new message',
    icon: notificationData.icon || '/images/icons/icon-192x192.png',
    badge: '/images/icons/badge-96x96.png',
    data: notificationData.data || {},
    vibrate: [100, 50, 100],
    actions: [
      {
        action: 'view',
        title: 'View'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click:', event.notification.tag);
  
  // Close the notification
  event.notification.close();
  
  // Handle notification action clicks
  if (event.action === 'view' || !event.action) {
    // Open or focus the app
    event.waitUntil(
      clients.matchAll({
        type: 'window'
      })
      .then((clientList) => {
        const url = event.notification.data.url || '/chat';
        
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.postMessage({
              type: 'notification-click',
              data: event.notification.data
            });
            return client.focus();
          }
        }
        
        // If no open window, open one
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  }
});

// Background sync for offline messages
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background Sync', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

// Function to sync messages when back online
async function syncMessages() {
  try {
    // Get pending messages from IndexedDB
    const db = await openDB();
    const pendingMessages = await getAllPendingMessages(db);
    
    console.log('[Service Worker] Syncing messages:', pendingMessages.length);
    
    // Process each pending message
    const results = await Promise.all(pendingMessages.map(async (message) => {
      try {
        // Send the message to the server
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        });
        
        if (response.ok) {
          // Remove from pending queue on success
          await deletePendingMessage(db, message.id);
          return { success: true, messageId: message.id };
        } else {
          return { success: false, messageId: message.id };
        }
      } catch (error) {
        console.error('Error syncing message:', error);
        return { success: false, messageId: message.id };
      }
    }));
    
    // Notify clients about the results
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'sync-complete',
        results
      });
    });
    
    return results;
  } catch (error) {
    console.error('Error in syncMessages:', error);
    throw error;
  }
}

// Open the IndexedDB database
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SecureChatMessages', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingMessages')) {
        db.createObjectStore('pendingMessages', { keyPath: 'id' });
      }
    };
  });
}

// Get all pending messages from IndexedDB
function getAllPendingMessages(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingMessages'], 'readonly');
    const store = transaction.objectStore('pendingMessages');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Delete a pending message from IndexedDB
function deletePendingMessage(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingMessages'], 'readwrite');
    const store = transaction.objectStore('pendingMessages');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}