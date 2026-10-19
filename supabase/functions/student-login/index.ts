// Edge Function entry: POST /functions/v1/student-login  { code, device? }
import { studentLoginDeps } from '../_shared/supabaseDeps.ts';
import { createStudentLoginHandler } from './handler.ts';

Deno.serve(createStudentLoginHandler(studentLoginDeps()));
