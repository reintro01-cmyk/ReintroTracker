// supabase-js surfaces a non-2xx edge-function response as a FunctionsHttpError whose `message`
// is generic ("Edge Function returned a non-2xx status code"); the useful server message — e.g.
// our "Rate limit exceeded…" text — lives in the JSON body of the raw Response on `error.context`.
// Pull it out when present, falling back to the generic message.
export async function edgeErrorMessage(error, fallback = "Edge Function error") {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return body.error;
  } catch {
    // context wasn't a readable JSON Response — fall through to the generic message.
  }
  return error?.message || fallback;
}
