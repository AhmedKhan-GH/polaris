-- Custom SQL migration file, put your code below! --

-- The app now connects as the non-superuser app_user. sign_in_log was created
-- before app_user existed (no grants); recordSignIn (INSERT) and the /activity
-- viewer (SELECT) need access. No RLS on sign_in_log — it's an audit log.
GRANT SELECT, INSERT ON "sign_in_log" TO "app_user";