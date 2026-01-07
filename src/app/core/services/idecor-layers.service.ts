import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, catchError, map, forkJoin } from 'rxjs';
import { LayerType, LayerFeature, LAYER_CONFIGS } from '../models/layer.model';

interface WFSResponse {
  type: string;
  features: WFSFeature[];
}

interface WFSFeature {
  type: string;
  id: string;
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][] | number[][][][];
  };
  properties: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class IdecorLayersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://idecor-ws.mapascordoba.gob.ar/geoserver/idecor/wfs';

  private readonly layerMappings: Record<LayerType, { wfsLayer: string; nameField: string }> = {
    schools: { wfsLayer: 'idecor:establecimientos_educativos', nameField: 'nombre' },
    hospitals: { wfsLayer: 'idecor:Centros_Salud', nameField: 'nombre' },
    police: { wfsLayer: '', nameField: 'nombre' }, // No disponible en IDECOR - usar Overpass API
    fire_stations: { wfsLayer: 'idecor:cuarteles_bbvv', nameField: 'nombre' },
    risk_zones: { wfsLayer: 'idecor:zonas_riesgo_cuarteles', nameField: 'zona_riesgo' },
    burned_areas: { wfsLayer: 'idecor:area_quemada_2024', nameField: 'nombre' },
    geology: { wfsLayer: 'idecor:litologia_geol', nameField: 'litologia' },
    natural_areas: { wfsLayer: 'idecor:areas_naturales_provinciales', nameField: 'nombre' },
    natural_regions: { wfsLayer: 'idecor:regiones_naturales', nameField: 'region' },
    soil_map: { wfsLayer: 'idecor:carta_suelo_500mil_2024', nameField: 'nombre' }
  };

  getLayerFeatures(layerType: LayerType, bbox?: string): Observable<LayerFeature[]> {
    const mapping = this.layerMappings[layerType];
    if (!mapping || !mapping.wfsLayer) {
      return of([]);
    }

    let params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '2.0.0')
      .set('request', 'GetFeature')
      .set('typeName', mapping.wfsLayer)
      .set('outputFormat', 'application/json')
      .set('srsName', 'EPSG:4326')
      .set('count', '5000');

    if (bbox) {
      params = params.set('bbox', bbox);
    } else {
      // Bbox que cubre toda la provincia de Córdoba
      params = params.set('bbox', '-66.0,-35.0,-62.0,-29.5,EPSG:4326');
    }

    return this.http.get<WFSResponse>(this.baseUrl, { params }).pipe(
      map(response => this.parseWFSResponse(response, layerType, mapping.nameField)),
      catchError(error => {
        console.error(`Error fetching ${layerType} from IDECOR:`, error);
        return of([]);
      })
    );
  }

  getAllLayers(enabledLayers: LayerType[], bbox?: string): Observable<Map<LayerType, LayerFeature[]>> {
    if (enabledLayers.length === 0) {
      return of(new Map());
    }

    const requests = enabledLayers.map(layerType =>
      this.getLayerFeatures(layerType, bbox).pipe(
        map(features => ({ layerType, features }))
      )
    );

    return forkJoin(requests).pipe(
      map(results => {
        const layerMap = new Map<LayerType, LayerFeature[]>();
        results.forEach(({ layerType, features }) => {
          layerMap.set(layerType, features);
        });
        return layerMap;
      })
    );
  }

  private parseWFSResponse(
    response: WFSResponse,
    layerType: LayerType,
    nameField: string
  ): LayerFeature[] {
    if (!response.features || !Array.isArray(response.features)) {
      return [];
    }

    return response.features
      .filter(feature => feature.geometry)
      .map(feature => this.convertToLayerFeature(feature, layerType, nameField));
  }

  private convertToLayerFeature(
    feature: WFSFeature,
    layerType: LayerType,
    nameField: string
  ): LayerFeature {
    const coords = this.extractCoordinates(feature.geometry);
    const polygon = this.extractPolygon(feature.geometry);

    return {
      id: feature.id || `${layerType}-${Math.random().toString(36).substr(2, 9)}`,
      name: (feature.properties[nameField] as string) || `${this.getLayerLabel(layerType)} sin nombre`,
      type: layerType,
      coordinates: coords,
      polygon: polygon,
      properties: feature.properties
    };
  }

  private extractCoordinates(geometry: WFSFeature['geometry']): [number, number] {
    if (geometry.type === 'Point') {
      const coords = geometry.coordinates as number[];
      return [coords[1], coords[0]];
    } else if (geometry.type === 'MultiPoint') {
      // MultiPoint: tomar el primer punto
      const coords = geometry.coordinates as number[][];
      const firstPoint = coords[0];
      return [firstPoint[1], firstPoint[0]];
    } else if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates as number[][][];
      const ring = coords[0];
      const sumLat = ring.reduce((sum, c) => sum + c[1], 0);
      const sumLng = ring.reduce((sum, c) => sum + c[0], 0);
      return [sumLat / ring.length, sumLng / ring.length];
    } else if (geometry.type === 'MultiPolygon') {
      const coords = geometry.coordinates as number[][][][];
      const ring = coords[0][0];
      const sumLat = ring.reduce((sum, c) => sum + c[1], 0);
      const sumLng = ring.reduce((sum, c) => sum + c[0], 0);
      return [sumLat / ring.length, sumLng / ring.length];
    }
    return [0, 0];
  }

  private extractPolygon(geometry: WFSFeature['geometry']): [number, number][] | undefined {
    if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates as number[][][];
      return coords[0].map(c => [c[1], c[0]] as [number, number]);
    } else if (geometry.type === 'MultiPolygon') {
      const coords = geometry.coordinates as number[][][][];
      return coords[0][0].map(c => [c[1], c[0]] as [number, number]);
    }
    return undefined;
  }

  private getLayerLabel(layerType: LayerType): string {
    const config = LAYER_CONFIGS.find(c => c.id === layerType);
    return config?.name || layerType;
  }
}
