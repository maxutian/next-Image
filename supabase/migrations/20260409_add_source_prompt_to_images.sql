alter table public.images
  add column if not exists source_prompt text;

update public.images
set source_prompt = prompt
where source_prompt is null;

alter table public.images
  alter column source_prompt set not null;
