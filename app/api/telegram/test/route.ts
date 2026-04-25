import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { botToken, chatId } = await req.json();

  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  const chat  = chatId  || process.env.TELEGRAM_CHAT_ID;

  if (!token) return NextResponse.json({ error: "No bot token provided" }, { status: 400 });

  const results: Record<string, unknown> = {};

  // 1. Validate bot token
  const meRes  = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const meJson = await meRes.json();
  results.botInfo = meJson.ok
    ? { ok: true, username: meJson.result.username, id: meJson.result.id }
    : { ok: false, error: meJson.description };

  if (!meJson.ok) {
    return NextResponse.json({
      step: "getMe",
      diagnosis: "❌ Bot token is invalid",
      ...results,
    });
  }

  if (!chat) {
    return NextResponse.json({
      step: "getMe",
      diagnosis: "✅ Bot token valid. Provide a chat_id to continue.",
      ...results,
    });
  }

  // 2. Get chat info
  const chatRes  = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chat)}`);
  const chatJson = await chatRes.json();
  results.chatInfo = chatJson.ok
    ? { ok: true, type: chatJson.result.type, title: chatJson.result.title, id: chatJson.result.id }
    : { ok: false, error: chatJson.description };

  if (!chatJson.ok) {
    return NextResponse.json({
      step: "getChat",
      diagnosis: "❌ Chat not found. Check the chat ID format (see tips below).",
      tips: [
        "For a PUBLIC channel: use @channelname",
        "For a PRIVATE channel or GROUP: use the numeric ID (negative number like -1001234567890)",
        "To get the numeric ID: forward a message from the group to @userinfobot",
        "Make sure the bot is added to the channel/group first",
        "For channels: bot must be an ADMIN with 'Post Messages' permission",
      ],
      ...results,
    });
  }

  // 3. Send a test text message
  const msgRes  = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text: "✅ Test message from Deal Image Generator — connection working!",
    }),
  });
  const msgJson = await msgRes.json();
  results.testMessage = msgJson.ok
    ? { ok: true, messageId: msgJson.result.message_id }
    : { ok: false, error: msgJson.description };

  if (!msgJson.ok) {
    return NextResponse.json({
      step: "sendMessage",
      diagnosis: "❌ Bot found the chat but can't post. Check permissions.",
      tips: [
        "For channels: bot must be an admin — go to channel → Administrators → Add Admin → select your bot → enable 'Post Messages'",
        "For groups: make sure the bot is a member (not just invited)",
      ],
      ...results,
    });
  }

  return NextResponse.json({
    step: "done",
    diagnosis: "✅ Everything working! Test message sent successfully.",
    ...results,
  });
}
