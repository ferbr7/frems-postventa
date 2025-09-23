import { Injectable } from '@angular/core';

export type Prox = 'today' | '1d' | '3d' | '7d';

export interface IASugerencia {
  nombre: string;
  sku?: string;
  precio?: number;
}

export interface IARec {
  id: string;
  clienteNombre: string;
  telefono: string;         // ← requerido por lista/detalle
  correo?: string;
  mensaje: string;          // ← requerido por lista
  opciones: IASugerencia[]; // ← [0], [1] y [2] (plus)
  proximaAccion: Prox;      // ← requerido por lista/detalle
  createdAt: string;
  estado?: 'pendiente' | 'descartado' | 'pospuesto';
}

@Injectable({ providedIn: 'root' })
export class IaService {
  private recs: IARec[] = [
    {
      id: 'r1',
      clienteNombre: 'Karla Núñez',
      telefono: '502 52233445',
      correo: 'karla@ejemplo.com',
      mensaje: 'Tu perfume Aurora 50ml está por agotarse. Te dejo algunas opciones 👇',
      opciones: [
        { nombre: 'Aurora 50ml', sku: 'AUR-50', precio: 39.99 },
        { nombre: 'Citrus Bloom 100ml', sku: 'CB-100', precio: 49.99 },
        { nombre: 'Noir Intense 30ml', sku: 'NI-30', precio: 29.99 }
      ],
      proximaAccion: '1d',
      createdAt: new Date().toISOString(),
      estado: 'pendiente'
    },
    {
      id: 'r2',
      clienteNombre: 'Luis Martínez',
      telefono: '502 58790112',
      correo: 'lmartinez@ejemplo.com',
      mensaje: 'Sugerencias personalizadas para vos:',
      opciones: [
        { nombre: 'Citrus Bloom 50ml', sku: 'CB-50', precio: 31.99 },
        { nombre: 'Aurora 100ml', sku: 'AUR-100', precio: 59.99 },
        { nombre: 'Sandal Mist 50ml', sku: 'SM-50', precio: 34.99 }
      ],
      proximaAccion: '3d',
      createdAt: new Date().toISOString(),
      estado: 'pendiente'
    }
  ];

  list(): IARec[] {
    // En real: peticiones HTTP + paginación.
    return [...this.recs].filter(r => r.estado !== 'descartado');
  }

  get(id: string): IARec | undefined {
    return this.recs.find(r => r.id === id);
  }

  snooze(id: string, when: Prox) {
    const r = this.get(id);
    if (!r) return;
    r.proximaAccion = when;
    r.estado = 'pospuesto';
  }

  discard(id: string) {
    const r = this.get(id);
    if (!r) return;
    r.estado = 'descartado';
  }

  waLink(rec: IARec): string {
    // Teléfono GT
    const clean = rec.telefono.replace(/\D+/g, '');
    const phone = clean.startsWith('502') ? clean : `502${clean}`;

    const opts = rec.opciones
      .slice(0, 3)
      .map((o, i) => `${i === 2 ? 'Plus' : `Opción ${i + 1}`}: ${o.nombre}`)
      .join('%0A');

    const texto =
      `Hola ${rec.clienteNombre},%0A%0A` +
      `${encodeURIComponent(rec.mensaje)}%0A%0A` +
      `${opts}%0A%0A` +
      `¿Querés que te separe alguno?`;

    return `https://wa.me/${phone}?text=${texto}`;
  }
}
