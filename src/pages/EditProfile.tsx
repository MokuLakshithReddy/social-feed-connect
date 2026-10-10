import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

const DEPARTMENTS = [
  "Computer Science & Engineering",
  "Information Technology",
  "Electronics & Communication",
  "Electrical & Electronics",
  "Mechanical Engineering",
  "Civil Engineering",
  "Chemical & Materials",
  "Biotechnology",
  "Business & Management",
  "Design & Media Arts",
  "Sciences & Humanities",
];

const YEARS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "Postgraduate / Masters",
  "PhD Research Scholar",
  "Faculty / Staff",
];

const EditProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [year, setYear] = useState(YEARS[2]);
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("username, bio, department, year, student_id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setUsername(data.username || "");
          setBio(data.bio || "");
          if (data.department) setDepartment(data.department);
          if (data.year) setYear(data.year);
          if (data.student_id) setStudentId(data.student_id);
        }
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (!username.trim()) {
      toast.error("Username cannot be empty");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          username: username.trim(),
          bio: bio.trim(),
          department,
          year,
          student_id: studentId.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Student profile updated!");
      navigate(`/profile/${user.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 py-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-medium">
          <ArrowLeft className="h-4 w-4" /> Cancel
        </button>
        <h1 className="text-base font-semibold">Edit Student Profile</h1>
        <Button size="sm" onClick={handleSave} disabled={loading} className="rounded-full h-8 px-4 text-xs">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
        </Button>
      </header>

      <div className="space-y-4 p-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Username</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-10 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Student ID / Roll Number</label>
          <Input
            value={studentId}
            placeholder="e.g. 22CSE0142"
            onChange={(e) => setStudentId(e.target.value)}
            className="h-10 rounded-lg font-mono text-sm"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Department / School</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Academic Year</label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {YEARS.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">About / Student Bio</label>
          <Textarea
            value={bio}
            placeholder="Interests, tech stack, research areas, or goals..."
            onChange={(e) => setBio(e.target.value)}
            className="min-h-[100px] resize-none rounded-lg text-sm"
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default EditProfile;
