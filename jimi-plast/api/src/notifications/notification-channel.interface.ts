export interface NotificationEvent {
  type: string; // ex: "registration.new", "order.created", "product_request.new"
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Un canal = une façon de délivrer un événement (console, WhatsApp, email, push...).
 * Ajouter un canal ne touche jamais au code métier qui appelle NotificationsService.notify().
 */
export interface NotificationChannel {
  readonly name: string;
  send(event: NotificationEvent): Promise<void>;
}
