export interface ContactInfo {
  phone: string;
  email: string;
  website?: string;
}

export interface PolygonCoordinates {
  coordinates: [number, number][];
}

export interface SchoolData {
  nivel?: string;
  sector?: string;
  ambito?: string;
  alumnos?: number;
  estado?: string;
  cue?: string;
  source?: 'idecor' | 'osm' | 'hybrid';
}

export interface School {
  id: string;
  name: string;
  address: string;
  contactInfo: ContactInfo;
  polygon: PolygonCoordinates;
  detected: boolean;
  color?: string;
  additionalData?: SchoolData;
}
