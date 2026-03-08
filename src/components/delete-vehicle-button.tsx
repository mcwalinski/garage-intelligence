"use client";

interface DeleteVehicleButtonProps {
  action: (formData: FormData) => Promise<void>;
  vehicleId: string;
}

export function DeleteVehicleButton({ action, vehicleId }: DeleteVehicleButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Delete this vehicle and all related records?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <button type="submit" className="button button--danger">
        Delete vehicle
      </button>
    </form>
  );
}
