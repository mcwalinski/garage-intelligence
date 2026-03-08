import { VehicleForm } from "@/components/vehicle-form";

interface AddVehicleFormProps {
  disabled?: boolean;
  error?: string;
}

export function AddVehicleForm({ disabled = false, error }: AddVehicleFormProps) {
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Vehicle Intake</span>
          <h2>Add inventory to your garage</h2>
        </div>
        <p>Start with the VIN, confirm the decoded details, and save the vehicle into your active garage.</p>
      </div>
      {disabled ? <p className="empty-state">Sign in with Google to add vehicles to your garage.</p> : null}
      <VehicleForm mode="create" submitLabel="Add vehicle" disabled={disabled} error={error} />
    </section>
  );
}
