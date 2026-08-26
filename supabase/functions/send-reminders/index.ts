import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const cronSecret = Deno.env.get("CRON_SECRET")!;
const appUrl = "https://shenedaneil-tech.github.io/MemoryDock/";

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
webpush.setVapidDetails(appUrl, vapidPublicKey, vapidPrivateKey);

Deno.serve(async (request) => {
  if (request.method !== "POST" || request.headers.get("x-cron-secret") !== cronSecret) return new Response("Unauthorized", { status: 401 });

  const now = new Date();
  const earliest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("id,user_id,text,remind_at")
    .eq("status", "pending")
    .lte("remind_at", now.toISOString())
    .gte("remind_at", earliest.toISOString())
    .order("remind_at", { ascending: true })
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  let sent = 0;

  for (const reminder of reminders || []) {
    const { data: subscriptions } = await supabase.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", reminder.user_id);
    let delivered = false;
    for (const subscription of subscriptions || []) {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({
          title: "MemoryDock reminder",
          body: reminder.text,
          tag: `memorydock-${reminder.id}`,
          url: appUrl,
        }), { TTL: 86_400 });
        delivered = true;
      } catch (pushError) {
        const statusCode = (pushError as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      }
    }
    if (delivered) {
      await supabase.from("reminders").update({ status: "sent", sent_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", reminder.id);
      sent += 1;
    }
  }

  return Response.json({ checked: reminders?.length || 0, sent });
});
