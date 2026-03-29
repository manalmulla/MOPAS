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
    // 1. Try Supabase
    const { error } = await supabase.from("detections").insert([detection]);
    
    // 2. Fallback to Local Storage (so user sees it working immediately)
    const localData = JSON.parse(localStorage.getItem("mopas_detections") || "[]");
    const newEntry = { ...detection, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    localStorage.setItem("mopas_detections", JSON.stringify([newEntry, ...localData].slice(0, 50)));
    window.dispatchEvent(new CustomEvent("mopas_new_detection", { detail: newEntry }));

    if (error) {
       console.warn("Supabase RLS/Policy blocked save. Using localStorage fallback.");
       // We don't throw here so the UI can still update from local storage if needed
    }
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
      supabase.from("detections").select("*", { count: "exact", head: true }).in("threat_level", ["High", "Critical"])
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
    const { data: remote, error } = await supabase
      .from("detections")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    const localData = JSON.parse(localStorage.getItem("mopas_detections") || "[]");
    const merged = [...localData, ...(remote || [])].sort((a,b) => 
       new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    return merged.slice(0, limit);
  } catch (err) {
    console.error("Error fetching live threat feed:", err);
    return [];
  }
};

export const subscribeToDetections = (onNewDetection: (payload: any) => void) => {
    const remoteSub = supabase
      .channel("detections-channel")
      .on(
        "postgres_changes" as any, 
        { event: "INSERT", table: "detections", schema: "public" }, 
        (payload) => {
          onNewDetection(payload.new);
        }
      )
      .subscribe();

    // Local Storage polling as a quick reactive fallback for current tab
    const interval = setInterval(() => {
       const local = JSON.parse(localStorage.getItem("mopas_detections") || "[]");
       if (local.length > 0) {
          // Since we might have already added them, this is just a quick UI sync
          // Real apps use better events, but for a 1-man demo this works.
       }
    }, 1000);

    return { unsubscribe: () => { remoteSub.unsubscribe(); clearInterval(interval); } };
};
