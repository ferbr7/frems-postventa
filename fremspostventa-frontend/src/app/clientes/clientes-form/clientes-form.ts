import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ClientesService } from '../../core/clientes.service';

@Component({
  standalone: true,
  selector: 'app-clientes-form',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './clientes-form.html',
})
export class ClientesFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ClientesService);


  id = 0;
  isEdit = false;
  isView = false;


  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required]],
    apellido: ['', [Validators.required]],
    email: ['', [Validators.email]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
    direccion: ['', [Validators.required]],
    fechaingreso: [this.todayLocal(), [Validators.required]],
    ultimacompra: [''],
  });

  private todayLocal(): string {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id') || 0);
    const segs = this.route.snapshot.url;
    const last = segs.length ? segs[segs.length - 1].path : '';
    this.isView = last === 'ver';
    this.isEdit = last === 'editar';

    if (this.isEdit || this.isView) {
      this.api.get(this.id).subscribe({
        next: (res) => {
          const c = res?.cliente;
          if (!c) return;
          this.form.patchValue({
            nombre: c.nombre,
            apellido: c.apellido,
            email: c.email ?? '',
            telefono: c.telefono,
            direccion: c.direccion,
            fechaingreso: (c.fechaingreso || '').substring(0, 10),
            ultimacompra: c.ultimacompra ? c.ultimacompra.substring(0, 10) : '',
          });
          if (this.isView) this.form.disable({ emitEvent: false });
        },
        error: _ => { }
      });
    }
  }

  get title() {
    if (this.isEdit) return 'Editar cliente';
    if (this.isView) return 'Vista de cliente';
    return 'Nuevo cliente';
  }
  get subtitle() {
    if (this.isEdit) return 'Actualiza los datos de este cliente.';
    if (this.isView) return 'Consulta los datos del cliente.';
    return 'Completa los campos para agregar un nuevo cliente.';
  }

  onTelefonoInput(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const digits = (el.value || '').replace(/\D/g, '').slice(0, 8);
    if (digits !== el.value) {
      this.form.get('telefono')?.setValue(digits, { emitEvent: false });
    }
  }

  save() {
    if (this.isView) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const raw = this.form.getRawValue();
    const payload: any = {
      nombre: raw.nombre.trim(),
      apellido: raw.apellido.trim(),
      telefono: raw.telefono.trim(),
      direccion: raw.direccion.trim(),
      fechaingreso: raw.fechaingreso,
    };
    if (raw.email.trim()) payload.email = raw.email.trim(); else payload.email = null;
    if (raw.ultimacompra.trim()) payload.ultimacompra = raw.ultimacompra;

    if (this.isEdit) {
      this.api.update(this.id, payload).subscribe({
        next: (res: any) => {
          if (!res?.ok) { alert(res?.message || 'No se pudo actualizar.'); return; }
          this.router.navigate(['/clientes']);
        },
        error: (e) => {
          if (e?.status === 409) {
            alert(e?.error?.message || 'El teléfono ya está en uso.');
            this.form.get('telefono')?.setErrors({ duplicate: true });
            this.form.get('telefono')?.markAsTouched();
            return;
          }
          alert('Ocurrió un error al actualizar.');
        }
      });
    } else {
      this.api.create(payload).subscribe({
        next: (res: any) => {
          if (!res?.ok) { alert(res?.message || 'No se pudo crear.'); return; }
          this.router.navigate(['/clientes']);
        },
        error: (e) => {
          if (e?.status === 409) {
            alert(e?.error?.message || 'El teléfono ya está en uso.');
            this.form.get('telefono')?.setErrors({ duplicate: true });
            this.form.get('telefono')?.markAsTouched();
            return;
          }
          alert('Ocurrió un error al crear.');
        }
      });
    }
  }
}
