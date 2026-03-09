import { refreshGarageValuationsAction } from "@/app/integrations/marketcheck/actions";

interface ValuationRefreshCardProps {
  disabled?: boolean;
  compact?: boolean;
}

export function ValuationRefreshCard({ disabled = false, compact = false }: ValuationRefreshCardProps) {
  return (
    <section>
      {!compact ? (
        <div className="section-heading">
          <div>
            <span className="eyebrow">Market value</span>
            <h2>Refresh valuations</h2>
          </div>
          <p>Pull fresh MarketCheck pricing snapshots for every VIN-backed vehicle in the garage.</p>
        </div>
      ) : null}
      <div className={`card smartcar-card ${compact ? "smartcar-card--compact" : ""}`}>
        <div className="smartcar-card__header">
          <div>
            <strong>Garage valuation refresh</strong>
            <p className="helper-text">
              Uses MarketCheck VIN history and recent listing prices to estimate current market value.
            </p>
          </div>
          {disabled ? (
            <span className="button button--ghost">Sign in required</span>
          ) : (
            <form action={refreshGarageValuationsAction}>
              <button type="submit" className="button button--primary">
                Refresh all valuations
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
