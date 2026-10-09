-- A BEFORE DELETE trigger must return OLD to allow the deletion.
CREATE OR REPLACE FUNCTION protect_system_access_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_protected THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Protected access roles cannot be deleted';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.key IS DISTINCT FROM OLD.key
      OR NOT NEW.is_protected OR NEW.is_system IS DISTINCT FROM OLD.is_system THEN
      RAISE EXCEPTION 'Protected access role identity and protection cannot be changed';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
