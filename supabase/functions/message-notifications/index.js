// supabase/functions/message-notifications/index.js
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as webPush from 'https://esm.sh/web-push@3.5.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Web Push configuration
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''

webPush.setVapidDetails(
  'mailto:notifications@securechat.com',
  vapidPublicKey,
  vapidPrivateKey
)

serve(async (req) => {
  try {
    // Create a Supabase client with the service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Only process POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { headers: { 'Content-Type': 'application/json' }, status: 405 }
      )
    }
    
    // Parse the request body
    const requestData = await req.json()
    const { messageId } = requestData
    
    if (!messageId) {
      return new Response(
        JSON.stringify({ error: 'Message ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    
    // Get message details
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        conversation_id,
        sender_id,
        created_at,
        attachments,
        profiles:sender_id (
          username,
          display_name
        )
      `)
      .eq('id', messageId)
      .single()
      
    if (messageError || !message) {
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
    }
    
    // Get conversation members to notify
    const { data: members, error: membersError } = await supabase
      .from('conversation_members')
      .select('user_id, last_read_at')
      .eq('conversation_id', message.conversation_id)
      .neq('user_id', message.sender_id) // Don't notify the sender
    
    if (membersError) {
      throw membersError
    }
    
    // Get push tokens for each member
    const pushResults = await Promise.all(
      members.map(async (member) => {
        try {
          // Check user notification settings
          const { data: settings, error: settingsError } = await supabase
            .from('user_settings')
            .select('notifications_enabled, message_preview_enabled')
            .eq('user_id', member.user_id)
            .single()
            
          if (settingsError || !settings.notifications_enabled) {
            return { userId: member.user_id, sent: false, reason: 'Notifications disabled' }
          }
          
          // Get user's push tokens
          const { data: tokens, error: tokensError } = await supabase
            .from('push_tokens')
            .select('token, device_id')
            .eq('user_id', member.user_id)
            
          if (tokensError || tokens.length === 0) {
            return { userId: member.user_id, sent: false, reason: 'No push tokens' }
          }
          
          // Prepare notification content
          const senderName = message.profiles.display_name || message.profiles.username
          
          let notificationContent = 'New message'
          if (settings.message_preview_enabled && message.content) {
            notificationContent = message.content
          } else if (settings.message_preview_enabled && message.attachments) {
            const attachmentsCount = JSON.parse(message.attachments).length
            notificationContent = `Sent ${attachmentsCount} ${attachmentsCount === 1 ? 'file' : 'files'}`
          }
          
          // Send push notification to each device
          const results = await Promise.all(
            tokens.map(async (tokenData) => {
              try {
                const pushSubscription = JSON.parse(tokenData.token)
                
                await webPush.sendNotification(
                  pushSubscription,
                  JSON.stringify({
                    title: senderName,
                    body: notificationContent,
                    icon: '/images/icons/icon-192x192.png',
                    badge: '/images/icons/badge-96x96.png',
                    data: {
                      url: `/chat/${message.conversation_id}`,
                      messageId: message.id,
                      senderId: message.sender_id,
                      conversationId: message.conversation_id,
                      timestamp: message.created_at
                    }
                  })
                )
                
                return { deviceId: tokenData.device_id, sent: true }
              } catch (error) {
                console.error(`Push notification error for device ${tokenData.device_id}:`, error)
                
                // If subscription is no longer valid, remove it
                if (error.statusCode === 410) {
                  await supabase
                    .from('push_tokens')
                    .delete()
                    .eq('device_id', tokenData.device_id)
                }
                
                return { deviceId: tokenData.device_id, sent: false, error: error.message }
              }
            })
          )
          
          return { 
            userId: member.user_id, 
            sent: results.some(r => r.sent), 
            devices: results 
          }
        } catch (error) {
          console.error(`Error handling notifications for user ${member.user_id}:`, error)
          return { userId: member.user_id, sent: false, error: error.message }
        }
      })
    )
    
    // Log notification results
    await supabase
      .from('notification_logs')
      .insert({
        message_id: message.id,
        conversation_id: message.conversation_id,
        recipients: pushResults,
        created_at: new Date().toISOString()
      })
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notifications processed',
        results: pushResults 
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Notification function error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})