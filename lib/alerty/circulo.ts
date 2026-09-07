export const CIRCULO_FREE_ZONE_LIMIT = 1;
export const CIRCULO_PLUS_ZONE_LIMIT = 5;
export const CIRCULO_PRICE_LABEL = "$39 MXN/mes";
export const ALIADO_PRICE_LABEL = "$499 MXN/mes";

export function circuloZoneLimit(isPremium: boolean): number {
  return isPremium ? CIRCULO_PLUS_ZONE_LIMIT : CIRCULO_FREE_ZONE_LIMIT;
}

export function canAddCirculoZone(count: number, isPremium: boolean): boolean {
  return count < circuloZoneLimit(isPremium);
}
