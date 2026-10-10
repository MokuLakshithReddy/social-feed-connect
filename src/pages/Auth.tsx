import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { GraduationCap, ShieldCheck, Loader2 } from "lucide-react";

const DEPARTMENTS = [
  "Computer Science & Engineering",
  "Information Technology",
  "Electronics & Communication",
  "Electrical & Electronics",
  "Mechanical Engineering",
  "Civil Engineering",
  "Biotechnology",
  "Business & Management",
  "Design & Media Arts",
];

const YEARS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "Postgraduate",
];

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [year, setYear] = useState(YEARS[0]);
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email.trim(), password);
        navigate("/");
      } else {
        await signUp(email.trim(), password, username.trim(), {
          department,
          year,
          student_id: studentId.trim() || undefined,
        });
        toast.success("Student account created! Check your email to verify your login.");
        setIsLogin(true);
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (error?.message?.includes("Failed to fetch") || error?.name === "AuthRetryableFetchError") {
        toast.error("Unable to connect to Supabase. Please ensure your Supabase project is active.");
      } else {
        toast.error(error.message || "Authentication error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">CampusConnect</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {isLogin ? "Sign in to access college clubs & events" : "Register your verified student identity"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {!isLogin && (
            <>
              <div className="space-y-1">
                <Label htmlFor="auth-username" className="text-xs">Username / Display Name</Label>
                <Input
                  id="auth-username"
                  placeholder="e.g. alex_chen"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="auth-studentid" className="text-xs">Student ID / Roll Number</Label>
                <Input
                  id="auth-studentid"
                  placeholder="e.g. 24CS0142"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  required
                  className="h-10 font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="auth-dept" className="text-xs">Department</Label>
                  <select
                    id="auth-dept"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d.split(" ")[0]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="auth-year" className="text-xs">Year</Label>
                  <select
                    id="auth-year"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs"
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label htmlFor="auth-email" className="text-xs">College or Student Email</Label>
            <Input
              id="auth-email"
              type="email"
              placeholder="student@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="auth-pw" className="text-xs">Password</Label>
            <Input
              id="auth-pw"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-10 text-sm"
            />
          </div>

          {!isLogin && (
            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground flex items-start gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Accounts using official campus emails (.edu) receive automatic verified student status.</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-10 w-full text-sm font-semibold mt-2"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isLogin ? "Log In" : "Create Student Account"}
          </Button>
        </form>

        <div className="mt-5 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs text-primary font-medium hover:underline"
          >
            {isLogin ? "New student? Register your campus account" : "Already have an account? Log In"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
