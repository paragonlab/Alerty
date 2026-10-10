/**
 * Fixtures realistas de respuestas TomTom (sin key).
 * Formas alineadas a:
 * - Traffic Incidents Details API v5
 * - Traffic Flow Segment Data
 * - Routing API calculateRoute
 * - Search nearbySearch / categorySearch
 *
 * Usar en tests y mocks; el smoke real vive en scripts/tomtom-smoke.mjs.
 */

/** incidentDetails v5 — 3 incidentes en el corredor México 15 / 15D. */
export const FIXTURE_INCIDENT_DETAILS = {
  incidents: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-107.02, 23.95],
      },
      properties: {
        id: "tt-fixture-accident-elota-001",
        iconCategory: 1,
        magnitudeOfDelay: 3,
        events: [{ description: "Accidente · un carril afectado", code: 401 }],
        from: "km 118",
        to: "km 120",
        startTime: "2026-10-10T14:05:00Z",
        endTime: "2026-10-10T18:00:00Z",
        timeValidity: "present",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-106.8, 23.75],
          [-106.78, 23.72],
          [-106.76, 23.7],
        ],
      },
      properties: {
        id: "tt-fixture-closure-dimas-002",
        iconCategory: 8,
        magnitudeOfDelay: 4,
        events: [{ description: "Carril cerrado temporalmente", code: 701 }],
        from: "Dimas",
        to: "Costa Rica",
        startTime: "2026-10-10T08:00:00Z",
        endTime: "2026-10-11T20:00:00Z",
        timeValidity: "present",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-107.43, 24.72],
      },
      properties: {
        id: "tt-fixture-works-culiacan-003",
        iconCategory: 9,
        magnitudeOfDelay: 2,
        events: [{ description: "Obras en vialidad", code: 801 }],
        from: "salida sur",
        to: null,
        startTime: "2026-10-09T12:00:00Z",
        endTime: null,
        timeValidity: "present",
      },
    },
  ],
} as const;

/** flowSegmentData — tramo lento cerca de Elota. */
export const FIXTURE_FLOW_SEGMENT = {
  flowSegmentData: {
    frc: "FRC2",
    currentSpeed: 42,
    freeFlowSpeed: 95,
    currentTravelTime: 780,
    freeFlowTravelTime: 360,
    confidence: 0.91,
    roadClosure: false,
    coordinates: {
      coordinate: [
        { latitude: 23.951, longitude: -107.021 },
        { latitude: 23.948, longitude: -107.018 },
      ],
    },
  },
} as const;

/** calculateRoute — Culiacán → Mazatlán con alterna. */
export const FIXTURE_CALCULATE_ROUTE = {
  formatVersion: "0.0.12",
  routes: [
    {
      summary: {
        lengthInMeters: 218400,
        travelTimeInSeconds: 10080,
        trafficDelayInSeconds: 1080,
        departureTime: "2026-10-10T15:00:00-07:00",
        arrivalTime: "2026-10-10T17:48:00-07:00",
      },
      legs: [],
      sections: [{ startPointIndex: 0, endPointIndex: 120, sectionType: "TRAVEL_MODE" }],
    },
    {
      summary: {
        lengthInMeters: 232000,
        travelTimeInSeconds: 11700,
        trafficDelayInSeconds: 600,
        departureTime: "2026-10-10T15:00:00-07:00",
        arrivalTime: "2026-10-10T18:15:00-07:00",
      },
      legs: [],
      sections: [],
    },
  ],
} as const;

/** nearbySearch — gasolineras cerca del corredor. */
export const FIXTURE_NEARBY_GAS = {
  summary: { query: "", queryType: "NEARBY", numResults: 2, totalResults: 2 },
  results: [
    {
      type: "POI",
      id: "poi-gas-001",
      score: 2.1,
      dist: 420,
      poi: { name: "Pemex Costa Rica", categories: ["petrol station"], categorySet: [{ id: 7311 }] },
      position: { lat: 24.55, lon: -107.44 },
    },
    {
      type: "POI",
      id: "poi-gas-002",
      score: 1.8,
      dist: 2100,
      poi: { name: "Shell Elota", categories: ["petrol station"], categorySet: [{ id: 7311 }] },
      position: { lat: 23.96, lon: -107.03 },
    },
  ],
} as const;

export const FIXTURE_NEARBY_HOSPITAL = {
  summary: { query: "", queryType: "NEARBY", numResults: 1, totalResults: 1 },
  results: [
    {
      type: "POI",
      id: "poi-hosp-001",
      score: 1.5,
      dist: 1200,
      poi: { name: "Hospital General Villa Unión", categories: ["hospital"], categorySet: [{ id: 7321 }] },
      position: { lat: 23.3, lon: -106.36 },
    },
  ],
} as const;
