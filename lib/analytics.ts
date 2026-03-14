import { supabase } from "./supabase";

type EventPayload = {
  event_type: string;
  metadata?: Record<string, unknown>;
};

export const trackEvent = async ({ event_type, metadata = {} }: EventPayload) => {
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  try {
    await supabase.from("app_events").insert({
      user_id: user.id,
      event_type,
      metadata,
    });
  } catch (error) {
    // Ignore if analytics table is not configured for this project.
  }
};
