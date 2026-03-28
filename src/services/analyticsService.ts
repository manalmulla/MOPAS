import { supabase } from "../lib/supabase";

export interface Detection {
  id?: string;
  created_at?: string;
  type: "URL" | "EMAIL" | "IMAGE" | "QR";
  target: string;
  risk_score: number;
  threat_level: "Low" | "Medium" | "High" | "Critical";
  is_malicious: boolean;
  summary: string;
}

export const trackDetection = async (detection: Detection) => {
  try {
    const { error } = await supabase.from("detections").insert([detection]);
    if (error) throw error;
  } catch (err) {
    console.error("Error tracking detection:", err);
  }
};

export const getLiveStats = async () => {
  try {
    // In a real scenario, you'd perform aggregation, but since Supabase doesn't easily return counts for everything in one call
    // without multiple calls or a stored procedure, we'll do quick counts for simplicity.
    const [
      { count: totalScanned },
      { count: threatsBlocked },
      { count: phishingCaught },
    ] = await Promise.all([
      supabase.from("detections").select("*", { count: "exact", head: true }),
      supabase.from("detections").select("*", { count: "exact", head: true }).eq("is_malicious", true),
      supabase.from("detections").select("*", { count: "exact", head: true }).eq("threat_level", "Critical")
    ]);

    // System Score can be (1 - (malicious / total)) * 100
    const score = totalScanned ? (1 - (threatsBlocked / totalScanned)) * 100 : 100;

    return {
      totalScanned: (totalScanned || 0).toLocaleString(),
      threatsBlocked: (threatsBlocked || 0).toLocaleString(),
      phishingCaught: (phishingCaught || 0).toLocaleString(),
      systemScore: `${score.toFixed(1)}%`
    };
  } catch (err) {
    console.error("Error fetching live stats:", err);
    return null;
  }
};

export const getLiveThreatFeed = async (limit = 10) => {
  try {
    const { data, error } = await supabase
      .from("detections")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Error fetching live threat feed:", err);
    return [];
  }
};

export const subscribeToDetections = (onNewDetection: (payload: any) => void) => {
  return supabase
    .channel("detections-channel")
    .on(
      "postgres_changes" as any, 
      { event: "INSERT", table: "detections", schema: "public" }, 
      (payload) => {
        onNewDetection(payload.new);
      }
    )
    .subscribe();
};
