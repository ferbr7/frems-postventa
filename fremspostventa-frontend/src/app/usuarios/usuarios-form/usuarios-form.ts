import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule, NavigationEnd } from '@angular/router';
import { UsersService } from '../../core/users.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, switchMap, filter as rxFilter } from 'rxjs/operators';
import { of, Observable } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-usuarios-form',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './usuarios-form.html',
})
export class UsuariosFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(UsersService);
  private http = inject(HttpClient);

  private readonly API = 'http://localhost:4000/api';

  id = 0;
  isEdit = false;
  isView = false;

  autoUsername = true;

  private lastState = { id: 0, isView: false };

  form = this.fb.group({
    nombre: ['', [Validators.required]],
    apellido: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    username: [{ value: '', disabled: true }, [Validators.required]],
    password: [''],
    idrol: [3, [Validators.required]],
    activo: [true],
    fechaalta: [this.todayLocal(), [Validators.required]],
  });

  private todayLocal(): string {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  ngOnInit() {
    this.recomputeModeFromRoute();

    this.router.events
      .pipe(rxFilter(e => e instanceof NavigationEnd))
      .subscribe(() => this.recomputeModeFromRoute());

    this.setupAutoUsername();
  }

  private recomputeModeFromRoute() {
    const idParam = this.route.pathFromRoot
      .map(r => r.snapshot.paramMap.get('id'))
      .find(v => !!v);
    this.id = idParam ? Number(idParam) : 0;

    let accion = this.route.pathFromRoot
      .map(r => r.snapshot.paramMap.get('accion') || r.snapshot.paramMap.get('mode'))
      .find(v => !!v) || '';

    if (!accion) {
      const segs = this.route.pathFromRoot.flatMap(r => r.snapshot.url.map(s => s.path));
      accion = segs[segs.length - 1] || ''; // 'ver' | 'editar' | 'nuevo' | ...
    }

    this.isView = accion === 'ver';
    this.isEdit = accion === 'editar';

    this.autoUsername = !this.isView && !this.isEdit;

    if (this.isView) {
      this.form.disable();

      this.form.get('password')?.reset('');
    } else {
      this.form.enable();

      if (this.isEdit) {
        this.form.get('nombre')?.disable({ emitEvent: false });
        this.form.get('apellido')?.disable({ emitEvent: false });
        this.form.get('email')?.enable({ emitEvent: false });
        this.form.get('username')?.disable({ emitEvent: false });
        this.form.get('password')?.reset('');
        this.form.get('password')?.disable({ emitEvent: false });
      } else {

        this.form.get('password')?.enable({ emitEvent: false });
      }
    }

    this.loadUserIfNeeded();
  }

  private loadUserIfNeeded() {
    if (this.id && (this.lastState.id !== this.id || this.lastState.isView !== this.isView)) {
      this.api.get(this.id).subscribe(res => {
        if (res?.ok) {
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
        }
      });
      this.lastState = { id: this.id, isView: this.isView };
    }
  }

  get estadoLabel(): string {
    return this.form.get('activo')?.value ? 'Activo' : 'Inactivo';
  }

  // ------------------ Auto-username ------------------
  private setupAutoUsername() {
    if (!this.autoUsername) return;

    const nombreCtrl = this.form.get('nombre')!;
    const apellidoCtrl = this.form.get('apellido')!;

    nombreCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe(() => this.trySuggestUsername());

    apellidoCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe(() => this.trySuggestUsername());
  }

  private trySuggestUsername() {
    if (!this.autoUsername) return;

    const nombre = (this.form.get('nombre')?.value || '').trim();
    const apellido = (this.form.get('apellido')?.value || '').trim();
    if (!nombre || !apellido) return;

    const params = new HttpParams().set('nombre', nombre).set('apellido', apellido);

    this.http
      .get<{ ok: boolean; suggestion: string }>(`${this.API}/usuarios/suggest-username`, { params })
      .pipe(switchMap(res => of(res?.suggestion ?? '')))
      .subscribe({
        next: (sug: string) => {
          if (this.autoUsername && sug) {
            this.form.get('username')?.setValue(sug, { emitEvent: false, onlySelf: true });
          }
        },
        error: _ => {
          this.fallbackLocalSuggestion(nombre, apellido).subscribe((sug: string) => {
            if (this.autoUsername && sug) {
              this.form.get('username')?.setValue(sug, { emitEvent: false, onlySelf: true });
            }
          });
        },
      });
  }

  private fallbackLocalSuggestion(nombre: string, apellido: string): Observable<string> {
    const base = this.slugUser(nombre, apellido);
    return this.ensureUnique(base);
  }

  private slugUser(nombre: string, apellido: string) {
    const clean = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const n = clean(nombre);
    const a = clean(apellido);
    const inicial = n[0] ?? '';
    return (inicial + a).slice(0, 50);
  }

  private ensureUnique(base: string) {
    const exists = (u: string) =>
      this.http.get<{ ok: boolean; exists: boolean }>(`${this.API}/usuarios/exists`, {
        params: new HttpParams().set('username', u),
      });

    const maxTry = 99;
    const loop = (i = 0): Observable<string> => {
      const candidate = i === 0 ? base : `${base}${i}`;
      return exists(candidate).pipe(
        switchMap(res => (res?.ok && !res.exists) ? of(candidate) : (i >= maxTry ? of(candidate) : loop(i + 1)))
      );
    };

    return loop();
  }

  save() {
    if (this.isView) return;
    if (this.form.invalid) return;

    if (this.isEdit) {
      const { idrol, activo, fechaalta, email } = this.form.getRawValue() as any;
      const payload = { idrol, activo, fechaalta, email };

      this.api.update(this.id, payload).subscribe(() => this.router.navigate(['/usuarios']));
      return;
    }

    const payload: any = this.form.getRawValue();
    if (!payload.password) { alert('Contraseña requerida'); return; }
    this.api.create(payload).subscribe(() => this.router.navigate(['/usuarios']));
  }

  get title() {
    if (this.isView) return 'Vista usuario';
    if (this.isEdit) return 'Editar usuario';
    return 'Nuevo usuario';
  }

  // --- Subtítulo dinámico ---
  get subtitle() {
    if (this.isView) return 'Consulta la información del usuario.';
    if (this.isEdit) return 'Actualiza los datos de este usuario.';
    return 'Completa los campos para agregar un nuevo usuario.';
  }
}
