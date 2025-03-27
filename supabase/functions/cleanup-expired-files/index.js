// supabase/functions/cleanup-expired-files/index.js
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

serve(async (req) => {
  try {
    // Create a Supabase client with the service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Check request authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { 'Content-Type': 'application/json' }, status: 401 }
      )
    }
    
    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { 'Content-Type': 'application/json' }, status: 401 }
      )
    }
    
    // Check if user is an admin
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .single()
      
    if (adminError || !adminData) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin access required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 403 }
      )
    }
    
    // Process request based on HTTP method
    if (req.method === 'POST') {
      return await processCleanup(supabase)
    } else if (req.method === 'GET') {
      return await getExpiredFiles(supabase)
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { headers: { 'Content-Type': 'application/json' }, status: 405 }
      )
    }
  } catch (error) {
    console.error('Cleanup function error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

// Get expired files from the database
async function getExpiredFiles(supabase) {
  try {
    // Get current date
    const now = new Date().toISOString()
    
    // Find files from expired messages
    const { data: expiredMessageFiles, error: messageError } = await supabase
      .from('attachments')
      .select(`
        id,
        storage_path,
        message_id,
        messages:message_id (
          expires_at
        )
      `)
      .not('messages.expires_at', 'is', null)
      .lt('messages.expires_at', now)
    
    if (messageError) throw messageError
    
    // Find orphaned files (no message association)
    const { data: orphanedFiles, error: orphanError } = await supabase
      .from('attachments')
      .select('id, storage_path, created_at')
      .is('message_id', null)
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Older than 24 hours
    
    if (orphanError) throw orphanError
    
    return new Response(
      JSON.stringify({ 
        success: true,
        expiredMessageFiles: expiredMessageFiles.length,
        orphanedFiles: orphanedFiles.length,
        totalFiles: expiredMessageFiles.length + orphanedFiles.length,
        files: [...expiredMessageFiles, ...orphanedFiles]
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    throw error
  }
}

// Process cleanup of expired files
async function processCleanup(supabase) {
  try {
    // Get current date
    const now = new Date().toISOString()
    
    // Find files from expired messages
    const { data: expiredMessageFiles, error: messageError } = await supabase
      .from('attachments')
      .select(`
        id,
        storage_path,
        message_id,
        messages:message_id (
          expires_at
        )
      `)
      .not('messages.expires_at', 'is', null)
      .lt('messages.expires_at', now)
    
    if (messageError) throw messageError
    
    // Find orphaned files (no message association)
    const { data: orphanedFiles, error: orphanError } = await supabase
      .from('attachments')
      .select('id, storage_path, created_at')
      .is('message_id', null)
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Older than 24 hours
    
    if (orphanError) throw orphanError
    
    // Combine all files to delete
    const allFilesToDelete = [...expiredMessageFiles, ...orphanedFiles]
    
    if (allFilesToDelete.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No expired files found'
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      )
    }
    
    // Delete files from storage
    const storageResults = await Promise.all(
      allFilesToDelete.map(async (file) => {
        try {
          const { error: storageError } = await supabase
            .storage
            .from('secure-files')
            .remove([file.storage_path])
          
          return {
            id: file.id,
            path: file.storage_path,
            deleted: !storageError,
            error: storageError?.message
          }
        } catch (error) {
          return {
            id: file.id,
            path: file.storage_path,
            deleted: false,
            error: error.message
          }
        }
      })
    )
    
    // Delete records from the database
    const { data: deletedRecords, error: dbError } = await supabase
      .from('attachments')
      .delete()
      .in('id', allFilesToDelete.map(file => file.id))
      .select()
    
    if (dbError) throw dbError
    
    // Log cleanup activity
    await supabase
      .from('admin_logs')
      .insert({
        action: 'cleanup_expired_files',
        admin_id: null, // System action
        details: {
          files_deleted: storageResults.filter(r => r.deleted).length,
          records_deleted: deletedRecords.length,
          total_files: allFilesToDelete.length,
          results: storageResults
        },
        created_at: new Date().toISOString()
      })
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Deleted ${deletedRecords.length} files`,
        filesDeleted: storageResults.filter(r => r.deleted).length,
        recordsDeleted: deletedRecords.length,
        totalFiles: allFilesToDelete.length,
        results: storageResults
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    throw error
  }
}