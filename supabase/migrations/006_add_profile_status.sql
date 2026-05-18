-- Add is_active column to profiles for account management
alter table public.profiles
add column if not exists is_active boolean default true;
-- Update RLS policy to prevent inactive users from accessing data
create policy "Inactive users cannot read profiles" on profiles for
select using (is_active = true);