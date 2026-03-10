import { demoGarageName, demoVehicles } from "@/lib/demo-seed";
import { vehicles as fallbackVehicles } from "@/lib/data";
import { MarketplaceSelection, searchMarketplaceListings } from "@/lib/marketplaces";
import { fetchMarketCheckHistoryEstimate } from "@/lib/marketcheck";
import { sendEmailNotification } from "@/lib/notifications";
import {
  fetchSmartcarBattery,
  fetchSmartcarFuel,
  fetchSmartcarLocation,
  fetchSmartcarOdometer
} from "@/lib/smartcar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Vehicle } from "@/lib/types";

interface CreateVehicleInput {
  ownershipStatus: Vehicle["ownershipStatus"];
  nickname: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  vin: string;
  powertrain: Vehicle["powertrain"];
  image?: string;
  sourceUrl?: string;
  watchNotes?: string;
  lifecycleNotes?: string;
  acquisitionDate?: string | null;
  dispositionDate?: string | null;
  purchasePriceUsd?: number | null;
  salePriceUsd?: number | null;
  targetPriceUsd?: number | null;
  targetMileage?: number | null;
}

interface CreateMaintenanceTaskInput {
  title: string;
  category: Vehicle["maintenance"][number]["category"];
  dueDate: string;
  dueMileage: number | null;
  estimatedCostUsd: number;
  providerRecommendation: string;
  notes?: string;
  recurrenceMiles?: number | null;
  recurrenceDays?: number | null;
  canScheduleOnline?: boolean;
}

