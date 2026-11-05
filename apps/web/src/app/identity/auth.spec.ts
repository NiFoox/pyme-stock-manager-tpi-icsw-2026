import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from './auth.service';
import { routes } from '../app.routes';
import { Login } from './login';
import { Session } from './session';

describe('authentication UI and session recovery', () => {
  let http: HttpTestingController;
  const user = { id: '1', username: 'admin-test', role: 'ADMIN' as const };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('restores a session on direct protected navigation and logs out', async () => {
    const harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl('/', Session);
    await vi.waitFor(() => http.expectOne('/api/auth/me').flush(user));
    const component = await navigation;
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain(user.username);
    const logout = component.logout();
    http.expectOne({ method: 'POST', url: '/api/auth/logout' }).flush(null, { status: 204, statusText: 'No Content' });
    await logout;
    expect(TestBed.inject(AuthService).user()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('redirects an anonymous visitor and completes login through the protected route', async () => {
    const harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl('/', Login);
    await vi.waitFor(() => http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' }));
    const component = await navigation;
    component.username = user.username;
    component.password = 'private password';
    const submit = component.submit();
    const login = http.expectOne({ method: 'POST', url: '/api/auth/login' });
    expect(login.request.body).toEqual({ username: user.username, password: 'private password' });
    login.flush(user);
    await vi.waitFor(() => http.expectOne('/api/auth/me').flush(user));
    await submit;
    expect(TestBed.inject(Router).url).toBe('/');
    expect(component.password).toBe('');
  });

  it('shows generic login errors and clears the password without navigating', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/login', Login);
    component.username = user.username;
    component.password = 'wrong';
    const submit = component.submit();
    http.expectOne('/api/auth/login').flush({ message: 'internal account details' }, { status: 401, statusText: 'Unauthorized' });
    await submit;
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('[role=alert]')?.textContent).toBe('Usuario o contraseña incorrectos.');
    expect(component.password).toBe('');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('keeps the session visible when logout fails so the user can retry', async () => {
    const harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl('/', Session);
    await vi.waitFor(() => http.expectOne('/api/auth/me').flush(user));
    const component = await navigation;
    const logout = component.logout();
    http.expectOne('/api/auth/logout').flush({}, { status: 503, statusText: 'Unavailable' });
    await logout;
    expect(TestBed.inject(AuthService).user()).toEqual(user);
    expect(component.error()).toContain('No se pudo cerrar');
  });
});
