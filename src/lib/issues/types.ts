export type IssueType = "video" | "audio" | "subtitle" | "other";
export type IssueStatus = "open" | "resolved" | "reopened";

export interface IssueComment {
  id: string;
  userId: string;
  username: string;
  message: string;
  createdAt: number;
}

export interface Issue {
  id: string;
  userId: string;
  username: string; // snapshot, survives the user being renamed/removed later
  libraryType: "movie" | "series";
  libraryId: string;
  title: string;
  posterPath: string | null;
  issueType: IssueType;
  description: string;
  status: IssueStatus;
  comments: IssueComment[];
  createdAt: number;
  updatedAt: number;
}
