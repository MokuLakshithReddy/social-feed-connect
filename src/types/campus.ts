export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  logo_url: string | null;
  cover_url: string | null;
  faculty_coordinator: string | null;
  status: 'active' | 'pending_approval' | 'inactive';
  created_by: string | null;
  created_at: string;
  member_count?: number;
  user_membership?: ClubMembership | null;
}

export interface ClubMembership {
  id: string;
  club_id: string;
  user_id: string;
  role: 'president' | 'organizer' | 'member';
  status: 'active' | 'pending' | 'rejected' | 'banned';
  joined_at: string;
}

export interface ClubChannel {
  id: string;
  club_id: string;
  name: string;
  type: 'announcements' | 'general' | 'project' | 'events';
  description: string | null;
  is_private: boolean;
  created_at: string;
}

export interface ChannelMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  attachments?: any[];
  is_pinned: boolean;
  created_at: string;
  sender?: {
    id: string;
    username: string;
    avatar_url: string | null;
    department?: string | null;
    year?: string | null;
    is_verified?: boolean;
  };
}

export interface CampusEvent {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  venue: string;
  start_time: string;
  end_time: string | null;
  capacity: number | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  club?: Club;
  registration_count?: number;
  user_registration?: EventRegistration | null;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  status: 'registered' | 'waitlist' | 'attended' | 'cancelled';
  qr_code_token: string;
  checked_in_at: string | null;
  created_at: string;
}

export interface StudentProfile {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  department: string | null;
  year: string | null;
  student_id: string | null;
  college_role: 'student' | 'faculty' | 'college_admin';
  is_verified: boolean;
}
