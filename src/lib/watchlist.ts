import { Vehicle } from "@/lib/types";

export interface WatchMetric {
  label: string;
  tone: "positive" | "neutral" | "negative";
  delta: number | null;
}

export interface WatchOpportunity {
  latestValue: number | null;
  price: WatchMetric;
  mileage: WatchMetric;
  summary: string;
}

function getLatestValue(vehicle: Vehicle) {
  return vehicle.valuationHistory[vehicle.valuationHistory.length - 1]?.marketValueUsd ?? null;
}

function formatCurrencyDelta(value: number) {
  return `${value > 0 ? "+" : "-"}$${Math.abs(value).toLocaleString()}`;
}

function formatMileageDelta(value: number) {
  return `${value > 0 ? "+" : "-"}${Math.abs(value).toLocaleString()} mi`;
}

export function getWatchOpportunity(vehicle: Vehicle): WatchOpportunity {
  const latestValue = getLatestValue(vehicle);
  const currentMileage = vehicle.telemetry.odometerMiles;
  const hasPriceTarget = typeof vehicle.targetPriceUsd === "number";
  const hasMileageTarget = typeof vehicle.targetMileage === "number";

  let price: WatchMetric = {
    label: hasPriceTarget ? `Target $${vehicle.targetPriceUsd?.toLocaleString()}` : "No target price set",
    tone: "neutral",
    delta: null
  };

  if (hasPriceTarget && latestValue !== null) {
    const delta = latestValue - (vehicle.targetPriceUsd ?? 0);
    price =
      delta <= 0
        ? {
            label: `${formatCurrencyDelta(delta)} vs target`,
            tone: "positive",
            delta
          }
        : delta / (vehicle.targetPriceUsd || 1) <= 0.05
          ? {
              label: `${formatCurrencyDelta(delta)} vs target`,
              tone: "neutral",
              delta
            }
          : {
              label: `${formatCurrencyDelta(delta)} vs target`,
              tone: "negative",
              delta
            };
  } else if (hasPriceTarget) {
    price = {
      label: `Target $${vehicle.targetPriceUsd?.toLocaleString()} waiting on valuation`,
      tone: "neutral",
      delta: null
    };
  }

  let mileage: WatchMetric = {
    label: hasMileageTarget ? `Target ${vehicle.targetMileage?.toLocaleString()} mi` : "No target mileage set",
    tone: "neutral",
    delta: null
  };

  if (hasMileageTarget) {
    const delta = currentMileage - (vehicle.targetMileage ?? 0);
    mileage =
      delta <= 0
        ? {
            label: `${formatMileageDelta(delta)} vs target`,
            tone: "positive",
            delta
          }
        : delta / Math.max(vehicle.targetMileage || 1, 1) <= 0.08
          ? {
              label: `${formatMileageDelta(delta)} vs target`,
              tone: "neutral",
              delta
            }
          : {
              label: `${formatMileageDelta(delta)} vs target`,
              tone: "negative",
              delta
            };
  }

  const summary =
    price.tone === "positive" && mileage.tone === "positive"
      ? "Strong match against your watch targets"
      : price.tone === "positive"
        ? "Price is in range, confirm condition and mileage"
        : mileage.tone === "positive"
          ? "Mileage is in range, watch market price closely"
          : hasPriceTarget || hasMileageTarget
            ? "Still above target thresholds"
            : "Set target price or mileage to track this vehicle";

  return { latestValue, price, mileage, summary };
}

export function sortWatchingVehicles(vehicles: Vehicle[]) {
  return [...vehicles].sort((left, right) => {
    const leftOpportunity = getWatchOpportunity(left);
    const rightOpportunity = getWatchOpportunity(right);
    const leftPriceScore = leftOpportunity.price.delta ?? 1_000_000;
    const rightPriceScore = rightOpportunity.price.delta ?? 1_000_000;
    const leftMileageScore = leftOpportunity.mileage.delta ?? 1_000_000;
    const rightMileageScore = rightOpportunity.mileage.delta ?? 1_000_000;
    const leftScore =
      leftPriceScore + leftMileageScore / 100;
    const rightScore =
      rightPriceScore + rightMileageScore / 100;

    return leftScore - rightScore;
  });
}
