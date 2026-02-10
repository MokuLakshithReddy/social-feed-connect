import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAvatarUrl } from "@/lib/supabase-helpers";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { username: string; avatar_url: string };
}

interface CommentsSheetProps {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CommentsSheet = ({ postId, open, onOpenChange }: CommentsSheetProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (postId && open) fetchComments();
  }, [postId, open]);

  const fetchComments = async () => {
    if (!postId) return;
    const { data } = await supabase
      .from("comments")
      .select("*, profiles(username, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments((data as unknown as Comment[]) ?? []);
  };

  const addComment = async () => {
    if (!user || !postId || !newComment.trim()) return;
    setLoading(true);
    await supabase.from("comments").insert({
      user_id: user.id,
      post_id: postId,
      content: newComment.trim(),
    });
    setNewComment("");
    await fetchComments();
    setLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="text-center">Comments</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto pb-4 scrollbar-hide">
            {comments.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No comments yet</p>
            )}
            {comments.map((c) => {
              const av = getAvatarUrl(c.profiles?.avatar_url);
              return (
                <div key={c.id} className="flex gap-3 px-1">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-secondary">
                    {av ? (
                      <img src={av} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                        {c.profiles?.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">{c.profiles?.username}</span>{" "}
                      {c.content}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 border-t pt-3">
            <Input
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment()}
              className="h-10 rounded-full bg-secondary border-0"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={addComment}
              disabled={loading || !newComment.trim()}
              className="shrink-0 text-primary"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CommentsSheet;
