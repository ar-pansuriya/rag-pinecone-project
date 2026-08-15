import { createAdminClient } from './lib/supabase/admin'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Server starting, running setup tasks...')
    
    // Only run if Supabase variables are configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('[Instrumentation] Skipping Supabase setup: Missing environment variables.')
      return
    }

    const supabase = createAdminClient()
    
    // Setup test user logic
    const testEmail = 'arpansuriya@app.local'
    const testPassword = '123456789'
    
    // Try to sign in or get user to see if they exist
    // Supabase Admin API to list users (requires service_role)
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('[Instrumentation] Error listing users:', listError.message)
    } else {
      const userExists = users.users.find(u => u.email === testEmail)
      
      if (!userExists) {
        console.log('[Instrumentation] Test user not found. Creating test user...')
        const { data, error } = await supabase.auth.admin.createUser({
          email: testEmail,
          password: testPassword,
          email_confirm: true,
        })
        
        if (error) {
          console.error('[Instrumentation] Failed to create test user:', error.message)
        } else {
          console.log('[Instrumentation] Test user created successfully!')
        }
      } else {
        console.log('[Instrumentation] Test user already exists.')
      }
    }
    
    // Future migrations can be placed here, e.g.:
    // await supabase.rpc('run_migrations')
  }
}
