import {
  refreshNotificationAlertsAction,
  sendNotificationDigestAction,
  updateNotificationPreferencesAction
} from "@/app/integrations/notifications/actions";

interface NotificationCenterCardProps {
  disabled: boolean;
  preferences: {
    deliveryEmail: string;
    phoneNumber: string;
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    maintenanceDueEnabled: boolean;
    maintenanceDueSoonEnabled: boolean;
    weeklyDigestEnabled: boolean;
  };
  alerts: Array<{
    id: string;
    title: string;
    body: string;
    severity: "info" | "warning" | "critical";
    createdAt: string;
    channelSuggestions: string[];
  }>;
  recentDeliveries: Array<{
    channel: "email" | "sms" | "push";
    status: "pending" | "sent" | "skipped" | "failed";
    deliveredAt: string | null;
    errorMessage: string | null;
  }>;
}

export function NotificationCenterCard({
  disabled,
  preferences,
  alerts,
  recentDeliveries
}: NotificationCenterCardProps) {
  return (
    <section className="card notification-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Notifications</span>
          <h2>Alert center</h2>
        </div>
        <div className="notification-card__actions">
          <form action={refreshNotificationAlertsAction}>
            <button type="submit" className="button button--ghost" disabled={disabled}>
              Refresh alerts
            </button>
          </form>
          <form action={sendNotificationDigestAction}>
            <button type="submit" className="button button--primary" disabled={disabled}>
              Send email digest
            </button>
          </form>
        </div>
      </div>
      <form action={updateNotificationPreferencesAction} className="vehicle-form notification-form">
        <div className="form-grid">
          <label className="field">
            <span>Delivery email</span>
            <input name="deliveryEmail" type="email" defaultValue={preferences.deliveryEmail} />
          </label>
          <label className="field">
            <span>Phone number</span>
            <input name="phoneNumber" type="tel" defaultValue={preferences.phoneNumber} placeholder="Optional" />
          </label>
          <label className="checkbox-field">
            <input name="emailEnabled" type="checkbox" defaultChecked={preferences.emailEnabled} />
            <span>Email notifications</span>
          </label>
          <label className="checkbox-field">
            <input name="smsEnabled" type="checkbox" defaultChecked={preferences.smsEnabled} />
            <span>SMS notifications</span>
          </label>
          <label className="checkbox-field">
            <input name="pushEnabled" type="checkbox" defaultChecked={preferences.pushEnabled} />
            <span>Push notifications</span>
          </label>
          <label className="checkbox-field">
            <input
              name="maintenanceDueEnabled"
              type="checkbox"
              defaultChecked={preferences.maintenanceDueEnabled}
            />
            <span>Due and overdue maintenance alerts</span>
          </label>
          <label className="checkbox-field">
            <input
              name="maintenanceDueSoonEnabled"
              type="checkbox"
              defaultChecked={preferences.maintenanceDueSoonEnabled}
            />
            <span>Due soon maintenance alerts</span>
          </label>
          <label className="checkbox-field">
            <input
              name="weeklyDigestEnabled"
              type="checkbox"
              defaultChecked={preferences.weeklyDigestEnabled}
            />
            <span>Weekly digest preference</span>
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="button button--ghost" disabled={disabled}>
            Save notification settings
          </button>
        </div>
      </form>

      <div className="notification-grid">
        <div>
          <span className="eyebrow">Active alerts</span>
          {alerts.length > 0 ? (
            <div className="stack">
              {alerts.slice(0, 8).map((alert) => (
                <div key={alert.id} className="task-row">
                  <div>
                    <strong>{alert.title}</strong>
                    <p>{alert.body}</p>
                  </div>
                  <div className="task-row__meta">
                    <span className={`status-pill status-${alert.severity === "critical" ? "overdue" : alert.severity === "warning" ? "due" : "live"}`}>
                      {alert.severity}
                    </span>
                    <small>{alert.createdAt.slice(0, 10)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No active alerts.</p>
          )}
        </div>

        <div>
          <span className="eyebrow">Delivery log</span>
          {recentDeliveries.length > 0 ? (
            <div className="stack">
              {recentDeliveries.map((delivery, index) => (
                <div key={`${delivery.channel}-${delivery.deliveredAt ?? index}`} className="task-row">
                  <div>
                    <strong>{delivery.channel}</strong>
                    <p>{delivery.errorMessage ?? "Delivery processed without provider errors"}</p>
                  </div>
                  <div className="task-row__meta">
                    <span className={`status-pill status-${delivery.status === "failed" ? "overdue" : delivery.status === "sent" ? "live" : "upcoming"}`}>
                      {delivery.status}
                    </span>
                    <small>{delivery.deliveredAt ? delivery.deliveredAt.slice(0, 10) : "Pending"}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No deliveries recorded yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
