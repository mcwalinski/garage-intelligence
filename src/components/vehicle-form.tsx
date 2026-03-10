"use client";

import { useState, useTransition } from "react";
import { addVehicleAction, updateVehicleAction } from "@/app/add-vehicle/actions";
import { Powertrain, VehicleOwnershipStatus } from "@/lib/types";

type VehicleFormMode = "create" | "edit";

interface VehicleFormValues {
  ownershipStatus: VehicleOwnershipStatus;
  nickname: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  vin: string;
  powertrain: Powertrain;
  image: string;
  sourceUrl: string;
  watchNotes: string;
  lifecycleNotes: string;
  acquisitionDate: string;
  dispositionDate: string;
  purchasePriceUsd: string;
  salePriceUsd: string;
  targetPriceUsd: string;
  targetMileage: string;
}

interface VinLookupPayload {
  year: number | null;
  make: string;
  model: string;
  trim: string;
  powertrain: Powertrain;
  bodyClass: string;
  manufacturer: string;
  imageUrl: string;
  imageSource: string;
}

interface VehicleFormProps {
  mode: VehicleFormMode;
  submitLabel: string;
  vehicleId?: string;
  initialValues?: Partial<VehicleFormValues>;
  disabled?: boolean;
  error?: string;
}

const defaultValues: VehicleFormValues = {
  ownershipStatus: "own",
  nickname: "",
  year: "",
  make: "",
  model: "",
  trim: "",
  vin: "",
  powertrain: "gas",
  image: "",
  sourceUrl: "",
  watchNotes: "",
  lifecycleNotes: "",
  acquisitionDate: "",
  dispositionDate: "",
  purchasePriceUsd: "",
  salePriceUsd: "",
  targetPriceUsd: "",
  targetMileage: ""
};

