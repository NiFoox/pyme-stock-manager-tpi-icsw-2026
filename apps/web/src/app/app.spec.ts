import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

it('renders the application route outlet', async () => {
  await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] }).compileComponents();
  const fixture = TestBed.createComponent(App);
  fixture.detectChanges();
  expect((fixture.nativeElement as HTMLElement).querySelector('router-outlet')).toBeTruthy();
});
