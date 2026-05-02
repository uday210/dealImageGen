import { NextRequest, NextResponse } from "next/server";
import { postToTelegram, sendAnimation } from "@/lib/telegram";
import { requireActiveSession } from "@/lib/requireActiveSession";

export async function POST(req: NextRequest) {
  const session = await requireActiveSession();
  if (session.errorResponse) return session.errorResponse;

  try {
    const { imageBase64, caption, botToken, chatId } = await req.json();

    const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
    const channel = chatId || process.env.TELEGRAM_CHAT_ID;

    if (!token || !channel) {
      return NextResponse.json({ error: "Bot token and chat ID required" }, { status: 400 });
    }

    const isGif = imageBase64.startsWith("data:image/gif;base64,");
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    const result = isGif
      ? await sendAnimation(token, channel, imageBuffer, caption)
      : await postToTelegram(token, channel, imageBuffer, caption);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message || "Telegram rejected the request", raw: result.raw },
        { status: 400 }
      );
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Telegram post failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
