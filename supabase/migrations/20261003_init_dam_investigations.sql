-- Additive migration for UseDAM AI Workspace
-- Run in Supabase SQL editor to create persistent investigation tables

CREATE TABLE IF NOT EXISTS public.investigations (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  case_id TEXT NOT NULL,
  mode TEXT DEFAULT 'evidence',
  lang TEXT DEFAULT 'auto',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.investigation_turns (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.investigation_sources (
  id SERIAL PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  published_date TEXT,
  source_type TEXT,
  passage TEXT,
  stance TEXT CHECK (stance IN ('supports', 'contradicts', 'context')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_sources ENABLE ROW LEVEL SECURITY;

-- Additive RLS Policies (Idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own investigations') THEN
    CREATE POLICY "Users can view their own investigations" 
      ON public.investigations FOR SELECT 
      USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own investigations') THEN
    CREATE POLICY "Users can insert their own investigations" 
      ON public.investigations FOR INSERT 
      WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own investigations') THEN
    CREATE POLICY "Users can update their own investigations" 
      ON public.investigations FOR UPDATE 
      USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own investigations') THEN
    CREATE POLICY "Users can delete their own investigations" 
      ON public.investigations FOR DELETE 
      USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can access turns for their investigations') THEN
    CREATE POLICY "Users can access turns for their investigations" 
      ON public.investigation_turns FOR ALL 
      USING (EXISTS (
        SELECT 1 FROM public.investigations i 
        WHERE i.id = investigation_turns.investigation_id 
        AND (i.user_id = auth.uid() OR i.user_id IS NULL)
      ));
  END IF;
END $$;
