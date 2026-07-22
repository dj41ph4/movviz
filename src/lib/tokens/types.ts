export interface ApiToken {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  createdAt: number;
  lastUsedAt: number | null;
}
