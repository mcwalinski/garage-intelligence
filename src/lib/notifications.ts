import { appConfig } from "@/lib/config";

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmailNotification(input: SendEmailInput) {
  if (!appConfig.notifications.resendApiKey) {
    return {
      status: "skipped" as const,
      providerMessageId: null,
      errorMessage: "RESEND_API_KEY is not configured"
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appConfig.notifications.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Garage Intelligence <onboarding@resend.dev>",
      to: [input.to],
      subject: input.subject,
      text: input.text
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      status: "failed" as const,
      providerMessageId: null,
      errorMessage: payload?.message ?? `Email provider error (${response.status})`
    };
  }

  return {
    status: "sent" as const,
    providerMessageId: payload?.id ?? null,
    errorMessage: null
  };
}
