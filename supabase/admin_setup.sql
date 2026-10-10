CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- If executed in direct database superuser/postgres migration session:
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- If client is modifying is_verified or college_role
  IF (OLD.college_role IS DISTINCT FROM NEW.college_role OR OLD.is_verified IS DISTINCT FROM NEW.is_verified) THEN
    SELECT college_role INTO v_caller_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_caller_role IS DISTINCT FROM 'college_admin' THEN
      NEW.college_role := OLD.college_role;
      NEW.is_verified := OLD.is_verified;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

UPDATE public.profiles
SET college_role = 'college_admin',
    is_verified = true
WHERE id = '73195cf7-df24-49e8-9f09-07bf6eb81c11';
