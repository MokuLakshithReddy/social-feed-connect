import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAvatarUrl } from "@/lib/supabase-helpers";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Send } from "lucide-react";

interface SharePostDialogProps {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserOption {
  conversationId: string | null;
  userId: string;
  username: string;
  avatar_url: string | null;
}

const SharePostDialog = ({ postId, open, onOpenChange }: SharePostDialogProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    const fetchUsers = async () => {
      // Get existing conversations
      const { data: convos } = await supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      const otherIds = (convos ?? []).map((c) =>
        c.user1_id === user.id ? c.user2_id : c.user1_id
      );

      if (otherIds.length === 0) {
        setUsers([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", otherIds);

      const convoMap = new Map(
        (convos ?? []).map((c) => [
          c.user1_id === user.id ? c.user2_id : c.user1_id,
          c.id,
        ])
      );

      setUsers(
        (profiles ?? []).map((p) => ({
          conversationId: convoMap.get(p.id) ?? null,
          userId: p.id,
          username: p.username,
          avatar_url: p.avatar_url,
        }))
      );
    };
    fetchUsers();
  }, [open, user]);

  const handleSend = async (target: UserOption) => {
    if (!user || !postId || sending) return;
    setSending(target.userId);

    let convoId = target.conversationId;
    if (!convoId) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user1_id: user.id, user2_id: target.userId })
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Failed to start conversation");
        setSending(null);
        return;
      }
      convoId = data.id;
    }

    const postUrl = `${window.location.origin}/post/${postId}`;
    await supabase.from("messages").insert({
      conversation_id: convoId,
      sender_id: user.id,
      content: postUrl,
    });

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", convoId);

    toast.success(`Sent to ${target.username}`);
    setSending(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Share to...</DialogTitle>
        </DialogHeader>
        {users.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No conversations yet. Start chatting from someone's profile first!
          </p>
        ) : (
          <div className="max-h-72 divide-y overflow-y-auto">
            {users.map((u) => {
              const avatarUrl = getAvatarUrl(u.avatar_url);
              return (
                <button
                  key={u.userId}
                  onClick={() => handleSend(u)}
                  disabled={sending === u.userId}
                  className="flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-secondary/50 transition-colors disabled:opacity-50"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-secondary">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-muted-foreground">
                        {u.username[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="flex-1 text-sm font-semibold">{u.username}</span>
                  <Send className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SharePostDialog;
