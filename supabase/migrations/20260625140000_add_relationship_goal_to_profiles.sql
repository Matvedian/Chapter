ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS relationship_goal text
  CHECK (relationship_goal IN ('casual', 'serious', 'open'));
