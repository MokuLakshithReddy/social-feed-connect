import { supabase } from "@/integrations/supabase/client";

export const getAvatarUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
};

export const getPostImageUrl = (path: string) => {
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from('posts').getPublicUrl(path);
  return data.publicUrl;
};
