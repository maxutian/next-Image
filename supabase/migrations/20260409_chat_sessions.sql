create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  last_image_id uuid references public.images (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  role text not null check (role in ('user','assistant','system')),
  text text not null default '',
  status text not null default 'success' check (status in ('pending','success','error')),
  intent text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.message_images (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  image_id uuid not null references public.images (id) on delete cascade,
  kind text not null check (kind in ('input_reference','generated_result','selected_context')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.images add column if not exists session_id uuid references public.chat_sessions (id) on delete set null;
alter table public.images add column if not exists message_id uuid references public.chat_messages (id) on delete set null;

create index if not exists chat_sessions_user_updated_idx on public.chat_sessions (user_id, updated_at desc);
create index if not exists chat_messages_session_created_idx on public.chat_messages (session_id, created_at asc);
create index if not exists message_images_message_idx on public.message_images (message_id);

-- simple RLS placeholders: mirror images policies for sessions/messages
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.message_images enable row level security;

do $$
begin
  -- CREATE POLICY does not support IF NOT EXISTS consistently across Postgres versions,
  -- so mirror the explicit pg_policies check used by the earlier images migration.
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_sessions'
      and policyname = 'Users can view their sessions'
  ) then
    create policy "Users can view their sessions"
      on public.chat_sessions
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_sessions'
      and policyname = 'Users can insert their sessions'
  ) then
    create policy "Users can insert their sessions"
      on public.chat_sessions
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_sessions'
      and policyname = 'Users can update their sessions'
  ) then
    create policy "Users can update their sessions"
      on public.chat_sessions
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'Users can view their session messages'
  ) then
    create policy "Users can view their session messages"
      on public.chat_messages
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.chat_sessions s
          where s.id = session_id
            and s.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'Users can insert their session messages'
  ) then
    create policy "Users can insert their session messages"
      on public.chat_messages
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.chat_sessions s
          where s.id = session_id
            and s.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'message_images'
      and policyname = 'Users can view their message images'
  ) then
    create policy "Users can view their message images"
      on public.message_images
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.chat_messages m
          join public.chat_sessions s on m.session_id = s.id
          where m.id = message_id
            and s.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'message_images'
      and policyname = 'Users can insert their message images'
  ) then
    create policy "Users can insert their message images"
      on public.message_images
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.chat_messages m
          join public.chat_sessions s on m.session_id = s.id
          where m.id = message_id
            and s.user_id = auth.uid()
        )
      );
  end if;
end $$;
