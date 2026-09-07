/**
 * Run: npx --yes tsx lib/alerty/avatars.test.ts
 */
import { isHttpAvatar, presetAvatarUrl, presetFromUrl } from "./avatars";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(presetAvatarUrl("owl") === "preset:owl", "preset url format");
  assert(presetFromUrl("preset:owl")?.label === "Búho", "owl preset");
  assert(presetFromUrl("preset:nope") === null, "unknown preset");
  assert(presetFromUrl("https://cdn.example/a.png") === null, "http is not preset");
  assert(isHttpAvatar("https://cdn.example/a.png"), "https avatar");
  assert(!isHttpAvatar("preset:owl"), "preset is not http");
  console.log("avatars tests ok");
}

run();
