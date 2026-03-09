import { notFound, redirect } from "next/navigation";
import { VehicleForm } from "@/components/vehicle-form";
import { getAuthenticatedUser } from "@/lib/auth";
import { getVehicle } from "@/lib/dashboard";

export default async function EditVehiclePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20required");
  }

  const { id } = await params;
  const vehicle = await getVehicle(id, user.id);

  if (!vehicle) {
    notFound();
  }

  return (
    <main className="page-shell">
      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Vehicle profile</span>
            <h2>Edit vehicle</h2>
          </div>
          <p>Update the core identity data now. Live VIN and telemetry sync can refine it later.</p>
        </div>
        <VehicleForm
          mode="edit"
          submitLabel="Save changes"
          vehicleId={vehicle.id}
          initialValues={{
            ownershipStatus: vehicle.ownershipStatus,
            nickname: vehicle.nickname,
            year: String(vehicle.year),
            make: vehicle.make,
            model: vehicle.model,
            trim: vehicle.trim,
            vin: vehicle.vin,
            powertrain: vehicle.powertrain,
            image: vehicle.image,
            sourceUrl: vehicle.sourceUrl ?? "",
            watchNotes: vehicle.watchNotes ?? "",
            targetPriceUsd: vehicle.targetPriceUsd ? String(vehicle.targetPriceUsd) : "",
            targetMileage: vehicle.targetMileage ? String(vehicle.targetMileage) : ""
          }}
        />
      </section>
    </main>
  );
}
