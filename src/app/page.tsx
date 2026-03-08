import Link from "next/link";
import { AddVehicleForm } from "@/components/add-vehicle-form";
import { GarageBulkDeleteForm } from "@/components/garage-bulk-delete-form";
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

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero__content">
          <span className="eyebrow">Garage Intelligence</span>
          <h1>Browse, track, and manage every vehicle in one clean garage view.</h1>
          <p>
            Built for navigating vehicles first, then layering in live status, value movement,
            service planning, and parts sourcing without losing the inventory view.
          </p>
          <div className="hero__actions">
            <Link href="/api/dashboard" className="button button--primary">
              View API payload
            </Link>
            <Link href="/login" className="button button--ghost">
              {userEmail ? `Signed in as ${userEmail}` : "Sign in with Google"}
            </Link>
            <a href="#fleet" className="button button--ghost">
              Browse garage
            </a>
          </div>
        </div>
        <div className="hero__aside card">
          <span className="eyebrow">Start Here</span>
          <div className="hero__mini-actions">
            <div className="hero__mini-card">
              <strong>Add a vehicle</strong>
              <p>Decode the VIN and get the garage record live first.</p>
            </div>
            <div className="hero__mini-card">
              <strong>Connect telemetry</strong>
              <p>Link supported vehicles for odometer, battery, fuel, and movement data.</p>
            </div>
            <div className="hero__mini-card">
              <strong>Search parts</strong>
              <p>Run Amazon and eBay searches from each vehicle detail page.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          label="Fleet Value"
          value={`$${summary.totalValue.toLocaleString()}`}
          helper="Latest normalized market estimate across all tracked vehicles"
        />
        <StatCard
          label="Tracked Vehicles"
          value={summary.totalVehicles.toString()}
          helper={`Own ${summary.ownedNowCount} · Owned ${summary.ownedBeforeCount} · Watching ${summary.watchingCount}`}
        />
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
      </section>

      <section className="section-block home-split">
        <div className="home-split__main">
          <section id="fleet">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Garage</span>
                <h2>Browse your vehicles</h2>
              </div>
              <p>
                Every card is built to navigate quickly between vehicles, then drill into service,
                market, and parts detail.
              </p>
            </div>
            {summary.vehicles.length > 0 ? (
              <GarageBulkDeleteForm vehicles={summary.vehicles} disabled={!userId} />
            ) : (
              <div className="card empty-panel">
                <p className="empty-state">No vehicles in this garage yet. Add your first vehicle from the action center.</p>
              </div>
            )}
          </section>

          <NotificationCenterCard
            disabled={!userId}
            preferences={notifications.preferences}
            alerts={notifications.alerts}
            recentDeliveries={notifications.recentDeliveries}
          />
        </div>

        <aside className="home-split__side">
          <div className="section-heading section-heading--stacked">
            <div>
              <span className="eyebrow">Actions</span>
              <h2>Garage action center</h2>
            </div>
            <p>Connection, intake, and refresh controls live here so browsing and operations stay separate.</p>
          </div>
          <AddVehicleForm disabled={!userId} error={params.formError} />
          <SmartcarCard
            connectionCount={smartcar.connectionCount}
            connectedVehicles={smartcar.connectedVehicles}
            garageVehicles={smartcar.garageVehicles ?? []}
            disabled={!userId}
          />
          <ValuationRefreshCard disabled={!userId} />
        </aside>
      </section>
    </main>
  );
}
