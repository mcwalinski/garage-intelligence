import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteVehicleAction } from "@/app/add-vehicle/actions";
import {
  completeMaintenanceTaskAction,
  createMaintenanceTaskAction,
  deleteMaintenanceTaskAction
} from "@/app/integrations/maintenance/actions";
import { searchVehiclePartsAction } from "@/app/integrations/marketplaces/actions";
import { refreshVehicleValuationAction } from "@/app/integrations/marketcheck/actions";
import { DeleteVehicleButton } from "@/components/delete-vehicle-button";
import { getAuthenticatedUser } from "@/lib/auth";
import { getVehicle, listVehicles } from "@/lib/dashboard";

export default async function VehiclePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ valuationError?: string; maintenanceError?: string; partsError?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await getAuthenticatedUser();
  const userId = user?.id ?? null;

  const vehicle = await getVehicle(id, userId);
  const fleetVehicles = await listVehicles(userId);

  if (!vehicle) {
    notFound();
  }

  const latestValue = vehicle.valuationHistory[vehicle.valuationHistory.length - 1];
  const dueTasks = vehicle.maintenance.filter((task) => task.status === "due" || task.status === "overdue").length;
  const latestAlert = vehicle.alerts[0] ?? null;
  const ownershipLabel =
    vehicle.ownershipStatus === "own" ? "Own" : vehicle.ownershipStatus === "owned" ? "Owned" : "Watching";

  return (
    <main className="page-shell vehicle-detail-page">
      <section className="detail-toolbar">
        <Link href="/" className="button button--ghost">
          Back to garage
        </Link>
        <div className="detail-toolbar__actions">
          <Link href={`/vehicles/${vehicle.id}/edit`} className="button button--ghost">
            Edit profile
          </Link>
          <DeleteVehicleButton action={deleteVehicleAction} vehicleId={vehicle.id} />
        </div>
      </section>

      {query.valuationError ? <p className="auth-error">{query.valuationError}</p> : null}
      {query.maintenanceError ? <p className="auth-error">{query.maintenanceError}</p> : null}
      {query.partsError ? <p className="auth-error">{query.partsError}</p> : null}

      <section className="detail-hero card">
        <div className="detail-hero__content">
          <div>
            <span className="eyebrow">{vehicle.nickname}</span>
            <h1>
              {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}
            </h1>
            <p>{vehicle.vin ? `VIN ${vehicle.vin}` : "VIN not recorded yet"}</p>
          </div>
          <div className="detail-hero__tags">
            <span
              className={`status-pill ${
                vehicle.ownershipStatus === "own"
                  ? vehicle.telemetry.ignitionOn
                    ? "status-live"
                    : "status-idle"
                  : vehicle.ownershipStatus === "owned"
                    ? "status-upcoming"
                    : "status-live"
              }`}
            >
              {ownershipLabel}
            </span>
            <span className="status-pill status-upcoming">{vehicle.powertrain.toUpperCase()}</span>
            {latestAlert ? <span className="status-pill status-due">{latestAlert.severity} alert</span> : null}
          </div>
        </div>
        <div className="detail-hero__metrics">
          <div>
            <span>Latest value</span>
            <strong>{latestValue ? `$${latestValue.marketValueUsd.toLocaleString()}` : "Pending"}</strong>
          </div>
          <div>
            <span>Odometer</span>
            <strong>{vehicle.telemetry.odometerMiles.toLocaleString()} mi</strong>
          </div>
          <div>
            <span>Energy level</span>
            <strong>{vehicle.telemetry.batteryOrFuelPercent}%</strong>
          </div>
          <div>
            <span>Service due</span>
            <strong>{dueTasks}</strong>
          </div>
        </div>
      </section>

      <section className="detail-layout">
        <div className="detail-layout__main">
          <div className="detail-grid">
            <div className="card">
              <span className="eyebrow">Telemetry</span>
              <h2>Current vehicle state</h2>
              <ul className="detail-list">
                <li>Captured: {vehicle.telemetry.capturedAt}</li>
                <li>Ignition: {vehicle.telemetry.ignitionOn ? "On" : "Off"}</li>
                <li>Speed: {vehicle.telemetry.speedMph} mph</li>
                <li>
                  Coordinates: {vehicle.telemetry.latitude}, {vehicle.telemetry.longitude}
                </li>
                <li>Source: {vehicle.telemetry.source}</li>
              </ul>
            </div>

            <div className="card">
              <span className="eyebrow">Market trend</span>
              <h2>Valuation history</h2>
              {latestValue ? (
                <div className="valuation-meta">
                  <span className="status-pill status-live">{latestValue.source}</span>
                  <p className="helper-text">
                    {latestValue.comparableCount
                      ? `${latestValue.comparableCount} recent listings in estimate`
                      : "Comparable listing count unavailable"}
                    {latestValue.lastSeenAt ? ` · Latest listing seen ${latestValue.lastSeenAt.slice(0, 10)}` : ""}
                  </p>
                </div>
              ) : null}
              {vehicle.valuationHistory.length > 0 ? (
                <div className="trend-list">
                  {vehicle.valuationHistory.map((point) => (
                    <div key={point.capturedAt} className="trend-row">
                      <div>
                        <strong>${point.marketValueUsd.toLocaleString()}</strong>
                        <span>
                          {point.capturedAt.slice(0, 10)}
                          {point.comparableCount ? ` · ${point.comparableCount} comps` : ""}
                        </span>
                      </div>
                      <span className={point.changeUsd <= 0 ? "trend-down" : "trend-up"}>
                        {point.changeUsd > 0 ? "+" : ""}
                        {point.changeUsd}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No valuation history yet.</p>
              )}
            </div>
          </div>

          <div className="detail-stack">
            <div className="card">
              <span className="eyebrow">Maintenance</span>
              <h2>Service plan</h2>
              <form action={createMaintenanceTaskAction} className="vehicle-form maintenance-form">
                <input type="hidden" name="vehicleId" value={vehicle.id} />
                <div className="form-grid">
                  <label className="field field--wide">
                    <span>Task title</span>
                    <input name="title" placeholder="Brake fluid flush" required />
                  </label>
                  <label className="field">
                    <span>Category</span>
                    <select name="category" defaultValue="general">
                      <option value="general">General</option>
                      <option value="engine">Engine</option>
                      <option value="tires">Tires</option>
                      <option value="brakes">Brakes</option>
                      <option value="fluids">Fluids</option>
                      <option value="filters">Filters</option>
                      <option value="battery">Battery</option>
                      <option value="inspection">Inspection</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Due date</span>
                    <input name="dueDate" type="date" required />
                  </label>
                  <label className="field">
                    <span>Due mileage</span>
                    <input name="dueMileage" type="number" min="0" placeholder="Optional" />
                  </label>
                  <label className="field">
                    <span>Estimated cost</span>
                    <input name="estimatedCostUsd" type="number" min="0" step="1" defaultValue="0" />
                  </label>
                  <label className="field field--wide">
                    <span>Service recommendation</span>
                    <input
                      name="providerRecommendation"
                      placeholder="Every 12 months or 10,000 miles"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Recurs every miles</span>
                    <input name="recurrenceMiles" type="number" min="0" placeholder="Optional" />
                  </label>
                  <label className="field">
                    <span>Recurs every days</span>
                    <input name="recurrenceDays" type="number" min="0" placeholder="Optional" />
                  </label>
                  <label className="field field--wide">
                    <span>Notes</span>
                    <input name="notes" placeholder="Shop preference, parts to order, or symptoms" />
                  </label>
                </div>
                <div className="form-actions">
                  <button type="submit" className="button button--primary">
                    Add maintenance task
                  </button>
                </div>
              </form>

              {vehicle.maintenance.length > 0 ? (
                <div className="stack">
                  {vehicle.maintenance.map((task) => (
                    <div key={task.id} className="task-row">
                      <div>
                        <strong>{task.title}</strong>
                        <p>{task.providerRecommendation}</p>
                        <p className="task-row__detail">
                          {task.category} · due {task.dueDate}
                          {task.dueMileage ? ` · ${task.dueMileage.toLocaleString()} mi` : ""}
                          {task.autoGenerated ? " · auto-generated" : ""}
                        </p>
                        {task.notes ? <p className="task-row__detail">{task.notes}</p> : null}
                        {task.completedAt ? (
                          <p className="task-row__detail">
                            Completed {task.completedAt.slice(0, 10)}
                            {task.completedMileage ? ` at ${task.completedMileage.toLocaleString()} mi` : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="task-row__meta">
                        <span className={`status-pill status-${task.status}`}>{task.status}</span>
                        <small>
                          {task.recurrenceMiles
                            ? `Every ${task.recurrenceMiles.toLocaleString()} mi`
                            : "No mile cycle"}
                          {task.recurrenceDays ? ` · ${task.recurrenceDays} day cycle` : ""}
                        </small>
                        <div className="task-row__actions">
                          {!task.completedAt ? (
                            <form action={completeMaintenanceTaskAction}>
                              <input type="hidden" name="vehicleId" value={vehicle.id} />
                              <input type="hidden" name="taskId" value={task.id} />
                              <button type="submit" className="button button--ghost">
                                Mark complete
                              </button>
                            </form>
                          ) : null}
                          <form action={deleteMaintenanceTaskAction}>
                            <input type="hidden" name="vehicleId" value={vehicle.id} />
                            <input type="hidden" name="taskId" value={task.id} />
                            <button type="submit" className="button button--ghost">
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No maintenance tasks yet.</p>
              )}
            </div>

            <div className="card">
              <span className="eyebrow">Parts</span>
              <h2>Accessory and part search</h2>
              <form action={searchVehiclePartsAction} className="vehicle-form maintenance-form">
                <input type="hidden" name="vehicleId" value={vehicle.id} />
                <div className="form-grid">
                  <label className="field field--wide">
                    <span>Search query</span>
                    <input
                      name="query"
                      placeholder={`floor mats, oil filter, phone mount, roof rack for ${vehicle.make} ${vehicle.model}`}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Marketplace</span>
                    <select name="marketplace" defaultValue="all">
                      <option value="all">Amazon + eBay</option>
                      <option value="amazon">Amazon only</option>
                      <option value="ebay">eBay only</option>
                    </select>
                  </label>
                </div>
                <div className="form-actions">
                  <button type="submit" className="button button--primary">
                    Search marketplace
                  </button>
                </div>
              </form>

              {vehicle.parts.length > 0 ? (
                <div className="stack">
                  {vehicle.parts.map((part) => (
                    <a key={part.id} href={part.url} className="task-row" target="_blank" rel="noreferrer">
                      <div>
                        <strong>{part.title}</strong>
                        <p>
                          {part.marketplace} · Fitment {part.fitmentConfidence} · Query {part.query}
                        </p>
                      </div>
                      <div className="task-row__meta">
                        <span className="status-pill status-live">
                          {part.priceUsd > 0 ? `$${part.priceUsd}` : "Open search"}
                        </span>
                        <small>{part.primeEligible ? "Prime / fast ship" : "Marketplace listing"}</small>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No parts or accessory results yet.</p>
              )}
            </div>
          </div>
        </div>

        <aside className="detail-layout__side">
          <div className="card detail-panel">
            <span className="eyebrow">Snapshot</span>
            <h2>Vehicle summary</h2>
            <div className="detail-summary-list">
              <div>
                <span>Status</span>
                <strong>{ownershipLabel}</strong>
              </div>
              <div>
                <span>Nickname</span>
                <strong>{vehicle.nickname}</strong>
              </div>
              <div>
                <span>Powertrain</span>
                <strong>{vehicle.powertrain.toUpperCase()}</strong>
              </div>
              <div>
                <span>Alerts</span>
                <strong>{vehicle.ownershipStatus === "own" ? vehicle.alerts.length : 0}</strong>
              </div>
              <div>
                <span>Marketplace results</span>
                <strong>{vehicle.parts.length}</strong>
              </div>
            </div>
          </div>

          <div className="card detail-panel">
            <span className="eyebrow">Quick actions</span>
            <h2>Manage this vehicle</h2>
            <div className="detail-panel__actions">
              <form action={refreshVehicleValuationAction}>
                <input type="hidden" name="vehicleId" value={vehicle.id} />
                <button type="submit" className="button button--primary">
                  Refresh valuation
                </button>
              </form>
              <Link href={`/vehicles/${vehicle.id}/edit`} className="button button--ghost">
                Edit vehicle profile
              </Link>
              <DeleteVehicleButton action={deleteVehicleAction} vehicleId={vehicle.id} />
            </div>
          </div>

          <div className="card detail-panel">
            <span className="eyebrow">Garage navigation</span>
            <h2>Jump to another vehicle</h2>
            <div className="detail-nav-stack">
              {fleetVehicles.map((fleetVehicle) => (
                <Link
                  key={fleetVehicle.id}
                  href={`/vehicles/${fleetVehicle.id}`}
                  className={`detail-nav-inline ${fleetVehicle.id === vehicle.id ? "detail-nav-inline--active" : ""}`}
                >
                  <div>
                    <strong>
                      {fleetVehicle.year} {fleetVehicle.make} {fleetVehicle.model}
                    </strong>
                    <small>{fleetVehicle.nickname}</small>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
