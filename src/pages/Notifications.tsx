import AppLayout from "@/components/AppLayout";
import { Heart, UserPlus } from "lucide-react";

const mockNotifications = [
  { id: 1, type: "like", user: "someone", text: "liked your photo", time: "2h" },
  { id: 2, type: "follow", user: "friend", text: "started following you", time: "5h" },
];

const Notifications = () => {
  return (
    <AppLayout>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur px-4 py-3">
        <h1 className="text-base font-semibold">Notifications</h1>
      </header>
      <div className="divide-y">
        {mockNotifications.map((n) => (
          <div key={n.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              {n.type === "like" ? (
                <Heart className="h-5 w-5 text-red-500" />
              ) : (
                <UserPlus className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm">
                <span className="font-semibold">{n.user}</span> {n.text}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{n.time}</span>
          </div>
        ))}
      </div>
    </AppLayout>
  );
};

export default Notifications;
