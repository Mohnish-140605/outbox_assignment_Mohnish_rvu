export interface SlackNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  destinationUrl: string | null;
}

export interface SlackNotificationsResponse {
  notifications: SlackNotification[];
  limit: number;
}