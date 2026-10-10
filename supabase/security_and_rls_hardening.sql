-- ============================================================================
-- CAMPUSCONNECT: SECURITY, RLS, PERMISSIONS, AND WORKFLOW HARDENING MIGRATION
-- ============================================================================

-- 1. SECURE IDENTITY & PRIVILEGE ESCALATION PREVENTION
-- Prevent non-admins from self-granting 'is_verified' or 'college_role = college_admin'
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- If caller is modifying is_verified or college_role
  IF (OLD.college_role IS DISTINCT FROM NEW.college_role OR OLD.is_verified IS DISTINCT FROM NEW.is_verified) THEN
    -- Check if calling user is an active college_admin
    SELECT college_role INTO v_caller_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_caller_role IS DISTINCT FROM 'college_admin' THEN
      -- Reset privilege fields to original database values
      NEW.college_role := OLD.college_role;
      NEW.is_verified := OLD.is_verified;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileges();

-- Designate the primary administrator securely
UPDATE public.profiles
SET college_role = 'college_admin',
    is_verified = true
WHERE username = 'mokulakshith' OR id = '73195cf7-df24-49e8-9f09-07bf6eb81c11';

-- 2. NOTIFICATIONS TABLE ENHANCEMENT
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "System or authorized functions can insert notifications" ON public.notifications;
CREATE POLICY "System or authorized functions can insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3. CLUB MEMBERSHIP SECURITY & JOIN REQUEST WORKFLOWS
-- Default membership insertion MUST be 'member' and 'pending' (unless created by college_admin)
CREATE OR REPLACE FUNCTION public.enforce_club_membership_defaults()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT college_role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();

  -- If not college_admin, enforce 'member' role and 'pending' status on insert
  IF v_caller_role IS DISTINCT FROM 'college_admin' THEN
    NEW.user_id := auth.uid();
    NEW.role := 'member';
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_club_membership_defaults ON public.club_memberships;
CREATE TRIGGER trg_enforce_club_membership_defaults
  BEFORE INSERT ON public.club_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_club_membership_defaults();

-- Auto-notification trigger on membership state changes
CREATE OR REPLACE FUNCTION public.handle_membership_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_club_name TEXT;
  v_user_name TEXT;
  v_organizer RECORD;
