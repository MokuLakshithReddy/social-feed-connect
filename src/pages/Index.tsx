import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import PostCard from "@/components/PostCard";
import CommentsSheet from "@/components/CommentsSheet";
import { Camera, Heart } from "lucide-react";

interface PostItem {
  id: string;
  user_id: string;
  image_url: string;
  caption: string;
  created_at: string;
  profiles: { username: string; avatar_url: string };
  likes: { user_id: string }[];
  comments: { id: string }[];
}

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    if (!user) return;
    // Get followed user IDs
    const { data: follows } = await supabase
      .from("followers")
      .select("following_id")
      .eq("follower_id", user.id);

    const followedIds = follows?.map((f) => f.following_id) ?? [];
    followedIds.push(user.id); // include own posts

    const { data } = await supabase
      .from("posts")
      .select("*, profiles(username, avatar_url), likes(user_id), comments(id)")
      .in("user_id", followedIds)
      .order("created_at", { ascending: false })
      .limit(50);

    setPosts((data as unknown as PostItem[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchFeed();

    // Realtime subscription for new posts
    const channel = supabase
      .channel("feed-posts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        () => {
          fetchFeed();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFeed]);

  return (
    <AppLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 py-3">
        <h1 className="text-xl font-bold tracking-tight">Snapgram</h1>
        <button
          onClick={() => navigate("/notifications")}
          className="rounded-full p-1.5 transition-colors hover:bg-secondary"
          aria-label="Notifications"
        >
          <Heart className="h-6 w-6 text-foreground" />
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <Camera className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold">Your feed is empty</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow people or create your first post to get started!
          </p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onLikeToggle={fetchFeed}
            onCommentOpen={setCommentPostId}
          />
        ))
      )}

      <CommentsSheet
        postId={commentPostId}
        open={!!commentPostId}
        onOpenChange={(open) => !open && setCommentPostId(null)}
      />
    </AppLayout>
  );
};

export default Index;
