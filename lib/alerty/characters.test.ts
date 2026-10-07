/**
 * Run: npx --yes tsx lib/alerty/characters.test.ts
 */
import {
  CITIZEN_CHARACTER_IDS,
  hashCharacterId,
  resolveCitizenCharacter,
} from "./characters";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(CITIZEN_CHARACTER_IDS.length === 12, "12 characters");
  assert(CITIZEN_CHARACTER_IDS.includes("tecolote"), "tecolote id");
  assert(CITIZEN_CHARACTER_IDS.includes("aguila"), "aguila id");

  assert(
    resolveCitizenCharacter({ userId: "u1", character: "vecina" }) === "vecina",
    "explicit character",
  );
  assert(
    resolveCitizenCharacter({ userId: "u1", avatarUrl: "preset:cat" }) === "gato",
    "legacy cat",
  );
  assert(
    resolveCitizenCharacter({ userId: "u1", avatarUrl: "preset:owl" }) === "tecolote",
    "legacy owl",
  );
  assert(
    resolveCitizenCharacter({ userId: "u1", avatarUrl: "preset:eagle" }) === "aguila",
    "legacy eagle",
  );

  const a = hashCharacterId("user-abc");
  const b = hashCharacterId("user-abc");
  assert(a === b, "hash stable");
  assert(CITIZEN_CHARACTER_IDS.includes(a), "hash in set");

  // wolf/fox/etc → hash, not a mapped character
  const wolf = resolveCitizenCharacter({ userId: "stable-id", avatarUrl: "preset:wolf" });
  assert(wolf === hashCharacterId("stable-id"), "wolf uses hash");

  console.log("characters tests ok");
}

run();
