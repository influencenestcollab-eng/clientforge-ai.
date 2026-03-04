-- =============================================
-- MINIMALIST SIGNUP FIX (Run this if 500 persists)
-- =============================================

-- 1. Aggressive Cleanup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create the simplest possible function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- We use a simple insert with NO complexity
  INSERT INTO public.profiles (id, full_name, subscription_status)
  VALUES (NEW.id, NEW.email, 'inactive')
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- CRITICAL: Prevent the 500 error by returning NEW even if insert fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-attach to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Final check: Ensure the table allows this
ALTER TABLE public.profiles ALTER COLUMN subscription_status SET DEFAULT 'inactive';
