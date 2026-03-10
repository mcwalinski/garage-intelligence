import { Vehicle } from "@/lib/types";
import { getWatchOpportunity } from "@/lib/watchlist";

export type GarageSortKey =
  | "recent"
  | "value-desc"
  | "value-asc"
  | "alerts"
  | "maintenance"
  | "watch-opportunity"
  | "year-desc";

function latestValue(vehicle: Vehicle) {
  return vehicle.valuationHistory[vehicle.valuationHistory.length - 1]?.marketValueUsd ?? 0;
}

function dueTaskCount(vehicle: Vehicle) {
  return vehicle.maintenance.filter((task) => task.status === "due" || task.status === "overdue").length;
}

function alertCount(vehicle: Vehicle) {
  return vehicle.alerts.length;
}

function watchScore(vehicle: Vehicle) {
  const opportunity = getWatchOpportunity(vehicle);
  const priceDelta = opportunity.price.delta ?? 999_999;
  const mileageDelta = opportunity.mileage.delta ?? 999_999;
  return priceDelta + mileageDelta / 100;
}

export function sortGarageVehicles(vehicles: Vehicle[], sortKey: GarageSortKey) {
  const sorted = [...vehicles];

  sorted.sort((left, right) => {
    switch (sortKey) {
      case "value-desc":
        return latestValue(right) - latestValue(left);
      case "value-asc":
        return latestValue(left) - latestValue(right);
      case "alerts":
        return alertCount(right) - alertCount(left) || latestValue(right) - latestValue(left);
      case "maintenance":
        return dueTaskCount(right) - dueTaskCount(left) || latestValue(right) - latestValue(left);
      case "watch-opportunity": {
        const leftScore = left.ownershipStatus === "watching" ? watchScore(left) : Number.POSITIVE_INFINITY;
        const rightScore = right.ownershipStatus === "watching" ? watchScore(right) : Number.POSITIVE_INFINITY;
        return leftScore - rightScore;
      }
      case "year-desc":
        return right.year - left.year || right.make.localeCompare(left.make) || right.model.localeCompare(left.model);
      case "recent":
      default:
        return right.year - left.year || latestValue(right) - latestValue(left);
    }
  });

  return sorted;
}