async function assertVehicleAccess(userId: string, vehicleSlug: string) {
  const supabase = createSupabaseAdminClient();
  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("id, slug, garage_id, image, vin, ownership_status")
    .eq("slug", vehicleSlug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!vehicle) {
    throw new Error("Vehicle not found");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("garage_memberships")
    .select("garage_id")
    .eq("user_id", userId)
    .eq("garage_id", vehicle.garage_id)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (!membership) {
    throw new Error("You do not have access to this vehicle");
  }

  return vehicle;
}

async function getLatestOdometerMiles(vehicleId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("telemetry_snapshots")
    .select("odometer_miles")
    .eq("vehicle_id", vehicleId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.odometer_miles ?? 0;
}

interface VehicleRow {
  id: string;
  slug: string;
  ownership_status: Vehicle["ownershipStatus"];
  nickname: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  vin: string;
  powertrain: Vehicle["powertrain"];
  image: string;
  source_url?: string | null;
  watch_notes?: string | null;
  lifecycle_notes?: string | null;
  acquisition_date?: string | null;
  disposition_date?: string | null;
  purchase_price_usd?: number | null;
  sale_price_usd?: number | null;
  target_price_usd?: number | null;
  target_mileage?: number | null;
}

interface TelemetryRow {
  vehicle_id: string;
  captured_at: string;
  odometer_miles: number;
  battery_or_fuel_percent: number;
  latitude: number;
  longitude: number;
  speed_mph: number;
  ignition_on: boolean;
  source: string;
}

interface ValuationRow {
  vehicle_id: string;
  captured_at: string;
  market_value_usd: number;
  change_usd: number;
  change_percent: number;
  confidence: "low" | "medium" | "high";
  source: string;
  comparable_count?: number | null;
  last_seen_at?: string | null;
}

interface MaintenanceRow {
  vehicle_id: string;
  external_id: string;
  title: string;
  category: Vehicle["maintenance"][number]["category"];
  status: "upcoming" | "due" | "overdue" | "scheduled";
  due_date: string;
  due_mileage: number | null;
  estimated_cost_usd: number;
  provider_recommendation: string;
  can_schedule_online: boolean;
  notes?: string | null;
  recurrence_miles?: number | null;
  recurrence_days?: number | null;
  completed_at?: string | null;
  completed_mileage?: number | null;
  auto_generated?: boolean;
}

interface AlertRow {
  vehicle_id: string;
  external_id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  created_at: string;
  channel_suggestions: string[];
}

interface PartListingRow {
  vehicle_id: string;
  external_id: string;
  query: string;
  title: string;
  marketplace: string;
  price_usd: number;
  prime_eligible: boolean;
  fitment_confidence: "low" | "medium" | "high";
  url: string;
}

interface NotificationPreferencesRow {
  user_id: string;
  delivery_email: string | null;
  phone_number: string | null;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  maintenance_due_enabled: boolean;
  maintenance_due_soon_enabled: boolean;
  weekly_digest_enabled: boolean;
}

interface NotificationDeliveryRow {
  alert_id: string;
  user_id: string;
  channel: "email" | "sms" | "push";
  status: "pending" | "sent" | "skipped" | "failed";
  provider_message_id: string | null;
  error_message: string | null;
  delivered_at: string | null;
  created_at: string;
}

function canUseDatabase() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function maintenanceAlertExternalId(vehicleSlug: string, taskId: string, status: string) {
  return `maintenance:${vehicleSlug}:${taskId}:${status}`;
}

function diffInDays(dateString: string) {
  const target = new Date(`${dateString}T00:00:00Z`);
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return Math.round((target.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000));
}

async function ensureDemoGarageForUser(userId: string) {
  if (!canUseDatabase()) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { data: membership } = await supabase
    .from("garage_memberships")
    .select("garage_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  let garageId = membership?.garage_id;

  if (!garageId) {
    const { data: garage, error: garageError } = await supabase
      .from("garages")
      .insert({
        name: demoGarageName
      })
      .select("id")
      .single();

    if (garageError || !garage) {
      throw garageError ?? new Error("Failed to create garage");
    }

    garageId = garage.id;

    const { error: membershipError } = await supabase.from("garage_memberships").insert({
      garage_id: garageId,
      user_id: userId,
      role: "owner"
    });

    if (membershipError) {
      throw membershipError;
    }
  }

  const { count, error: countError } = await supabase
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("garage_id", garageId);

  if (countError) {
    throw countError;
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const vehicleRows = demoVehicles.map((vehicle) => ({
    garage_id: garageId,
    slug: `${userId.slice(0, 8)}-${vehicle.id}`,
    ownership_status: vehicle.ownershipStatus,
    nickname: vehicle.nickname,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim,
    vin: vehicle.vin,
    powertrain: vehicle.powertrain,
    image: vehicle.image,
    source_url: vehicle.sourceUrl ?? null,
    watch_notes: vehicle.watchNotes ?? null,
    target_price_usd: vehicle.targetPriceUsd ?? null,
    target_mileage: vehicle.targetMileage ?? null
  }));

  const { data: insertedVehicles, error: vehicleError } = await supabase
    .from("vehicles")
    .insert(vehicleRows)
    .select("id, slug");

  if (vehicleError || !insertedVehicles) {
    throw vehicleError ?? new Error("Failed to insert vehicles");
  }

  const vehicleIdsBySlug = new Map(insertedVehicles.map((vehicle) => [vehicle.slug, vehicle.id]));

  const telemetryRows = demoVehicles.map((vehicle) => ({
    vehicle_id: vehicleIdsBySlug.get(vehicle.id),
    captured_at: vehicle.telemetry.capturedAt,
    odometer_miles: vehicle.telemetry.odometerMiles,
    battery_or_fuel_percent: vehicle.telemetry.batteryOrFuelPercent,
    latitude: vehicle.telemetry.latitude,
    longitude: vehicle.telemetry.longitude,
    speed_mph: vehicle.telemetry.speedMph,
    ignition_on: vehicle.telemetry.ignitionOn,
    source: vehicle.telemetry.source
  }));

  const valuationRows = demoVehicles.flatMap((vehicle) =>
    vehicle.valuationHistory.map((point) => ({
      vehicle_id: vehicleIdsBySlug.get(vehicle.id),
      captured_at: point.capturedAt,
      market_value_usd: point.marketValueUsd,
      change_usd: point.changeUsd,
      change_percent: point.changePercent,
      confidence: point.confidence,
      source: point.source
    }))
  );

  const maintenanceRows = demoVehicles.flatMap((vehicle) =>
    vehicle.maintenance.map((task) => ({
      vehicle_id: vehicleIdsBySlug.get(vehicle.id),
      external_id: task.id,
      title: task.title,
      category: task.category,
      status: task.status,
      due_date: task.dueDate,
      due_mileage: task.dueMileage,
      estimated_cost_usd: task.estimatedCostUsd,
      provider_recommendation: task.providerRecommendation,
      can_schedule_online: task.canScheduleOnline,
      notes: task.notes ?? null,
      recurrence_miles: task.recurrenceMiles ?? null,
      recurrence_days: task.recurrenceDays ?? null,
      completed_at: task.completedAt ?? null,
      completed_mileage: task.completedMileage ?? null,
      auto_generated: task.autoGenerated ?? false
    }))
  );

  const alertRows = demoVehicles.flatMap((vehicle) =>
    vehicle.alerts.map((alert) => ({
      vehicle_id: vehicleIdsBySlug.get(vehicle.id),
      external_id: alert.id,
      title: alert.title,
      body: alert.body,
      severity: alert.severity,
      created_at: alert.createdAt,
      channel_suggestions: alert.channelSuggestions
    }))
  );

  const partRows = demoVehicles.flatMap((vehicle) =>
    vehicle.parts.map((part) => ({
      vehicle_id: vehicleIdsBySlug.get(vehicle.id),
      external_id: part.id,
      query: part.query,
      title: part.title,
      marketplace: part.marketplace,
      price_usd: part.priceUsd,
      prime_eligible: part.primeEligible,
      fitment_confidence: part.fitmentConfidence,
      url: part.url
    }))
  );

  await Promise.all([
    supabase.from("telemetry_snapshots").insert(telemetryRows),
    supabase.from("valuation_points").insert(valuationRows),
    supabase.from("maintenance_tasks").insert(maintenanceRows),
    supabase.from("alerts").insert(alertRows),
    supabase.from("part_listings").insert(partRows)
  ]);
}

export async function getOrCreateGarageIdForUser(userId: string) {
  if (!canUseDatabase()) {
    return null;
  }

  await ensureDemoGarageForUser(userId);

  const supabase = createSupabaseAdminClient();
  const { data: membership, error } = await supabase
    .from("garage_memberships")
    .select("garage_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return membership?.garage_id ?? null;
}

function slugifyVehicle(input: Pick<CreateVehicleInput, "year" | "make" | "model" | "trim">) {
  return `${input.year}-${input.make}-${input.model}-${input.trim}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function deriveMaintenanceStatus(
  task: Pick<MaintenanceRow, "status" | "due_date" | "due_mileage" | "completed_at">,
  odometerMiles: number
): Vehicle["maintenance"][number]["status"] {
  if (task.completed_at || task.status === "scheduled") {
    return "scheduled";
  }

  const today = isoDate(new Date());

  if (task.due_date < today || (task.due_mileage !== null && odometerMiles > task.due_mileage)) {
    return "overdue";
  }

  if (task.due_date <= today || (task.due_mileage !== null && odometerMiles >= task.due_mileage)) {
    return "due";
  }

  return "upcoming";
}

function getDefaultMaintenanceTemplates(powertrain: Vehicle["powertrain"]) {
  const common = [
    {
      title: "Rotate tires and inspect alignment",
      category: "tires" as const,
      estimatedCostUsd: 85,
      providerRecommendation: "Every 7,500 miles",
      recurrenceMiles: 7500,
      recurrenceDays: null
    },
    {
      title: "Annual multi-point inspection",
      category: "inspection" as const,
      estimatedCostUsd: 160,
      providerRecommendation: "Every 12 months",
      recurrenceMiles: null,
      recurrenceDays: 365
    }
  ];

  if (powertrain === "ev") {
    return [
      {
        title: "Cabin air filter replacement",
        category: "filters" as const,
        estimatedCostUsd: 145,
        providerRecommendation: "Every 20,000 miles",
        recurrenceMiles: 20000,
        recurrenceDays: null
      },
      {
        title: "Brake fluid inspection",
        category: "brakes" as const,
        estimatedCostUsd: 220,
        providerRecommendation: "Annually",
        recurrenceMiles: null,
        recurrenceDays: 365
      },
      ...common
    ];
  }

  return [
    {
      title: "Synthetic oil and filter service",
      category: "engine" as const,
      estimatedCostUsd: 129,
      providerRecommendation: "6 months or 5,000 miles",
      recurrenceMiles: 5000,
      recurrenceDays: 180
    },
    {
      title: "Engine air filter inspection",
      category: "filters" as const,
      estimatedCostUsd: 70,
      providerRecommendation: "Every 15,000 miles",
      recurrenceMiles: 15000,
      recurrenceDays: null
    },
    ...common
  ];
}

async function ensureDefaultMaintenanceForVehicle(
  vehicleId: string,
  powertrain: Vehicle["powertrain"],
  odometerMiles: number
) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("maintenance_tasks")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", vehicleId);

  if (error) {
    throw error;
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const today = isoDate(new Date());
  const rows = getDefaultMaintenanceTemplates(powertrain).map((template, index) => ({
    vehicle_id: vehicleId,
    external_id: `${vehicleId}-${template.category}-${index + 1}`,
    title: template.title,
    category: template.category,
    status: "upcoming",
    due_date: template.recurrenceDays ? addDays(today, template.recurrenceDays) : addDays(today, 120),
    due_mileage: template.recurrenceMiles ? odometerMiles + template.recurrenceMiles : null,
    estimated_cost_usd: template.estimatedCostUsd,
    provider_recommendation: template.providerRecommendation,
    can_schedule_online: false,
    recurrence_miles: template.recurrenceMiles,
    recurrence_days: template.recurrenceDays,
    auto_generated: true
  }));

  const { error: insertError } = await supabase.from("maintenance_tasks").insert(rows);

  if (insertError) {
    throw insertError;
  }
}

function buildVehicleMap(
  vehicleRows: VehicleRow[],
  telemetryRows: TelemetryRow[],
  valuationRows: ValuationRow[],
  maintenanceRows: MaintenanceRow[],
  alertRows: AlertRow[],
  partRows: PartListingRow[]
) {
  return vehicleRows.map((vehicle) => {
    const latestTelemetry = telemetryRows
      .filter((row) => row.vehicle_id === vehicle.id)
      .sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];
    const odometerMiles = latestTelemetry?.odometer_miles ?? 0;

    return {
      id: vehicle.slug,
      ownershipStatus: vehicle.ownership_status,
      nickname: vehicle.nickname,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      vin: vehicle.vin,
      powertrain: vehicle.powertrain,
      image: vehicle.image,
      sourceUrl: vehicle.source_url ?? null,
      watchNotes: vehicle.watch_notes ?? null,
      lifecycleNotes: vehicle.lifecycle_notes ?? null,
      acquisitionDate: vehicle.acquisition_date ?? null,
      dispositionDate: vehicle.disposition_date ?? null,
      purchasePriceUsd:
        typeof vehicle.purchase_price_usd === "number" ? vehicle.purchase_price_usd : vehicle.purchase_price_usd ? Number(vehicle.purchase_price_usd) : null,
      salePriceUsd:
        typeof vehicle.sale_price_usd === "number" ? vehicle.sale_price_usd : vehicle.sale_price_usd ? Number(vehicle.sale_price_usd) : null,
      targetPriceUsd: vehicle.target_price_usd ?? null,
      targetMileage: vehicle.target_mileage ?? null,
      telemetry: latestTelemetry
        ? {
            capturedAt: latestTelemetry.captured_at,
            odometerMiles: latestTelemetry.odometer_miles,
            batteryOrFuelPercent: Number(latestTelemetry.battery_or_fuel_percent),
            latitude: Number(latestTelemetry.latitude),
            longitude: Number(latestTelemetry.longitude),
            speedMph: Number(latestTelemetry.speed_mph),
            ignitionOn: latestTelemetry.ignition_on,
            source: latestTelemetry.source
          }
        : {
            capturedAt: new Date(0).toISOString(),
            odometerMiles: 0,
            batteryOrFuelPercent: 0,
            latitude: 0,
            longitude: 0,
            speedMph: 0,
            ignitionOn: false,
            source: "unknown"
          },
      valuationHistory: valuationRows
        .filter((row) => row.vehicle_id === vehicle.id)
        .sort((a, b) => a.captured_at.localeCompare(b.captured_at))
        .map((row) => ({
          capturedAt: row.captured_at,
          marketValueUsd: row.market_value_usd,
          changeUsd: row.change_usd,
          changePercent: Number(row.change_percent),
          confidence: row.confidence,
          source: row.source,
          comparableCount: row.comparable_count ?? null,
          lastSeenAt: row.last_seen_at ?? null
        })),
      maintenance: maintenanceRows
        .filter((row) => row.vehicle_id === vehicle.id)
        .map((row) => ({
          id: row.external_id,
          title: row.title,
          category: row.category ?? "general",
          status: deriveMaintenanceStatus(row, odometerMiles),
          dueDate: row.due_date,
          dueMileage: row.due_mileage,
          estimatedCostUsd: row.estimated_cost_usd,
          providerRecommendation: row.provider_recommendation ?? "Owner-defined interval",
          canScheduleOnline: row.can_schedule_online,
          notes: row.notes ?? null,
          recurrenceMiles: row.recurrence_miles ?? null,
          recurrenceDays: row.recurrence_days ?? null,
          completedAt: row.completed_at ?? null,
          completedMileage: row.completed_mileage ?? null,
          autoGenerated: row.auto_generated ?? false
        }))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      alerts: alertRows
        .filter((row) => row.vehicle_id === vehicle.id)
        .map((row) => ({
          id: row.external_id,
          title: row.title,
          body: row.body,
          severity: row.severity,
          createdAt: row.created_at,
          channelSuggestions: row.channel_suggestions
        })),
      parts: partRows
        .filter((row) => row.vehicle_id === vehicle.id)
        .map((row) => ({
          id: row.external_id,
          query: row.query,
          title: row.title,
          marketplace: row.marketplace,
          priceUsd: Number(row.price_usd),
          primeEligible: row.prime_eligible,
          fitmentConfidence: row.fitment_confidence,
          url: row.url
        }))
    } satisfies Vehicle;
  });
}

async function fetchVehiclesFromDatabase(userId: string): Promise<Vehicle[]> {
  const supabase = createSupabaseAdminClient();
  const { data: memberships, error: membershipError } = await supabase
    .from("garage_memberships")
    .select("garage_id")
    .eq("user_id", userId);

  if (membershipError) {
    throw membershipError;
  }

  const garageIds = memberships?.map((membership) => membership.garage_id) ?? [];

  if (garageIds.length === 0) {
    return [];
  }

  const { data: vehicleRows, error: vehicleError } = await supabase
    .from("vehicles")
    .select(
      "id, slug, ownership_status, nickname, year, make, model, trim, vin, powertrain, image, source_url, watch_notes, lifecycle_notes, acquisition_date, disposition_date, purchase_price_usd, sale_price_usd, target_price_usd, target_mileage"
    )
    .in("garage_id", garageIds)
    .order("created_at", { ascending: true });

  if (vehicleError) {
    throw vehicleError;
  }

  const vehicleIds = vehicleRows?.map((vehicle) => vehicle.id) ?? [];

  if (vehicleIds.length === 0) {
    return [];
  }

  const { data: telemetryRows, error: telemetryError } = await supabase
    .from("telemetry_snapshots")
    .select(
      "vehicle_id, captured_at, odometer_miles, battery_or_fuel_percent, latitude, longitude, speed_mph, ignition_on, source"
    )
    .in("vehicle_id", vehicleIds);

  if (telemetryError) {
    throw telemetryError;
  }

  const latestOdometerByVehicleId = new Map<string, number>();

  for (const telemetryRow of ((telemetryRows ?? []) as TelemetryRow[]).sort((a, b) =>
    b.captured_at.localeCompare(a.captured_at)
  )) {
    if (!latestOdometerByVehicleId.has(telemetryRow.vehicle_id)) {
      latestOdometerByVehicleId.set(telemetryRow.vehicle_id, telemetryRow.odometer_miles ?? 0);
    }
  }

  await Promise.all(
    ((vehicleRows ?? []) as VehicleRow[]).map((vehicle) =>
      vehicle.ownership_status === "own"
        ? ensureDefaultMaintenanceForVehicle(
            vehicle.id,
            vehicle.powertrain,
            latestOdometerByVehicleId.get(vehicle.id) ?? 0
          )
        : Promise.resolve()
    )
  );

  const [
    { data: valuationRows, error: valuationError },
    { data: maintenanceRows, error: maintenanceError },
    { data: alertRows, error: alertError },
    { data: partRows, error: partError }
  ] = await Promise.all([
    supabase
      .from("valuation_points")
      .select(
        "vehicle_id, captured_at, market_value_usd, change_usd, change_percent, confidence, source, comparable_count, last_seen_at"
      )
      .in("vehicle_id", vehicleIds),
    supabase
      .from("maintenance_tasks")
      .select(
        "vehicle_id, external_id, title, category, status, due_date, due_mileage, estimated_cost_usd, provider_recommendation, can_schedule_online, notes, recurrence_miles, recurrence_days, completed_at, completed_mileage, auto_generated"
      )
      .in("vehicle_id", vehicleIds),
    supabase
      .from("alerts")
      .select("vehicle_id, external_id, title, body, severity, created_at, channel_suggestions")
      .in("vehicle_id", vehicleIds),
    supabase
      .from("part_listings")
      .select(
        "vehicle_id, external_id, query, title, marketplace, price_usd, prime_eligible, fitment_confidence, url"
      )
      .in("vehicle_id", vehicleIds)
  ]);

  if (valuationError || maintenanceError || alertError || partError) {
    throw valuationError ?? maintenanceError ?? alertError ?? partError;
  }

  return buildVehicleMap(
    (vehicleRows ?? []) as VehicleRow[],
    (telemetryRows ?? []) as TelemetryRow[],
    (valuationRows ?? []) as ValuationRow[],
    (maintenanceRows ?? []) as MaintenanceRow[],
    (alertRows ?? []) as AlertRow[],
    (partRows ?? []) as PartListingRow[]
  );
}

export async function listVehicles(userId?: string | null) {
  if (!userId || !canUseDatabase()) {
    return fallbackVehicles;
  }

  await ensureDemoGarageForUser(userId);

  const databaseVehicles = await fetchVehiclesFromDatabase(userId);
  return databaseVehicles.length > 0 ? databaseVehicles : fallbackVehicles;
}

export async function getVehicle(vehicleId: string, userId?: string | null) {
  const allVehicles = await listVehicles(userId);
  return allVehicles.find((vehicle) => vehicle.id === vehicleId) ?? null;
}

export async function createVehicleForUser(userId: string, input: CreateVehicleInput) {
  if (!canUseDatabase()) {
    throw new Error("Database is not configured");
  }

  const garageId = await getOrCreateGarageIdForUser(userId);

  if (!garageId) {
    throw new Error("No garage available for user");
  }

  const supabase = createSupabaseAdminClient();
  const baseSlug = slugifyVehicle(input);
  let slug = baseSlug;

  for (let suffix = 1; suffix <= 25; suffix += 1) {
    const { data: existing, error } = await supabase
      .from("vehicles")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!existing) {
      break;
    }

    slug = `${baseSlug}-${suffix + 1}`;
  }

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .insert({
      garage_id: garageId,
      slug,
      ownership_status: input.ownershipStatus,
      nickname: input.nickname,
      year: input.year,
      make: input.make,
      model: input.model,
      trim: input.trim,
      vin: input.vin.trim(),
      powertrain: input.powertrain,
      source_url: input.sourceUrl?.trim() || null,
      watch_notes: input.watchNotes?.trim() || null,
      lifecycle_notes: input.lifecycleNotes?.trim() || null,
      acquisition_date: input.acquisitionDate || null,
      disposition_date: input.dispositionDate || null,
      purchase_price_usd: input.purchasePriceUsd ?? null,
      sale_price_usd: input.salePriceUsd ?? null,
      target_price_usd: input.targetPriceUsd ?? null,
      target_mileage: input.targetMileage ?? null,
      image:
        input.image?.trim() ||
        "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80"
    })
    .select("id, slug")
    .single();

  if (vehicleError || !vehicle) {
    throw vehicleError ?? new Error("Failed to create vehicle");
  }

  const today = new Date().toISOString();
  const { error: telemetryError } = await supabase.from("telemetry_snapshots").insert({
    vehicle_id: vehicle.id,
    captured_at: today,
    odometer_miles: 0,
    battery_or_fuel_percent: 0,
    latitude: 0,
    longitude: 0,
    speed_mph: 0,
    ignition_on: false,
    source: "manual-entry"
  });

  if (telemetryError) {
    throw telemetryError;
  }

  if (input.ownershipStatus === "own") {
    await ensureDefaultMaintenanceForVehicle(vehicle.id, input.powertrain, 0);
  }

  return vehicle.slug;
}

export async function updateVehicleForUser(userId: string, vehicleSlug: string, input: CreateVehicleInput) {
  if (!canUseDatabase()) {
    throw new Error("Database is not configured");
  }

  const existingVehicle = await assertVehicleAccess(userId, vehicleSlug);
  const supabase = createSupabaseAdminClient();

  const { data: updatedVehicle, error } = await supabase
    .from("vehicles")
    .update({
      ownership_status: input.ownershipStatus,
      nickname: input.nickname,
      year: input.year,
      make: input.make,
      model: input.model,
      trim: input.trim,
      vin: input.vin.trim(),
      powertrain: input.powertrain,
      source_url: input.sourceUrl?.trim() || null,
      watch_notes: input.watchNotes?.trim() || null,
      lifecycle_notes: input.lifecycleNotes?.trim() || null,
      acquisition_date: input.acquisitionDate || null,
      disposition_date: input.dispositionDate || null,
      purchase_price_usd: input.purchasePriceUsd ?? null,
      sale_price_usd: input.salePriceUsd ?? null,
      target_price_usd: input.targetPriceUsd ?? null,
      target_mileage: input.targetMileage ?? null,
      image: input.image?.trim() || existingVehicle.image
    })
    .eq("slug", vehicleSlug)
    .select("slug")
    .single();

  if (error || !updatedVehicle) {
    throw error ?? new Error("Failed to update vehicle");
  }

  if (input.ownershipStatus === "own") {
    await ensureDefaultMaintenanceForVehicle(existingVehicle.id, input.powertrain, await getLatestOdometerMiles(existingVehicle.id));
  }

  return updatedVehicle.slug;
}

export async function deleteVehicleForUser(userId: string, vehicleSlug: string) {
  if (!canUseDatabase()) {
    throw new Error("Database is not configured");
  }

  await assertVehicleAccess(userId, vehicleSlug);
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("vehicles").delete().eq("slug", vehicleSlug);

  if (error) {
    throw error;
  }
}

export async function deleteVehiclesForUser(userId: string, vehicleSlugs: string[]) {
  if (!canUseDatabase()) {
    throw new Error("Database is not configured");
  }

  const uniqueSlugs = Array.from(new Set(vehicleSlugs.filter(Boolean)));

  if (uniqueSlugs.length === 0) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { data: vehicles, error: vehicleError } = await supabase
    .from("vehicles")
    .select("slug, garage_id")
    .in("slug", uniqueSlugs);

  if (vehicleError) {
    throw vehicleError;
  }

  if (!vehicles || vehicles.length !== uniqueSlugs.length) {
    throw new Error("One or more vehicles were not found");
  }

  const garageIds = Array.from(new Set(vehicles.map((vehicle) => vehicle.garage_id)));
  const { data: memberships, error: membershipError } = await supabase
    .from("garage_memberships")
    .select("garage_id")
    .eq("user_id", userId)
    .in("garage_id", garageIds);

  if (membershipError) {
    throw membershipError;
  }

  if ((memberships?.length ?? 0) !== garageIds.length) {
    throw new Error("You do not have access to one or more selected vehicles");
  }

  const { error } = await supabase.from("vehicles").delete().in("slug", uniqueSlugs);

  if (error) {
    throw error;
  }
}

export async function createMaintenanceTaskForUser(
  userId: string,
  vehicleSlug: string,
  input: CreateMaintenanceTaskInput
) {
  if (!canUseDatabase()) {
    throw new Error("Database is not configured");
  }

  const vehicle = await assertVehicleAccess(userId, vehicleSlug);
  const supabase = createSupabaseAdminClient();
  const externalId = `manual-${crypto.randomUUID()}`;
  const { error } = await supabase.from("maintenance_tasks").insert({
    vehicle_id: vehicle.id,
    external_id: externalId,
    title: input.title,
    category: input.category,
    status: "upcoming",
    due_date: input.dueDate,
    due_mileage: input.dueMileage,
    estimated_cost_usd: input.estimatedCostUsd,
    provider_recommendation: input.providerRecommendation,
    can_schedule_online: input.canScheduleOnline ?? false,
    notes: input.notes?.trim() || null,
    recurrence_miles: input.recurrenceMiles ?? null,
    recurrence_days: input.recurrenceDays ?? null,
    auto_generated: false
  });

  if (error) {
    throw error;
  }
}

export async function completeMaintenanceTaskForUser(userId: string, vehicleSlug: string, taskId: string) {
  if (!canUseDatabase()) {
    throw new Error("Database is not configured");
  }

  const vehicle = await assertVehicleAccess(userId, vehicleSlug);
  const supabase = createSupabaseAdminClient();
  const { data: task, error } = await supabase
    .from("maintenance_tasks")
    .select(
      "vehicle_id, external_id, title, category, due_date, due_mileage, estimated_cost_usd, provider_recommendation, can_schedule_online, notes, recurrence_miles, recurrence_days"
    )
    .eq("vehicle_id", vehicle.id)
    .eq("external_id", taskId)
    .maybeSingle();

  if (error || !task) {
    throw error ?? new Error("Maintenance task not found");
  }

  const completedAt = new Date().toISOString();
  const completedMileage = await getLatestOdometerMiles(vehicle.id);
  const { error: updateError } = await supabase
    .from("maintenance_tasks")
    .update({
      status: "scheduled",
      completed_at: completedAt,
      completed_mileage: completedMileage
    })
    .eq("vehicle_id", vehicle.id)
    .eq("external_id", taskId);

  if (updateError) {
    throw updateError;
  }

  if (task.recurrence_miles || task.recurrence_days) {
    const nextDueDate = task.recurrence_days
      ? addDays(completedAt.slice(0, 10), task.recurrence_days)
      : addDays(completedAt.slice(0, 10), 180);
    const nextDueMileage =
      task.recurrence_miles !== null ? completedMileage + task.recurrence_miles : null;

    const { error: insertError } = await supabase.from("maintenance_tasks").insert({
      vehicle_id: vehicle.id,
      external_id: `recurring-${crypto.randomUUID()}`,
      title: task.title,
      category: task.category,
      status: "upcoming",
      due_date: nextDueDate,
      due_mileage: nextDueMileage,
      estimated_cost_usd: task.estimated_cost_usd,
      provider_recommendation: task.provider_recommendation,
      can_schedule_online: task.can_schedule_online,
      notes: task.notes,
      recurrence_miles: task.recurrence_miles,
      recurrence_days: task.recurrence_days,
      auto_generated: true
    });

    if (insertError) {
      throw insertError;
    }
  }
}

export async function deleteMaintenanceTaskForUser(userId: string, vehicleSlug: string, taskId: string) {
  if (!canUseDatabase()) {
    throw new Error("Database is not configured");
  }

  const vehicle = await assertVehicleAccess(userId, vehicleSlug);
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("maintenance_tasks")
    .delete()
    .eq("vehicle_id", vehicle.id)
    .eq("external_id", taskId);

  if (error) {
    throw error;
  }
}

export async function getNotificationPreferencesForUser(userId: string, email?: string | null) {
  if (!canUseDatabase()) {
    return {
      deliveryEmail: email ?? "",
      phoneNumber: "",
      emailEnabled: true,
      smsEnabled: false,
      pushEnabled: false,
      maintenanceDueEnabled: true,
      maintenanceDueSoonEnabled: true,
      weeklyDigestEnabled: false
    };
  }

  const supabase = createSupabaseAdminClient();
  const defaults = {
    user_id: userId,
    delivery_email: email ?? null,
    phone_number: null,
    email_enabled: true,
    sms_enabled: false,
    push_enabled: false,
    maintenance_due_enabled: true,
    maintenance_due_soon_enabled: true,
    weekly_digest_enabled: false
  };

  const { error: upsertError } = await supabase.from("notification_preferences").upsert(defaults, {
    onConflict: "user_id",
    ignoreDuplicates: true
  });

  if (upsertError) {
    throw upsertError;
  }

  const { data: existing, error } = await supabase
    .from("notification_preferences")
    .select(
      "user_id, delivery_email, phone_number, email_enabled, sms_enabled, push_enabled, maintenance_due_enabled, maintenance_due_soon_enabled, weekly_digest_enabled"
    )
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  const row = existing as NotificationPreferencesRow;
  return {
    deliveryEmail: row.delivery_email ?? email ?? "",
    phoneNumber: row.phone_number ?? "",
    emailEnabled: row.email_enabled,
    smsEnabled: row.sms_enabled,
    pushEnabled: row.push_enabled,
    maintenanceDueEnabled: row.maintenance_due_enabled,
    maintenanceDueSoonEnabled: row.maintenance_due_soon_enabled,
    weeklyDigestEnabled: row.weekly_digest_enabled
  };
}

export async function updateNotificationPreferencesForUser(
  userId: string,
  input: {
    deliveryEmail: string;
    phoneNumber?: string;
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    maintenanceDueEnabled: boolean;
    maintenanceDueSoonEnabled: boolean;
    weeklyDigestEnabled: boolean;
  }
) {
  if (!canUseDatabase()) {
    throw new Error("Database is not configured");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: userId,
      delivery_email: input.deliveryEmail.trim() || null,
      phone_number: input.phoneNumber?.trim() || null,
      email_enabled: input.emailEnabled,
      sms_enabled: input.smsEnabled,
      push_enabled: input.pushEnabled,
      maintenance_due_enabled: input.maintenanceDueEnabled,
      maintenance_due_soon_enabled: input.maintenanceDueSoonEnabled,
      weekly_digest_enabled: input.weeklyDigestEnabled,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: "user_id"
    }
  );

  if (error) {
    throw error;
  }
}

export async function syncMaintenanceAlertsForUser(userId: string, email?: string | null) {
  if (!canUseDatabase()) {
    return [];
  }

  const preferences = await getNotificationPreferencesForUser(userId, email);
  const vehicles = await listVehicles(userId);
  const activeOwnershipVehicles = vehicles.filter((vehicle) => vehicle.ownershipStatus === "own");
  const generatedAlerts = [] as Array<{
    externalId: string;
    vehicleSlug: string;
    title: string;
    body: string;
    severity: "info" | "warning" | "critical";
  }>;

  for (const vehicle of activeOwnershipVehicles) {
    for (const task of vehicle.maintenance) {
      if (task.completedAt) {
        continue;
      }

      if ((task.status === "due" || task.status === "overdue") && preferences.maintenanceDueEnabled) {
        generatedAlerts.push({
          externalId: maintenanceAlertExternalId(vehicle.id, task.id, task.status),
          vehicleSlug: vehicle.id,
          title: `${vehicle.nickname}: ${task.title} is ${task.status}`,
          body:
            task.status === "overdue"
              ? `${task.title} is overdue for your ${vehicle.year} ${vehicle.make} ${vehicle.model}. Due ${task.dueDate}${task.dueMileage ? ` or ${task.dueMileage.toLocaleString()} mi` : ""}.`
              : `${task.title} is due now for your ${vehicle.year} ${vehicle.make} ${vehicle.model}. Due ${task.dueDate}${task.dueMileage ? ` or ${task.dueMileage.toLocaleString()} mi` : ""}.`,
          severity: task.status === "overdue" ? "critical" : "warning"
        });
        continue;
      }

      const daysUntilDue = diffInDays(task.dueDate);
      if (
        task.status === "upcoming" &&
        preferences.maintenanceDueSoonEnabled &&
        daysUntilDue >= 0 &&
        daysUntilDue <= 7
      ) {
        generatedAlerts.push({
          externalId: maintenanceAlertExternalId(vehicle.id, task.id, "due-soon"),
          vehicleSlug: vehicle.id,
          title: `${vehicle.nickname}: ${task.title} due soon`,
          body: `${task.title} is due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"} on ${task.dueDate}.`,
          severity: "info"
        });
      }
    }

    const telemetryInsights = await getVehicleTelemetryInsightsForUser(userId, vehicle.id);
    const energyPercent = vehicle.telemetry.batteryOrFuelPercent;

    if (energyPercent > 0 && energyPercent <= 10) {
      generatedAlerts.push({
        externalId: `telemetry:${vehicle.id}:low-energy-critical`,
        vehicleSlug: vehicle.id,
        title: `${vehicle.nickname}: energy level is critically low`,
        body: `${vehicle.year} ${vehicle.make} ${vehicle.model} is at ${Math.round(energyPercent)}%. Charge or refuel soon.`,
        severity: "critical"
      });
    } else if (energyPercent > 10 && energyPercent <= 20) {
      generatedAlerts.push({
        externalId: `telemetry:${vehicle.id}:low-energy-warning`,
        vehicleSlug: vehicle.id,
        title: `${vehicle.nickname}: energy level is low`,
        body: `${vehicle.year} ${vehicle.make} ${vehicle.model} is at ${Math.round(energyPercent)}%. Plan a charge or fuel stop.`,
        severity: "warning"
      });
    }

    if (telemetryInsights?.freshness === "stale") {
      generatedAlerts.push({
        externalId: `telemetry:${vehicle.id}:stale-sync`,
        vehicleSlug: vehicle.id,
        title: `${vehicle.nickname}: Smartcar data is stale`,
        body: `Telemetry has not refreshed in the last 24 hours. Sync again to confirm current vehicle state.`,
        severity: "info"
      });
    }

    if (
      telemetryInsights &&
      telemetryInsights.movementMiles !== null &&
      telemetryInsights.movementMiles >= 25
    ) {
      generatedAlerts.push({
        externalId: `telemetry:${vehicle.id}:movement`,
        vehicleSlug: vehicle.id,
        title: `${vehicle.nickname}: significant movement detected`,
        body: `${vehicle.year} ${vehicle.make} ${vehicle.model} moved about ${telemetryInsights.movementMiles.toLocaleString()} miles since the prior Smartcar snapshot.`,
        severity: "info"
      });
    }
  }

  const watchingVehicles = vehicles.filter((vehicle) => vehicle.ownershipStatus === "watching");
  for (const vehicle of watchingVehicles) {
    const latestValue = vehicle.valuationHistory[vehicle.valuationHistory.length - 1]?.marketValueUsd ?? null;
    const hasTargets = vehicle.targetPriceUsd || vehicle.targetMileage;
    if (!hasTargets) {
      continue;
    }

    if (typeof vehicle.targetPriceUsd === "number" && latestValue !== null && latestValue <= vehicle.targetPriceUsd) {
      generatedAlerts.push({
        externalId: `watchlist:${vehicle.id}:price-hit`,
        vehicleSlug: vehicle.id,
        title: `${vehicle.nickname}: price target reached`,
        body: `${vehicle.year} ${vehicle.make} ${vehicle.model} is now around $${latestValue.toLocaleString()}, at or below your target of $${vehicle.targetPriceUsd.toLocaleString()}.`,
        severity: "info"
      });
    } else if (
      typeof vehicle.targetPriceUsd === "number" &&
      latestValue !== null &&
      latestValue <= vehicle.targetPriceUsd * 1.05
    ) {
      generatedAlerts.push({
        externalId: `watchlist:${vehicle.id}:price-close`,
        vehicleSlug: vehicle.id,
        title: `${vehicle.nickname}: price is close`,
        body: `${vehicle.year} ${vehicle.make} ${vehicle.model} is within 5% of your target price at roughly $${latestValue.toLocaleString()}.`,
        severity: "info"
      });
    }

    if (
      typeof vehicle.targetMileage === "number" &&
      vehicle.telemetry.odometerMiles > 0 &&
      vehicle.telemetry.odometerMiles <= vehicle.targetMileage
    ) {
      generatedAlerts.push({
        externalId: `watchlist:${vehicle.id}:mileage-hit`,
        vehicleSlug: vehicle.id,
        title: `${vehicle.nickname}: mileage target reached`,
        body: `${vehicle.year} ${vehicle.make} ${vehicle.model} is listed around ${vehicle.telemetry.odometerMiles.toLocaleString()} miles, within your target of ${vehicle.targetMileage.toLocaleString()} miles.`,
        severity: "info"
      });
    }
  }

  const supabase = createSupabaseAdminClient();
  const vehicleRows = await Promise.all(
    vehicles.map(async (vehicle) => ({
      slug: vehicle.id,
      row: await assertVehicleAccess(userId, vehicle.id)
    }))
  );
  const vehicleIdBySlug = new Map(vehicleRows.map((item) => [item.slug, item.row.id]));
  const maintenancePrefixList = vehicles.map((vehicle) => `maintenance:${vehicle.id}:`);
  const telemetryPrefixList = activeOwnershipVehicles.map((vehicle) => `telemetry:${vehicle.id}:`);
  const watchlistPrefixList = watchingVehicles.map((vehicle) => `watchlist:${vehicle.id}:`);

  const { data: existingAlerts, error: existingAlertsError } = await supabase
    .from("alerts")
    .select("id, external_id, vehicle_id")
    .in("vehicle_id", Array.from(vehicleIdBySlug.values()));

  if (existingAlertsError) {
    throw existingAlertsError;
  }

  const currentMaintenanceAlerts = (existingAlerts ?? []).filter((alert) =>
    maintenancePrefixList.some((prefix) => alert.external_id.startsWith(prefix))
  );
  const currentWatchAlerts = (existingAlerts ?? []).filter((alert) =>
    watchlistPrefixList.some((prefix) => alert.external_id.startsWith(prefix))
  );
  const currentTelemetryAlerts = (existingAlerts ?? []).filter((alert) =>
    telemetryPrefixList.some((prefix) => alert.external_id.startsWith(prefix))
  );
  const nextExternalIds = new Set(generatedAlerts.map((alert) => alert.externalId));
  const staleAlertIds = [...currentMaintenanceAlerts, ...currentWatchAlerts, ...currentTelemetryAlerts]
    .filter((alert) => !nextExternalIds.has(alert.external_id))
    .map((alert) => alert.id);

  if (staleAlertIds.length > 0) {
    await supabase.from("alerts").delete().in("id", staleAlertIds);
  }

  for (const alert of generatedAlerts) {
    const vehicleId = vehicleIdBySlug.get(alert.vehicleSlug);
    if (!vehicleId) {
      continue;
    }

    const { error } = await supabase.from("alerts").upsert(
      {
        vehicle_id: vehicleId,
        external_id: alert.externalId,
        title: alert.title,
        body: alert.body,
        severity: alert.severity,
        created_at: new Date().toISOString(),
        channel_suggestions: ["email", "push"]
      },
      { onConflict: "external_id" }
    );

    if (error) {
      throw error;
    }
  }

  const refreshedVehicles = await fetchVehiclesFromDatabase(userId);
  return refreshedVehicles.flatMap((vehicle) => vehicle.alerts);
}

