export type RiskLevel = 'high' | 'medium' | 'low';

export interface BufferZone {
  id: number;
  radiusKm: number;
  riskLevel: RiskLevel;
  color: string;
  fillOpacity: number;
  polygon?: GeoJSON.Feature<GeoJSON.Polygon>;
}

export interface BufferZoneStats {
  zoneId: number;
  radiusKm: number;
  riskLevel: RiskLevel;
  schools: number;
  hospitals: number;
  police: number;
  fireStations: number;
  riskZones: number;
  total: number;
}

export interface BufferAnalysisResult {
  centerPoint: [number, number];
  zones: BufferZone[];
  statistics: BufferZoneStats[];
  totalElements: {
    schools: number;
    hospitals: number;
    police: number;
    fireStations: number;
    riskZones: number;
  };
}

export const BUFFER_ZONE_CONFIGS: Omit<BufferZone, 'polygon'>[] = [
  { id: 1, radiusKm: 1, riskLevel: 'high', color: '#e74c3c', fillOpacity: 0.3 },
  { id: 2, radiusKm: 2, riskLevel: 'high', color: '#e74c3c', fillOpacity: 0.25 },
  { id: 3, radiusKm: 3, riskLevel: 'high', color: '#e74c3c', fillOpacity: 0.2 },
  { id: 4, radiusKm: 4, riskLevel: 'medium', color: '#f39c12', fillOpacity: 0.2 },
  { id: 5, radiusKm: 5, riskLevel: 'low', color: '#27ae60', fillOpacity: 0.15 }
];

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  high: 'Alto Riesgo',
  medium: 'Riesgo Medio',
  low: 'Riesgo Bajo'
};
