import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  styles: `form { display: grid; gap: .75rem; } input, button { padding: .7rem; font: inherit; } button { margin-top: .5rem; cursor: pointer; } [role=alert] { color: #a11520; }`,
  template: `
    <h1>Inventario PyME</h1>
    <h2>Iniciar sesión</h2>
    <form (ngSubmit)="submit()">
      <label for="username">Usuario</label>
      <input id="username" name="username" [(ngModel)]="username" autocomplete="username" required maxlength="64" />
      <label for="password">Contraseña</label>
      <input id="password" name="password" type="password" [(ngModel)]="password" autocomplete="current-password" required maxlength="128" />
      @if (error()) { <p role="alert">{{ error() }}</p> }
      <button type="submit" [disabled]="busy() || !username.trim() || !password">{{ busy() ? 'Ingresando…' : 'Ingresar' }}</button>
    </form>
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  username = '';
  password = '';
  readonly busy = signal(false);
  readonly error = signal(inject(ActivatedRoute).snapshot.queryParamMap.has('unavailable') ? 'Servicio temporalmente no disponible.' : '');

  async submit() {
    if (this.busy() || !this.username.trim() || !this.password) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.username, this.password);
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.error.set(error instanceof HttpErrorResponse && error.status === 401
        ? 'Usuario o contraseña incorrectos.'
        : error instanceof HttpErrorResponse && error.status === 429
          ? 'Demasiados intentos. Reintentá en un minuto.'
          : 'No se pudo iniciar sesión. Intentá nuevamente.');
    } finally {
      this.password = '';
      this.busy.set(false);
    }
  }
}
