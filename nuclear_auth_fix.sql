-- =============================================
-- NUCLEAR CLEANUP (Isolate the 500 Error)
-- =============================================

-- 1. DELETE ALL TRIGGERS ON auth.users
-- This ensures NOTHING runs when a user signs up.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Test Signup now.
-- If it still fails with 500, the issue is your Supabase Auth Config (SMTP/Settings).
-- If it succeeds, the issue was definitely the trigger code.

-- 3. (Optional) Re-verify table structure is clean
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;
ALTER TABLE IF EXISTS public.profiles ADD CONSTRAINT profiles_subscription_status_check 
  CHECK (subscription_status IN ('inactive', 'active', 'pro', 'cancelled'));
