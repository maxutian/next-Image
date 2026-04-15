create extension if not exists vector;

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt text not null,
  image_url text not null,
  mode text not null default 'text-to-image' check (mode in ('text-to-image', 'image-to-image')),
  embedding vector(768),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists images_user_id_created_at_idx
  on public.images (user_id, created_at desc);

create index if not exists images_embedding_idx
  on public.images
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.images enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'images'
      and policyname = 'Users can view their own images'
  ) then
    create policy "Users can view their own images"
      on public.images
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'images'
      and policyname = 'Users can insert their own images'
  ) then
    create policy "Users can insert their own images"
      on public.images
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'images'
      and policyname = 'Users can update their own images'
  ) then
    create policy "Users can update their own images"
      on public.images
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'images'
      and policyname = 'Users can delete their own images'
  ) then
    create policy "Users can delete their own images"
      on public.images
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'images',
  'images',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can upload their own image objects'
  ) then
    create policy "Authenticated users can upload their own image objects"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'images'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can update their own image objects'
  ) then
    create policy "Authenticated users can update their own image objects"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'images'
        and owner = auth.uid()
      )
      with check (
        bucket_id = 'images'
        and owner = auth.uid()
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can delete their own image objects'
  ) then
    create policy "Authenticated users can delete their own image objects"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'images'
        and owner = auth.uid()
      );
  end if;
end $$;
