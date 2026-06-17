-- Fix handle_new_user trigger to support phone-only signups.
-- Previously used split_part(NEW.email, '@', 1) which returns NULL when email is NULL,
-- causing a NOT NULL violation on profiles.username for OTP users.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'user_' || substr(NEW.id::text, 1, 8)
  );

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, v_username, v_username);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
