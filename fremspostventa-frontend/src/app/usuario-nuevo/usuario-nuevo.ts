import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

type Rol = 'admin' | 'vendedor';

@Component({
  selector: 'app-usuario-nuevo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './usuario-nuevo.html',
})
export class UsuarioNuevoComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  // Evita sobre-escribir el username si el usuario ya lo tocó a mano
  private usernameTouched = signal(false);

  roles: { label: string; value: Rol }[] = [
    { label: 'Admin', value: 'admin' },
    { label: 'Vendedor', value: 'vendedor' },
  ];

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    apellido: ['', [Validators.required, Validators.maxLength(60)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(40)]],
    rol: <Rol | null> (null),
    fechaIngreso: [this.hoyISO(), Validators.required],
    activo: [true],
  });

  ngOnInit() {
    // Auto-sugerir username si cambia nombre/apellido/email y el campo no fue tocado manualmente
    this.form.get('nombre')!.valueChanges.subscribe(() => this.autosuggestUsername());
    this.form.get('apellido')!.valueChanges.subscribe(() => this.autosuggestUsername());
    this.form.get('email')!.valueChanges.subscribe(() => this.autosuggestUsername());
    // Si el usuario edita username a mano, dejamos de autocompletar
    this.form.get('username')!.valueChanges.subscribe(() => this.usernameTouched.set(true));
  }

  private hoyISO(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  private slug(s: string): string {
    return s
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .toLowerCase();
  }

  private autosuggestUsername() {
    if (this.usernameTouched()) return;

    const email = this.form.value.email?.trim() ?? '';
    const nombre = this.form.value.nombre?.trim() ?? '';
    const apellido = this.form.value.apellido?.trim() ?? '';

    let suggestion = '';
    if (email && email.includes('@')) {
      suggestion = email.split('@')[0];
    } else if (nombre || apellido) {
      suggestion = `${nombre.split(' ')[0]}.${apellido.split(' ').slice(-1)[0] ?? ''}`;
    }
    suggestion = this.slug(suggestion);

    // Evitar setear vacío
    if (suggestion) this.form.get('username')!.setValue(suggestion, { emitEvent: false });
  }

  get f() { return this.form.controls; }

  volver() {
    this.router.navigate(['/usuarios']); // ajusta si tu ruta de listado es otra
  }

  async guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = {
      nombre: this.form.value.nombre!,
      apellido: this.form.value.apellido!,
      email: this.form.value.email!,
      username: this.form.value.username!,
      rol: this.form.value.rol as Rol,
      fechaIngreso: this.form.value.fechaIngreso!,
      activo: !!this.form.value.activo,
    };

    console.log('Nuevo usuario >', payload);

    // TODO backend:
    // 1) POST /api/usuarios  (el backend genera contraseña aleatoria)
    // 2) Backend envía email con credenciales/restablecimiento
    // 3) Manejar errores (username/email repetidos, etc.)

    // Simulación de guardado:
    await new Promise(r => setTimeout(r, 500));
    // Navegar al listado
    this.router.navigate(['/usuarios']);
  }
}
