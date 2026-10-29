/*
 * These are safe to use in a public frontend when the SQL setup enables
 * Row Level Security. Never put a Supabase secret/service_role key here.
 */
window.CBD_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  publishableKey: "sb_publishable_YOUR_PUBLISHABLE_KEY"
};

/* Copy the admin user's UUID from Supabase Authentication > Users. */
window.CBD_SUPABASE_ADMIN_UID = "281830a6-a457-494e-ba93-34d7465a2cac";
