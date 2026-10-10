import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Megaphone,
  MessageSquare,
  Calendar,
  Users,
  Send,
  Pin,
  Plus,
  ShieldCheck,
  GraduationCap,
  Loader2,
  Clock,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface ClubDetails {
  id: string;
  name: string;
  description: string | null;
  category: string;
  faculty_coordinator: string | null;
  status: string;
  created_by: string;
}

interface MemberItem {
  id: string;
  user_id: string;
  role: "president" | "organizer" | "member";
  status: string;
  username: string;
  avatar_url: string | null;
  department: string | null;
  year: string | null;
}

interface ChannelItem {
  id: string;
  name: string;
  type: "announcements" | "general" | "project" | "events";
  description: string | null;
}

interface MessageItem {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  sender: {
    username: string;
    avatar_url: string | null;
    department?: string | null;
  };
}

interface EventItem {
  id: string;
  title: string;
  description: string | null;
  venue: string;
  start_time: string;
  capacity: number | null;
  registration_count?: number;
  is_registered?: boolean;
}

const ClubWorkspace = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [club, setClub] = useState<ClubDetails | null>(null);
  const [membership, setMembership] = useState<{ role: string; status: string } | null>(null);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  // Active channel state
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isNewEventOpen, setIsNewEventOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventVenue, setEventVenue] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventCapacity, setEventCapacity] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);

  // Announcement modal
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [publishingNotice, setPublishingNotice] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isOrganizer = membership?.role === "president" || membership?.role === "organizer";

  // Fetch club data
  const loadClubData = async () => {
    if (!clubId) return;
    try {
      setLoading(true);

      // 1. Fetch Club
      const { data: cData, error: cErr } = await (supabase
        .from("clubs" as any)
        .select("*")
        .eq("id", clubId)
        .single() as any);
      if (cErr) throw cErr;
      setClub(cData);

      // 2. Fetch User Membership
      if (user?.id) {
        const { data: mData } = await (supabase
          .from("club_memberships" as any)
          .select("role, status")
          .eq("club_id", clubId)
          .eq("user_id", user.id)
          .maybeSingle() as any);
        setMembership(mData || null);
      }

      // 3. Fetch Channels
      const { data: chData } = await (supabase
        .from("club_channels" as any)
        .select("*")
        .eq("club_id", clubId)
        .order("created_at", { ascending: true }) as any);

      const chList = chData || [];
      setChannels(chList);
      if (chList.length > 0 && !selectedChannelId) {
        // Default to announcements or general
        const defaultCh = chList.find((c: any) => c.type === "announcements") || chList[0];
        setSelectedChannelId(defaultCh.id);
      }

      // 4. Fetch Members with profiles
      const { data: memData } = await (supabase
        .from("club_memberships" as any)
        .select(`
          id,
          user_id,
          role,
          status,
          profiles:user_id (
            username,
            avatar_url,
            department,
            year
          )
        `)
        .eq("club_id", clubId)
        .eq("status", "active") as any);

      if (memData) {
        const parsedMembers: MemberItem[] = memData.map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          status: m.status,
          username: m.profiles?.username || "Student",
          avatar_url: m.profiles?.avatar_url || null,
          department: m.profiles?.department || null,
          year: m.profiles?.year || null,
        }));
        setMembers(parsedMembers);
      }

      // 5. Fetch Events
      const { data: evData } = await (supabase
        .from("events" as any)
        .select("*")
        .eq("club_id", clubId)
        .order("start_time", { ascending: true }) as any);

      if (evData) {
        // Fetch registrations
        const { data: regData } = await (supabase
          .from("event_registrations" as any)
          .select("event_id, user_id") as any);

        const regs = regData || [];
        const enrichedEvents = evData.map((ev: any) => {
          const evRegs = regs.filter((r: any) => r.event_id === ev.id);
          const userReg = evRegs.some((r: any) => r.user_id === user?.id);
          return {
            ...ev,
            registration_count: evRegs.length,
            is_registered: userReg,
          };
        });
        setEvents(enrichedEvents);
      }
    } catch (err: any) {
      console.error("Error loading club:", err);
      toast.error("Could not load club details");
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages for selected channel
  const loadChannelMessages = async (channelId: string) => {
    if (!channelId) return;
    try {
      const { data, error } = await (supabase
        .from("channel_messages" as any)
        .select(`
          id,
          channel_id,
          sender_id,
          content,
          is_pinned,
          created_at,
          profiles:sender_id (
            username,
            avatar_url,
            department
          )
        `)
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true }) as any);

      if (error) throw error;

      const parsed: MessageItem[] = (data || []).map((m: any) => ({
        id: m.id,
        channel_id: m.channel_id,
        sender_id: m.sender_id,
        content: m.content,
        is_pinned: m.is_pinned,
        created_at: m.created_at,
        sender: {
          username: m.profiles?.username || "Student",
          avatar_url: m.profiles?.avatar_url || null,
          department: m.profiles?.department || null,
        },
      }));
      setMessages(parsed);
    } catch (err: any) {
      console.error("Error loading channel messages:", err);
    }
  };

  useEffect(() => {
    loadClubData();
  }, [clubId, user?.id]);

  useEffect(() => {
    if (selectedChannelId) {
      loadChannelMessages(selectedChannelId);

      // Realtime subscription for channel messages
      const sub = supabase
        .channel(`channel_${selectedChannelId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "channel_messages",
            filter: `channel_id=eq.${selectedChannelId}`,
          },
          () => {
            loadChannelMessages(selectedChannelId);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(sub);
      };
    }
  }, [selectedChannelId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !newMessage.trim() || !selectedChannelId) return;

    try {
      setSendingMessage(true);
      const { error } = await (supabase
        .from("channel_messages" as any)
        .insert({
          channel_id: selectedChannelId,
          sender_id: user.id,
          content: newMessage.trim(),
        }) as any);

      if (error) throw error;
      setNewMessage("");
      loadChannelMessages(selectedChannelId);
    } catch (err: any) {
      toast.error(err.message || "Failed to send message. Verify membership permissions.");
    } finally {
      setSendingMessage(false);
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !announcementText.trim()) return;

    const announcementsCh = channels.find((c) => c.type === "announcements");
    if (!announcementsCh) {
      toast.error("Announcements channel not found");
      return;
    }

    try {
      setPublishingNotice(true);
      const { error } = await (supabase
        .from("channel_messages" as any)
        .insert({
          channel_id: announcementsCh.id,
          sender_id: user.id,
          content: announcementText.trim(),
          is_pinned: true,
        }) as any);

      if (error) throw error;
      toast.success("Official announcement broadcasted!");
      setAnnouncementText("");
      setIsAnnouncementOpen(false);
      if (selectedChannelId === announcementsCh.id) {
        loadChannelMessages(announcementsCh.id);
      } else {
        setSelectedChannelId(announcementsCh.id);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to publish announcement");
    } finally {
      setPublishingNotice(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubId || !user?.id || !eventTitle.trim() || !eventVenue.trim() || !eventDate) return;

    try {
      setCreatingEvent(true);
      const { error } = await (supabase
        .from("events" as any)
        .insert({
          club_id: clubId,
          title: eventTitle.trim(),
          description: eventDesc.trim() || null,
          venue: eventVenue.trim(),
          start_time: new Date(eventDate).toISOString(),
          capacity: eventCapacity ? parseInt(eventCapacity, 10) : null,
          is_published: true,
          created_by: user.id,
        }) as any);

      if (error) throw error;
      toast.success("Event scheduled & published!");
      setIsNewEventOpen(false);
      setEventTitle("");
      setEventDesc("");
      setEventVenue("");
      setEventDate("");
      setEventCapacity("");
      loadClubData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create event");
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleToggleJoin = async () => {
    if (!clubId || !user?.id) return;
    try {
      if (membership) {
        await (supabase
          .from("club_memberships" as any)
          .delete()
          .match({ club_id: clubId, user_id: user.id }) as any);
        toast.success(`Left ${club?.name}`);
        setMembership(null);
      } else {
        await (supabase
          .from("club_memberships" as any)
          .insert({
            club_id: clubId,
            user_id: user.id,
            role: "member",
            status: "active",
          }) as any);
        toast.success(`Joined ${club?.name}!`);
        setMembership({ role: "member", status: "active" });
      }
      loadClubData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update membership");
    }
  };

  const handleRegisterEvent = async (ev: EventItem) => {
    if (!user?.id) return;
    try {
      if (ev.is_registered) {
        await (supabase
          .from("event_registrations" as any)
          .delete()
          .match({ event_id: ev.id, user_id: user.id }) as any);
        toast.success("Registration cancelled");
      } else {
        await (supabase
          .from("event_registrations" as any)
          .insert({
            event_id: ev.id,
            user_id: user.id,
            status: "registered",
          }) as any);
        toast.success("You are registered! Ticket issued.");
      }
      loadClubData();
    } catch (err: any) {
      toast.error(err.message || "Failed to register");
    }
  };

  if (loading || !club) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Loading club workspace...</p>
        </div>
      </AppLayout>
    );
  }

  const activeChannel = channels.find((c) => c.id === selectedChannelId);

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        {/* Top Navbar */}
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => navigate("/clubs")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="leading-tight">
              <h1 className="text-base font-bold text-foreground truncate max-w-[200px]">
                {club.name}
              </h1>
              <p className="text-[11px] text-muted-foreground">{club.category}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={membership ? "outline" : "default"}
              onClick={handleToggleJoin}
              className="h-7 text-xs rounded-full px-3"
            >
              {membership ? "Joined" : "Join Club"}
            </Button>
          </div>
        </header>

        {/* Club Hero Card */}
        <div className="p-4 bg-muted/30 border-b space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold">{club.name}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {club.category}
                </Badge>
                {membership?.role && (
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 text-[10px] capitalize">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    {membership.role}
                  </Badge>
                )}
              </div>
              {club.description && (
                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  {club.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <Users className="h-3.5 w-3.5 text-primary" /> {members.length} Members
            </span>
            {club.faculty_coordinator && (
              <span className="flex items-center gap-1">
                <GraduationCap className="h-3.5 w-3.5" /> Coordinator: {club.faculty_coordinator}
              </span>
            )}
          </div>

          {/* Organizer Quick Actions */}
          {isOrganizer && (
            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              <Dialog open={isAnnouncementOpen} onOpenChange={setIsAnnouncementOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 rounded-full">
                    <Megaphone className="h-3.5 w-3.5 text-primary" /> Broadcast Notice
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Broadcast Official Club Notice</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handlePublishAnnouncement} className="space-y-3 pt-2">
                    <Textarea
                      placeholder="Write important announcement, schedules, or updates for all club members..."
                      rows={4}
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      required
                    />
                    <Button type="submit" className="w-full" disabled={publishingNotice}>
                      {publishingNotice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Post Notice"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isNewEventOpen} onOpenChange={setIsNewEventOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 rounded-full">
                    <Plus className="h-3.5 w-3.5 text-primary" /> Add Event
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule Campus Event or Workshop</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateEvent} className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <Label htmlFor="ev-title">Event Title</Label>
                      <Input
                        id="ev-title"
                        placeholder="e.g. AI Vision Bootcamp"
                        value={eventTitle}
                        onChange={(e) => setEventTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ev-venue">Venue / Location</Label>
                      <Input
                        id="ev-venue"
                        placeholder="e.g. Seminar Hall 3, Block A"
                        value={eventVenue}
                        onChange={(e) => setEventVenue(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="ev-date">Date & Time</Label>
                        <Input
                          id="ev-date"
                          type="datetime-local"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="ev-cap">Capacity Limit</Label>
                        <Input
                          id="ev-cap"
                          type="number"
                          placeholder="e.g. 100"
                          value={eventCapacity}
                          onChange={(e) => setEventCapacity(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ev-desc">Description & Agenda</Label>
                      <Textarea
                        id="ev-desc"
                        placeholder="Workshop topics, prerequisites, key takeaways..."
                        rows={3}
                        value={eventDesc}
                        onChange={(e) => setEventDesc(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={creatingEvent}>
                      {creatingEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Publish Event"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Club Navigation Tabs */}
        <Tabs defaultValue="channels" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-background px-4 h-11 gap-4">
            <TabsTrigger value="channels" className="text-xs gap-1 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <MessageSquare className="h-3.5 w-3.5" /> Channels
            </TabsTrigger>
            <TabsTrigger value="events" className="text-xs gap-1 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Calendar className="h-3.5 w-3.5" /> Events ({events.length})
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs gap-1 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Users className="h-3.5 w-3.5" /> Members ({members.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CHANNELS & COMMUNITY CHAT */}
          <TabsContent value="channels" className="m-0 p-0">
            {/* Channel Pill Switcher */}
            <div className="flex gap-1.5 overflow-x-auto p-3 border-b bg-muted/20 scrollbar-none">
              {channels.map((ch) => {
                const isAnnouncement = ch.type === "announcements";
                return (
                  <Button
                    key={ch.id}
                    size="sm"
                    variant={selectedChannelId === ch.id ? "default" : "outline"}
                    onClick={() => setSelectedChannelId(ch.id)}
                    className="h-7 text-xs rounded-full gap-1.5 whitespace-nowrap px-3"
                  >
                    {isAnnouncement ? <Megaphone className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                    <span>#{ch.name}</span>
                  </Button>
                );
              })}
            </div>

            {/* Chat Messages View */}
            <div className="flex flex-col h-[calc(100vh-340px)]">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-sm font-medium">No messages in #{activeChannel?.name || "channel"} yet.</p>
                    <p className="text-xs mt-1">Be the first to start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                      >
                        <Avatar className="h-7 w-7 mt-0.5">
                          <AvatarImage src={msg.sender.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {msg.sender.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className={`max-w-[80%] space-y-1 ${isMe ? "items-end" : "items-start"}`}>
                          <div className={`flex items-center gap-1.5 text-[11px] ${isMe ? "justify-end" : "justify-start"}`}>
                            <span className="font-semibold text-foreground">{msg.sender.username}</span>
                            {msg.sender.department && (
                              <span className="text-muted-foreground text-[10px]">({msg.sender.department.split(" ")[0]})</span>
                            )}
                            {msg.is_pinned && (
                              <Badge variant="outline" className="text-[9px] h-4 gap-0.5 text-amber-500 border-amber-500/30">
                                <Pin className="h-2.5 w-2.5" /> Pinned
                              </Badge>
                            )}
                          </div>

                          <div
                            className={`p-2.5 rounded-2xl text-xs leading-relaxed ${
                              isMe
                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                : "bg-muted text-foreground rounded-tl-none border border-border/40"
                            }`}
                          >
                            {msg.content}
                          </div>
                          <span className={`block text-[10px] text-muted-foreground px-1 ${isMe ? "text-right" : "text-left"}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {activeChannel?.type === "announcements" && !isOrganizer ? (
                <div className="p-3 border-t bg-muted/40 text-center text-xs text-muted-foreground">
                  🔒 Only verified club organizers can broadcast notices in this announcement channel.
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="p-3 border-t bg-background flex items-center gap-2">
                  <Input
                    placeholder={`Message #${activeChannel?.name || "chat"}...`}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="h-9 text-xs"
                    disabled={sendingMessage}
                  />
                  <Button type="submit" size="icon" className="h-9 w-9 rounded-full shrink-0" disabled={sendingMessage || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: EVENTS */}
          <TabsContent value="events" className="p-4 space-y-3">
            {events.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-xl text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto opacity-40 mb-2" />
                <p className="text-xs">No upcoming events scheduled for this club.</p>
              </div>
            ) : (
              events.map((ev) => (
                <Card key={ev.id} className="border-border/60">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm font-semibold">{ev.title}</CardTitle>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1 text-primary font-medium">
                            <Clock className="h-3 w-3" />
                            {new Date(ev.start_time).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {ev.venue}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={ev.is_registered ? "outline" : "default"}
                        onClick={() => handleRegisterEvent(ev)}
                        className="h-7 text-xs rounded-full"
                      >
                        {ev.is_registered ? "Registered ✓" : "Register"}
                      </Button>
                    </div>
                  </CardHeader>
                  {ev.description && (
                    <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                      {ev.description}
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </TabsContent>

          {/* TAB 3: MEMBERS */}
          <TabsContent value="members" className="p-4 space-y-2">
            {members.map((mem) => (
              <div
                key={mem.id}
                onClick={() => navigate(`/profile/${mem.user_id}`)}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 hover:bg-muted/30 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={mem.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {mem.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold">{mem.username}</span>
                      {mem.role !== "member" && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 capitalize">
                          {mem.role}
                        </Badge>
                      )}
                    </div>
                    {mem.department && (
                      <p className="text-[10px] text-muted-foreground">
                        {mem.department} {mem.year ? `· ${mem.year}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ClubWorkspace;
