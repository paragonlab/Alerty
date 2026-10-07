/**
 * Run: deno test supabase/functions/_shared/guessCategory.test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { guessCategory, normalizeEs } from "./guessCategory.ts";

Deno.test("normalize strips accents", () => {
  assertEquals(normalizeEs("Balacera en Culiacán"), "balacera en culiacan");
});

Deno.test("specific categories beat alerta", () => {
  assertEquals(guessCategory("Reportan balacera en Tres Ríos"), "balacera");
  assertEquals(guessCategory("ALERTAN por levantón en Humaya"), "desaparecida");
  assertEquals(guessCategory("Despliegue de militares en el centro"), "operativo");
  assertEquals(guessCategory("Incendio de vehículo en la Loyola"), "incendio");
});

Deno.test("alerta catch-all", () => {
  assertEquals(guessCategory("Alertan zona de riesgo cerca del malecón"), "alerta");
});

Deno.test("null when empty / noise", () => {
  assertEquals(guessCategory(""), null);
  assertEquals(guessCategory("partido de fútbol y turismo"), null);
});
