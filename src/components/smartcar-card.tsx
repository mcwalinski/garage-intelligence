import Link from "next/link";
import { linkSmartcarVehicleAction, syncSmartcarConnectionAction } from "@/app/integrations/smartcar/actions";

interface SmartcarCardProps {
  connectionCount: number;
  connectedVehicles: Array<{
    id: string;
    make: string;
    model: string;
    year: number | null;
    linkedVehicleId: string | null;
    linkedVehicleLabel: string | null;
    connectionId: string | null;
  }>;
  garageVehicles: Array<{ id: string; label: string }>;
  disabled?: boolean;
  compact?: boolean;
}

export function SmartcarCard({
  connectionCount,
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
            <p className="helper-text">Priority brands: Jeep, GMC, Chevy, Rivian, Tesla</p>
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
                <span className={`status-pill ${vehicle.linkedVehicleId ? "status-live" : "status-upcoming"}`}>
                  {vehicle.linkedVehicleId ? "Linked" : "Needs link"}
                </span>
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
