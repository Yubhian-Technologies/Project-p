const GRAPH_API_VERSION = "v20.0";

export function normalizePhoneNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 8) return null;
  return digits;
}

export async function sendWhatsAppMessage(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  templateName: string,
  params: string[],
): Promise<void> {
  const normalized = normalizePhoneNumber(to);
  if (!normalized) {
    console.warn(`Skipping WhatsApp message: "${to}" is not a usable phone number.`);
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalized,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en_US" },
          components: [
            {
              type: "body",
              parameters: params.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    console.error(`WhatsApp API error (${response.status}) sending to ${normalized}: ${body}`);
  }
}
