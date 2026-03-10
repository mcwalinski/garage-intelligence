"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { bulkDeleteVehiclesAction } from "@/app/add-vehicle/actions";
import { GarageSortKey, sortGarageVehicles } from "@/lib/garage";
import { Vehicle } from "@/lib/types";
import { getWatchOpportunity } from "@/lib/watchlist";

interface GarageBulkDeleteFormProps {
  vehicles: Vehicle[];
  disabled?: boolean;
  allowBulkDelete?: boolean;
}

type GarageFilter = "all" | "own" | "owned" | "watching";
const sortOptions: Array<{ key: GarageSortKey; label: string }> = [
  { key: "recent", label: "Newest first" },
  { key: "value-desc", label: "Highest value" },
  { key: "alerts", label: "Most alerts" },
  { key: "maintenance", label: "Most service due" },
  { key: "watch-opportunity", label: "Best watch opportunities" },
  { key: "year-desc", label: "Newest model year" }
];

export function GarageBulkDeleteForm({
  vehicles,
  disabled = false,
  allowBulkDelete = true
}: GarageBulkDeleteFormProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<GarageFilter>("all");
  const [sortKey, setSortKey] = useState<GarageSortKey>("recent");
  const groupedVehicles = useMemo(
    () => ({
      own: sortGarageVehicles(vehicles.filter((vehicle) => vehicle.ownershipStatus === "own"), sortKey),
      owned: sortGarageVehicles(vehicles.filter((vehicle) => vehicle.ownershipStatus === "owned"), sortKey),
      watching: sortGarageVehicles(vehicles.filter((vehicle) => vehicle.ownershipStatus === "watching"), sortKey)
    }),
    [sortKey, vehicles]
  );
  const visibleVehicles = useMemo(
    () => (activeFilter === "all" ? sortGarageVehicles(vehicles, sortKey) : groupedVehicles[activeFilter]),
    [activeFilter, groupedVehicles, sortKey, vehicles]
  );
  const allSelected = useMemo(
    () => visibleVehicles.length > 0 && visibleVehicles.every((vehicle) => selectedIds.includes(vehicle.id)),
    [selectedIds, visibleVehicles]
  );

  function toggleVehicle(vehicleId: string) {
    setSelectedIds((current) =>
      current.includes(vehicleId) ? current.filter((id) => id !== vehicleId) : [...current, vehicleId]
    );
  }

  function toggleAll() {
    const visibleIds = visibleVehicles.map((vehicle) => vehicle.id);
    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds]))
    );
  }

  function renderVehicleCard(vehicle: Vehicle) {
    const isSelected = allowBulkDelete && selectedIds.includes(vehicle.id);
    const latestValue = vehicle.valuationHistory[vehicle.valuationHistory.length - 1];
    const topTask = vehicle.maintenance[0];
    const watchOpportunity = vehicle.ownershipStatus === "watching" ? getWatchOpportunity(vehicle) : null;
    const ownershipLabel =
      vehicle.ownershipStatus === "own" ? "Own" : vehicle.ownershipStatus === "owned" ? "Owned" : "Watching";
    const ownershipClass =
      vehicle.ownershipStatus === "own"
        ? vehicle.telemetry.ignitionOn
          ? "status-live"
          : "status-idle"
        : vehicle.ownershipStatus === "owned"
          ? "status-upcoming"
          : "status-live";

    return (
      <article
        key={vehicle.id}
        className={`card vehicle-card vehicle-card--selectable ${isSelected ? "vehicle-card--selected" : ""}`}
      >
        <div className="vehicle-card__image" style={{ backgroundImage: `url(${vehicle.image})` }}>
          {allowBulkDelete ? (
            <label className="vehicle-select-pill">
              <input
                type="checkbox"
                name="vehicleIds"
                value={vehicle.id}
                checked={isSelected}
                onChange={() => toggleVehicle(vehicle.id)}
                disabled={disabled}
              />
              <span>Select</span>
            </label>
          ) : null}
        </div>
        <div className="vehicle-card__body">
          <div className="vehicle-card__heading">
            <div>
              <span className="eyebrow">{vehicle.nickname}</span>
              <h3>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h3>
            </div>
            <span className={`status-pill ${ownershipClass}`}>{ownershipLabel}</span>
          </div>
          <div className="vehicle-metrics">
            <div>
              <span>Market value</span>
              <strong>{latestValue ? `$${latestValue.marketValueUsd.toLocaleString()}` : "Pending"}</strong>
            </div>
            <div>
              <span>{vehicle.ownershipStatus === "watching" ? "Price target" : "Energy"}</span>
              <strong>
                {vehicle.ownershipStatus === "watching"
                  ? vehicle.targetPriceUsd
                    ? `$${vehicle.targetPriceUsd.toLocaleString()}`
                    : "Not set"
                  : `${vehicle.telemetry.batteryOrFuelPercent}%`}
              </strong>
            </div>
            <div>
              <span>{vehicle.ownershipStatus === "watching" ? "Mileage target" : "Odometer"}</span>
              <strong>
                {vehicle.ownershipStatus === "watching"
                  ? vehicle.targetMileage
                    ? `${vehicle.targetMileage.toLocaleString()} mi`
                    : "Not set"
                  : `${vehicle.telemetry.odometerMiles.toLocaleString()} mi`}
              </strong>
            </div>
          </div>
          <p className="vehicle-card__task">
            {vehicle.ownershipStatus === "own"
              ? topTask
                ? `Next task: ${topTask.title} on ${topTask.dueDate}`
                : "No maintenance plan yet"
              : vehicle.ownershipStatus === "owned"
                ? vehicle.dispositionDate
                  ? `Previously owned · moved on ${vehicle.dispositionDate}`
                  : "Historical vehicle record"
                : watchOpportunity?.summary ?? "Watchlist vehicle"}
          </p>
          <Link href={`/vehicles/${vehicle.id}`} className="button button--ghost vehicle-card__link">
            Open vehicle
          </Link>
        </div>
      </article>
    );
  }

  const sections: Array<{ key: keyof typeof groupedVehicles; title: string; helper: string }> = [
    { key: "own", title: "Current vehicles", helper: "Active garage records with live operations and maintenance." },
    { key: "owned", title: "Previously owned", helper: "Historical records kept for reference, comps, and service history." },
    { key: "watching", title: "Watching", helper: "Future vehicles and market watchlist candidates." }
  ];
  const tabs: Array<{ key: GarageFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: vehicles.length },
    { key: "own", label: "Own", count: groupedVehicles.own.length },
    { key: "owned", label: "Owned", count: groupedVehicles.owned.length },
    { key: "watching", label: "Watching", count: groupedVehicles.watching.length }
  ];

  return (
    <form
      action={bulkDeleteVehiclesAction}
      className="bulk-delete-form"
      onSubmit={(event) => {
        if (!allowBulkDelete || selectedIds.length === 0) {
          event.preventDefault();
          return;
        }

        if (!window.confirm(`Delete ${selectedIds.length} selected vehicle${selectedIds.length === 1 ? "" : "s"}?`)) {
          event.preventDefault();
        }
      }}
    >
      {allowBulkDelete ? (
        <div className="bulk-delete-toolbar card">
          <label className="bulk-delete-toggle">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={disabled || vehicles.length === 0}
            />
            <span>Select all</span>
          </label>
          <div className="bulk-delete-toolbar__actions">
            <span className="helper-text">
              {selectedIds.length} selected{vehicles.length > 0 ? ` of ${vehicles.length}` : ""}
            </span>
            <button
              type="submit"
              className="button button--danger"
              disabled={disabled || selectedIds.length === 0}
            >
              Delete selected
            </button>
          </div>
        </div>
      ) : null}

      <div className="garage-filter-toolbar">
        <div className="garage-filter-bar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`garage-filter-tab ${activeFilter === tab.key ? "garage-filter-tab--active" : ""}`}
            onClick={() => setActiveFilter(tab.key)}
          >
            <span>{tab.label}</span>
            <strong>{tab.count}</strong>
          </button>
        ))}
        </div>
        <label className="garage-sort-control">
          <span>Sort</span>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as GarageSortKey)}>
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {sections.map((section) =>
        groupedVehicles[section.key].length > 0 && (activeFilter === "all" || activeFilter === section.key) ? (
          <section key={section.key} className="garage-status-section">
            <div className="garage-status-section__header">
              <div>
                <span className="eyebrow">{section.title}</span>
                <h3>{groupedVehicles[section.key].length} vehicle{groupedVehicles[section.key].length === 1 ? "" : "s"}</h3>
              </div>
              <p>{section.helper}</p>
            </div>
            <div className="vehicle-grid">{groupedVehicles[section.key].map(renderVehicleCard)}</div>
          </section>
        ) : null
      )}
    </form>
  );
}
