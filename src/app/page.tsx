import Link from "next/link";
import { syncSmartcarConnectionAction } from "@/app/integrations/smartcar/actions";
import { AddVehicleForm } from "@/components/add-vehicle-form";
import { GarageBulkDeleteForm } from "@/components/garage-bulk-delete-form";
import { HomeVideoFeed } from "@/components/home-video-feed";
import { NotificationCenterCard } from "@/components/notification-center-card";
import { SmartcarCard } from "@/components/smartcar-card";
import { StatCard } from "@/components/stat-card";
import { ValuationRefreshCard } from "@/components/valuation-refresh-card";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getDashboardSummary,
  getNotificationCenterForUser,
  getSmartcarSummaryForUser
} from "@/lib/dashboard";
import { getHomepageVideoFeed } from "@/lib/research";
import { getWatchOpportunity, sortWatchingVehicles } from "@/lib/watchlist";

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ formError?: string }>;
}) {
  const params = await searchParams;
  const user = await getAuthenticatedUser();
  const userEmail = user?.email ?? null;
  const userId = user?.id ?? null;
  const isAuthenticated = Boolean(userId);

  const summary = isAuthenticated ? await getDashboardSummary(userId) : null;
  const smartcar = isAuthenticated ? await getSmartcarSummaryForUser(userId) : null;
  const notifications = isAuthenticated ? await getNotificationCenterForUser(userId, userEmail) : null;
  const videoFeed = await getHomepageVideoFeed();
  const watchingVehicles = isAuthenticated
    ? sortWatchingVehicles(
        (summary?.vehicles ?? []).filter((vehicle) => vehicle.ownershipStatus === "watching")
      ).slice(0, 3)
    : [];
  const firstConnectionId = smartcar?.connectedVehicles[0]?.connectionId ?? null;

  return (
    <main className="page-shell">
      <section className="sticky-topbar card">
        <div className="sticky-topbar__brand">
          <span className="eyebrow">Garage Intelligence</span>
          <strong>{isAuthenticated ? "Vehicle control center" : "Vehicle ownership, archive, and watchlist"}</strong>
          <small>
            {userEmail
              ? `Signed in as ${userEmail}`
              : "Track vehicles you own, archive the ones you sold, and research the ones you want next."}
          </small>
        </div>

        <div className="sticky-topbar__nav">
          <a href={isAuthenticated ? "#fleet" : "#overview"} className="button button--ghost">
            {isAuthenticated ? "Browse" : "Overview"}
          </a>
          <Link href="/login" className="button button--ghost">
            {userEmail ? "Account" : "Sign in"}
          </Link>
          {isAuthenticated ? (
            <>
              <a href="#add-vehicle" className="button button--primary">
                Add
              </a>
              <a href="#telemetry" className="button button--ghost">
                Connect
              </a>
              {firstConnectionId && userId ? (
                <form action={syncSmartcarConnectionAction}>
                  <input type="hidden" name="connectionId" value={firstConnectionId} />
                  <button type="submit" className="button button--ghost">
                    Sync
                  </button>
                </form>
              ) : (
                <a href="#telemetry" className="button button--ghost">
                  Sync
                </a>
              )}
            </>
          ) : (
            <a href="#public-cta" className="button button--primary">
              Get started
            </a>
          )}
        </div>
      </section>

      <section className="home-intro">
        <span className="eyebrow">{isAuthenticated ? "Garage" : "Platform"}</span>
        <h1>
          {isAuthenticated
            ? "Navigate every vehicle from one place."
            : "Track the vehicles you own, remember the ones you had, and watch the ones you want."}
        </h1>
        <p>
          {isAuthenticated
            ? "Browse current vehicles, historical records, and watchlist candidates without losing the garage view."
            : "Garage Intelligence combines telemetry, market value, maintenance, research, and parts discovery into one vehicle-first workspace."}
        </p>
      </section>

      <section className="stats-grid stats-grid--compact">
        {isAuthenticated && summary ? (
          <>
            <StatCard
              label="Maintenance Due"
              value={summary.dueTasks.toString()}
              helper="Rules-based tasks that need attention now"
            />
            <StatCard
              label="Active Alerts"
              value={summary.activeAlerts.toString()}
              helper="Movement, charging, and service reminders ready for notifications"
            />
            <StatCard
              label="Watchlist"
              value={summary.watchingCount.toString()}
              helper="Vehicles being tracked toward your buy targets"
            />
            <StatCard
              label="Current Fleet"
              value={summary.ownedNowCount.toString()}
              helper={`Owned ${summary.ownedBeforeCount} archived · $${summary.totalValue.toLocaleString()} tracked value`}
            />
          </>
        ) : (
          <>
            <StatCard label="Own" value="Live" helper="Telemetry, maintenance, alerts, valuation, and parts for active vehicles" />
            <StatCard label="Owned" value="Archive" helper="Keep past vehicles, service history, and ownership context in one record" />
            <StatCard label="Watching" value="Target" helper="Track price and mileage goals on future vehicles before you buy" />
            <StatCard label="Research" value="Built in" helper="Reviews, recalls, videos, comps, and marketplace search from one home base" />
          </>
        )}
      </section>

      {isAuthenticated && summary ? (
        <section className="section-block">
          <section id="fleet">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Garage</span>
                <h2>Browse your vehicles</h2>
              </div>
              <p>Move between current, past, and future vehicles from one inventory surface.</p>
            </div>
            {summary.vehicles.length > 0 ? (
              <GarageBulkDeleteForm vehicles={summary.vehicles} disabled={!userId} allowBulkDelete={false} />
            ) : (
              <div className="card empty-panel">
                <p className="empty-state">No vehicles in this garage yet. Add your first vehicle below.</p>
              </div>
            )}
          </section>
        </section>
      ) : (
        <section className="section-block" id="overview">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Overview</span>
              <h2>Built around the full vehicle lifecycle</h2>
            </div>
            <p>Use one platform for active ownership, archived vehicles, and future targets instead of splitting those jobs across different tools.</p>
          </div>
          <div className="public-feature-grid">
            <article className="card">
              <span className="eyebrow">Own</span>
              <h3>Operate your current garage</h3>
              <p>See telemetry, maintenance, alerts, valuation, and parts search from the same vehicle detail page.</p>
            </article>
            <article className="card">
              <span className="eyebrow">Owned</span>
              <h3>Keep a real archive</h3>
              <p>Store old vehicles with lifecycle dates, pricing, service history, notes, and reference research.</p>
            </article>
            <article className="card">
              <span className="eyebrow">Watching</span>
              <h3>Track what comes next</h3>
              <p>Set price and mileage targets, save source listings, and research likely candidates before you buy.</p>
            </article>
          </div>
        </section>
      )}

      {isAuthenticated && watchingVehicles.length > 0 ? (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Watching</span>
              <h2>Watchlist opportunities</h2>
            </div>
            <p>Track the watched vehicles that are closest to your target price and mileage first.</p>
          </div>
          <div className="watchlist-grid">
            {watchingVehicles.map((vehicle) => {
              const opportunity = getWatchOpportunity(vehicle);

              return (
                <Link key={vehicle.id} href={`/vehicles/${vehicle.id}`} className="card watch-card">
                  <div className="watch-card__header">
                    <div>
                      <span className="eyebrow">{vehicle.nickname}</span>
                      <h3>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </h3>
                    </div>
                    <span
                      className={`status-pill ${
                        opportunity.badge === "strong"
                          ? "status-live"
                          : opportunity.badge === "monitor"
                            ? "status-due"
                            : "status-upcoming"
                      }`}
                    >
                      {opportunity.badge === "strong"
                        ? "Strong match"
                        : opportunity.badge === "close"
                          ? "Close to target"
                          : opportunity.badge === "monitor"
                            ? "Monitor"
                            : "Set targets"}
                    </span>
                  </div>
                  <div className="watch-card__metrics">
                    <div>
                      <span>Market value</span>
                      <strong>
                        {opportunity.latestValue ? `$${opportunity.latestValue.toLocaleString()}` : "Pending"}
                      </strong>
                    </div>
                    <div>
                      <span>Price target</span>
                      <strong>
                        {vehicle.targetPriceUsd ? `$${vehicle.targetPriceUsd.toLocaleString()}` : "Not set"}
                      </strong>
                    </div>
                    <div>
                      <span>Mileage target</span>
                      <strong>
                        {vehicle.targetMileage ? `${vehicle.targetMileage.toLocaleString()} mi` : "Not set"}
                      </strong>
                    </div>
                  </div>
                  <div className="watch-card__notes">
                    <p>{opportunity.summary}</p>
                    <small>
                      {opportunity.price.label}
                      {vehicle.targetMileage ? ` · ${opportunity.mileage.label}` : ""}
                    </small>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <HomeVideoFeed channels={videoFeed.channels} videos={videoFeed.videos} />

      {isAuthenticated && smartcar && notifications ? (
        <section className="section-block" id="operations">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Operations</span>
              <h2>Keep the garage moving</h2>
            </div>
            <p>Add vehicles, connect telemetry, refresh valuation data, and manage alerts in one place.</p>
          </div>
          <div className="home-actions-grid">
            <section id="add-vehicle">
              <AddVehicleForm disabled={!userId} error={params.formError} />
            </section>
            <section id="telemetry">
              <SmartcarCard
                connectionCount={smartcar.connectionCount}
                linkedCount={smartcar.linkedCount}
                freshVehicleCount={smartcar.freshVehicleCount}
                lastSyncedAt={smartcar.lastSyncedAt}
                lastSyncStatus={smartcar.lastSyncStatus}
                lastSyncError={smartcar.lastSyncError}
                connectedVehicles={smartcar.connectedVehicles}
                garageVehicles={smartcar.garageVehicles ?? []}
                disabled={!userId}
              />
            </section>
            <ValuationRefreshCard disabled={!userId} />
            <NotificationCenterCard
              disabled={!userId}
              preferences={notifications.preferences}
              alerts={notifications.alerts}
              recentDeliveries={notifications.recentDeliveries}
            />
          </div>
        </section>
      ) : (
        <section className="section-block" id="public-cta">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Get started</span>
              <h2>Sign in to create your garage</h2>
            </div>
            <p>Once signed in, you can add vehicles, connect Smartcar where supported, refresh valuations, and build your own archive and watchlist.</p>
          </div>
          <div className="public-cta-grid">
            <article className="card">
              <h3>Create your garage</h3>
              <p>Start with current vehicles, then add historical records and future targets as your garage evolves.</p>
              <Link href="/login" className="button button--primary">Continue with Google</Link>
            </article>
            <article className="card">
              <h3>What unlocks after sign-in</h3>
              <ul className="detail-list">
                <li>VIN-first intake and saved vehicles</li>
                <li>Smartcar account connection and sync</li>
                <li>Market value tracking and watch targets</li>
                <li>Maintenance alerts, research, and marketplace search</li>
              </ul>
            </article>
          </div>
        </section>
      )}
    </main>
  );
}
