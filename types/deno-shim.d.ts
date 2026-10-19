/**
 * Minimal Deno globals for type-checking the Edge Functions with tsc in Node tooling.
 * The real Deno runtime provides these; this file is never imported by function code.
 */
declare namespace Deno {
  export const env: { get(name: string): string | undefined };
  export function serve(handler: (req: Request) => Response | Promise<Response>): unknown;
  export function serve(
    options: { hostname?: string; port?: number },
    handler: (req: Request) => Response | Promise<Response>,
  ): unknown;
}
