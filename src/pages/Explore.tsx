import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { getAvatarUrl, getPostImageUrl } from "@/lib/supabase-helpers";
import { useNavigate } from "react-router-dom";
import { Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ExplorePost {
  id: string;
  image_url: string;
  user_id: string;
  profiles: { username: string } | null;
}

interface UserSearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
}

const Explore = () => {
  const [posts, setPosts] = useState<ExplorePost[]>([]);
  const [matchingUsers, setMatchingUsers] = useState<UserSearchResult[]>([]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, image_url, user_id, profiles(username)")
        .order("created_at", { ascending: false })
        .limit(60);

      setPosts((data as unknown as ExplorePost[]) ?? []);
    };
    fetchPosts();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setMatchingUsers([]);
      return;
    }

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .ilike("username", `%${search.trim()}%`)
        .limit(5);

      setMatchingUsers(data ?? []);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const filteredPosts = search
    ? posts.filter((p) =>
        p.profiles?.username?.toLowerCase().includes(search.toLowerCase())
      )
    : posts;

  return (
    <AppLayout>
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users or posts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-xl bg-secondary border-0 pl-10"
          />
        </div>
      </header>

      {/* Matching users quick list */}
      {matchingUsers.length > 0 && (
        <div className="border-b px-4 py-2 space-y-1 bg-secondary/20">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Users</p>
          {matchingUsers.map((u) => {
            const avatar = getAvatarUrl(u.avatar_url);
            return (
              <button
                key={u.id}
                onClick={() => navigate(`/profile/${u.id}`)}
                className="flex w-full items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-secondary text-left transition-colors"
              >
                <div className="h-7 w-7 rounded-full bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <span className="text-sm font-medium">{u.username}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-3 gap-0.5">
        {filteredPosts.map((post) => (
          <button
            key={post.id}
            onClick={() => navigate(`/post/${post.id}`)}
            className="aspect-square overflow-hidden bg-secondary"
          >
            <img
              src={getPostImageUrl(post.image_url)}
              alt=""
              className="h-full w-full object-cover transition-opacity hover:opacity-90"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </AppLayout>
  );
};

export default Explore;
