import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, catchError, of, retry, timer, from, switchMap } from 'rxjs';
import { School } from '../models/school.model';

@Injectable({
  providedIn: 'root'
})
export class OverpassService {
  private readonly http = inject(HttpClient);

  private readonly overpassServers = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
  ];

  private currentServerIndex = 0;

  getSchoolsInCordoba(): Observable<School[]> {
    return this.tryServer(0);
  }

  private tryServer(serverIndex: number): Observable<School[]> {
    if (serverIndex >= this.overpassServers.length) {
      console.warn('All Overpass servers failed, returning empty array');
      return of([]);
    }

    const url = this.overpassServers[serverIndex];
    const query = this.buildOverpassQuery();
    const headers = new HttpHeaders({ 'Content-Type': 'text/plain' });

    console.log(`Trying Overpass server: ${url}`);

    return this.http.post<any>(url, query, { headers }).pipe(
      retry({
        count: 2,
        delay: (error, retryCount) => {
          console.log(`Retry ${retryCount} for ${url}`);
          return timer(1000 * retryCount);
        }
      }),
      map(response => this.transformToSchools(response)),
      catchError(error => {
        console.error(`Error with server ${url}:`, error.message || error);
        return this.tryServer(serverIndex + 1);
      })
    );
  }

  private buildOverpassQuery(): string {
    return `
      [out:json][timeout:60];
      (
        way["amenity"="school"](-31.4800,-64.2500,-31.3500,-64.1200);
        relation["amenity"="school"](-31.4800,-64.2500,-31.3500,-64.1200);
      );
      out geom;
    `;
  }

  private transformToSchools(response: any): School[] {
    if (!response?.elements) {
      return [];
    }

    return response.elements
      .filter((element: any) => element.geometry && element.geometry.length > 0)
      .map((element: any) => {
        const coordinates: [number, number][] = element.geometry.map((point: any) => [point.lat, point.lon]);

        if (coordinates.length < 3) {
          return null;
        }

        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          coordinates.push([first[0], first[1]]);
        }

        const tags = element.tags || {};

        return {
          id: 'osm_' + element.id,
          name: tags.name || 'Escuela sin nombre',
          address: this.buildAddress(tags),
          contactInfo: {
            phone: tags['contact:phone'] || tags.phone || '',
            email: tags['contact:email'] || tags.email || '',
            website: tags['contact:website'] || tags.website
          },
          polygon: {
            coordinates
          },
          detected: true,
          additionalData: {
            source: 'osm' as const
          }
        } as School;
      })
      .filter((school: School | null): school is School => school !== null);
  }

  private buildAddress(tags: any): string {
    const parts = [
      tags['addr:street'],
      tags['addr:housenumber']
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(' ') + ', Córdoba';
    }

    return 'Dirección no disponible';
  }
}
