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

  
  private readonly API = 'http://localhost:4000/api';

  id = Number(this.route.snapshot.paramMap.get('id') || 0);
  isEdit = this.id > 0;

  
  autoUsername = !this.isEdit;

  form = this.fb.group({
    nombre: ['', [Validators.required]],
    apellido: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    username: ['', [Validators.required]],
    password: [''], 
    idrol: [3, [Validators.required]],
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
          
          this.autoUsername = false;
        }
      });
    }

    this.setupAutoUsername();
  }

  
  get estadoLabel(): string {
    return this.form.get('activo')?.value ? 'Activo' : 'Inactivo';
  }

  
  onUsernameInput() {
    this.autoUsername = false;
  }

  
  private setupAutoUsername() {
    const nombreCtrl = this.form.get('nombre')!;
    const apellidoCtrl = this.form.get('apellido')!;
    const usernameCtrl = this.form.get('username')!;

    
    usernameCtrl.valueChanges.pipe(debounceTime(200)).subscribe(v => {
      if (v && v.toString().trim().length) this.autoUsername = false;
    });

    
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

    
    this.http.get<{ ok: boolean; suggestion: string }>(`${this.API}/usuarios/suggest-username`, { params })
      .pipe(
        switchMap(res => of(res?.suggestion ?? '')) 
      )
      .subscribe({
        next: (sug: string) => {
          if (this.autoUsername && sug) {
            this.form.get('username')?.setValue(sug, { emitEvent: false });
          }
        },
        error: _err => {
          
          this.fallbackLocalSuggestion(nombre, apellido).subscribe((sug: string) => {
            if (this.autoUsername && sug) {
              this.form.get('username')?.setValue(sug, { emitEvent: false });
            }
          });
        }
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
    return (inicial + a).slice(0, 50); // limita a 50 si quieres
  }

  
  private ensureUnique(base: string) {
    const exists = (u: string) =>
      this.http.get<{ ok: boolean; exists: boolean }>(`${this.API}/usuarios/exists`, {
        params: new HttpParams().set('username', u),
      });

    
    const maxTry = 99;

    const tryLoop = (i = 0): any => {
      const candidate = i === 0 ? base : `${base}${i}`;
      return exists(candidate).pipe(
        switchMap(res => {
          if (res?.ok && !res.exists) return of(candidate);
          if (i >= maxTry) return of(candidate); 
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