export async function getNotificationCenterForUser(userId?: string | null, email?: string | null) {
  if (!userId || !canUseDatabase()) {
    return {
      preferences: {
        deliveryEmail: email ?? "",
        phoneNumber: "",
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: false,
        maintenanceDueEnabled: true,
        maintenanceDueSoonEnabled: true,
        weeklyDigestEnabled: false
      },
      alerts: [] as Vehicle["alerts"],
      recentDeliveries: [] as Array<{
        channel: "email" | "sms" | "push";
        status: "pending" | "sent" | "skipped" | "failed";
        deliveredAt: string | null;
        errorMessage: string | null;
      }>
    };
  }

  const [preferences, alerts] = await Promise.all([
    getNotificationPreferencesForUser(userId, email),
    syncMaintenanceAlertsForUser(userId, email)
  ]);

  const supabase = createSupabaseAdminClient();
  const { data: deliveries, error } = await supabase
    .from("notification_deliveries")
    .select("alert_id, user_id, channel, status, provider_message_id, error_message, delivered_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  return {
    preferences,
    alerts: alerts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    recentDeliveries: ((deliveries ?? []) as NotificationDeliveryRow[]).map((delivery) => ({
      channel: delivery.channel,
      status: delivery.status,
      deliveredAt: delivery.delivered_at,
      errorMessage: delivery.error_message
    }))
  };
}

