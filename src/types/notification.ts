export interface NotificationActor {
  id: number | null;
  name: string | null;
  role: string | null;
}

export interface NotificationWebTarget {
  route: string | null;
  params: Record<string, string | number>;
  url?: string | null;
}

export interface NotificationMobileTarget {
  screen: string | null;
  params: Record<string, string | number>;
}

export interface AppNotification {
  id: string;
  title: string;
  description: string | null;
  type: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string | null;
  order_id: number | null;
  actor: NotificationActor;
  target: {
    web: NotificationWebTarget | null;
    mobile: NotificationMobileTarget | null;
  };
}
