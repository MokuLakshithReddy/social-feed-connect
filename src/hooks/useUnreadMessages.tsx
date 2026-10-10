import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MessagePayload {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export const useUnreadMessages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const convoIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // Fetch user's conversation IDs
    const init = async () => {
      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
      convoIdsRef.current = new Set((convos ?? []).map((c) => c.id));
    };
    init();

    // Listen for new messages in real-time
    const channel = supabase
      .channel(`user-unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as MessagePayload;
          if (!msg || msg.sender_id === user.id) return;

          // Verify this message belongs to one of user's conversations
          let isUserConvo = convoIdsRef.current.has(msg.conversation_id);
          if (!isUserConvo) {
            const { data: convo } = await supabase
              .from("conversations")
              .select("id")
              .eq("id", msg.conversation_id)
              .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
              .maybeSingle();

            if (convo) {
              convoIdsRef.current.add(convo.id);
              isUserConvo = true;
            }
          }

          if (!isUserConvo) return;

          setUnreadCount((c) => c + 1);
          toast("New message received", {
            description: msg.content?.length > 50 ? msg.content.slice(0, 50) + "…" : msg.content,
            action: {
              label: "View",
              onClick: () => {
                navigate(`/chat/${msg.conversation_id}`);
              },
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  const clearUnread = () => setUnreadCount(0);

  return { unreadCount, clearUnread };
};