export async function sendNotificationDigestForUser(userId: string, email?: string | null) {
  if (!canUseDatabase()) {
    throw new Error("Database is not configured");
  }

  const center = await getNotificationCenterForUser(userId, email);
  const activeAlerts = center.alerts.slice(0, 12);

  if (activeAlerts.length === 0) {
    return {
      status: "skipped" as const,
      message: "No active alerts to send"
    };
  }

  const targetEmail = center.preferences.deliveryEmail || email;

  if (!center.preferences.emailEnabled || !targetEmail) {
    return {
      status: "skipped" as const,
      message: "Email delivery is disabled or no delivery email is configured"
    };
  }

  const emailResult = await sendEmailNotification({
    to: targetEmail,
    subject: `Garage maintenance digest (${activeAlerts.length} active alert${activeAlerts.length === 1 ? "" : "s"})`,
    text: activeAlerts.map((alert) => `- ${alert.title}\n${alert.body}`).join("\n\n")
  });

  const supabase = createSupabaseAdminClient();
  const { data: alertRows, error: alertRowsError } = await supabase
    .from("alerts")
    .select("id, external_id")
    .in(
      "external_id",
      activeAlerts.map((alert) => alert.id)
    );

  if (alertRowsError) {
    throw alertRowsError;
  }

  for (const alertRow of alertRows ?? []) {
    await supabase.from("notification_deliveries").upsert(
      {
        alert_id: alertRow.id,
        user_id: userId,
        channel: "email",
        status: emailResult.status === "sent" ? "sent" : emailResult.status === "failed" ? "failed" : "skipped",
        provider_message_id: emailResult.providerMessageId,
        error_message: emailResult.errorMessage,
        delivered_at: emailResult.status === "sent" ? new Date().toISOString() : null
      },
      { onConflict: "alert_id,user_id,channel" }
    );
  }

  return {
    status: emailResult.status,
    message: emailResult.errorMessage ?? `Processed ${activeAlerts.length} alert notifications`
  };
}

