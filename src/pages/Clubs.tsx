import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Search, Users, GraduationCap, ChevronRight, Plus, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ClubWithMeta {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  faculty_coordinator: string | null;
  status: string;
  member_count: number;
  is_member: boolean;
  member_role?: string;
}

const CATEGORIES = [
  "All",
  "Technical",
  "Robotics & AI",
  "Entrepreneurship",
  "Arts & Media",
  "Design & Product",
];

const Clubs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<ClubWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New club form
  const [newClubName, setNewClubName] = useState("");
  const [newClubCategory, setNewClubCategory] = useState("Technical");
  const [newClubDescription, setNewClubDescription] = useState("");
  const [newClubCoordinator, setNewClubCoordinator] = useState("");

  const fetchClubs = async () => {
    try {
      setLoading(true);
      // Fetch clubs
      const { data: clubsData, error: clubsErr } = await (supabase
        .from("clubs" as any)
        .select("*")
        .order("name", { ascending: true }) as any);

      if (clubsErr) throw clubsErr;

      // Fetch memberships
      const { data: membersData } = await (supabase
        .from("club_memberships" as any)
        .select("club_id, user_id, role, status") as any);

      const memberships = membersData || [];

      const enriched: ClubWithMeta[] = (clubsData || []).map((club: any) => {
        const clubMembers = memberships.filter((m: any) => m.club_id === club.id && m.status === "active");
        const userMem = clubMembers.find((m: any) => m.user_id === user?.id);

        return {
          id: club.id,
          name: club.name,
          slug: club.slug,
          description: club.description,
          category: club.category,
          faculty_coordinator: club.faculty_coordinator,
          status: club.status,
          member_count: clubMembers.length,
          is_member: !!userMem,
          member_role: userMem?.role,
        };
      });

      setClubs(enriched);
    } catch (err: any) {
      console.error("Error fetching clubs:", err);
      toast.error("Failed to load clubs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClubs();
  }, [user?.id]);

  const handleJoinToggle = async (club: ClubWithMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;

    try {
      if (club.is_member) {
        // Leave club
        const { error } = await (supabase
          .from("club_memberships" as any)
          .delete()
          .match({ club_id: club.id, user_id: user.id }) as any);
        if (error) throw error;
        toast.success(`Left ${club.name}`);
      } else {
        // Join club
        const { error } = await (supabase
          .from("club_memberships" as any)
          .insert({
            club_id: club.id,
            user_id: user.id,
            role: "member",
            status: "active",
          }) as any);
        if (error) throw error;
        toast.success(`Joined ${club.name}! Welcome aboard.`);
      }
      fetchClubs();
    } catch (err: any) {
      toast.error(err.message || "Failed to update membership");
    }
  };

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !newClubName.trim()) return;

    try {
      setIsSubmitting(true);
      const slug = newClubName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      const { data: newClub, error } = await (supabase
        .from("clubs" as any)
        .insert({
          name: newClubName.trim(),
          slug,
          category: newClubCategory,
          description: newClubDescription.trim(),
          faculty_coordinator: newClubCoordinator.trim() || null,
          created_by: user.id,
          status: "active",
        })
        .select()
        .single() as any);

      if (error) throw error;

      // Auto-assign creator as president
      await (supabase
        .from("club_memberships" as any)
        .insert({
          club_id: newClub.id,
          user_id: user.id,
          role: "president",
          status: "active",
        }) as any);

      // Create default channels
      await (supabase
        .from("club_channels" as any)
        .insert([
          { club_id: newClub.id, name: "announcements", type: "announcements", description: "Official notices" },
          { club_id: newClub.id, name: "general", type: "general", description: "General community chat" },
        ]) as any);

      toast.success("Club created successfully!");
      setIsCreateOpen(false);
      setNewClubName("");
      setNewClubDescription("");
      setNewClubCoordinator("");
      fetchClubs();
      navigate(`/club/${newClub.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create club");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClubs = clubs.filter((c) => {
    const matchesCategory = selectedCategory === "All" || c.category === selectedCategory;
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        {/* Top Header */}
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Campus Clubs</h1>
              <p className="text-xs text-muted-foreground">Discover, join & collaborate with university student organizations</p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1 rounded-full text-xs">
                  <Plus className="h-3.5 w-3.5" /> Start Club
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Register New Campus Club</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateClub} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="club-name">Club Name</Label>
                    <Input
                      id="club-name"
                      placeholder="e.g. CyberSecurity & CTF Club"
                      value={newClubName}
                      onChange={(e) => setNewClubName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="club-cat">Category</Label>
                    <select
                      id="club-cat"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newClubCategory}
                      onChange={(e) => setNewClubCategory(e.target.value)}
                    >
                      {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="club-coord">Faculty Coordinator</Label>
                    <Input
                      id="club-coord"
                      placeholder="e.g. Dr. Rajesh Kumar"
                      value={newClubCoordinator}
                      onChange={(e) => setNewClubCoordinator(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="club-desc">About the Club</Label>
                    <Textarea
                      id="club-desc"
                      placeholder="Describe the club mission, projects, and activities..."
                      rows={3}
                      value={newClubDescription}
                      onChange={(e) => setNewClubDescription(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Launch Club"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search bar */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search clubs by name or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>

          {/* Category filter pills */}
          <div className="flex gap-1.5 overflow-x-auto pt-3 pb-1 scrollbar-none">
            {CATEGORIES.map((category) => (
              <Button
                key={category}
                size="sm"
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                className="h-7 whitespace-nowrap rounded-full px-3 text-xs"
              >
                {category}
              </Button>
            ))}
          </div>
        </header>

        {/* Club List */}
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs">Loading campus clubs...</p>
            </div>
          ) : filteredClubs.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl border border-dashed text-muted-foreground">
              <Users className="mx-auto h-10 w-10 opacity-40 mb-2" />
              <p className="font-semibold text-sm">No clubs found</p>
              <p className="text-xs mt-1">Try a different search term or category filter.</p>
            </div>
          ) : (
            filteredClubs.map((club) => (
              <Card
                key={club.id}
                onClick={() => navigate(`/club/${club.id}`)}
                className="cursor-pointer border-border/60 hover:border-primary/50 transition-all hover:shadow-sm"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-semibold leading-tight hover:text-primary transition-colors">
                          {club.name}
                        </CardTitle>
                      </div>
                      <Badge variant="secondary" className="mt-1 text-[10px] font-normal px-2 py-0">
                        {club.category}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant={club.is_member ? "outline" : "default"}
                      onClick={(e) => handleJoinToggle(club, e)}
                      className="h-7 px-3 text-xs rounded-full gap-1 shrink-0"
                    >
                      {club.is_member ? (
                        <>
                          <Check className="h-3 w-3 text-primary" />
                          <span>Joined</span>
                        </>
                      ) : (
                        <span>Join</span>
                      )}
                    </Button>
                  </div>
                  {club.description && (
                    <CardDescription className="line-clamp-2 text-xs pt-2">
                      {club.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardFooter className="p-4 pt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 mt-2">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {club.member_count} {club.member_count === 1 ? "member" : "members"}
                    </span>
                    {club.faculty_coordinator && (
                      <span className="flex items-center gap-1 truncate max-w-[150px]">
                        <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{club.faculty_coordinator}</span>
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-0.5 text-primary font-medium text-xs">
                    View Space <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Clubs;
