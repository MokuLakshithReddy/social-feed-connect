import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const EditProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("username, bio").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setUsername(data.username);
        setBio(data.bio || "");
      }
    });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ username, bio }).eq("id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile updated!");
      navigate(`/profile/${user.id}`);
    }
    setLoading(false);
  };

  return (
    <AppLayout>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-sm font-medium">Cancel</button>
        <h1 className="text-base font-semibold">Edit Profile</h1>
        <Button size="sm" onClick={handleSave} disabled={loading} className="rounded-lg">
          {loading ? "..." : "Done"}
        </Button>
      </header>
      <div className="space-y-4 p-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Username</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} className="h-12 rounded-xl bg-secondary border-0" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Bio</label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[100px] resize-none rounded-xl bg-secondary border-0" />
        </div>
      </div>
    </AppLayout>
  );
};

export default EditProfile;
