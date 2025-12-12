
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn('Supabase URL missing! Using placeholder. Please set NEXT_PUBLIC_SUPABASE_URL in .env.local')
}
