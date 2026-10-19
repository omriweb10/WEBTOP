-- Private bucket for profile pictures. Size and MIME types are enforced by Storage
-- itself; paths are "<profile id>/<random uuid>.<ext>".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Admins manage all avatars.
create policy avatars_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (select public.is_admin()))
  with check (bucket_id = 'avatars' and (select public.is_admin()));

-- A signed-in student may read (create signed URLs for) only their own folder.
create policy avatars_read_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select public.current_profile_id())::text);
