/**
 * Local stand-in for Supabase's Edge Runtime: serves the real function handlers
 * (same code that is deployed) under /<function-name>.
 */
import { createAdminAccessCodeHandler } from '../../supabase/functions/admin-access-code/handler.ts';
import { adminAccessCodeDeps, studentLoginDeps } from '../../supabase/functions/_shared/supabaseDeps.ts';
import { createStudentLoginHandler } from '../../supabase/functions/student-login/handler.ts';

const handlers: Record<string, (req: Request) => Promise<Response>> = {
  'student-login': createStudentLoginHandler(studentLoginDeps()),
  'admin-access-code': createAdminAccessCodeHandler(adminAccessCodeDeps()),
};

Deno.serve({ hostname: '127.0.0.1', port: Number(Deno.env.get('PORT') ?? 54322) }, (req) => {
  const name = new URL(req.url).pathname.split('/').filter(Boolean)[0] ?? '';
  const handler = handlers[name];
  return handler ? handler(req) : new Response('Function not found', { status: 404 });
});
