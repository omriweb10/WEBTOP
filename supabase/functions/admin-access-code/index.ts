// Edge Function entry: POST /functions/v1/admin-access-code  { profileId, mode, code?, allowWeak? }
import { adminAccessCodeDeps } from '../_shared/supabaseDeps.ts';
import { createAdminAccessCodeHandler } from './handler.ts';

Deno.serve(createAdminAccessCodeHandler(adminAccessCodeDeps()));
