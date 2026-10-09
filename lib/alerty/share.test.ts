/**
 * Run: npx tsx lib/alerty/share.test.ts
 */
import {
  pulsePublicUrl,
  dailySummaryShareMessage,
  APP_SHARE_URL,
  communityPublicId,
  isCommunityPublicId,
} from "./shareCore";
import { buildShareCardModel, sharePulseMessage, shareCardSvg } from "./shareCard";
import { neighborThanksLine } from "./neighborThanks";
import { familyInviteUrl, familyInviteMessage } from "./familyInvite";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  const id = "11111111-1111-4111-8111-111111111111";
  assert(pulsePublicUrl(id) === `${APP_SHARE_URL}/p/${id}`, "URL pública /p/<id>");
  assert(
    pulsePublicUrl(id, "community") === `${APP_SHARE_URL}/p/c-${id}`,
    "URL comunidad /p/c-<id>",
  );
  assert(isCommunityPublicId(communityPublicId(id)), "prefijo c-");

  const model = buildShareCardModel({
    id,
    category: "bloqueo",
    title: "BLOQUEO EN BOULEVARES",
    placeLabel: "Boulevares",
    cityName: "Culiacán",
    status: "active",
  });
  assert(model.url.includes("/p/"), "modelo apunta a /p/");
  assert(model.actionLine.length > 0, "tiene action line");
  assert(!model.headline.includes("BLOQUEO EN BOULEVARES") || model.headline !== "BLOQUEO EN BOULEVARES", "suaviza mayúsculas");

  const msg = sharePulseMessage(model);
  assert(msg.includes(model.url), "mensaje incluye link");
  assert(!msg.toLowerCase().startsWith("alerta en pulso"), "sin prefijo alarmista");

  const cleared = buildShareCardModel({
    id,
    category: "accidente",
    title: "Choque menor",
    placeLabel: "Centro",
    cityName: "Mazatlán",
    status: "resolved",
  });
  assert(sharePulseMessage(cleared).includes("Ya se despejó"), "despejado en mensaje");

  const svg = shareCardSvg(model);
  assert(svg.includes("<svg"), "SVG válido");
  assert(svg.includes("PULSO"), "logo Pulso en tarjeta");
  assert(!svg.includes("24.809"), "sin coords precisas en SVG");

  const operativo = buildShareCardModel({
    id,
    category: "operativo",
    title: "Operativo en zona",
    placeLabel: "Las Quintas",
    cityName: "Culiacán",
  });
  assert(operativo.placeLine === "Culiacán", "operativo generaliza a ciudad");
  assert(!operativo.showMapHint, "operativo sin hint de mapa");

  const community = buildShareCardModel({
    id,
    kind: "community",
    category: "bloqueo",
    title: "Tráfico lento cerca de Boulevares",
    placeLabel: "Boulevares",
    cityName: "Culiacán",
  });
  assert(community.url.includes("/p/c-"), `community url: ${community.url}`);

  const thanks = neighborThanksLine({ username: "vecina", notifiedCount: 12 });
  assert(thanks === "Gracias a @vecina se avisó a 12 personas", `thanks: ${thanks}`);
  assert(neighborThanksLine({ username: "x", notifiedCount: 0 }) === null, "sin gracias si N=0");

  const invite = familyInviteUrl({ zoneLabel: "Las Quintas", lat: 24.8099, lng: -107.3874 });
  assert(invite.includes("invite=familia"), "invite flag");
  assert(invite.includes("zone=Las"), "zone en query");
  assert(invite.includes("lat=24.810") || invite.includes("lat=24.809"), "lat redondeada");
  assert(familyInviteMessage({ zoneLabel: "Centro" }).includes("Pulso"), "mensaje familia");

  const daily = dailySummaryShareMessage({
    cityName: "Culiacán",
    total: 5,
    byCategory: [{ label: "Bloqueo Vial", count: 2 }],
    cleared: 1,
    allies: 2,
    toneLabel: "Día tranquilo",
  });
  assert(daily.startsWith("Así estuvo Culiacán hoy"), "resumen del día");
  assert(daily.includes("ya se despejó"), "menciona despejados");
  assert(daily.includes("aliado"), "menciona aliados");

  console.log("share.test.ts OK");
}

run();
