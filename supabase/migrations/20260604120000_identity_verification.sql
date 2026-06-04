ALTER TABLE public.profiles ADD COLUMN identity_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN stripe_verification_session_id text;
