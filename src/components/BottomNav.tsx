import { Home, Search, PlusSquare, MessageCircle, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { cn } from "@/lib/utils";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unreadCount, clearUnread } = useUnreadMessages();

  const profilePath = user?.id ? `/profile/${user.id}` : "/profile";

  const items = [
    { icon: Home, path: "/", label: "Home" },
    { icon: Search, path: "/explore", label: "Explore" },
    { icon: PlusSquare, path: "/create", label: "Create" },
    { icon: MessageCircle, path: "/chats", label: "Chats", badge: unreadCount },
    { icon: User, path: profilePath, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {items.map(({ icon: Icon, path, label, badge }) => {
          const isActive = label === "Profile"
            ? location.pathname.startsWith("/profile")
            : location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => {
                if (label === "Chats") clearUnread();
                navigate(path);
              }}
              className={cn(
                "relative flex flex-col items-center gap-0.5 p-2 transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={label}
            >
              <Icon className={cn("h-6 w-6", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 1.5} />
              {badge && badge > 0 && (
                <span className="absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
