import { supabase, supabaseAnonKey, supabaseUrl } from "./supabase";

type AuthedFetchOptions = {
  path: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export const authedFetch = async ({
  path,
  method = "GET",
  body,
  headers = {},
}: AuthedFetchOptions) => {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session expired. Log in again.");
  }

  const response = await fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    await supabase.auth.signOut();
    throw new Error("Session expired. Log in again.");
  }

  return response;
};
// alerty project