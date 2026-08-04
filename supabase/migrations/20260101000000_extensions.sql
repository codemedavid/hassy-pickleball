-- Extensions required by the schema.
-- btree_gist lets an EXCLUDE constraint mix equality (court_id) with range overlap.
create extension if not exists btree_gist;

-- citext gives case-insensitive, unique-safe email columns.
create extension if not exists citext;
