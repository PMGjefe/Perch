-- Sighting photos become private: readable only by the owner or by someone who can see the
-- sighting through public_sightings (same visibility, followers and privacy rules). The app
-- fetches them through short-lived signed URLs. Avatars move to their own public bucket.

update storage.buckets set public = false where id = 'sighting-photos';

drop policy if exists "photos: public read" on storage.objects;
create policy "photos: read visible" on storage.objects for select to authenticated
  using (
    bucket_id = 'sighting-photos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.public_sightings s where s.photo_path = name)
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
