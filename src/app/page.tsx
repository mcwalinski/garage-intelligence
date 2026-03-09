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

  const summary = await getDashboardSummary(userId);
  const smartcar = await getSmartcarSummaryForUser(userId);
  const notifications = await getNotificationCenterForUser(userId, userEmail);
  const videoFeed = await getHomepageVideoFeed();
  const watchingVehicles = sortWatchingVehicles(
    summary.vehicles.filter((vehicle) => vehicle.ownershipStatus === "watching")
  ).slice(0, 3);
  const firstConnectionId = smartcar.connectedVehicles[0]?.connectionId ?? null;

  return (
    <main className="page-shell">
      <section className="sticky-topbar card">
        <div className="sticky-topbar__brand">
          <span className="eyebrow">Garage Intelligence</span>
          <strong>Vehicle control center</strong>
          <small>{userEmail ? `Signed in as ${userEmail}` : "Sign in to unlock sync, alerts, and saved vehicles"}</small>
        </div>

        <div className="sticky-topbar__nav">
          <a href="#fleet" className="button button--ghost">
            Browse
          </a>
          <Link href="/login" className="button button--ghost">
            {userEmail ? "Account" : "Sign in"}
          </Link>
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
        </div>
      </section>

      <section className="home-intro">
        <div>
          <span className="eyebrow">Garage</span>
          <h1>Navigate every vehicle from one place.</h1>
        </div>
        <p>
          Browse current vehicles, historical records, and watchlist candidates without losing the
          garage view.
        </p>
      </section>

      <section className="stats-grid stats-grid--compact">
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
      </section>

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

      {watchingVehicles.length > 0 ? (
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
                        opportunity.price.tone === "positive"
                          ? "status-live"
                          : opportunity.price.tone === "negative"
                            ? "status-due"
                            : "status-upcoming"
                      }`}
                    >
                      {opportunity.price.tone === "positive"
                        ? "Price in range"
                        : opportunity.price.tone === "negative"
                          ? "Above target"
                          : "Watch closely"}
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
    </main>
  );
}
