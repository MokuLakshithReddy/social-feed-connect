import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { getAvatarUrl } from "@/lib/supabase-helpers";
import { MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ConversationWithProfile {
  id: string;
  otherUserId: string;
  username: string;
  avatar_url: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
}

const Chats = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchConversations = async () => {
      const { data: convos } = await supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order("last_message_at", { ascending: false });

      if (!convos || convos.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const otherUserIds = convos.map((c) =>
        c.user1_id === user.id ? c.user2_id : c.user1_id
      );

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", otherUserIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

      // Fetch last messages in parallel
      const results: ConversationWithProfile[] = await Promise.all(
        convos.map(async (c) => {
          const otherUserId = c.user1_id === user.id ? c.user2_id : c.user1_id;
          const profile = profileMap.get(otherUserId);
          const { data: msgs } = await supabase
            .from("messages")
            .select("content")
            .eq("conversation_id", c.id)
            .order("created_at", { ascending: false })
            .limit(1);

          return {
            id: c.id,
            otherUserId,
            username: profile?.username ?? "Unknown",
            avatar_url: profile?.avatar_url ?? null,
            lastMessage: msgs?.[0]?.content ?? null,
            lastMessageAt: c.last_message_at,
          };
        })
      );

      setConversations(results);
      setLoading(false);
    };

    fetchConversations();

    // Realtime subscription to reload conversation updates
    const channel = supabase
      .channel("chats-list-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <AppLayout>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur px-4 py-3">
        <h1 className="text-xl font-bold tracking-tight">Messages</h1>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <MessageCircle className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold">No messages yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a conversation from someone's profile!
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/chat/${c.id}`)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-secondary">
                {getAvatarUrl(c.avatar_url) ? (
                  <img src={getAvatarUrl(c.avatar_url)!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground">
                    {c.username[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{c.username}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.lastMessage ?? "No messages yet"} · {formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: false })}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default Chats;
