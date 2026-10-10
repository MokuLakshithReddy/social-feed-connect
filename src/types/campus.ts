export type CollegeRole = 'student' | 'faculty' | 'college_admin';

export type ClubRole = 'president' | 'organizer' | 'member';

export type MembershipStatus = 'active' | 'pending' | 'rejected' | 'banned';

export type ClubStatus = 'active' | 'pending_approval' | 'inactive';

export type ChannelType = 'announcements' | 'general' | 'project' | 'events';

export type RegistrationStatus = 'registered' | 'waitlist' | 'attended' | 'cancelled';

export type NotificationType = 
  | 'announcement'
  | 'event_created'
  | 'event_reminder'
  | 'membership_requested'
  | 'membership_approved';

export interface StudentProfile {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  department: string | null;
  year: string | null;
  student_id: string | null;
  college_role: CollegeRole;
  is_verified: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  logo_url: string | null;
  cover_url: string | null;
  faculty_coordinator: string | null;
  status: ClubStatus;
  created_by: string | null;
  created_at: string;
  updated_at?: string;
  member_count?: number;
  user_membership?: ClubMembership | null;
}

export interface ClubMembership {
  id: string;
  club_id: string;
  user_id: string;
  role: ClubRole;
  status: MembershipStatus;
  joined_at: string;
  created_at?: string;
  profiles?: StudentProfile;
}

export interface ClubChannel {
  id: string;
  club_id: string;
  name: string;
  type: ChannelType;
  description: string | null;
  is_private: boolean;
  created_at: string;
}

export interface ChannelMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  attachments?: Record<string, unknown>[];
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
  status: RegistrationStatus;
  qr_code_token: string;
  checked_in_at: string | null;
  created_at: string;
  profiles?: StudentProfile;
}

export interface CampusNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  resource_type: string | null;
  resource_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface RegisterEventResult {
  success: boolean;
  registration_id?: string;
  qr_code_token?: string;
  message?: string;
}

export interface CheckInResult {
  success: boolean;
  attendee_name?: string;
  checked_in_at?: string;
  message?: string;
}