export async function getDashboardSummary(userId?: string | null) {
  if (userId && canUseDatabase()) {
    await syncMaintenanceAlertsForUser(userId);
  }

  const vehicles = await listVehicles(userId);
  const totalVehicles = vehicles.length;
  const ownedNowCount = vehicles.filter((vehicle) => vehicle.ownershipStatus === "own").length;
  const ownedBeforeCount = vehicles.filter((vehicle) => vehicle.ownershipStatus === "owned").length;
  const watchingCount = vehicles.filter((vehicle) => vehicle.ownershipStatus === "watching").length;
  const totalValue = vehicles.reduce((sum, vehicle) => {
    const latestValue =
      vehicle.valuationHistory[vehicle.valuationHistory.length - 1]?.marketValueUsd ?? 0;
    return sum + latestValue;
  }, 0);
  const dueTasks = vehicles
    .filter((vehicle) => vehicle.ownershipStatus === "own")
    .flatMap((vehicle) => vehicle.maintenance)
    .filter((task) => task.status === "due" || task.status === "overdue").length;
  const activeAlerts = vehicles
    .flatMap((vehicle) => vehicle.alerts).length;

  return {
    totalVehicles,
    ownedNowCount,
    ownedBeforeCount,
    watchingCount,
    totalValue,
    dueTasks,
    activeAlerts,
    vehicles
  };
}

