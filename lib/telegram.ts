export async function postToTelegram(
  botToken: string,
  chatId: string,
  imageBuffer: Buffer,
  caption: string
): Promise<{ ok: boolean; message?: string; raw?: unknown }> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/png" });
  form.append("chat_id", chatId);
  form.append("photo", blob, "deal.png");
  // Strip HTML tags from caption — use plain text to avoid parse_mode errors
  form.append("caption", caption.replace(/<[^>]*>/g, ""));

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendPhoto`,
    { method: "POST", body: form }
  );

  const json = await res.json();
  return { ok: json.ok, message: json.description, raw: json };
}

export async function sendAnimation(
  botToken: string,
  chatId: string,
  gifBuffer: Buffer,
  caption: string
): Promise<{ ok: boolean; message?: string; raw?: unknown }> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(gifBuffer)], { type: "image/gif" });
  form.append("chat_id", chatId);
  form.append("animation", blob, "deal.gif");
  form.append("caption", caption.replace(/<[^>]*>/g, ""));

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendAnimation`,
    { method: "POST", body: form }
  );

  const json = await res.json();
  return { ok: json.ok, message: json.description, raw: json };
}
