import { Injectable } from '@angular/core';
import * as turf from '@turf/turf';
import {
  BufferZone,
  BufferZoneStats,
  BufferAnalysisResult,
  RiskLevel
} from '../models/buffer-zone.model';
import { LayerFeature, LayerType } from '../models/layer.model';
import { School } from '../models/school.model';

type PolygonFeature = GeoJSON.Feature<GeoJSON.Polygon> | GeoJSON.Feature<GeoJSON.MultiPolygon>;

export interface BufferConfig {
  totalRadius: number;  // Radio total en km
  zoneWidth: number;    // Ancho de cada zona en km
}

@Injectable({
  providedIn: 'root'
})
export class BufferAnalysisService {

  private readonly defaultConfig: BufferConfig = {
    totalRadius: 5,
    zoneWidth: 1
  };

  createBufferZones(centerPoint: [number, number], config?: BufferConfig): BufferZone[] {
    const { totalRadius, zoneWidth } = config || this.defaultConfig;
    const numZones = Math.ceil(totalRadius / zoneWidth);
    const zones: BufferZone[] = [];

    for (let i = 1; i <= numZones; i++) {
      const radiusKm = Math.min(i * zoneWidth, totalRadius);
      const riskLevel = this.calculateRiskLevel(i, numZones);
      const color = this.getRiskColor(riskLevel);
      const fillOpacity = this.getFillOpacity(i, numZones);

      const point = turf.point([centerPoint[1], centerPoint[0]]);
      const buffered = turf.buffer(point, radiusKm, { units: 'kilometers' });

      zones.push({
        id: i,
        radiusKm,
        riskLevel,
        color,
        fillOpacity,
        polygon: buffered as GeoJSON.Feature<GeoJSON.Polygon>
      });
    }

    return zones;
  }

  private calculateRiskLevel(zoneIndex: number, totalZones: number): RiskLevel {
    const ratio = zoneIndex / totalZones;
    if (ratio <= 0.6) return 'high';
    if (ratio <= 0.8) return 'medium';
    return 'low';
  }

  private getRiskColor(riskLevel: RiskLevel): string {
    const colors: Record<RiskLevel, string> = {
      high: '#e74c3c',
      medium: '#f39c12',
      low: '#27ae60'
    };
    return colors[riskLevel];
  }

  private getFillOpacity(zoneIndex: number, totalZones: number): number {
    return 0.35 - (zoneIndex / totalZones) * 0.2;
  }

  analyzeBufferZones(
    centerPoint: [number, number],
    schools: School[],
    layerFeatures: Map<LayerType, LayerFeature[]>,
    config?: BufferConfig
  ): BufferAnalysisResult {
    const zones = this.createBufferZones(centerPoint, config);
    const statistics = this.calculateStatistics(zones, schools, layerFeatures);

    const totalElements = {
      schools: schools.length,
      hospitals: layerFeatures.get('hospitals')?.length || 0,
      police: layerFeatures.get('police')?.length || 0,
      fireStations: layerFeatures.get('fire_stations')?.length || 0,
      riskZones: layerFeatures.get('risk_zones')?.length || 0
    };

    return {
      centerPoint,
      zones,
      statistics,
      totalElements
    };
  }

  private calculateStatistics(
    zones: BufferZone[],
    schools: School[],
    layerFeatures: Map<LayerType, LayerFeature[]>
  ): BufferZoneStats[] {
    const prevZonePolygons: GeoJSON.Feature<GeoJSON.Polygon>[] = [];

    return zones.map((zone) => {
      const ringPolygon = this.createRingPolygon(zone.polygon!, prevZonePolygons);
      prevZonePolygons.push(zone.polygon!);

      const schoolsInZone = this.countPointsInPolygon(
        schools.map(s => this.getSchoolCenter(s)),
        ringPolygon
      );

      const hospitalsInZone = this.countFeaturesInPolygon(
        layerFeatures.get('hospitals') || [],
        ringPolygon
      );

      const policeInZone = this.countFeaturesInPolygon(
        layerFeatures.get('police') || [],
        ringPolygon
      );

      const fireStationsInZone = this.countFeaturesInPolygon(
        layerFeatures.get('fire_stations') || [],
        ringPolygon
      );

      const riskZonesInZone = this.countFeaturesInPolygon(
        layerFeatures.get('risk_zones') || [],
        ringPolygon
      );

      return {
        zoneId: zone.id,
        radiusKm: zone.radiusKm,
        riskLevel: zone.riskLevel,
        schools: schoolsInZone,
        hospitals: hospitalsInZone,
        police: policeInZone,
        fireStations: fireStationsInZone,
        riskZones: riskZonesInZone,
        total: schoolsInZone + hospitalsInZone + policeInZone + fireStationsInZone + riskZonesInZone
      };
    });
  }

  private createRingPolygon(
    outerPolygon: GeoJSON.Feature<GeoJSON.Polygon>,
    innerPolygons: GeoJSON.Feature<GeoJSON.Polygon>[]
  ): PolygonFeature {
    if (innerPolygons.length === 0) {
      return outerPolygon;
    }

    const innerPolygon = innerPolygons[innerPolygons.length - 1];

    try {
      const difference = turf.difference(
        turf.featureCollection([outerPolygon, innerPolygon])
      );
      return (difference as PolygonFeature) || outerPolygon;
    } catch {
      return outerPolygon;
    }
  }

  private getSchoolCenter(school: School): [number, number] {
    if (school.polygon && school.polygon.coordinates.length > 0) {
      const coords = school.polygon.coordinates;
      const sumLat = coords.reduce((sum, c) => sum + c[0], 0);
      const sumLng = coords.reduce((sum, c) => sum + c[1], 0);
      return [sumLat / coords.length, sumLng / coords.length];
    }
    return [0, 0];
  }

  private countPointsInPolygon(
    points: [number, number][],
    polygon: PolygonFeature
  ): number {
    return points.filter(point => {
      const turfPoint = turf.point([point[1], point[0]]);
      return turf.booleanPointInPolygon(turfPoint, polygon as GeoJSON.Feature<GeoJSON.Polygon>);
    }).length;
  }

  private countFeaturesInPolygon(
    features: LayerFeature[],
    polygon: PolygonFeature
  ): number {
    return features.filter(feature => {
      const turfPoint = turf.point([feature.coordinates[1], feature.coordinates[0]]);
      return turf.booleanPointInPolygon(turfPoint, polygon as GeoJSON.Feature<GeoJSON.Polygon>);
    }).length;
  }

  isPointInZone(
    point: [number, number],
    zone: BufferZone
  ): boolean {
    if (!zone.polygon) return false;
    const turfPoint = turf.point([point[1], point[0]]);
    return turf.booleanPointInPolygon(turfPoint, zone.polygon);
  }

  getZoneForPoint(
    point: [number, number],
    zones: BufferZone[]
  ): BufferZone | null {
    const sortedZones = [...zones].sort((a, b) => a.radiusKm - b.radiusKm);

    for (const zone of sortedZones) {
      if (this.isPointInZone(point, zone)) {
        return zone;
      }
    }
    return null;
  }

  calculateDistance(
    point1: [number, number],
    point2: [number, number]
  ): number {
    const from = turf.point([point1[1], point1[0]]);
    const to = turf.point([point2[1], point2[0]]);
    return turf.distance(from, to, { units: 'kilometers' });
  }
}
