# NexoraSolveX Client Feedback

Static site + one Vercel serverless function (`api/submit.js`). No build step.

## Setup
1. Run `schema.sql` in Supabase > SQL Editor (ideally in a separate Supabase project).
2. Vercel > Project > Settings > Environment Variables (Production + Preview):
   - `SUPABASE_URL` = https://<ref>.supabase.co
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role / secret key (server only, never in the repo or frontend)
3. Deploy (framework preset "Other", no build command), then redeploy after adding the variables.

Local test: `npx vercel dev` with a `.env.local` file holding the same two variables.

The browser only calls `/api/submit`. The database table, function and storage bucket are not accessible to anonymous visitors.
