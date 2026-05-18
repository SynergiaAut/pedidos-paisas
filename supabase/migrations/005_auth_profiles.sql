-- Create a table for public profiles
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade not null primary key,
    updated_at timestamp with time zone,
    full_name text,
    role text default 'user' check (role in ('admin', 'user'))
);
-- Set up Row Level Security (RLS)
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on profiles for
select using (true);
create policy "Users can insert their own profile." on profiles for
insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles for
update using (auth.uid() = id);
-- Function to handle new user signup
create or replace function public.handle_new_user() returns trigger as $$ begin
insert into public.profiles (id, full_name, role)
values (
        new.id,
        new.raw_user_meta_data->>'full_name',
        'user'
    );
return new;
end;
$$ language plpgsql security definer;
-- Trigger to call the function on new user creation
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after
insert on auth.users for each row execute procedure public.handle_new_user();