BEGIN
  SELECT name INTO v_club_name FROM public.clubs WHERE id = NEW.club_id;
  SELECT username INTO v_user_name FROM public.profiles WHERE id = NEW.user_id;

  -- 1. On INSERT with status 'pending': Notify club organizers/presidents
  IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
    FOR v_organizer IN 
      SELECT user_id FROM public.club_memberships 
      WHERE club_id = NEW.club_id AND role IN ('president', 'organizer') AND status = 'active'
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, resource_type, resource_id)
      VALUES (
        v_organizer.user_id,
        'membership_requested',
        'New Club Membership Request',
        v_user_name || ' requested to join ' || v_club_name,
        'club',
        NEW.club_id::text
      );
    END LOOP;
  END IF;

  -- 2. On UPDATE from 'pending' to 'active': Notify the student
  IF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'active') THEN
    INSERT INTO public.notifications (user_id, type, title, message, resource_type, resource_id)
    VALUES (
      NEW.user_id,
      'membership_approved',
      'Membership Approved! 🎉',
      'You are now an active member of ' || v_club_name,
      'club',
      NEW.club_id::text
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_handle_membership_notifications ON public.club_memberships;
CREATE TRIGGER trg_handle_membership_notifications
  AFTER INSERT OR UPDATE ON public.club_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_membership_notifications();

-- 4. ATOMIC EVENT REGISTRATION WITH LOCKING & CAPACITY VERIFICATION
CREATE OR REPLACE FUNCTION public.register_for_event(p_event_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_event RECORD;
  v_current_count INT;
  v_existing_reg RECORD;
  v_new_reg RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to register for events';
  END IF;

  -- Lock event row to prevent concurrent race condition overbooking
  SELECT id, club_id, title, capacity, is_published, start_time
  INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT v_event.is_published THEN
    RAISE EXCEPTION 'Event is not published';
  END IF;

  IF v_event.start_time < NOW() THEN
    RAISE EXCEPTION 'Cannot register for past events';
  END IF;

  -- Check existing registration
  SELECT id, status INTO v_existing_reg
  FROM public.event_registrations
  WHERE event_id = p_event_id AND user_id = v_user_id;

  IF FOUND THEN
    IF v_existing_reg.status = 'registered' THEN
      RAISE EXCEPTION 'Already registered for this event';
    ELSIF v_existing_reg.status = 'cancelled' THEN
      -- Re-activate registration
      UPDATE public.event_registrations
      SET status = 'registered', checked_in_at = NULL
      WHERE id = v_existing_reg.id
      RETURNING * INTO v_new_reg;

      RETURN jsonb_build_object('success', true, 'registration_id', v_new_reg.id, 'qr_code_token', v_new_reg.qr_code_token);
    END IF;
  END IF;

  -- Verify capacity atomically
  IF v_event.capacity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM public.event_registrations
    WHERE event_id = p_event_id AND status = 'registered';

    IF v_current_count >= v_event.capacity THEN
      RAISE EXCEPTION 'Event has reached maximum capacity (% seats)', v_event.capacity;
    END IF;
  END IF;

  -- Insert registration
  INSERT INTO public.event_registrations (event_id, user_id, status)
  VALUES (p_event_id, v_user_id, 'registered')
  RETURNING * INTO v_new_reg;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_new_reg.id,
    'qr_code_token', v_new_reg.qr_code_token
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Controlled cancellation
CREATE OR REPLACE FUNCTION public.cancel_event_registration(p_event_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.event_registrations
  WHERE event_id = p_event_id AND user_id = v_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Registration cancelled successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Server-validated attendance checking
CREATE OR REPLACE FUNCTION public.check_in_event_attendee(p_event_id UUID, p_qr_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_event RECORD;
  v_is_authorized BOOLEAN;
  v_reg RECORD;
  v_attendee_name TEXT;
BEGIN
  -- Verify caller authorization for this club event
  SELECT ev.id, ev.club_id, ev.title INTO v_event
  FROM public.events ev
  WHERE ev.id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Check if caller is club president, organizer, or college admin
  SELECT EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = v_event.club_id AND user_id = v_caller_id AND role IN ('president', 'organizer') AND status = 'active'
    UNION
    SELECT 1 FROM public.profiles
    WHERE id = v_caller_id AND college_role = 'college_admin'
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: Only event organizers can scan and validate tickets';
  END IF;

  -- Find matching registration
  SELECT * INTO v_reg
  FROM public.event_registrations
  WHERE event_id = p_event_id AND qr_code_token = p_qr_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid ticket pass or QR code';
  END IF;

  IF v_reg.status = 'cancelled' THEN
    RAISE EXCEPTION 'This registration was cancelled by the attendee';
  END IF;

  IF v_reg.checked_in_at IS NOT NULL THEN
    RAISE EXCEPTION 'Attendee already checked in at %', v_reg.checked_in_at;
  END IF;

  -- Mark checked in
  UPDATE public.event_registrations
  SET checked_in_at = NOW(), status = 'attended'
  WHERE id = v_reg.id;

  SELECT username INTO v_attendee_name FROM public.profiles WHERE id = v_reg.user_id;

  RETURN jsonb_build_object(
    'success', true,
    'attendee_name', v_attendee_name,
    'checked_in_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. AUTOMATIC ANNOUNCEMENT NOTIFICATIONS TRIGGER
CREATE OR REPLACE FUNCTION public.handle_announcement_broadcast()
RETURNS TRIGGER AS $$
DECLARE
  v_ch_type TEXT;
  v_club_id UUID;
  v_club_name TEXT;
  v_sender_name TEXT;
  v_member RECORD;
BEGIN
  -- Check if channel is 'announcements'
  SELECT type, club_id INTO v_ch_type, v_club_id
  FROM public.club_channels
  WHERE id = NEW.channel_id;

  IF v_ch_type = 'announcements' THEN
    SELECT name INTO v_club_name FROM public.clubs WHERE id = v_club_id;
    SELECT username INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;

    -- Insert notification for all active members of this club (except sender)
    FOR v_member IN
      SELECT user_id FROM public.club_memberships
      WHERE club_id = v_club_id AND status = 'active' AND user_id != NEW.sender_id
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, resource_type, resource_id)
      VALUES (
        v_member.user_id,
        'announcement',
        'Notice from ' || v_club_name,
        SUBSTRING(NEW.content FROM 1 FOR 120),
        'club',
        v_club_id::text
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_handle_announcement_broadcast ON public.channel_messages;
CREATE TRIGGER trg_handle_announcement_broadcast
  AFTER INSERT ON public.channel_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_announcement_broadcast();

-- 6. TIGHTENED ROW LEVEL SECURITY POLICIES

-- CLUBS:
-- Anyone can view active clubs. Pending clubs only viewable by creator or college_admin.
DROP POLICY IF EXISTS "Anyone can view active clubs" ON public.clubs;
DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;
DROP POLICY IF EXISTS "Organizers or creators can update clubs" ON public.clubs;

CREATE POLICY "View active clubs or own pending clubs" ON public.clubs
  FOR SELECT TO authenticated
  USING (
    status = 'active' OR
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND college_role = 'college_admin')
  );

-- Club proposal: students can submit pending clubs
CREATE POLICY "Propose or create clubs" ON public.clubs
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND (
      status = 'pending_approval' OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND college_role = 'college_admin')
    )
  );

-- Club management: Only college admin or club president can update club details
CREATE POLICY "Presidents or admins update clubs" ON public.clubs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_memberships
      WHERE club_id = clubs.id AND user_id = auth.uid() AND role = 'president' AND status = 'active'
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND college_role = 'college_admin')
  );

