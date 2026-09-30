export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  slackConnected: boolean;
  slackTeamName: string | null;
}
