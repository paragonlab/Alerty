/**
 * Run: npx tsx lib/alerty/share.test.ts
 */
import {
  pulsePublicUrl,
  videoPublicUrl,
  dailySummaryShareMessage,
  APP_SHARE_URL,
  communityPublicId,
  isCommunityPublicId,
} from "./shareCore";
import { buildShareCardModel, sharePulseMessage, shareCardSvg } from "./shareCard";
import { neighborThanksLine } from "./neighborThanks";
import { familyInviteUrl, familyInviteMessage } from "./familyInvite";
import { appShareMessage, coloniaTagline, neighborsBlurb } from "./brandCopy";

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
  assert(videoPublicUrl(id) === `${APP_SHARE_URL}/v/${id}`, "URL video /v/<id>");
  assert(
    videoPublicUrl(id, "community") === `${APP_SHARE_URL}/v/c-${id}`,
    "URL video comunidad /v/c-<id>",
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

  const videoShare = buildShareCardModel({
    id,
    kind: "community",
    surface: "video",
    category: "bloqueo",
    title: "Video en Boulevares",
    placeLabel: "Boulevares",
    cityName: "Culiacán",
  });
  assert(videoShare.url.includes("/v/c-"), `video url: ${videoShare.url}`);
  assert(sharePulseMessage(videoShare).includes("/v/c-"), "mensaje video con /v/");

  const news = buildShareCardModel({
    id,
    kind: "community",
    category: "alerta",
    title: "PROYECTAN 37 MIL VIVIENDAS DEL BIENESTAR PARA Sinaloa",
    placeLabel: "Culiacán",
    cityName: "Culiacán",
  });
  assert(news.actionLine === "", "noticia informativa sin action line");
  assert(news.headline.startsWith("Proyectan"), `oración: ${news.headline}`);
  assert(/\bmil\b/.test(news.headline), `sentence case mil: ${news.headline}`);
  assert(!sharePulseMessage(news).includes("Échale un ojo"), "mensaje sin action info");
  assert(shareCardSvg(news).includes("tspan"), "SVG wrap");
  assert(!shareCardSvg(news).includes("Échale un ojo"), "SVG sin action info");

  const hashed = buildShareCardModel({
    id,
    kind: "community",
    category: "otro",
    title: "Obras del Bienestar en #Sinaloa @NoticiasMX",
    placeLabel: "Culiacán",
    cityName: "Culiacán",
  });
  assert(!hashed.headline.includes("#"), `share sin #: ${hashed.headline}`);
  assert(hashed.headline.includes("Sinaloa"), `conserva Sinaloa: ${hashed.headline}`);
  assert(!hashed.headline.includes("@"), `share sin @: ${hashed.headline}`);

  const thanks = neighborThanksLine({ username: "vecina", notifiedCount: 12 });
  assert(thanks === "Gracias a @vecina se avisó a 12 personas", `thanks: ${thanks}`);
  assert(neighborThanksLine({ username: "x", notifiedCount: 0 }) === null, "sin gracias si N=0");

  const invite = familyInviteUrl({ zoneLabel: "Las Quintas", lat: 24.8099, lng: -107.3874 });
  assert(invite.includes("invite=familia"), "invite flag");
  assert(invite.includes("zone=Las"), "zone en query");
  assert(invite.includes("lat=24.810") || invite.includes("lat=24.809"), "lat redondeada");
  const inviteMsg = familyInviteMessage({ zoneLabel: "Centro", cityName: "Mazatlán" });
  assert(inviteMsg.includes("Pulso"), "mensaje familia");
  assert(inviteMsg.includes("Mazatlán"), `invite con ciudad: ${inviteMsg}`);
  assert(inviteMsg.includes("¿Cómo está tu colonia en Mazatlán?"), "tagline en invite");

  const daily = dailySummaryShareMessage({
    cityName: "Culiacán",
    total: 5,
    byCategory: [{ label: "Bloqueo Vial", count: 2 }],
    cleared: 1,
    allies: 2,
    toneLabel: "Día tranquilo",
  });
  assert(daily.startsWith("Así estuvo Culiacán hoy"), "resumen del día");

  assert(coloniaTagline("Mazatlán").includes("Mazatlán"), "tagline ciudad");
  assert(coloniaTagline(null) === "¿Cómo está tu colonia hoy?", "tagline neutro");
  assert(neighborsBlurb(null).includes("Culiacán y Mazatlán"), "blurb global");
  assert(appShareMessage("Mazatlán").includes("Mazatlán"), "share app dinámico");
  assert(!appShareMessage("Mazatlán").includes("en Culiacán"), "share app sin ciudad fija");
  assert(daily.includes("ya se despejó"), "menciona despejados");
  assert(daily.includes("aliado"), "menciona aliados");

  console.log("share.test.ts OK");
}

run();
