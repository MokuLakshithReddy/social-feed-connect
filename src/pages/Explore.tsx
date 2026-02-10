import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { getPostImageUrl } from "@/lib/supabase-helpers";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const Explore = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPosts = async () => {
      let query = supabase
        .from("posts")
        .select("id, image_url, user_id, profiles(username)")
        .order("created_at", { ascending: false })
        .limit(60);

      const { data } = await query;
      setPosts(data ?? []);
    };
    fetchPosts();
  }, []);

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
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-xl bg-secondary border-0 pl-10"
          />
        </div>
      </header>

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