-- CLUB MEMBERSHIPS:
DROP POLICY IF EXISTS "Anyone can view club memberships" ON public.club_memberships;
DROP POLICY IF EXISTS "Users can join clubs" ON public.club_memberships;
DROP POLICY IF EXISTS "Members can update their membership or organizers can manage" ON public.club_memberships;
DROP POLICY IF EXISTS "Members can leave or organizers can remove" ON public.club_memberships;

-- Active members are visible to authenticated users. Pending requests visible only to user or club organizers/admins.
CREATE POLICY "View memberships" ON public.club_memberships
  FOR SELECT TO authenticated
  USING (
    status = 'active' OR
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.club_memberships cm
      WHERE cm.club_id = club_memberships.club_id AND cm.user_id = auth.uid() AND cm.role IN ('president', 'organizer') AND cm.status = 'active'
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND college_role = 'college_admin')
  );

-- Request membership
CREATE POLICY "Request membership" ON public.club_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
  );

-- Manage memberships: Only president or organizer can approve/reject/promote
CREATE POLICY "Organizers or admins manage memberships" ON public.club_memberships
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_memberships cm
      WHERE cm.club_id = club_memberships.club_id AND cm.user_id = auth.uid() AND cm.role IN ('president', 'organizer') AND cm.status = 'active'
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND college_role = 'college_admin')
  );

-- Leave or remove
CREATE POLICY "Leave or remove membership" ON public.club_memberships
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.club_memberships cm
      WHERE cm.club_id = club_memberships.club_id AND cm.user_id = auth.uid() AND cm.role IN ('president', 'organizer') AND cm.status = 'active'
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND college_role = 'college_admin')
  );

-- CLUB CHANNELS:
DROP POLICY IF EXISTS "Anyone can view club channels" ON public.club_channels;
DROP POLICY IF EXISTS "Organizers can create channels" ON public.club_channels;

-- Only active members of that club or college admins can view channels
CREATE POLICY "Active members view channels" ON public.club_channels
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_memberships cm
      WHERE cm.club_id = club_channels.club_id AND cm.user_id = auth.uid() AND cm.status = 'active'
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND college_role = 'college_admin')
  );

CREATE POLICY "Organizers create channels" ON public.club_channels
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_memberships cm
      WHERE cm.club_id = club_channels.club_id AND cm.user_id = auth.uid() AND cm.role IN ('president', 'organizer') AND cm.status = 'active'
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND college_role = 'college_admin')
  );

-- CHANNEL MESSAGES:
DROP POLICY IF EXISTS "Members can view channel messages" ON public.channel_messages;
DROP POLICY IF EXISTS "Authorized members can post messages" ON public.channel_messages;

-- Only active members of the channel's club can view messages
CREATE POLICY "Active members view channel messages" ON public.channel_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_channels cc
      JOIN public.club_memberships cm ON cc.club_id = cm.club_id
      WHERE cc.id = channel_messages.channel_id AND cm.user_id = auth.uid() AND cm.status = 'active'
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND college_role = 'college_admin')
  );

-- Post messages: announcements restricted to organizers; general open to active members
CREATE POLICY "Authorized members post messages" ON public.channel_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND (
      -- Announcements: Only president or organizer
      (
        EXISTS (
          SELECT 1 FROM public.club_channels cc
          JOIN public.club_memberships cm ON cc.club_id = cm.club_id
          WHERE cc.id = channel_messages.channel_id
            AND cm.user_id = auth.uid()
            AND cc.type = 'announcements'
            AND cm.role IN ('president', 'organizer')
            AND cm.status = 'active'
        )
      )
      OR
      -- General discussion: Any active member
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
      OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND college_role = 'college_admin')
    )
  );

-- EVENT REGISTRATIONS:
DROP POLICY IF EXISTS "Users can view registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Users can register for events" ON public.event_registrations;
DROP POLICY IF EXISTS "Users or organizers can update registrations" ON public.event_registrations;

-- Privacy: Attendee can view their own registration. Organizers of that event can view list of attendees.
CREATE POLICY "Attendee or organizer views registration" ON public.event_registrations
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.events ev
      JOIN public.club_memberships cm ON ev.club_id = cm.club_id
      WHERE ev.id = event_registrations.event_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('president', 'organizer')
        AND cm.status = 'active'
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND college_role = 'college_admin')
  );

-- Only user themselves can insert through function or policy
CREATE POLICY "User inserts own registration" ON public.event_registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
  );

CREATE POLICY "User or organizer updates registration" ON public.event_registrations
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.events ev
      JOIN public.club_memberships cm ON ev.club_id = cm.club_id
      WHERE ev.id = event_registrations.event_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('president', 'organizer')
        AND cm.status = 'active'
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND college_role = 'college_admin')
  );

CREATE POLICY "User cancels own registration" ON public.event_registrations
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND college_role = 'college_admin')
  );
