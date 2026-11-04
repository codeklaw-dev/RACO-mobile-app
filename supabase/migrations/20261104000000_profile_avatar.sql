-- Profile photo: a small square JPEG (256 px) stored as a data URI on the
-- profile row, so it follows the same row level security and is removed with
-- the account.
alter table public.profiles
  add column avatar text check (avatar is null or (avatar like 'data:image/jpeg;base64,%' and char_length(avatar) <= 200000));
