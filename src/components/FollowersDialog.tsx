import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getAvatarUrl } from "@/lib/supabase-helpers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  userId: string;
  type: "followers" | "following";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FollowersDialog = ({ userId, type, open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const fetchUsers = async () => {
      if (type === "followers") {
        const { data } = await supabase
          .from("followers")
          .select("follower_id, profiles:follower_id(id, username, avatar_url)")
          .eq("following_id", userId);
        setUsers(data?.map((d) => d.profiles) ?? []);
      } else {
        const { data } = await supabase
          .from("followers")
          .select("following_id, profiles:following_id(id, username, avatar_url)")
          .eq("follower_id", userId);
        setUsers(data?.map((d) => d.profiles) ?? []);
      }
      setLoading(false);
    };
    fetchUsers();
  }, [open, userId, type]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="capitalize">{type}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No {type} yet</p>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y">
            {users.map((u: any) => (
              <button
                key={u.id}
                onClick={() => { onOpenChange(false); navigate(`/profile/${u.id}`); }}
                className="flex w-full items-center gap-3 px-2 py-3 hover:bg-secondary/50 transition-colors"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-secondary">
                  {getAvatarUrl(u.avatar_url) ? (
                    <img src={getAvatarUrl(u.avatar_url)!} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-muted-foreground">
                      {u.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-sm font-semibold">{u.username}</span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FollowersDialog;
