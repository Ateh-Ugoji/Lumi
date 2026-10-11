const API_BASE = "http://localhost:8000";

export type SamplePost = {
  author?: string;
  text?: string;
  likes?: number;
  url?: string;
};

export type ToolExecution = {
  name: string;
  arguments: Record<string, any>;
  sample_posts: SamplePost[];
};

export type AgentResponse = {
  role: string;
  content: string;
  tool_calls_made: string[];
  tool_executions: ToolExecution[];
};

export type ProfileSummary = {
  id: number;
  name: string;
  platform: string;
  handle: string;
  has_voice_profile: boolean;
  listening_active: boolean;
};

export async function sendChatMessage(profileId: number, message: string): Promise<AgentResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile_id: profileId, message }),
  });

  if (!res.ok) {
    throw new Error(`Agent error (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

export async function getProfiles(): Promise<ProfileSummary[]> {
  const res = await fetch(`${API_BASE}/profiles`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.profiles || [];
}

export async function getProfileAlerts(profileId: number): Promise<any[]> {
  const res = await fetch(`${API_BASE}/profiles/${profileId}/alerts/unread`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.alerts || [];
}

export async function getChatHistory(profileId: number): Promise<any[]> {
  const res = await fetch(`${API_BASE}/chat/history?profile_id=${profileId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages || [];
}
