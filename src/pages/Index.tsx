import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import {
  GraduationCap,
  Bell,
  Calendar,
  Users,
  Megaphone,
  Clock,
  MapPin,
  ChevronRight,
  ShieldCheck,
  Ticket,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface StudentMeta {
  username: string;
  department: string | null;
  year: string | null;
  student_id: string | null;
  is_verified: boolean;
}

interface UpcomingEvent {
  id: string;
  club_id: string;
  title: string;
  venue: string;
  start_time: string;
  club_name: string;
  is_registered: boolean;
}

interface AnnouncementNotice {
  id: string;
  club_id: string;
  club_name: string;
  content: string;
  created_at: string;
  sender_name: string;
}

interface JoinedClubSummary {
  id: string;
  name: string;
  category: string;
  role: string;
}

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [student, setStudent] = useState<StudentMeta | null>(null);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementNotice[]>([]);
  const [joinedClubs, setJoinedClubs] = useState<JoinedClubSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      // 1. Fetch Student Profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, department, year, student_id, is_verified")
        .eq("id", user.id)
        .single();

      if (profile) {
        setStudent(profile as StudentMeta);
      }

      // 2. Fetch Joined Clubs
      const { data: memberships } = await (supabase
        .from("club_memberships" as any)
        .select(`
          role,
          clubs:club_id (
            id,
            name,
            category
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "active") as any);

      const clubsList: JoinedClubSummary[] = (memberships || []).map((m: any) => ({
        id: m.clubs.id,
        name: m.clubs.name,
        category: m.clubs.category,
        role: m.role,
      }));
      setJoinedClubs(clubsList);

      // 3. Fetch Upcoming Events & User Registrations
      const { data: evData } = await (supabase
        .from("events" as any)
        .select(`
          id,
          club_id,
          title,
          venue,
          start_time,
          clubs:club_id (name)
        `)
        .order("start_time", { ascending: true })
        .limit(4) as any);

      const { data: regData } = await (supabase
        .from("event_registrations" as any)
        .select("event_id")
        .eq("user_id", user.id)
        .eq("status", "registered") as any);

      const registeredIds = new Set((regData || []).map((r: any) => r.event_id));

      const parsedEvents: UpcomingEvent[] = (evData || []).map((ev: any) => ({
        id: ev.id,
        club_id: ev.club_id,
        title: ev.title,
        venue: ev.venue,
        start_time: ev.start_time,
        club_name: ev.clubs?.name || "Campus Club",
        is_registered: registeredIds.has(ev.id),
      }));
      setEvents(parsedEvents);

      // 4. Fetch Latest Official Announcements
      const { data: notices } = await (supabase
        .from("channel_messages" as any)
        .select(`
          id,
          content,
          created_at,
          club_channels:channel_id (
            club_id,
            type,
            clubs:club_id (name)
          ),
          profiles:sender_id (username)
        `)
        .order("created_at", { ascending: false })
        .limit(5) as any);

      const announcementNotices: AnnouncementNotice[] = (notices || [])
        .filter((n: any) => n.club_channels?.type === "announcements")
        .map((n: any) => ({
          id: n.id,
          club_id: n.club_channels.club_id,
          club_name: n.club_channels.clubs?.name || "Campus Club",
          content: n.content,
          created_at: n.created_at,
          sender_name: n.profiles?.username || "Coordinator",
        }));
      setAnnouncements(announcementNotices);
    } catch (err: any) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleRegisterEvent = async (ev: UpcomingEvent) => {
    if (!user?.id) return;
    try {
      if (ev.is_registered) {
        navigate("/events");
      } else {
        const { error } = await (supabase
          .from("event_registrations" as any)
          .insert({
            event_id: ev.id,
            user_id: user.id,
            status: "registered",
          }) as any);
        if (error) throw error;
        toast.success("Successfully registered! Pass issued.");
        loadDashboard();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to register");
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        {/* Top Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-bold tracking-tight">CampusConnect</h1>
                {student?.is_verified && (
                  <ShieldCheck className="h-4 w-4 text-primary fill-primary/20" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">College Clubs & Events Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => navigate("/notifications")}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-foreground" />
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs">Loading campus workspace...</p>
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {/* Student ID Welcome Card */}
            <div className="rounded-2xl border bg-gradient-to-br from-card to-muted/40 p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-primary">
                    Verified Student Pass
                  </span>
                  <h2 className="text-base font-bold text-foreground mt-0.5">
                    {student?.username || user?.email?.split("@")[0]}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {student?.department || "Department Not Set"} · {student?.year || "Year Not Set"}
                  </p>
                  {student?.student_id && (
                    <span className="inline-block mt-2 font-mono text-[11px] bg-background/80 px-2 py-0.5 rounded border text-muted-foreground">
                      ID: {student.student_id}
                    </span>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/profile")}
                  className="h-7 text-xs rounded-full gap-1"
                >
                  Edit Profile
                </Button>
              </div>

              {/* Quick metrics */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border/60 text-center">
                <div onClick={() => navigate("/clubs")} className="cursor-pointer">
                  <p className="text-base font-bold text-primary">{joinedClubs.length}</p>
                  <p className="text-[10px] text-muted-foreground">Joined Clubs</p>
                </div>
                <div onClick={() => navigate("/events")} className="cursor-pointer">
                  <p className="text-base font-bold text-foreground">
                    {events.filter((e) => e.is_registered).length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">My Tickets</p>
                </div>
                <div onClick={() => navigate("/events")} className="cursor-pointer">
                  <p className="text-base font-bold text-foreground">{events.length}</p>
                  <p className="text-[10px] text-muted-foreground">Upcoming</p>
                </div>
              </div>
            </div>

            {/* My Joined Clubs Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary" /> My Club Spaces
                </h3>
                <button
                  onClick={() => navigate("/clubs")}
                  className="text-xs text-primary font-medium hover:underline flex items-center"
                >
                  Explore All <ChevronRight className="h-3 w-3" />
                </button>
              </div>

              {joinedClubs.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                  <p>You haven't joined any clubs yet.</p>
                  <Button
                    size="sm"
                    variant="link"
                    onClick={() => navigate("/clubs")}
                    className="text-xs p-0 h-auto text-primary mt-1"
                  >
                    Browse campus clubs & join →
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {joinedClubs.map((club) => (
                    <div
                      key={club.id}
                      onClick={() => navigate(`/club/${club.id}`)}
                      className="min-w-[150px] p-3 rounded-xl border bg-card hover:border-primary/50 cursor-pointer transition-all shrink-0"
                    >
                      <Badge variant="secondary" className="text-[9px] mb-1">
                        {club.category}
                      </Badge>
                      <p className="text-xs font-semibold truncate text-foreground">{club.name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                        Role: {club.role}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Campus Events */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" /> Upcoming Events & Workshops
                </h3>
                <button
                  onClick={() => navigate("/events")}
                  className="text-xs text-primary font-medium hover:underline flex items-center"
                >
                  All Events <ChevronRight className="h-3 w-3" />
                </button>
              </div>

              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">No events scheduled right now.</p>
              ) : (
                <div className="space-y-2.5">
                  {events.map((ev) => (
                    <Card key={ev.id} className="border-border/60">
                      <CardHeader className="p-3 pb-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-semibold text-primary">
                              {ev.club_name}
                            </span>
                            <CardTitle className="text-sm font-semibold leading-tight mt-0.5">
                              {ev.title}
                            </CardTitle>
                          </div>
                          <Button
                            size="sm"
                            variant={ev.is_registered ? "outline" : "default"}
                            onClick={() => handleRegisterEvent(ev)}
                            className="h-7 text-xs rounded-full px-3 shrink-0"
                          >
                            {ev.is_registered ? "Registered ✓" : "Register"}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardFooter className="p-3 pt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Clock className="h-3 w-3 text-primary" />
                          {new Date(ev.start_time).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {ev.venue}
                        </span>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Official Announcements */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Megaphone className="h-4 w-4 text-amber-500" /> Official Notices
                </h3>
              </div>

              {announcements.length === 0 ? (
                <p className="text-xs text-muted-foreground">No official announcements posted yet.</p>
              ) : (
                <div className="space-y-2">
                  {announcements.map((notice) => (
                    <div
                      key={notice.id}
                      onClick={() => navigate(`/club/${notice.club_id}`)}
                      className="p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-primary">{notice.club_name}</span>
                        <span className="text-muted-foreground text-[10px]">
                          {new Date(notice.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-foreground leading-relaxed line-clamp-3">
                        {notice.content}
                      </p>
                      <span className="text-[10px] text-muted-foreground block">
                        Posted by {notice.sender_name} · Click to open channel →
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Index;
