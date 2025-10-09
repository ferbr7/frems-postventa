import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RecsService, RecListItem } from '../../core/recs.service';
import { firstValueFrom } from 'rxjs';

type ViewRec = {
  id: number;
  clienteNombre: string;
  telefono: string;
  mensaje: string;
  opciones: Array<{ nombre: string }>; // 0..3 (Opción 1, Opción 2, Plus)
  proximaAccion: string | null;        // ISO
};

@Component({
  standalone: true,
  selector: 'app-recs-list',
  imports: [CommonModule, RouterModule],
  templateUrl: './recs-list.html',
})
export class RecsListComponent implements OnInit {
  private api = inject(RecsService);

  // STATE con Signals (funciona perfecto sin Zone)
  loading = signal<boolean>(false);
  recs = signal<ViewRec[]>([]);

  async ngOnInit() {
    await this.fetch();
  }

  private mapItem(it: RecListItem): ViewRec {
    const nombre = it?.cliente?.nombre || 'Cliente';
    const tel = (it?.cliente?.telefono || '—').toString().trim();
    const ops = (Array.isArray(it?.opciones) ? it.opciones : [])
      .slice(0, 3)
      .map(o => ({ nombre: o?.nombre || '—' }));

    return {
      id: Number(it?.id),
      clienteNombre: nombre,
      telefono: tel || '—',
      mensaje: it?.preview || '—',
      opciones: ops,
      proximaAccion: it?.next_action_at ?? null,
    };
  }

  async fetch() {
    this.loading.set(true);
    try {
      const resp = await firstValueFrom(this.api.list({ page: 1, size: 100, estado: 'pendiente' }));
      const items = Array.isArray(resp?.items) ? resp.items : [];
      this.recs.set(items.map(it => this.mapItem(it)));
    } catch (e) {
      console.error('[RECS list] error', e);
      this.recs.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  trackById = (_: number, r: ViewRec) => r.id;

  // Acciones
  async snooze(id: number, tag: '1d' | '3d' | '7d') {
    const days = tag === '1d' ? 1 : tag === '3d' ? 3 : 7;
    try {
      await firstValueFrom(this.api.defer(id, days));
      await this.fetch();
    } catch { alert('No se pudo posponer.'); }
  }

  async discard(id: number) {
    if (!confirm(`Descartar recomendación #${id}?`)) return;
    try {
      await firstValueFrom(this.api.discard(id));
      this.recs.update(list => list.filter(x => x.id !== id));
      await this.fetch();
    } catch { alert('No se pudo descartar.'); }
  }

  waLink(r: ViewRec): string {
    const digits = (r.telefono || '').replace(/\D+/g, '');
    if (!digits) return 'javascript:void(0)';
    const number = digits.startsWith('502') ? digits : `502${digits}`;
    const labels = ['Opción 1', 'Opción 2', 'Opción 3'];
    const chips = r.opciones.map((o, i) => `${labels[i] || 'Opción'}: ${o.nombre}`).join(' · ');
    const text = `¡Hola ${r.clienteNombre}!%0A${r.mensaje}%0A%0ASugerencias: ${chips}`;
    return `https://wa.me/${number}?text=${text}`;
  }

  labelProx(iso: string | null): string {
    if (!iso) return '—';
    const now = new Date();
    const dt = new Date(iso);
    const d = Math.round((dt.getTime() - now.getTime()) / 86400000);
    if (d === 0) return 'hoy';
    if (d === 1) return 'en 1 día';
    if (d < 0) return `en ${Math.abs(d)} día${Math.abs(d) === 1 ? '' : 's'}`;
    return `en ${d} días`;
  }

  async sendWhatsApp(r: ViewRec) {
    try {

      const { rec } = await firstValueFrom(this.api.get(r.id));


      const rawPhone = (rec?.clientes?.telefono ?? r.telefono ?? '').toString();
      const digits = rawPhone.replace(/\D+/g, '');
      if (!digits) { alert('El cliente no tiene teléfono válido.'); return; }
      const number = digits.startsWith('502') ? digits : `502${digits}`;


      const msg = (rec?.justificacion ?? r.mensaje ?? '').toString();
      const url = `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;

      try {
        await firstValueFrom(this.api.markSent(r.id));
        this.recs.update(list => list.filter(x => x.id !== r.id));
      } catch (e) {
        console.warn('[markSent] falló pero no bloqueamos el envío', e);
      }

      window.open(url, '_blank');

    } catch (e) {
      console.error('[WA] error', e);
      alert('No se pudo armar el mensaje de WhatsApp.');
    }
  }
}
