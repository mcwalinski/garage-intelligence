type RequiredServerEnvKey =
  | "DATABASE_URL"
  | "AUTH_SECRET";

type OptionalServerEnvKey =
  | "AUTH_GOOGLE_CLIENT_ID"
  | "AUTH_GOOGLE_CLIENT_SECRET"
  | "NHTSA_VPIC_API_URL"
  | "SMARTCAR_CLIENT_ID"
  | "SMARTCAR_CLIENT_SECRET"
  | "SMARTCAR_REDIRECT_URI"
  | "SMARTCAR_MANAGEMENT_TOKEN"
  | "SMARTCAR_WEBHOOK_SECRET"
  | "MARKETCHECK_API_KEY"
  | "MARKETCHECK_CLIENT_SECRET"
  | "MARKETCHECK_MARKET_ZIP"
  | "MARKETCHECK_MARKET_CITY"
  | "MARKETCHECK_MARKET_STATE"
  | "MARKETCHECK_DEALER_TYPE"
  | "AMAZON_ASSOCIATES_STORE_ID"
  | "AMAZON_CREATORS_API_KEY"
  | "EBAY_CLIENT_ID"
  | "EBAY_CLIENT_SECRET"
  | "RESEND_API_KEY"
  | "TWILIO_ACCOUNT_SID"
  | "TWILIO_AUTH_TOKEN"
  | "TWILIO_FROM_NUMBER"
  | "EXPO_ACCESS_TOKEN"
  | "S3_BUCKET"
  | "S3_REGION"
  | "S3_ACCESS_KEY_ID"
  | "S3_SECRET_ACCESS_KEY"
  | "CRON_SECRET"
  | "SENTRY_DSN";

function readEnv(key: RequiredServerEnvKey): string;
function readEnv(key: OptionalServerEnvKey): string | undefined;
function readEnv(key: RequiredServerEnvKey | OptionalServerEnvKey): string | undefined {
  const value = process.env[key];

  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

function requireEnv(key: RequiredServerEnvKey) {
  const value = readEnv(key);

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export const appConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Garage Intelligence",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  databaseUrl: requireEnv("DATABASE_URL"),
  authSecret: requireEnv("AUTH_SECRET"),
  providers: {
    nhtsaBaseUrl: readEnv("NHTSA_VPIC_API_URL") ?? "https://vpic.nhtsa.dot.gov/api",
    smartcarClientId: readEnv("SMARTCAR_CLIENT_ID"),
    smartcarClientSecret: readEnv("SMARTCAR_CLIENT_SECRET"),
    smartcarRedirectUri: readEnv("SMARTCAR_REDIRECT_URI"),
    smartcarManagementToken: readEnv("SMARTCAR_MANAGEMENT_TOKEN"),
    smartcarWebhookSecret: readEnv("SMARTCAR_WEBHOOK_SECRET"),
    marketCheckApiKey: readEnv("MARKETCHECK_API_KEY"),
    marketCheckClientSecret: readEnv("MARKETCHECK_CLIENT_SECRET"),
    marketCheckMarketZip: readEnv("MARKETCHECK_MARKET_ZIP") ?? "10001",
    marketCheckMarketCity: readEnv("MARKETCHECK_MARKET_CITY") ?? "New York",
    marketCheckMarketState: readEnv("MARKETCHECK_MARKET_STATE") ?? "NY",
    marketCheckDealerType: readEnv("MARKETCHECK_DEALER_TYPE") ?? "independent",
    amazonAssociatesStoreId: readEnv("AMAZON_ASSOCIATES_STORE_ID"),
    amazonCreatorsApiKey: readEnv("AMAZON_CREATORS_API_KEY"),
    ebayClientId: readEnv("EBAY_CLIENT_ID"),
    ebayClientSecret: readEnv("EBAY_CLIENT_SECRET")
  },
  notifications: {
    resendApiKey: readEnv("RESEND_API_KEY"),
    twilioAccountSid: readEnv("TWILIO_ACCOUNT_SID"),
    twilioAuthToken: readEnv("TWILIO_AUTH_TOKEN"),
    twilioFromNumber: readEnv("TWILIO_FROM_NUMBER"),
    expoAccessToken: readEnv("EXPO_ACCESS_TOKEN")
  },
  storage: {
    bucket: readEnv("S3_BUCKET"),
    region: readEnv("S3_REGION"),
    accessKeyId: readEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: readEnv("S3_SECRET_ACCESS_KEY")
  },
  ops: {
    cronSecret: readEnv("CRON_SECRET"),
    sentryDsn: readEnv("SENTRY_DSN")
  }
};

export function hasProviderConfig(provider: "smartcar" | "marketcheck" | "amazon" | "ebay") {
  switch (provider) {
    case "smartcar":
      return Boolean(appConfig.providers.smartcarClientId && appConfig.providers.smartcarClientSecret);
    case "marketcheck":
      return Boolean(appConfig.providers.marketCheckApiKey);
    case "amazon":
      return Boolean(appConfig.providers.amazonCreatorsApiKey);
    case "ebay":
      return Boolean(appConfig.providers.ebayClientId && appConfig.providers.ebayClientSecret);
    default:
      return false;
  }
}
