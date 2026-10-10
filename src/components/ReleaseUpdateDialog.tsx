import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, ImagePlus, UserCheck, Zap } from "lucide-react";

export const CURRENT_APP_VERSION = "1.1.0";
const STORAGE_KEY = "seen_release_version";

interface ReleaseUpdateDialogProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export const ReleaseUpdateDialog = ({ forceOpen, onClose }: ReleaseUpdateDialogProps) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      return;
    }

    const seenVersion = localStorage.getItem(STORAGE_KEY);
    if (seenVersion !== CURRENT_APP_VERSION) {
      // Delay slightly so user sees the app load first
      const timer = setTimeout(() => {
        setOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [forceOpen]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, CURRENT_APP_VERSION);
    setOpen(false);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleDismiss();
      else setOpen(true);
    }}>
      <DialogContent className="max-w-md rounded-2xl p-6 sm:rounded-2xl">
        <DialogHeader className="text-center sm:text-center items-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-7 w-7 animate-pulse" />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-1">
            New Release v{CURRENT_APP_VERSION}
          </div>
          <DialogTitle className="text-xl font-bold">What's New in this Update</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            We've resolved critical issues to give you a seamless experience!
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-3.5">
          <div className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
              <ImagePlus className="h-5 w-5" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-semibold">Post Uploads Fixed</h4>
              <p className="text-xs text-muted-foreground">
                Resolved the "Bucket not found" error when sharing images. You can now post photos freely!
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
              <UserCheck className="h-5 w-5" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-semibold">Account Profile Restored</h4>
              <p className="text-xs text-muted-foreground">
                Fixed the "User not found" issue. Your profile, avatar, post feed, and followers now load instantly.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-semibold">Stability & Speed Improvements</h4>
              <p className="text-xs text-muted-foreground">
                Smoother bottom navigation and automatic account synchronization across devices.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleDismiss}
          className="h-11 w-full rounded-xl text-sm font-semibold shadow"
        >
          Got it, let's explore!
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ReleaseUpdateDialog;
