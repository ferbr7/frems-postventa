import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { VentasService } from '../../core/ventas.service';
import { ClientesService } from '../../core/clientes.service';
import { ProductosService } from '../../core/productos.service';

type Opcion = { id: number; label: string; precio?: number; stock?: number };

@Component({
  standalone: true,
  selector: 'app-ventas-form',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './ventas-form.html',
})
export class VentasFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private ventasApi = inject(VentasService);
  private clientesApi = inject(ClientesService);
  private productosApi = inject(ProductosService);

  // modo / id
  id = Number(this.route.snapshot.paramMap.get('id') || 0);
  isView = false;

  // selects
  clientes: Opcion[] = [];
  productos: Opcion[] = [];

  form = this.fb.nonNullable.group({
    idcliente: [0, [Validators.required, Validators.min(1)]],
    fecha: [this.todayLocal(), [Validators.required]],
    notas: [''],
    items: this.fb.array([] as any[]),
  });
  get items(): FormArray { return this.form.get('items') as FormArray; }

  ngOnInit(): void {
    const segs = this.route.snapshot.url;
    this.isView = this.id > 0 && segs.length > 0 && segs[segs.length - 1].path === 'ver';

    this.loadClientes();
    this.loadProductos(this.isView ? 'all' : 'true');

    if (this.isView) {
      this.loadVenta(this.id);
    } else {
      this.addItem();
    }
  }

  // ---------- data loaders ----------
  private loadClientes() {
    this.clientesApi.list({ page: 1, size: 1000 }).subscribe((res: any) => {
      const arr = res?.items || [];
      this.clientes = arr.map((c: any) => ({
        id: c.idcliente,
        label: `${c.nombre} ${c.apellido}`.trim() || `Cliente #${c.idcliente}`,
      }));
    });
  }

  private loadProductos(activo: 'all' | 'true' | 'false') {
    this.productosApi.list({ page: 1, limit: 1000, order: 'mod', activo }).subscribe((res: any) => {
      const arr = res?.items || [];
      this.productos = arr.map((p: any) => ({
        id: p.idproducto,
        label: `${p.nombre} (${p.sku})`,
        precio: Number(p.precioventa ?? 0),
        stock: Number(p.stock ?? 0),
      }));
    });
  }

  private loadVenta(id: number) {
    this.ventasApi.get(id).subscribe({
      next: (res: any) => {
        if (!res?.ok || !res?.venta) {
          alert(res?.message || 'Venta no encontrada');
          this.router.navigate(['/ventas']);
          return;
        }
        const v = res.venta;
        const dets = res.detalles || [];

        // cabecera
        this.form.patchValue({
          idcliente: v.idcliente || 0,
          fecha: (v.fecha || '').substring(0, 10),
          notas: v.notas || '',
        });

        // líneas
        this.items.clear();
        dets.forEach((d: any) => {
          // aseguro que el producto exista en el select (por si está inactivo y no vino en la lista)
          if (!this.productos.find(p => p.id === d.idproducto)) {
            this.productos.push({
              id: d.idproducto,
              label: `${d.productoNombre || 'Producto'} (${d.sku || ''})`.trim(),
              precio: d.precio_unit,
              stock: 0,
            });
          }
          const g = this.fb.nonNullable.group({
            idproducto: [Number(d.idproducto), [Validators.required, Validators.min(1)]],
            cantidad: [Number(d.cantidad), [Validators.required, Validators.min(1)]],
            precio: [{ value: Number(d.precio_unit), disabled:true}, [Validators.required, Validators.min(0)]],
            desc_pct: [Number(d.desc_pct ?? 0), [Validators.min(0), Validators.max(100)]],
            _stock: [0],
          });
          this.items.push(g);
        });

        // modo ver: deshabilito todo
        if (this.isView) this.form.disable({ emitEvent: false });
      },
      error: () => {
        alert('Error cargando venta');
        this.router.navigate(['/ventas']);
      },
    });
  }

  // ---------- helpers ----------
  private todayLocal(): string {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  addItem() {
    const g = this.fb.nonNullable.group({
      idproducto: [0, [Validators.required, Validators.min(1)]],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      precio: [{ value: 0, disabled: true }, [Validators.required, Validators.min(0)]],
      desc_pct: [0, [Validators.min(0), Validators.max(100)]],
      _stock: [0],
    });
    g.get('idproducto')!.valueChanges.subscribe(id => {
      const p = this.productos.find(x => x.id === Number(id));
      g.get('precio')!.setValue(p?.precio ?? 0, { emitEvent: false });
      g.get('_stock')!.setValue(p?.stock ?? 0, { emitEvent: false });
    });
    this.items.push(g);
  }
  removeItem(i: number) { this.items.removeAt(i); }

  subtotalLinea(i: number): number {
    const g = this.items.at(i) as any;
    const cant = Number(g.get('cantidad')?.value || 0);
    const precio = Number(g.get('precio')?.value || 0);
    const desc = Number(g.get('desc_pct')?.value || 0);
    const bruto = cant * precio;
    return Number((bruto - bruto * (desc / 100)).toFixed(2));
  }
  subtotal(): number {
    return this.items.controls.reduce((a, _, i) => {
      const g = this.items.at(i) as any;
      return a + Number(g.get('cantidad')?.value || 0) * Number(g.get('precio')?.value || 0);
    }, 0);
  }
  descuentoTotal(): number {
    const br = this.subtotal();
    const net = this.total();
    return Number((br - net).toFixed(2));
  }
  total(): number {
    return Number(this.items.controls.reduce((a, _, i) => a + this.subtotalLinea(i), 0).toFixed(2));
  }

  // título dinámico (opcional)
  get title() { return this.isView ? `Venta #${this.id}` : 'Nueva venta'; }
  get subtitle() { return this.isView ? 'Detalle de la venta' : 'Registra una venta y sus productos'; }

  // guardar (solo en nueva)
  save() {
    if (this.isView) return;
    if (this.form.invalid || this.items.length === 0) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const payload = {
      fecha: raw.fecha,
      idcliente: raw.idcliente,
      notas: raw.notas?.trim() || undefined,
      items: raw.items.map((it: any) => ({
        idproducto: Number(it.idproducto),
        cantidad: Number(it.cantidad),
        precio: Number(it.precio),
        desc_pct: Number(it.desc_pct || 0),
      })),
    };
    this.ventasApi.create(payload).subscribe({
      next: (res) => {
        if (!res?.ok) { alert(res?.message || 'No se pudo registrar la venta'); return; }
        this.router.navigate(['/ventas']);
      },
      error: (err) => alert(err?.error?.message || 'Error registrando venta'),
    });
  }

  volver() { this.router.navigate(['/ventas']); }
  imprimir() { this.router.navigate(['/ventas', this.id, 'imprimir']); }
}
