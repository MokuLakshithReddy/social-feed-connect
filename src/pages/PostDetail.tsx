import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import PostCard from "@/components/PostCard";
import CommentsSheet from "@/components/CommentsSheet";
import { ArrowLeft } from "lucide-react";

const PostDetail = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);

  const fetchPost = async () => {
    if (!postId) return;
    const { data } = await supabase
      .from("posts")
      .select("*, profiles(username, avatar_url), likes(user_id), comments(id)")
      .eq("id", postId)
      .maybeSingle();
    if (!data) {
      navigate("/", { replace: true });
      return;
    }
    setPost(data);
  };

  useEffect(() => {
    fetchPost();
  }, [postId]);

  const handlePostDeleted = () => {
    navigate("/", { replace: true });
  };

  return (
    <AppLayout>
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 py-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold">Post</h1>
      </header>
      {post && (
        <PostCard post={post} onLikeToggle={fetchPost} onCommentOpen={setCommentPostId} />
      )}
      <CommentsSheet
        postId={commentPostId}
        open={!!commentPostId}
        onOpenChange={(open) => !open && setCommentPostId(null)}
      />
    </AppLayout>
  );
};

export default PostDetail;
