-- ==============================================
-- SUPER ADMIN MIGRATION
-- Run this in the Supabase SQL Editor
-- ==============================================

-- 1. Create super_admins table
CREATE TABLE IF NOT EXISTS super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS on super_admins
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Super admins can read the super_admins table (to check if they are admin)
CREATE POLICY "Users can check if they are super admin"
  ON super_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 4. Policy: Super admins can create stores
CREATE POLICY "Super admins can create stores"
  ON stores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

-- 5. Policy: Super admins can read all stores (for admin panel)
CREATE POLICY "Super admins can read all stores"
  ON stores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

-- 6. Policy: Super admins can create invitations for any store
CREATE POLICY "Super admins can create invitations for any store"
  ON store_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

-- 7. Policy: Super admins can read all invitations
CREATE POLICY "Super admins can read all invitations"
  ON store_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

-- 8. Policy: Super admins can delete invitations for any store
CREATE POLICY "Super admins can delete any invitation"
  ON store_invitations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

-- ==============================================
-- ADD YOURSELF AS SUPER ADMIN
-- Replace 'YOUR_USER_ID' with your actual user ID
-- You can find your user ID by running:
--   SELECT id, email FROM auth.users;
-- ==============================================

-- INSERT INTO super_admins (user_id) VALUES ('YOUR_USER_ID');
