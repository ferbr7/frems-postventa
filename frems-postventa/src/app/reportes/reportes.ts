import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';

type TipoReporte = 'clientes' | 'ventas' | 'top' | 'ia';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reportes.html',
})
export class ReportesComponent {
  private fb = inject(FormBuilder);

  filtros = this.fb.group({
    tipo: <TipoReporte>'ventas',
    desde: this.hoy(-30),
    hasta: this.hoy(0),
    categoria: '',
    vendedor: '',
    cliente: '',
    topN: 10,
  });

  loading = signal(false);
  kpis = signal<{ label: string; value: string }[]>([]);
  tabla = signal<any[]>([]);
  grafica = signal<{ label: string; value: number }[]>([]);

  ngOnInit() { this.generar(); }

  generar() {
    this.loading.set(true);
    const f = this.filtros.getRawValue();

    switch (f.tipo) {
      case 'clientes':
        this.kpis.set([
          { label: 'Clientes nuevos', value: '12' },
          { label: 'Activos %', value: '86%' },
          { label: 'Ticket prom. cliente', value: 'Q 215' },
        ]);
        this.grafica.set([]);
        this.tabla.set([
          { cliente: 'Karla Núñez', compras: 12, total: 1240, ultima: '2025-09-05' },
          { cliente: 'Luis Martínez', compras: 1, total: 120, ultima: '2025-09-01' },
        ]);
        break;

      case 'ventas':
        this.kpis.set([
          { label: 'Total ventas', value: 'Q 8,540' },
          { label: 'Órdenes', value: '43' },
          { label: 'Ticket promedio', value: 'Q 199' },
        ]);
        this.grafica.set([
          { label: '09-01', value: 320 },
          { label: '09-02', value: 480 },
          { label: '09-03', value: 210 },
          { label: '09-04', value: 990 },
        ]);
        this.tabla.set([
          { fecha: '2025-09-01', ordenes: 5, total: 320 },
          { fecha: '2025-09-02', ordenes: 8, total: 480 },
          { fecha: '2025-09-03', ordenes: 4, total: 210 },
          { fecha: '2025-09-04', ordenes: 12, total: 990 },
        ]);
        break;

      case 'top':
        this.kpis.set([
          { label: 'SKU vendidos', value: '26' },
          { label: 'Top N', value: String(f.topN ?? 10) },
          { label: 'Participación top', value: '61%' },
        ]);
        this.grafica.set([
          { label: 'Aurora 50ml', value: 42 },
          { label: 'Citrus Bloom 100ml', value: 31 },
          { label: 'Noir Intense 30ml', value: 27 },
        ]);
        this.tabla.set([
          { producto: 'Aurora 50ml', cantidad: 42, monto: 4200 },
          { producto: 'Citrus Bloom 100ml', cantidad: 31, monto: 4650 },
          { producto: 'Noir Intense 30ml', cantidad: 27, monto: 2430 },
        ]);
        break;

      case 'ia':
        this.kpis.set([
          { label: 'Recs generadas', value: '57' },
          { label: 'Contactadas', value: '41' },
          { label: 'Conversión', value: '18%' },
        ]);
        this.grafica.set([
          { label: '09-01', value: 6 },
          { label: '09-02', value: 9 },
          { label: '09-03', value: 14 },
          { label: '09-04', value: 11 },
        ]);
        this.tabla.set([
          { fecha: '2025-09-01', generadas: 6, contactadas: 5, descartadas: 1 },
          { fecha: '2025-09-02', generadas: 9, contactadas: 7, descartadas: 2 },
        ]);
        break;
    }

    setTimeout(() => this.loading.set(false), 300);
  }

  // ==== Helpers expuestos a la plantilla ====

  /** Máximo de la serie para escalar las barras */
  gMax(): number {
    const arr = this.grafica();
    return arr.length ? Math.max(...arr.map(p => p.value)) : 1;
  }

  /** Encabezados de la tabla */
  headers(): string[] {
    const rows = this.tabla();
    return rows.length ? Object.keys(rows[0]) : [];
  }

  exportCsv() {
    const rows = this.tabla();
    if (!rows.length) return;
    const header = this.headers();
    const csv = [
      header.join(','),
      ...rows.map(r => header.map(h => JSON.stringify(r[h] ?? '')).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'reporte.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  print() { window.print(); }

  private hoy(delta: number) {
    const d = new Date();
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
  }
}
