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
import { getVehicleResearch } from "@/lib/research";
import { getWatchOpportunity } from "@/lib/watchlist";

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

  const research = await getVehicleResearch(vehicle);

  const latestValue = vehicle.valuationHistory[vehicle.valuationHistory.length - 1];
  const dueTasks = vehicle.maintenance.filter((task) => task.status === "due" || task.status === "overdue").length;
  const latestAlert = vehicle.alerts[0] ?? null;
  const isWatching = vehicle.ownershipStatus === "watching";
  const watchOpportunity = isWatching ? getWatchOpportunity(vehicle) : null;
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
            <span>{isWatching ? "Price gap" : "Odometer"}</span>
            <strong>
              {isWatching
                ? watchOpportunity?.price.label ?? "No price target"
                : `${vehicle.telemetry.odometerMiles.toLocaleString()} mi`}
            </strong>
          </div>
          <div>
            <span>{isWatching ? "Mileage gap" : "Energy level"}</span>
            <strong>
              {isWatching
                ? watchOpportunity?.mileage.label ?? "No mileage target"
                : `${vehicle.telemetry.batteryOrFuelPercent}%`}
            </strong>
          </div>
          <div>
            <span>{isWatching ? "Decision read" : "Service due"}</span>
            <strong>{isWatching ? watchOpportunity?.summary ?? "Set targets" : dueTasks}</strong>
          </div>
        </div>
      </section>

      <section className="detail-layout">
        <div className="detail-layout__main">
          <div className="detail-grid">
            {isWatching ? (
              <div className="card">
                <span className="eyebrow">Watch targets</span>
                <h2>Acquisition fit</h2>
                <ul className="detail-list">
                  <li>
                    Target price:{" "}
                    {vehicle.targetPriceUsd ? `$${vehicle.targetPriceUsd.toLocaleString()}` : "Not set"}
                  </li>
                  <li>
                    Target mileage:{" "}
                    {vehicle.targetMileage ? `${vehicle.targetMileage.toLocaleString()} mi` : "Not set"}
                  </li>
                  <li>Current listing mileage: {vehicle.telemetry.odometerMiles.toLocaleString()} mi</li>
                  <li>{watchOpportunity?.price.label ?? "Set a target price to track market movement."}</li>
                  <li>{watchOpportunity?.mileage.label ?? "Set a target mileage to screen cleaner examples."}</li>
                </ul>
              </div>
            ) : (
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
            )}

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
              {isWatching ? (
                <>
                  <span className="eyebrow">Acquisition plan</span>
                  <h2>What to confirm before buying</h2>
                  <div className="stack">
                    <div className="task-row">
                      <div>
                        <strong>Source listing</strong>
                        <p>{vehicle.sourceUrl ? "Primary listing saved for follow-up." : "No source listing saved yet."}</p>
                      </div>
                      <div className="task-row__meta">
                        {vehicle.sourceUrl ? (
                          <a href={vehicle.sourceUrl} target="_blank" rel="noreferrer" className="button button--ghost">
                            Open listing
                          </a>
                        ) : (
                          <span className="status-pill status-upcoming">Add source URL</span>
                        )}
                      </div>
                    </div>
                    <div className="task-row">
                      <div>
                        <strong>Market read</strong>
                        <p>{watchOpportunity?.summary ?? "Refresh valuation to compare against your targets."}</p>
                      </div>
                      <div className="task-row__meta">
                        <span
                          className={`status-pill ${
                            watchOpportunity?.price.tone === "positive"
                              ? "status-live"
                              : watchOpportunity?.price.tone === "negative"
                                ? "status-due"
                                : "status-upcoming"
                          }`}
                        >
                          {watchOpportunity?.price.tone === "positive"
                            ? "In range"
                            : watchOpportunity?.price.tone === "negative"
                              ? "Over target"
                              : "Watch closely"}
                        </span>
                      </div>
                    </div>
                    <div className="task-row">
                      <div>
                        <strong>Watch notes</strong>
                        <p>{vehicle.watchNotes || "Add seller notes, condition notes, or why this vehicle matters."}</p>
                      </div>
                      <div className="task-row__meta">
                        <Link href={`/vehicles/${vehicle.id}/edit`} className="button button--ghost">
                          Update notes
                        </Link>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>

            <div className="card">
              <span className="eyebrow">{isWatching ? "Research" : "Parts"}</span>
              <h2>{isWatching ? "Search listings, parts, and accessories" : "Accessory and part search"}</h2>
              <form action={searchVehiclePartsAction} className="vehicle-form maintenance-form">
                <input type="hidden" name="vehicleId" value={vehicle.id} />
                <div className="form-grid">
                  <label className="field field--wide">
                    <span>Search query</span>
                    <input
                      name="query"
                      placeholder={
                        isWatching
                          ? `dealer listing, bed cover, charging cable, floor mats for ${vehicle.make} ${vehicle.model}`
                          : `floor mats, oil filter, phone mount, roof rack for ${vehicle.make} ${vehicle.model}`
                      }
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

            <div className="card">
              <span className="eyebrow">Research</span>
              <h2>History, issues, and reviews</h2>
              <div className="stack">
                <div className="task-row">
                  <div>
                    <strong>NHTSA recall history</strong>
                    <p>
                      {research.recallCount > 0
                        ? `${research.recallCount} recall record${research.recallCount === 1 ? "" : "s"} found for this year, make, and model.`
                        : "No recall records found from the current NHTSA lookup."}
                    </p>
                    {research.commonIssueThemes.length > 0 ? (
                      <p className="task-row__detail">
                        Common issue themes: {research.commonIssueThemes.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="task-row__meta">
                    <a
                      href={`https://www.nhtsa.gov/recalls?search=${encodeURIComponent(`${vehicle.year} ${vehicle.make} ${vehicle.model}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="button button--ghost"
                    >
                      Open NHTSA
                    </a>
                  </div>
                </div>

                {research.recentRecalls.length > 0 ? (
                  <div className="stack">
                    {research.recentRecalls.map((recall) => (
                      <div
                        key={`${recall.nhtsaCampaignNumber ?? "recall"}-${recall.reportReceivedDate ?? ""}`}
                        className="task-row"
                      >
                        <div>
                          <strong>{recall.component ?? "Vehicle safety issue"}</strong>
                          <p>{recall.summary ?? "Summary unavailable"}</p>
                          {recall.consequence ? (
                            <p className="task-row__detail">Consequence: {recall.consequence}</p>
                          ) : null}
                        </div>
                        <div className="task-row__meta">
                          <span className="status-pill status-due">
                            {recall.reportReceivedDate ?? "Undated"}
                          </span>
                          {recall.nhtsaCampaignNumber ? <small>Campaign {recall.nhtsaCampaignNumber}</small> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="task-row">
                  <div>
                    <strong>Expert reviews</strong>
                    <p>Three high-traffic review sources to sanity-check ownership experience and market opinion.</p>
                  </div>
                  <div className="research-links">
                    {research.reviewLinks.map((link) => (
                      <a
                        key={link.label}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="button button--ghost"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <span className="eyebrow">Video research</span>
              <h2>Matched video reviews and walkarounds</h2>
              {research.videos.length > 0 ? (
                <div className="stack">
                  {research.videos.map((video) => (
                    <a key={video.url} href={video.url} target="_blank" rel="noreferrer" className="research-video-card">
                      {video.thumbnailUrl ? (
                        <div
                          className="research-video-card__thumb"
                          style={{ backgroundImage: `url(${video.thumbnailUrl})` }}
                        />
                      ) : null}
                      <div className="research-video-card__body">
                        <strong>{video.title}</strong>
                        <p>{video.source}</p>
                      </div>
                      <div className="task-row__meta">
                        <span className="status-pill status-live">{video.publishedAt || "Matched"}</span>
                        <small>Open on YouTube</small>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="empty-state">
                  No recent feed videos matched this vehicle. Older reviews can still exist on the source channels.
                </p>
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
                <span>{isWatching ? "Target fit" : "Alerts"}</span>
                <strong>
                  {isWatching
                    ? watchOpportunity?.summary ?? "Set targets"
                    : vehicle.ownershipStatus === "own"
                      ? vehicle.alerts.length
                      : 0}
                </strong>
              </div>
              <div>
                <span>Marketplace results</span>
                <strong>{vehicle.parts.length}</strong>
              </div>
              {vehicle.targetPriceUsd ? (
                <div>
                  <span>Target price</span>
                  <strong>${vehicle.targetPriceUsd.toLocaleString()}</strong>
                </div>
              ) : null}
              {vehicle.targetMileage ? (
                <div>
                  <span>Target mileage</span>
                  <strong>{vehicle.targetMileage.toLocaleString()} mi</strong>
                </div>
              ) : null}
            </div>
            {vehicle.watchNotes ? <p className="helper-text">{vehicle.watchNotes}</p> : null}
            {vehicle.sourceUrl ? (
              <a href={vehicle.sourceUrl} target="_blank" rel="noreferrer" className="button button--ghost">
                Open source listing
              </a>
            ) : null}
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