export async function getSmartcarSummaryForUser(userId?: string | null) {
  if (!userId || !canUseDatabase()) {
    return {
      connectionCount: 0,
      linkedCount: 0,
      freshVehicleCount: 0,
      lastSyncedAt: null as string | null,
      lastSyncStatus: null as string | null,
      lastSyncError: null as string | null,
      connectedVehicles: [] as Array<{
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
      }>,
      garageVehicles: [] as Array<{ id: string; label: string }>
    };
  }

  const garageId = await getOrCreateGarageIdForUser(userId);

  if (!garageId) {
    return {
      connectionCount: 0,
      linkedCount: 0,
      freshVehicleCount: 0,
      lastSyncedAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
      connectedVehicles: [],
      garageVehicles: []
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: connections, error: connectionsError } = await supabase
    .from("provider_connections")
    .select("id, status, metadata, updated_at")
    .eq("provider", "smartcar")
    .eq("garage_id", garageId)
    .eq("status", "active");

  if (connectionsError || !connections) {
    return {
      connectionCount: 0,
      linkedCount: 0,
      freshVehicleCount: 0,
      lastSyncedAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
      connectedVehicles: [],
      garageVehicles: []
    };
  }

  const connectionIds = connections.map((connection) => connection.id);

  if (connectionIds.length === 0) {
    return {
      connectionCount: 0,
      linkedCount: 0,
      freshVehicleCount: 0,
      lastSyncedAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
      connectedVehicles: [],
      garageVehicles: []
    };
  }

  const { data: providerVehicles, error: vehiclesError } = await supabase
    .from("provider_vehicles")
    .select("id, make, model, year, linked_vehicle_id")
    .in("provider_connection_id", connectionIds)
    .order("created_at", { ascending: true });

  if (vehiclesError || !providerVehicles) {
    return {
      connectionCount: connections.length,
      linkedCount: 0,
      freshVehicleCount: 0,
      lastSyncedAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
      connectedVehicles: [],
      garageVehicles: []
    };
  }

  const { data: garageVehicles } = await supabase
    .from("vehicles")
    .select("id, slug, year, make, model")
    .eq("garage_id", garageId)
    .order("created_at", { ascending: true });

  const garageVehicleMap = new Map(
    (garageVehicles ?? []).map((vehicle) => [
      vehicle.id,
      {
        id: vehicle.slug,
        label: [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")
      }
    ])
  );
  const linkedVehicleIds = providerVehicles
    .map((vehicle) => vehicle.linked_vehicle_id)
    .filter((value): value is string => Boolean(value));
  const { data: telemetryRows } = linkedVehicleIds.length
    ? await supabase
        .from("telemetry_snapshots")
        .select("vehicle_id, captured_at, odometer_miles, battery_or_fuel_percent, latitude, longitude, source")
        .in("vehicle_id", linkedVehicleIds)
        .order("captured_at", { ascending: false })
    : { data: [] as Array<{
        vehicle_id: string;
        captured_at: string;
        odometer_miles: number;
        battery_or_fuel_percent: number;
        latitude: number;
        longitude: number;
        source: string;
      }> };

  const latestTelemetryByVehicleId = new Map<
    string,
    {
      captured_at: string;
      odometer_miles: number;
      battery_or_fuel_percent: number;
      latitude: number;
      longitude: number;
      source: string;
    }
  >();

  for (const row of telemetryRows ?? []) {
    if (!latestTelemetryByVehicleId.has(row.vehicle_id)) {
      latestTelemetryByVehicleId.set(row.vehicle_id, row);
    }
  }

  const now = Date.now();
  const freshWindowMs = 24 * 60 * 60 * 1000;
  const connectedVehicles = providerVehicles.map((vehicle) => {
    const telemetry = vehicle.linked_vehicle_id
      ? latestTelemetryByVehicleId.get(vehicle.linked_vehicle_id)
      : undefined;

    return {
      id: vehicle.id,
      make: vehicle.make ?? "Unknown",
      model: vehicle.model ?? "Vehicle",
      year: vehicle.year ?? null,
      linkedVehicleId: garageVehicleMap.get(vehicle.linked_vehicle_id ?? "")?.id ?? null,
      linkedVehicleLabel: garageVehicleMap.get(vehicle.linked_vehicle_id ?? "")?.label ?? null,
      connectionId: connections[0]?.id ?? null,
      lastSyncedAt: telemetry?.captured_at ?? null,
      odometerMiles: telemetry?.odometer_miles ?? null,
      batteryOrFuelPercent:
        typeof telemetry?.battery_or_fuel_percent === "number"
          ? Number(telemetry.battery_or_fuel_percent)
          : telemetry?.battery_or_fuel_percent
            ? Number(telemetry.battery_or_fuel_percent)
            : null,
      latitude: telemetry?.latitude ?? null,
      longitude: telemetry?.longitude ?? null,
      telemetrySource: telemetry?.source ?? null
    };
  });

  const freshVehicleCount = connectedVehicles.filter(
    (vehicle) =>
      vehicle.lastSyncedAt &&
      now - new Date(vehicle.lastSyncedAt).getTime() <= freshWindowMs
  ).length;
  const lastSyncedAt = connectedVehicles
    .map((vehicle) => vehicle.lastSyncedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
  const latestConnection = [...connections].sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0];

  return {
    connectionCount: connections.length,
    linkedCount: connectedVehicles.filter((vehicle) => vehicle.linkedVehicleId).length,
    freshVehicleCount,
    lastSyncedAt,
    lastSyncStatus: String(latestConnection?.metadata?.last_sync_status ?? latestConnection?.status ?? ""),
    lastSyncError: latestConnection?.metadata?.last_sync_error
      ? String(latestConnection.metadata.last_sync_error)
      : null,
    connectedVehicles,
    garageVehicles: (garageVehicles ?? []).map((vehicle) => ({
      id: vehicle.slug,
      label: [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")
    }))
  };
}

export async function getVehicleTelemetryInsightsForUser(userId?: string | null, vehicleSlug?: string | null) {
  if (!userId || !vehicleSlug || !canUseDatabase()) {
    return null;
  }

  const vehicle = await assertVehicleAccess(userId, vehicleSlug);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("telemetry_snapshots")
    .select("captured_at, odometer_miles, battery_or_fuel_percent, latitude, longitude, ignition_on, source")
    .eq("vehicle_id", vehicle.id)
    .order("captured_at", { ascending: false })
    .limit(5);

  if (error || !data || data.length === 0) {
    return null;
  }

  const latest = data[0];
  const previous = data[1] ?? null;
  const lastSyncAgeMs = Date.now() - new Date(latest.captured_at).getTime();

  return {
    lastSyncedAt: latest.captured_at,
    source: latest.source,
    freshness: lastSyncAgeMs <= 24 * 60 * 60 * 1000 ? "fresh" as const : "stale" as const,
    movementMiles:
      previous && typeof latest.odometer_miles === "number" && typeof previous.odometer_miles === "number"
        ? latest.odometer_miles - previous.odometer_miles
        : null,
    hasLocation:
      Boolean(latest.latitude || latest.longitude),
    history: data.map((row) => ({
      capturedAt: row.captured_at,
      odometerMiles: row.odometer_miles,
      batteryOrFuelPercent: Number(row.battery_or_fuel_percent),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      ignitionOn: row.ignition_on,
      source: row.source
    }))
  };
}

export async function linkSmartcarVehicleForUser(
  userId: string,
  providerVehicleId: string,
  garageVehicleSlug: string
) {
  if (!canUseDatabase()) {
    throw new Error("Database is not configured");
  }

  const supabase = createSupabaseAdminClient();
  const { data: providerVehicle, error: providerVehicleError } = await supabase
    .from("provider_vehicles")
    .select("id, provider_connection_id")
    .eq("id", providerVehicleId)
    .maybeSingle();

  if (providerVehicleError || !providerVehicle) {
    throw providerVehicleError ?? new Error("Smartcar vehicle not found");
  }

  const { data: connection, error: connectionError } = await supabase
    .from("provider_connections")
    .select("garage_id")
    .eq("id", providerVehicle.provider_connection_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (connectionError || !connection) {
    throw connectionError ?? new Error("Smartcar connection not found");
  }

  const { data: garageVehicle, error: garageVehicleError } = await supabase
    .from("vehicles")
    .select("id")
    .eq("slug", garageVehicleSlug)
    .eq("garage_id", connection.garage_id)
    .maybeSingle();

  if (garageVehicleError || !garageVehicle) {
    throw garageVehicleError ?? new Error("Garage vehicle not found");
  }

  const { error } = await supabase
    .from("provider_vehicles")
    .update({
      linked_vehicle_id: garageVehicle.id
    })
    .eq("id", providerVehicleId);

  if (error) {
    throw error;
  }
}

export async function syncSmartcarConnectionForUser(userId: string, connectionId: string) {
  if (!canUseDatabase()) {
    throw new Error("Database is not configured");
  }

  const supabase = createSupabaseAdminClient();
  const { data: connection, error: connectionError } = await supabase
    .from("provider_connections")
    .select("id, access_token, user_id")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .eq("provider", "smartcar")
    .maybeSingle();

  if (connectionError || !connection) {
    throw connectionError ?? new Error("Smartcar connection not found");
  }

  const { data: providerVehicles, error: providerVehiclesError } = await supabase
    .from("provider_vehicles")
    .select("smartcar_vehicle_id, linked_vehicle_id")
    .eq("provider_connection_id", connection.id)
    .not("linked_vehicle_id", "is", null);

  if (providerVehiclesError) {
    throw providerVehiclesError;
  }

  let successfulSyncs = 0;

  try {
    for (const providerVehicle of providerVehicles ?? []) {
      const [odometerResult, locationResult, batteryResult, fuelResult] = await Promise.allSettled([
        fetchSmartcarOdometer(connection.access_token, providerVehicle.smartcar_vehicle_id),
        fetchSmartcarLocation(connection.access_token, providerVehicle.smartcar_vehicle_id),
        fetchSmartcarBattery(connection.access_token, providerVehicle.smartcar_vehicle_id),
        fetchSmartcarFuel(connection.access_token, providerVehicle.smartcar_vehicle_id)
      ]);

      const odometer =
        odometerResult.status === "fulfilled" ? Math.round(odometerResult.value.distance ?? 0) : 0;
      const latitude = locationResult.status === "fulfilled" ? locationResult.value.latitude ?? 0 : 0;
      const longitude = locationResult.status === "fulfilled" ? locationResult.value.longitude ?? 0 : 0;
      const batteryPercent =
        batteryResult.status === "fulfilled" ? Number((batteryResult.value.percentRemaining ?? 0) * 100) : null;
      const fuelPercent =
        fuelResult.status === "fulfilled" ? Number((fuelResult.value.percentRemaining ?? 0) * 100) : null;

      await supabase.from("telemetry_snapshots").insert({
        vehicle_id: providerVehicle.linked_vehicle_id,
        captured_at: new Date().toISOString(),
        odometer_miles: odometer,
        battery_or_fuel_percent: batteryPercent ?? fuelPercent ?? 0,
        latitude,
        longitude,
        speed_mph: 0,
        ignition_on: false,
        source: "smartcar-live"
      });

      successfulSyncs += 1;
    }

    await supabase
      .from("provider_connections")
      .update({
        updated_at: new Date().toISOString(),
        metadata: {
          last_sync_status: "synced",
          last_sync_at: new Date().toISOString(),
          last_sync_error: null,
          successful_vehicle_syncs: successfulSyncs
        }
      })
      .eq("id", connection.id);
  } catch (error) {
    await supabase
      .from("provider_connections")
      .update({
        updated_at: new Date().toISOString(),
        metadata: {
          last_sync_status: "error",
          last_sync_at: new Date().toISOString(),
          last_sync_error: error instanceof Error ? error.message : "Smartcar sync failed",
          successful_vehicle_syncs: successfulSyncs
        }
      })
      .eq("id", connection.id);

    throw error;
  }
}

async function syncLinkedSmartcarVehicle(
  providerConnectionId: string,
  accessToken: string,
  smartcarVehicleId: string,
  linkedVehicleId: string
) {
  const supabase = createSupabaseAdminClient();
  const [odometerResult, locationResult, batteryResult, fuelResult] = await Promise.allSettled([
    fetchSmartcarOdometer(accessToken, smartcarVehicleId),
    fetchSmartcarLocation(accessToken, smartcarVehicleId),
    fetchSmartcarBattery(accessToken, smartcarVehicleId),
    fetchSmartcarFuel(accessToken, smartcarVehicleId)
  ]);

  const odometer = odometerResult.status === "fulfilled" ? Math.round(odometerResult.value.distance ?? 0) : 0;
  const latitude = locationResult.status === "fulfilled" ? locationResult.value.latitude ?? 0 : 0;
  const longitude = locationResult.status === "fulfilled" ? locationResult.value.longitude ?? 0 : 0;
  const batteryPercent =
    batteryResult.status === "fulfilled" ? Number((batteryResult.value.percentRemaining ?? 0) * 100) : null;
  const fuelPercent =
    fuelResult.status === "fulfilled" ? Number((fuelResult.value.percentRemaining ?? 0) * 100) : null;

  await supabase.from("telemetry_snapshots").insert({
    vehicle_id: linkedVehicleId,
    captured_at: new Date().toISOString(),
    odometer_miles: odometer,
    battery_or_fuel_percent: batteryPercent ?? fuelPercent ?? 0,
    latitude,
    longitude,
    speed_mph: 0,
    ignition_on: false,
    source: "smartcar-live"
  });

  await supabase
    .from("provider_connections")
    .update({
      updated_at: new Date().toISOString(),
      metadata: {
        last_sync_status: "synced",
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
        sync_source: "smartcar-webhook",
        synced_vehicle_id: smartcarVehicleId
      }
    })
    .eq("id", providerConnectionId);
}

export async function syncSmartcarVehicleFromWebhook(smartcarVehicleId: string) {
  if (!canUseDatabase()) {
    throw new Error("Database is not configured");
  }

  const supabase = createSupabaseAdminClient();
  const { data: providerVehicle, error } = await supabase
    .from("provider_vehicles")
    .select("provider_connection_id, smartcar_vehicle_id, linked_vehicle_id")
    .eq("smartcar_vehicle_id", smartcarVehicleId)
    .not("linked_vehicle_id", "is", null)
    .maybeSingle();

  if (error || !providerVehicle || !providerVehicle.linked_vehicle_id) {
    return;
  }

  const { data: connection, error: connectionError } = await supabase
    .from("provider_connections")
    .select("id, access_token")
    .eq("id", providerVehicle.provider_connection_id)
    .eq("provider", "smartcar")
    .eq("status", "active")
    .maybeSingle();

  if (connectionError || !connection) {
    return;
  }

  try {
    await syncLinkedSmartcarVehicle(
      providerVehicle.provider_connection_id,
      connection.access_token,
      providerVehicle.smartcar_vehicle_id,
      providerVehicle.linked_vehicle_id
    );
  } catch (syncError) {
    await supabase
      .from("provider_connections")
      .update({
        updated_at: new Date().toISOString(),
        metadata: {
          last_sync_status: "error",
          last_sync_at: new Date().toISOString(),
          last_sync_error: syncError instanceof Error ? syncError.message : "Webhook sync failed",
          sync_source: "smartcar-webhook",
          synced_vehicle_id: smartcarVehicleId
        }
      })
      .eq("id", providerVehicle.provider_connection_id);

    throw syncError;
  }
}

export async function markSmartcarVehicleWebhookError(smartcarVehicleId: string, errorMessage: string) {
  if (!canUseDatabase()) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { data: providerVehicle } = await supabase
    .from("provider_vehicles")
    .select("provider_connection_id")
    .eq("smartcar_vehicle_id", smartcarVehicleId)
    .maybeSingle();

  if (!providerVehicle) {
    return;
  }

  await supabase
    .from("provider_connections")
    .update({
      updated_at: new Date().toISOString(),
      metadata: {
        last_sync_status: "vehicle_error",
        last_sync_at: new Date().toISOString(),
        last_sync_error: errorMessage,
        sync_source: "smartcar-webhook",
        synced_vehicle_id: smartcarVehicleId
      }
    })
    .eq("id", providerVehicle.provider_connection_id);
}

async function getVehicleRowForUser(userId: string, vehicleSlug: string) {
  const vehicle = await assertVehicleAccess(userId, vehicleSlug);
  return vehicle;
}

export async function searchPartsForVehicleForUser(
  userId: string,
  vehicleSlug: string,
  query: string,
  marketplace: MarketplaceSelection
) {
  if (!canUseDatabase()) {
    throw new Error("Database is not configured");
  }

  const vehicle = await getVehicleRowForUser(userId, vehicleSlug);
  const supabase = createSupabaseAdminClient();
  const vehicleDetails = await getVehicle(vehicleSlug, userId);

  if (!vehicleDetails) {
    throw new Error("Vehicle not found");
  }

  const results = await searchMarketplaceListings(vehicleDetails, query, marketplace);
  const marketplacesToReplace =
    marketplace === "all" ? ["Amazon", "eBay"] : [marketplace === "amazon" ? "Amazon" : "eBay"];

  await supabase
    .from("part_listings")
    .delete()
    .eq("vehicle_id", vehicle.id)
    .eq("query", query)
    .in("marketplace", marketplacesToReplace);

  if (results.length === 0) {
    return;
  }

  const { error } = await supabase.from("part_listings").upsert(
    results.map((result) => ({
      vehicle_id: vehicle.id,
      external_id: `${vehicle.id}-${result.externalId}`,
      query: result.query,
      title: result.title,
      marketplace: result.marketplace,
      price_usd: result.priceUsd,
      prime_eligible: result.primeEligible,
      fitment_confidence: result.fitmentConfidence,
      url: result.url
    })),
    {
      onConflict: "external_id"
    }
  );

  if (error) {
    throw error;
  }
}

export async function refreshVehicleValuationForUser(userId: string, vehicleSlug: string) {
  if (!canUseDatabase()) {
    throw new Error("Database is not configured");
  }

  const vehicle = await getVehicleRowForUser(userId, vehicleSlug);
  if (!vehicle.vin || vehicle.vin.trim().length !== 17) {
    throw new Error("Vehicle must have a 17-character VIN before valuation refresh");
  }

  const supabase = createSupabaseAdminClient();
  const { data: latestTelemetry } = await supabase
    .from("telemetry_snapshots")
    .select("odometer_miles")
    .eq("vehicle_id", vehicle.id)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestValuation } = await supabase
    .from("valuation_points")
    .select("market_value_usd")
    .eq("vehicle_id", vehicle.id)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const marketCheck = await fetchMarketCheckHistoryEstimate(vehicle.vin);

  const previousValue = latestValuation?.market_value_usd ?? null;
  const changeUsd = previousValue !== null ? marketCheck.marketValueUsd - previousValue : 0;
  const changePercent =
    previousValue && previousValue > 0 ? Number(((changeUsd / previousValue) * 100).toFixed(2)) : 0;

  const { error } = await supabase.from("valuation_points").insert({
    vehicle_id: vehicle.id,
    captured_at: new Date().toISOString(),
    market_value_usd: marketCheck.marketValueUsd,
    change_usd: changeUsd,
    change_percent: changePercent,
    confidence: marketCheck.confidence,
    source: marketCheck.source,
    comparable_count: marketCheck.comparableCount,
    last_seen_at: marketCheck.lastSeenAt
  });

  if (error) {
    throw error;
  }
}

export async function refreshGarageValuationsForUser(userId: string) {
  const vehicles = await listVehicles(userId);

  for (const vehicle of vehicles) {
    if (vehicle.vin.length === 17) {
      try {
        await refreshVehicleValuationForUser(userId, vehicle.id);
      } catch {
        // Keep refreshing the rest of the garage even if one vehicle fails provider validation.
      }
    }
  }
}
