import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const useUnreadMessages = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const convoIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch user's conversation IDs
    const init = async () => {
      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
      convoIdsRef.current = (convos ?? []).map((c) => c.id);
    };
    init();

    // Listen for new messages in real-time
    const channel = supabase
      .channel("unread-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id !== user.id) {
            setUnreadCount((c) => c + 1);
            toast("New message received", {
              description: msg.content?.length > 50 ? msg.content.slice(0, 50) + "…" : msg.content,
              action: {
                label: "View",
                onClick: () => {
                  window.location.href = `/chat/${msg.conversation_id}`;
                },
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const clearUnread = () => setUnreadCount(0);

  return { unreadCount, clearUnread };
};
