import Link from "next/link";
import { Vehicle } from "@/lib/types";

interface VehicleCardProps {
  vehicle: Vehicle;
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const latestValue = vehicle.valuationHistory[vehicle.valuationHistory.length - 1];
  const topTask = vehicle.maintenance[0];
  const ownershipLabel =
    vehicle.ownershipStatus === "own" ? "Own" : vehicle.ownershipStatus === "owned" ? "Owned" : "Watching";
  const statusClass =
    vehicle.ownershipStatus === "own"
      ? vehicle.telemetry.ignitionOn
        ? "status-live"
        : "status-idle"
      : vehicle.ownershipStatus === "owned"
        ? "status-upcoming"
        : "status-live";

  return (
    <Link href={`/vehicles/${vehicle.id}`} className="card vehicle-card">
      <div className="vehicle-card__image" style={{ backgroundImage: `url(${vehicle.image})` }} />
      <div className="vehicle-card__body">
        <div className="vehicle-card__heading">
          <div>
            <span className="eyebrow">{vehicle.nickname}</span>
            <h3>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h3>
          </div>
          <span className={`status-pill ${statusClass}`}>
            {ownershipLabel}
          </span>
        </div>
        <div className="vehicle-metrics">
          <div>
            <span>Market value</span>
            <strong>
              {latestValue ? `$${latestValue.marketValueUsd.toLocaleString()}` : "Pending"}
            </strong>
          </div>
          <div>
            <span>Energy</span>
            <strong>{vehicle.telemetry.batteryOrFuelPercent}%</strong>
          </div>
          <div>
            <span>Odometer</span>
            <strong>{vehicle.telemetry.odometerMiles.toLocaleString()} mi</strong>
          </div>
        </div>
        <p className="vehicle-card__task">
          {vehicle.ownershipStatus === "own"
            ? topTask
              ? `Next task: ${topTask.title} on ${topTask.dueDate}`
              : "No maintenance plan yet"
            : vehicle.ownershipStatus === "owned"
              ? "Historical vehicle record"
              : "Watchlist vehicle"}
        </p>
      </div>
    </Link>
  );
}
