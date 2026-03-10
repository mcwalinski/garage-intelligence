import Link from "next/link";
import { linkSmartcarVehicleAction, syncSmartcarConnectionAction } from "@/app/integrations/smartcar/actions";

interface SmartcarCardProps {
  connectionCount: number;
  linkedCount: number;
  freshVehicleCount: number;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  connectedVehicles: Array<{
    id: string;
    make: string;
    model: string;
    year: number | null;
    linkedVehicleId: string | null;
    linkedVehicleLabel: string | null;
    connectionId: string | null;
    lastSyncedAt: string | null;
    odometerMiles: number | null;
    batteryOrFuelPercent: number | null;
    latitude: number | null;
    longitude: number | null;
    telemetrySource: string | null;
  }>;
  garageVehicles: Array<{ id: string; label: string }>;
  disabled?: boolean;
  compact?: boolean;
}

export function SmartcarCard({
  connectionCount,
  linkedCount,
  freshVehicleCount,
  lastSyncedAt,
  lastSyncStatus,
  lastSyncError,
  connectedVehicles,
  garageVehicles,
  disabled = false,
  compact = false
}: SmartcarCardProps) {
  const firstConnectionId = connectedVehicles[0]?.connectionId;

  return (
    <section>
      {!compact ? (
        <div className="section-heading">
          <div>
            <span className="eyebrow">Telemetry</span>
            <h2>Smartcar connection</h2>
          </div>
          <p>Connect supported vehicles for live odometer, location, fuel, battery, and movement data.</p>
        </div>
      ) : null}
      <div className={`card smartcar-card ${compact ? "smartcar-card--compact" : ""}`}>
        <div className="smartcar-card__header">
          <div>
            <strong>{connectionCount > 0 ? `${connectionCount} Smartcar connection${connectionCount === 1 ? "" : "s"}` : "No Smartcar connection yet"}</strong>
            <p className="helper-text">
              {linkedCount > 0
                ? `${linkedCount} linked vehicle${linkedCount === 1 ? "" : "s"} · ${freshVehicleCount} fresh in the last 24h${lastSyncedAt ? ` · last sync ${lastSyncedAt.slice(0, 16).replace("T", " ")}` : ""}`
                : "Priority brands: Jeep, GMC, Chevy, Rivian, Tesla"}
            </p>
            {lastSyncStatus ? (
              <p className="helper-text">
                Sync status: {lastSyncStatus}
                {lastSyncError ? ` · ${lastSyncError}` : ""}
              </p>
            ) : null}
          </div>
          <div className="smartcar-card__actions">
            {firstConnectionId && !disabled ? (
              <form action={syncSmartcarConnectionAction}>
                <input type="hidden" name="connectionId" value={firstConnectionId} />
                <button type="submit" className="button button--ghost">
                  Sync linked vehicles
                </button>
              </form>
            ) : null}
            {disabled ? (
              <span className="button button--ghost">Sign in required</span>
            ) : (
              <Link href="/api/integrations/smartcar/connect" className="button button--primary">
                Connect Smartcar
              </Link>
            )}
          </div>
        </div>
        {connectedVehicles.length > 0 ? (
          <div className="smartcar-list">
            {connectedVehicles.map((vehicle) => (
              <div key={vehicle.id} className="task-row">
                <div>
                  <strong>
                    {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                  </strong>
                  <p>
                    {vehicle.linkedVehicleLabel
                      ? `Linked to ${vehicle.linkedVehicleLabel}`
                      : "Imported from Smartcar provider discovery"}
                  </p>
                  {vehicle.linkedVehicleId ? (
                    <p className="helper-text">
                      {vehicle.lastSyncedAt ? `Synced ${vehicle.lastSyncedAt.slice(0, 16).replace("T", " ")}` : "No synced telemetry yet"}
                      {vehicle.odometerMiles !== null ? ` · ${vehicle.odometerMiles.toLocaleString()} mi` : ""}
                      {vehicle.batteryOrFuelPercent !== null ? ` · ${Math.round(vehicle.batteryOrFuelPercent)}% energy` : ""}
                    </p>
                  ) : null}
                  {!vehicle.linkedVehicleId && !disabled ? (
                    <form action={linkSmartcarVehicleAction} className="smartcar-link-form">
                      <input type="hidden" name="providerVehicleId" value={vehicle.id} />
                      <select name="garageVehicleId" defaultValue="">
                        <option value="" disabled>
                          Link to garage vehicle
                        </option>
                        {garageVehicles.map((garageVehicle) => (
                          <option key={garageVehicle.id} value={garageVehicle.id}>
                            {garageVehicle.label}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="button button--ghost">
                        Link
                      </button>
                    </form>
                  ) : null}
                </div>
                <div className="task-row__meta">
                  <span
                    className={`status-pill ${
                      vehicle.linkedVehicleId
                        ? vehicle.lastSyncedAt
                          ? "status-live"
                          : "status-upcoming"
                        : "status-upcoming"
                    }`}
                  >
                    {vehicle.linkedVehicleId ? (vehicle.lastSyncedAt ? "Linked + synced" : "Linked") : "Needs link"}
                  </span>
                  {vehicle.latitude !== null && vehicle.longitude !== null ? <small>Location available</small> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="helper-text">After connection, discovered Smartcar vehicles will appear here.</p>
        )}
      </div>
    </section>
  );
}
