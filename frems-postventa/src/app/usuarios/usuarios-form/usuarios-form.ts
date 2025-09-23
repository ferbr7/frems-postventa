import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { UsersService } from '../../core/users.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs/operators';
import { of, Observable } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-usuarios-form',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './usuarios-form.html',
})
export class UsuariosFormComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(UsersService);
  private http = inject(HttpClient);

  // Cambia si tu API base es distinta
  private readonly API = 'http://localhost:4000/api';

  id = Number(this.route.snapshot.paramMap.get('id') || 0);
  isEdit = this.id > 0;

  /** Mientras el usuario no toque el campo username, se mantiene el autosuggest */
  autoUsername = !this.isEdit;

  form = this.fb.group({
    nombre: ['', [Validators.required]],
    apellido: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    username: ['', [Validators.required]],
    password: [''], // requerido solo al crear
    idrol: [3, [Validators.required]], // 1=admin, 2=vendedor. Ajusta si quieres cargar roles reales
    activo: [true],
    fechaalta: [new Date().toISOString().substring(0, 10)],
  });

  ngOnInit() {
    if (this.isEdit) {
      this.api.get(this.id).subscribe(res => {
        if (res.ok) {
          const u = res.user;
          this.form.patchValue({
            nombre: u.nombre,
            apellido: u.apellido,
            email: u.email,
            username: u.username,
            idrol: u.idrol,
            activo: u.activo,
            fechaalta: (u.fechaalta || '').substring(0, 10),
          });
          // al editar, ya no sugerimos username
          this.autoUsername = false;
        }
      });
    }

    this.setupAutoUsername();
  }

  /** Etiqueta que cambia visualmente con el switch */
  get estadoLabel(): string {
    return this.form.get('activo')?.value ? 'Activo' : 'Inactivo';
  }

  /** Cuando el usuario teclea manualmente en username, apagamos el autosuggest */
  onUsernameInput() {
    this.autoUsername = false;
  }

  /** Configura el autorrelleno del username con correlativo */
  private setupAutoUsername() {
    const nombreCtrl = this.form.get('nombre')!;
    const apellidoCtrl = this.form.get('apellido')!;
    const usernameCtrl = this.form.get('username')!;

    // Si el usuario escribe manualmente, apagar auto
    usernameCtrl.valueChanges.pipe(debounceTime(200)).subscribe(v => {
      if (v && v.toString().trim().length) this.autoUsername = false;
    });

    // Reaccionar a cambios en nombre+apellido
    nombreCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe(() => this.trySuggestUsername());

    apellidoCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe(() => this.trySuggestUsername());
  }

  /** Intenta sugerir username vía backend; si no existe, hace fallback local con exists */
  private trySuggestUsername() {
    if (!this.autoUsername) return;

    const nombre = (this.form.get('nombre')?.value || '').trim();
    const apellido = (this.form.get('apellido')?.value || '').trim();
    if (!nombre || !apellido) return;

    const params = new HttpParams().set('nombre', nombre).set('apellido', apellido);

    // 1) Intento con endpoint de sugerencia
    this.http.get<{ ok: boolean; suggestion: string }>(`${this.API}/usuarios/suggest-username`, { params })
      .pipe(
        switchMap(res => of(res?.suggestion ?? '')) // Observable<string>
      )
      .subscribe({
        next: (sug: string) => {
          if (this.autoUsername && sug) {
            this.form.get('username')?.setValue(sug, { emitEvent: false });
          }
        },
        error: _err => {
          // Si el endpoint falla, usa fallback local
          this.fallbackLocalSuggestion(nombre, apellido).subscribe((sug: string) => {
            if (this.autoUsername && sug) {
              this.form.get('username')?.setValue(sug, { emitEvent: false });
            }
          });
        }
      });
  }

  /** Fallback local: genera base y consulta /exists para agregar correlativo */
  private fallbackLocalSuggestion(nombre: string, apellido: string): Observable<string> {
    const base = this.slugUser(nombre, apellido); // ej: f + aguilar => 'faguilar'
    return this.ensureUnique(base);
  }

  /** Convierte nombre+apellido a username base: primera inicial + apellido (sin tildes/espacios) */
  private slugUser(nombre: string, apellido: string) {
    const clean = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const n = clean(nombre);
    const a = clean(apellido);
    const inicial = n[0] ?? '';
    return (inicial + a).slice(0, 50); // limita a 50 si quieres
  }

  /** Verifica existencia y agrega correlativo: faguilar, faguilar1, faguilar2… */
  private ensureUnique(base: string) {
    const exists = (u: string) =>
      this.http.get<{ ok: boolean; exists: boolean }>(`${this.API}/usuarios/exists`, {
        params: new HttpParams().set('username', u),
      });

    // probamos base, luego base1..base99 (puedes subir el tope si quieres)
    const maxTry = 99;

    const tryLoop = (i = 0): any => {
      const candidate = i === 0 ? base : `${base}${i}`;
      return exists(candidate).pipe(
        switchMap(res => {
          if (res?.ok && !res.exists) return of(candidate);
          if (i >= maxTry) return of(candidate); // nos quedamos con el último si excede
          return tryLoop(i + 1);
        })
      );
    };

    return tryLoop();
  }

  save() {
    if (this.form.invalid) return;

    const payload: any = { ...this.form.value };

    if (this.isEdit) {
      delete payload.password; // no se actualiza aquí
      this.api.update(this.id, payload).subscribe(() => this.router.navigate(['/usuarios']));
    } else {
      if (!payload.password) { alert('Contraseña requerida'); return; }
      this.api.create(payload).subscribe(() => this.router.navigate(['/usuarios']));
    }
  }
}
