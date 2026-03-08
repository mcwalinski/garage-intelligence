"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { bulkDeleteVehiclesAction } from "@/app/add-vehicle/actions";
import { Vehicle } from "@/lib/types";

interface GarageBulkDeleteFormProps {
  vehicles: Vehicle[];
  disabled?: boolean;
}

export function GarageBulkDeleteForm({ vehicles, disabled = false }: GarageBulkDeleteFormProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const groupedVehicles = useMemo(
    () => ({
      own: vehicles.filter((vehicle) => vehicle.ownershipStatus === "own"),
      owned: vehicles.filter((vehicle) => vehicle.ownershipStatus === "owned"),
      watching: vehicles.filter((vehicle) => vehicle.ownershipStatus === "watching")
    }),
    [vehicles]
  );
  const allSelected = useMemo(
    () => vehicles.length > 0 && selectedIds.length === vehicles.length,
    [selectedIds.length, vehicles.length]
  );

  function toggleVehicle(vehicleId: string) {
    setSelectedIds((current) =>
      current.includes(vehicleId) ? current.filter((id) => id !== vehicleId) : [...current, vehicleId]
    );
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : vehicles.map((vehicle) => vehicle.id));
  }

  function renderVehicleCard(vehicle: Vehicle) {
    const isSelected = selectedIds.includes(vehicle.id);
    const latestValue = vehicle.valuationHistory[vehicle.valuationHistory.length - 1];
    const topTask = vehicle.maintenance[0];
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

  return (
    <form
      action={bulkDeleteVehiclesAction}
      className="bulk-delete-form"
      onSubmit={(event) => {
        if (selectedIds.length === 0) {
          event.preventDefault();
          return;
        }

        if (!window.confirm(`Delete ${selectedIds.length} selected vehicle${selectedIds.length === 1 ? "" : "s"}?`)) {
          event.preventDefault();
        }
      }}
    >
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

      {sections.map((section) =>
        groupedVehicles[section.key].length > 0 ? (
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
