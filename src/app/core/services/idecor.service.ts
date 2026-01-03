import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { School } from '../models/school.model';

@Injectable({
  providedIn: 'root'
})
export class IdecorService {
  private readonly http = inject(HttpClient);
  private readonly WFS_URL = 'https://idecor-ws.mapascordoba.gob.ar/geoserver/idecor/wfs';

  getSchoolsInCordoba(): Observable<School[]> {
    const params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '2.0.0')
      .set('request', 'GetFeature')
      .set('typeName', 'idecor:establecimientos_educativos')
      .set('outputFormat', 'application/json')
      .set('srsName', 'EPSG:4326');

    return this.http.get<any>(this.WFS_URL, { params }).pipe(
      map(response => this.transformToSchools(response)),
      catchError(error => {
        console.error('Error fetching IDECOR schools:', error);
        return of([]);
      })
    );
  }

  private transformToSchools(geoJson: any): School[] {
    if (!geoJson?.features) {
      return [];
    }

    return geoJson.features.map((feature: any) => {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates || [0, 0];
      const lon = coords[0];
      const lat = coords[1];

      return {
        id: 'idecor_' + (props.id || props.gid || Math.random().toString(36).substr(2, 9)),
        name: props.nombre || props.establecimiento || 'Sin nombre',
        address: this.buildAddress(props),
        contactInfo: {
          phone: props.telefono || props.tel || '',
          email: props.email || props.mail || '',
          website: props.web || props.sitio_web
        },
        polygon: {
          coordinates: this.createPointPolygon(lat, lon)
        },
        detected: true,
        additionalData: {
          nivel: props.nivel || props.tipo_nivel,
          sector: props.sector || props.gestion,
          ambito: props.ambito,
          cue: props.cue || props.cueanexo,
          source: 'idecor' as const
        }
      } as School;
    });
  }

  private createPointPolygon(lat: number, lon: number): [number, number][] {
    const offset = 0.0005;
    return [
      [lat + offset, lon - offset],
      [lat + offset, lon + offset],
      [lat - offset, lon + offset],
      [lat - offset, lon - offset],
      [lat + offset, lon - offset]
    ];
  }

  private buildAddress(props: any): string {
    const parts = [
      props.domicilio || props.direccion || props.calle,
      props.localidad,
      props.departamento,
      'Córdoba'
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : 'Dirección no disponible';
  }
}
