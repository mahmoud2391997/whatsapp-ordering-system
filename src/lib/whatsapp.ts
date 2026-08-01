export async function sendWhatsApp(to: string, text: string): Promise<boolean> {
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? '';
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) return false;

  try {
    const formattedPhone = to.replace(/[^0-9]/g, '');
    const res = await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: { body: text },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function nowTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}
