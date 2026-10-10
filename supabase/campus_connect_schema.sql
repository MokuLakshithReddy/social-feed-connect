-- Migration: College Club Community & Event Management (CampusConnect)

-- 1. Extend public.profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS year TEXT,
  ADD COLUMN IF NOT EXISTS student_id TEXT,
  ADD COLUMN IF NOT EXISTS college_role TEXT DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- 2. Create public.clubs
CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Technical',
  logo_url TEXT,
  cover_url TEXT,
  faculty_coordinator TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_approval', 'inactive')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create public.club_memberships
CREATE TABLE IF NOT EXISTS public.club_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('president', 'organizer', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'rejected', 'banned')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (club_id, user_id)
);

-- 4. Create public.club_channels
CREATE TABLE IF NOT EXISTS public.club_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('announcements', 'general', 'project', 'events')),
  description TEXT,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create public.channel_messages
CREATE TABLE IF NOT EXISTS public.channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.club_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create public.events
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  poster_url TEXT,
  venue TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  capacity INTEGER,
  is_published BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Create public.event_registrations
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'waitlist', 'attended', 'cancelled')),
  qr_code_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clubs
DROP POLICY IF EXISTS "Anyone can view active clubs" ON public.clubs;
CREATE POLICY "Anyone can view active clubs" ON public.clubs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;
CREATE POLICY "Authenticated users can create clubs" ON public.clubs FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Organizers or creators can update clubs" ON public.clubs;
CREATE POLICY "Organizers or creators can update clubs" ON public.clubs FOR UPDATE TO authenticated USING (
  auth.uid() = created_by OR
  EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = clubs.id AND user_id = auth.uid() AND role IN ('president', 'organizer')
  )
);

-- RLS Policies for club_memberships
DROP POLICY IF EXISTS "Anyone can view club memberships" ON public.club_memberships;
CREATE POLICY "Anyone can view club memberships" ON public.club_memberships FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join clubs" ON public.club_memberships;
CREATE POLICY "Users can join clubs" ON public.club_memberships FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can update their membership or organizers can manage" ON public.club_memberships;
CREATE POLICY "Members can update their membership or organizers can manage" ON public.club_memberships FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.club_memberships cm
    WHERE cm.club_id = club_memberships.club_id AND cm.user_id = auth.uid() AND cm.role IN ('president', 'organizer')
  )
);

DROP POLICY IF EXISTS "Members can leave or organizers can remove" ON public.club_memberships;
CREATE POLICY "Members can leave or organizers can remove" ON public.club_memberships FOR DELETE TO authenticated USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.club_memberships cm
    WHERE cm.club_id = club_memberships.club_id AND cm.user_id = auth.uid() AND cm.role IN ('president', 'organizer')
  )
);

-- RLS Policies for club_channels
DROP POLICY IF EXISTS "Anyone can view club channels" ON public.club_channels;
CREATE POLICY "Anyone can view club channels" ON public.club_channels FOR SELECT USING (true);

DROP POLICY IF EXISTS "Organizers can create channels" ON public.club_channels;
CREATE POLICY "Organizers can create channels" ON public.club_channels FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = club_channels.club_id AND user_id = auth.uid() AND role IN ('president', 'organizer')
  )
);

-- RLS Policies for channel_messages
DROP POLICY IF EXISTS "Members can view channel messages" ON public.channel_messages;
CREATE POLICY "Members can view channel messages" ON public.channel_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authorized members can post messages" ON public.channel_messages;
CREATE POLICY "Authorized members can post messages" ON public.channel_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND (
    -- If announcement channel, only organizers/presidents
    (
      EXISTS (
        SELECT 1 FROM public.club_channels cc
        JOIN public.club_memberships cm ON cc.club_id = cm.club_id
        WHERE cc.id = channel_messages.channel_id
          AND cm.user_id = auth.uid()
          AND cc.type = 'announcements'
          AND cm.role IN ('president', 'organizer')
      )
    )
    OR
    -- If normal channel, any active member
    (
      EXISTS (
        SELECT 1 FROM public.club_channels cc
        JOIN public.club_memberships cm ON cc.club_id = cm.club_id
        WHERE cc.id = channel_messages.channel_id
          AND cm.user_id = auth.uid()
          AND cc.type != 'announcements'
          AND cm.status = 'active'
      )
    )
  )
);

-- RLS Policies for events
DROP POLICY IF EXISTS "Anyone can view published events" ON public.events;
CREATE POLICY "Anyone can view published events" ON public.events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Organizers can create events" ON public.events;
CREATE POLICY "Organizers can create events" ON public.events FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = events.club_id AND user_id = auth.uid() AND role IN ('president', 'organizer')
  )
);

DROP POLICY IF EXISTS "Organizers can update events" ON public.events;
CREATE POLICY "Organizers can update events" ON public.events FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = events.club_id AND user_id = auth.uid() AND role IN ('president', 'organizer')
  )
);

-- RLS Policies for event_registrations
DROP POLICY IF EXISTS "Users can view registrations" ON public.event_registrations;
CREATE POLICY "Users can view registrations" ON public.event_registrations FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.events ev
    JOIN public.club_memberships cm ON ev.club_id = cm.club_id
    WHERE ev.id = event_registrations.event_id AND cm.user_id = auth.uid() AND cm.role IN ('president', 'organizer')
  )
);

DROP POLICY IF EXISTS "Users can register for events" ON public.event_registrations;
CREATE POLICY "Users can register for events" ON public.event_registrations FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "Users or organizers can update registrations" ON public.event_registrations;
CREATE POLICY "Users or organizers can update registrations" ON public.event_registrations FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.events ev
    JOIN public.club_memberships cm ON ev.club_id = cm.club_id
    WHERE ev.id = event_registrations.event_id AND cm.user_id = auth.uid() AND cm.role IN ('president', 'organizer')
  )
);
