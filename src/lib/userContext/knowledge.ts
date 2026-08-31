import { getAiMemory } from "@/lib/ai/memory";
import { getAllRatings, getContextProfile, getFacts, getFeedback } from "@/lib/ai/tasteProfile";
import { loadRequests } from "@/lib/requests/store";
import type { AiContextInsight, AiFactEntry, AiFeedbackEntry, AiUserMemory, TitleRating } from "@/lib/ai/types";

export interface UnifiedUserKnowledge {
  userId: string;
  facts: AiFactEntry[];
  insights: AiContextInsight[];
  ratings: TitleRating[];
  feedback: AiFeedbackEntry[];
  memory: AiUserMemory;
  requests: {
    title: string;
    status: string;
    createdAt: number;
    tmdbId?: number;
    type?: "movie" | "series";
  }[];
  generatedAt: number;
}

/**
 * One read API over the user-owned knowledge sources that already exist in
 * Movviz. These stores remain authoritative during the migration: the
 * Context Engine unifies how they are queried instead of copying them into a
 * second database and creating synchronization bugs.
 */
export function getUnifiedUserKnowledge(userId: string): UnifiedUserKnowledge {
  const requests = loadRequests()
    .filter((request) => request.userId === userId)
    .map((request) => ({
      title: request.title,
      status: request.status,
      createdAt: request.createdAt,
      tmdbId: "tmdbId" in request && typeof request.tmdbId === "number" ? request.tmdbId : undefined,
      type: "type" in request && (request.type === "movie" || request.type === "series") ? request.type : undefined,
    }));

  return {
    userId,
    facts: getFacts(userId),
    insights: getContextProfile(userId)?.insights ?? [],
    ratings: getAllRatings(userId),
    feedback: getFeedback(userId),
    memory: getAiMemory(userId),
    requests,
    generatedAt: Date.now(),
  };
}
