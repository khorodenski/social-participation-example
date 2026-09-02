/** Tiny JSON response helpers shared by the functions. */

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** All JSON errors have the shape { "error": "<polish message>" }. */
export function jsonError(message: string, status: number): Response {
  return json({ error: message }, status);
}
