import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { getAvatarUrl, getPostImageUrl } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Grid3X3, LogOut, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import FollowersDialog from "@/components/FollowersDialog";

const Profile = () => {
  const { userId: paramUserId } = useParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followDialog, setFollowDialog] = useState<"followers" | "following" | null>(null);

  const effectiveUserId = (paramUserId && paramUserId !== "undefined") ? paramUserId : user?.id;
  const isOwn = !!user && user.id === effectiveUserId;

  const fetchProfile = async () => {
    if (!effectiveUserId) {
      setLoading(false);
      return;
    }

    const [profileRes, postsRes, followersRes, followingRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", effectiveUserId).maybeSingle(),
      supabase.from("posts").select("id, image_url").eq("user_id", effectiveUserId).order("created_at", { ascending: false }),
      supabase.from("followers").select("id", { count: "exact" }).eq("following_id", effectiveUserId),
      supabase.from("followers").select("id", { count: "exact" }).eq("follower_id", effectiveUserId),
    ]);

    let profileData = profileRes.data;

    // Self-healing: if own profile doesn't exist yet in database, create it
    if (!profileData && isOwn && user) {
      const defaultUsername = user.user_metadata?.username || `user_${user.id.slice(0, 8)}`;
      const { data: createdProfile } = await supabase
        .from("profiles")
        .upsert({ id: user.id, username: defaultUsername })
        .select("*")
        .maybeSingle();

      if (createdProfile) {
        profileData = createdProfile;
      }
    }

    setProfile(profileData);
    setPosts(postsRes.data ?? []);
    setFollowersCount(followersRes.count ?? 0);
    setFollowingCount(followingRes.count ?? 0);

    if (user && user.id !== effectiveUserId) {
      const { data } = await supabase
        .from("followers").select("id")
        .eq("follower_id", user.id).eq("following_id", effectiveUserId).maybeSingle();
      setIsFollowing(!!data);
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchProfile();
  }, [effectiveUserId, user?.id]);

  const toggleFollow = async () => {
    if (!user || !effectiveUserId) return;
    if (isFollowing) {
      await supabase.from("followers").delete().eq("follower_id", user.id).eq("following_id", effectiveUserId);
    } else {
      await supabase.from("followers").insert({ follower_id: user.id, following_id: effectiveUserId });
    }
    setIsFollowing(!isFollowing);
    setFollowersCount((c) => c + (isFollowing ? -1 : 1));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
    toast.success("Profile picture updated!");
    fetchProfile();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleMessage = async () => {
    if (!user || !effectiveUserId) return;
    // Check for existing conversation
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${effectiveUserId}),and(user1_id.eq.${effectiveUserId},user2_id.eq.${user.id})`)
      .maybeSingle();

    if (existing) {
      navigate(`/chat/${existing.id}`);
    } else {
      const { data: newConvo, error } = await supabase
        .from("conversations")
        .insert({ user1_id: user.id, user2_id: userId })
        .select("id")
        .single();
      if (error) { toast.error("Could not start conversation"); return; }
      navigate(`/chat/${newConvo.id}`);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">User not found</div>
      </AppLayout>
    );
  }

  const avatarUrl = getAvatarUrl(profile.avatar_url);

  return (
    <AppLayout>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 py-3">
        <h1 className="text-base font-semibold">{profile.username}</h1>
        {isOwn && (
          <button onClick={handleSignOut}>
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
      </header>

      <div className="px-4 py-5">
        <div className="flex items-center gap-6">
          <button
            onClick={() => isOwn && fileRef.current?.click()}
            className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-secondary ring-2 ring-border"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
                {profile.username?.[0]?.toUpperCase()}
              </div>
            )}
          </button>
          <div className="flex flex-1 justify-around text-center">
            <div><p className="text-lg font-bold">{posts.length}</p><p className="text-xs text-muted-foreground">Posts</p></div>
            <button onClick={() => setFollowDialog("followers")}>
              <p className="text-lg font-bold">{followersCount}</p><p className="text-xs text-muted-foreground">Followers</p>
            </button>
            <button onClick={() => setFollowDialog("following")}>
              <p className="text-lg font-bold">{followingCount}</p><p className="text-xs text-muted-foreground">Following</p>
            </button>
          </div>
        </div>

        {profile.bio && <p className="mt-3 text-sm">{profile.bio}</p>}

        {!isOwn && user && (
          <div className="mt-4 flex gap-2">
            <Button onClick={toggleFollow} variant={isFollowing ? "secondary" : "default"} className="flex-1 rounded-xl">
              {isFollowing ? "Following" : "Follow"}
            </Button>
            <Button onClick={handleMessage} variant="secondary" className="rounded-xl" size="icon">
              <MessageCircle className="h-5 w-5" />
            </Button>
          </div>
        )}

        {isOwn && (
          <Button variant="secondary" className="mt-4 w-full rounded-xl" onClick={() => navigate("/edit-profile")}>
            Edit Profile
          </Button>
        )}
      </div>

      <div className="border-t">
        <div className="flex items-center justify-center py-2">
          <Grid3X3 className="h-5 w-5 text-foreground" />
        </div>
        <div className="grid grid-cols-3 gap-0.5">
          {posts.map((post) => (
            <button key={post.id} onClick={() => navigate(`/post/${post.id}`)} className="aspect-square overflow-hidden bg-secondary">
              <img src={getPostImageUrl(post.image_url)} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
        {posts.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">No posts yet</p>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />

      {followDialog && userId && (
        <FollowersDialog
          userId={userId}
          type={followDialog}
          open={!!followDialog}
          onOpenChange={(open) => !open && setFollowDialog(null)}
        />
      )}
    </AppLayout>
  );
};

export default Profile;
