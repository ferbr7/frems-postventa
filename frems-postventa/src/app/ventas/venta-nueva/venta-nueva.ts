import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CurrencyPipe } from '@angular/common';

type Cliente = { id: number; nombre: string };
type Producto = { id: number; nombre: string; precio: number; stock?: number };

// Payload que mandarás al backend
interface VentaPost {
  fecha: string;
  idCliente: number;
  idUsuario: number; // tomar del auth cuando lo tengas
  notas?: string;
  items: Array<{
    idProducto: number;
    cantidad: number;
    precioUnitario: number;
    descuentoPct: number;
  }>;
}

@Component({
  selector: 'app-venta-nueva',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './venta-nueva.html',
})
export class VentaNuevaComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  // ----- mocks (cámbialos por servicios reales cuando conectes el back) -----
  clientes: Cliente[] = [
    { id: 1, nombre: 'Karla Núñez' },
    { id: 2, nombre: 'Luis Martínez' },
    { id: 3, nombre: 'María López' },
  ];

  productos: Producto[] = [
    { id: 101, nombre: 'Aurora 50ml', precio: 320, stock: 9 },
    { id: 102, nombre: 'Citrus Bloom 100ml', precio: 420, stock: 5 },
    { id: 103, nombre: 'Noir Intense 30ml', precio: 260, stock: 12 },
  ];

  // ----- Form principal -----
  form: FormGroup = this.fb.group({
    clienteId: [null as number | null, Validators.required],
    fecha: [this.hoyISO(), Validators.required],
    items: this.fb.array<FormGroup>([]),
    notas: [''],
    idUsuario: [7], // TODO: reemplazar por el id del usuario logueado (auth)
  });

  // atajo para FormArray de items
  get items(): FormArray<FormGroup> {
    return this.form.get('items') as FormArray<FormGroup>;
  }

  // crear un renglón
  private createItemGroup(preset?: Partial<{
    productoId: number | null;
    cantidad: number;
    precio: number;
    descuento: number;
  }>): FormGroup {
    return this.fb.group({
      productoId: [preset?.productoId ?? null, Validators.required],
      cantidad: [preset?.cantidad ?? 1, [Validators.required, Validators.min(1)]],
      precio: [preset?.precio ?? 0, [Validators.required, Validators.min(0)]],
      descuento: [preset?.descuento ?? 0, [Validators.min(0), Validators.max(100)]],
    });
  }

  constructor() {
    // inicia con una línea
    this.addItem();
  }

  // hoy en ISO (yyyy-MM-dd)
  hoyISO(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  // ----- UI actions -----
  addItem() {
    this.items.push(this.createItemGroup());
  }

  removeItem(idx: number) {
    this.items.removeAt(idx);
  }

  // cuando seleccionan producto, autopone el precio
  onProductoChange(idx: number) {
    const g = this.items.at(idx);
    const prodId = g.get('productoId')!.value as number | null;
    if (!prodId) return;
    const p = this.productos.find(x => x.id === prodId);
    if (p) {
      g.get('precio')!.setValue(p.precio);
      g.markAsDirty();
    }
  }

  // helpers de cálculo
  private calcLinea(g: FormGroup): { bruto: number; desc: number; neto: number } {
    const cant = Number(g.get('cantidad')!.value) || 0;
    const precio = Number(g.get('precio')!.value) || 0;
    const ds = Number(g.get('descuento')!.value) || 0;
    const bruto = cant * precio;
    const desc = (bruto * ds) / 100;
    const neto = bruto - desc;
    return { bruto, desc, neto };
  }

  subTotal(): number {
    return this.items.controls.reduce((acc, g) => acc + this.calcLinea(g).bruto, 0);
  }

  descuentoTotal(): number {
    return this.items.controls.reduce((acc, g) => acc + this.calcLinea(g).desc, 0);
  }

  total(): number {
    return this.items.controls.reduce((acc, g) => acc + this.calcLinea(g).neto, 0);
  }

  // nombre y stock del producto (para chips en UI)
  prodName(id: number | null): string {
    if (!id) return '';
    return this.productos.find(p => p.id === id)?.nombre ?? '';
  }
  prodStock(id: number | null): number | undefined {
    if (!id) return undefined;
    return this.productos.find(p => p.id === id)?.stock;
  }

  // ----- POST payload -----
  private buildPayload(): VentaPost {
    const raw = this.form.getRawValue();
    const items = this.items.controls.map(g => ({
      idProducto: g.get('productoId')!.value as number,
      cantidad: Number(g.get('cantidad')!.value) || 0,
      precioUnitario: Number(g.get('precio')!.value) || 0,
      descuentoPct: Number(g.get('descuento')!.value) || 0,
    }));
    return {
      fecha: raw.fecha as string,
      idCliente: raw.clienteId as number,
      idUsuario: raw.idUsuario as number,
      notas: raw.notas as string,
      items,
    };
  }

  guardar() {
    if (this.form.invalid || this.items.length === 0) {
      this.form.markAllAsTouched();
      alert('Revisá los datos: el cliente, la fecha y al menos un producto.');
      return;
    }

    const payload = this.buildPayload();

    // TODO: Reemplazar por ventasService.create(payload)
    console.log('POST /ventas', payload, {
      frontSubtotal: this.subTotal(),
      frontDescuento: this.descuentoTotal(),
      frontTotal: this.total(),
    });

    alert('Venta registrada.');
    this.router.navigate(['/ventas']);
  }

  // trackBy para *ngFor de items
  trackByIdx = (_: number, __: unknown) => _;
}
