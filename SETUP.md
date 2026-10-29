# Supabase shared price setup

The dashboard stores monitor costs and other upgrade items in one Supabase row. Visitors can read the public price list. Supabase Auth and database Row Level Security allow only the configured admin account to change it.

## 1. Create the Supabase project and admin account

1. Create a Supabase project.
2. In Authentication, create the admin email/password account.
3. Copy that user's UUID from the Users table. Use the same UUID in supabase-config.js and supabase-setup.sql.

## 2. Create the pricing table and policies

1. Open the Supabase SQL Editor.
2. In supabase-setup.sql, replace both instances of YOUR_ADMIN_USER_UUID with the admin user's UUID.
3. Run the SQL.
4. In Database > Publications, enable upgrade_pricing for the supabase_realtime publication.

The SQL grants public read access to the single pricing row. Only the configured Auth user can insert or update it. Do not put a secret or service_role key in the website.

## 3. Connect the website

1. In Supabase Project Settings, copy the Project URL and publishable key.
2. Put them in supabase-config.js, and set CBD_SUPABASE_ADMIN_UID to the admin user's UUID.
3. Keep index.html, script.js, style.css, and supabase-config.js together when publishing the static site.

The publishable key is meant for browser code. The SQL policies protect the data. Never use a secret or service_role key in these files.

## 4. Move old browser prices into Supabase

The earlier version stored prices only in the browser that edited them. Open the updated page in that same browser after configuration, sign in as admin, review the values, and select Save Shared Prices once. If that browser has no saved prices, enter the current prices first and save.

The Supabase Realtime subscription sends price changes to connected pages as they happen. A page opened while Supabase is paused or unavailable can reload when the service is active again.
