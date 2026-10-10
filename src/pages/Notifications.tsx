import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Heart, UserPlus, ArrowLeft, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

interface NotificationItem {
  id: string;
  type: "like" | "follow" | "comment";
  created_at: string;
  actor_id: string;
  post_id?: string | null;
  profiles?: {
    id: string;
    username: string;
    avatar_url: string;
  };
}

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("notifications" as unknown as "posts")
        .select("*, profiles:actor_id(id, username, avatar_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40);

      if (!error && data) {
        setNotifications(data as unknown as NotificationItem[]);
      }
    } catch {
      // Table may be pending creation
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationClick = (n: NotificationItem) => {
    if (n.post_id) {
      navigate(`/post/${n.post_id}`);
    } else if (n.actor_id) {
      navigate(`/profile/${n.actor_id}`);
    }
  };

  return (
    <AppLayout>
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-full p-1 transition-colors hover:bg-secondary"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold">Notifications</h1>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-3">
            <Heart className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-base font-semibold">No notifications yet</h2>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            When people like your posts, comment, or start following you, you'll see them here.
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {notifications.map((n) => {
            const username = n.profiles?.username ?? "Someone";
            return (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                  {n.type === "like" ? (
                    <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                  ) : n.type === "comment" ? (
                    <MessageSquare className="h-5 w-5 text-blue-500" />
                  ) : (
                    <UserPlus className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    <span className="font-semibold">{username}</span>{" "}
                    {n.type === "like"
                      ? "liked your photo"
                      : n.type === "comment"
                      ? "commented on your post"
                      : "started following you"}
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

export default Notifications;