export function VehicleForm({
  mode,
  submitLabel,
  vehicleId,
  initialValues,
  disabled = false,
  error
}: VehicleFormProps) {
  const [formValues, setFormValues] = useState<VehicleFormValues>({
    ...defaultValues,
    ...initialValues
  });
  const [vinStatus, setVinStatus] = useState<string>("");
  const [vinImageSource, setVinImageSource] = useState<string>("");
  const [isLookingUp, startLookupTransition] = useTransition();

  function updateField<K extends keyof VehicleFormValues>(key: K, value: VehicleFormValues[K]) {
    setFormValues((current) => ({
      ...current,
      [key]: value
    }));
  }

  function lookupVin() {
    const vin = formValues.vin.trim().toUpperCase();

    if (!vin) {
      setVinStatus("Enter a VIN before running lookup.");
      return;
    }

    startLookupTransition(async () => {
      setVinStatus("Looking up VIN...");

      try {
        const response = await fetch(`/api/vin-decode?vin=${encodeURIComponent(vin)}`, {
          method: "GET",
          cache: "no-store"
        });
        const payload = (await response.json()) as VinLookupPayload | { error: string };

        if (!response.ok || "error" in payload) {
          setVinStatus(("error" in payload ? payload.error : "VIN lookup failed") || "VIN lookup failed");
          return;
        }

        setFormValues((current) => ({
          ...current,
          vin,
          year: payload.year ? String(payload.year) : current.year,
          make: payload.make || current.make,
          model: payload.model || current.model,
          trim: payload.trim || current.trim,
          powertrain: payload.powertrain || current.powertrain,
          image: payload.imageUrl || current.image,
          nickname:
            current.nickname ||
            [payload.year, payload.make, payload.model].filter(Boolean).join(" ")
        }));
        setVinImageSource(payload.imageSource || "");
        setVinStatus(
          `VIN matched ${[payload.year, payload.make, payload.model, payload.trim].filter(Boolean).join(" ")}`
        );
      } catch {
        setVinStatus("VIN lookup failed.");
      }
    });
  }

  const action = mode === "edit" ? updateVehicleAction : addVehicleAction;

  return (
    <form action={action} className="card vehicle-form">
      {error ? <p className="auth-error">{error}</p> : null}
      {vehicleId ? <input type="hidden" name="vehicleId" value={vehicleId} /> : null}
      <div className="vin-lookup-row">
        <label className="field field--wide">
          <span>VIN</span>
          <input
            name="vin"
            value={formValues.vin}
            onChange={(event) => updateField("vin", event.target.value.toUpperCase())}
            placeholder="Optional unless you have it"
            disabled={disabled}
          />
        </label>
        <button
          type="button"
          className="button button--ghost"
          onClick={lookupVin}
          disabled={isLookingUp || disabled}
        >
          {isLookingUp ? "Looking up..." : "Lookup VIN"}
        </button>
      </div>
      <p className="helper-text">
        Use VIN lookup when available. Historical or watchlist vehicles can be saved without a VIN,
        then refined later.
      </p>
      {vinStatus ? <p className="helper-text">{vinStatus}</p> : null}
      {formValues.image ? (
        <div className="vin-preview card">
          <div className="vin-preview__image" style={{ backgroundImage: `url(${formValues.image})` }} />
          <div>
            <strong>Suggested vehicle image</strong>
            <p className="helper-text">
              {vinImageSource || "Best-effort match based on decoded year, make, and model."}
            </p>
          </div>
        </div>
      ) : null}
      <div className="form-grid">
        <label className="field">
          <span>Vehicle status</span>
          <select
            name="ownershipStatus"
            value={formValues.ownershipStatus}
            onChange={(event) => updateField("ownershipStatus", event.target.value as VehicleOwnershipStatus)}
            disabled={disabled}
          >
            <option value="own">Own</option>
            <option value="owned">Owned</option>
            <option value="watching">Watching</option>
          </select>
        </label>
        <label className="field">
          <span>Nickname</span>
          <input
            name="nickname"
            value={formValues.nickname}
            onChange={(event) => updateField("nickname", event.target.value)}
            placeholder="Weekend 911"
            required
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span>Year</span>
          <input
            name="year"
            type="number"
            value={formValues.year}
            onChange={(event) => updateField("year", event.target.value)}
            placeholder="2023"
            min="1900"
            max="2030"
            required
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span>Make</span>
          <input
            name="make"
            value={formValues.make}
            onChange={(event) => updateField("make", event.target.value)}
            placeholder="Porsche"
            required
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span>Model</span>
          <input
            name="model"
            value={formValues.model}
            onChange={(event) => updateField("model", event.target.value)}
            placeholder="911"
            required
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span>Trim</span>
          <input
            name="trim"
            value={formValues.trim}
            onChange={(event) => updateField("trim", event.target.value)}
            placeholder="Carrera 4 GTS"
            required
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span>Powertrain</span>
          <select
            name="powertrain"
            value={formValues.powertrain}
            onChange={(event) => updateField("powertrain", event.target.value as Powertrain)}
            disabled={disabled}
          >
            <option value="gas">Gas</option>
            <option value="diesel">Diesel</option>
            <option value="hybrid">Hybrid</option>
            <option value="ev">EV</option>
          </select>
        </label>
        <label className="field field--wide">
          <span>Image URL</span>
          <input
            name="image"
            value={formValues.image}
            onChange={(event) => updateField("image", event.target.value)}
            placeholder="https://..."
            disabled={disabled}
          />
        </label>
        <label className="field field--wide">
          <span>Source URL</span>
          <input
            name="sourceUrl"
            value={formValues.sourceUrl}
            onChange={(event) => updateField("sourceUrl", event.target.value)}
            placeholder="Listing, auction, dealer, or research URL"
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span>Acquired on</span>
          <input
            name="acquisitionDate"
            type="date"
            value={formValues.acquisitionDate}
            onChange={(event) => updateField("acquisitionDate", event.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span>Sold / moved on</span>
          <input
            name="dispositionDate"
            type="date"
            value={formValues.dispositionDate}
            onChange={(event) => updateField("dispositionDate", event.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span>Purchase price</span>
          <input
            name="purchasePriceUsd"
            type="number"
            min="0"
            value={formValues.purchasePriceUsd}
            onChange={(event) => updateField("purchasePriceUsd", event.target.value)}
            placeholder="Optional"
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span>Sale price</span>
          <input
            name="salePriceUsd"
            type="number"
            min="0"
            value={formValues.salePriceUsd}
            onChange={(event) => updateField("salePriceUsd", event.target.value)}
            placeholder="Optional"
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span>Target price</span>
          <input
            name="targetPriceUsd"
            type="number"
            min="0"
            value={formValues.targetPriceUsd}
            onChange={(event) => updateField("targetPriceUsd", event.target.value)}
            placeholder="Optional"
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span>Target mileage</span>
          <input
            name="targetMileage"
            type="number"
            min="0"
            value={formValues.targetMileage}
            onChange={(event) => updateField("targetMileage", event.target.value)}
            placeholder="Optional"
            disabled={disabled}
          />
        </label>
        <label className="field field--wide">
          <span>Watch / ownership notes</span>
          <input
            name="watchNotes"
            value={formValues.watchNotes}
            onChange={(event) => updateField("watchNotes", event.target.value)}
            placeholder="Ownership history, target spec, seller notes, or acquisition plan"
            disabled={disabled}
          />
        </label>
        <label className="field field--wide">
          <span>Lifecycle notes</span>
          <input
            name="lifecycleNotes"
            value={formValues.lifecycleNotes}
            onChange={(event) => updateField("lifecycleNotes", event.target.value)}
            placeholder="Acquisition story, sale context, ownership highlights, or what to remember"
            disabled={disabled}
          />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="button button--primary" disabled={disabled}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
