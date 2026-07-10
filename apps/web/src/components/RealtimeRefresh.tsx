"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/** Nudges a server re-render whenever anything raven-shaped changes.
 *  RLS decides what this user is allowed to hear about. */
export function RealtimeRefresh() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 150);
    };

    const channel = supabase
      .channel("raven-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "ravens" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "raven_recipients" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "raven_replies" }, refresh)
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
