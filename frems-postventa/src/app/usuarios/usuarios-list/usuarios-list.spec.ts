import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsuariosList } from './usuarios-list';

describe('UsuariosList', () => {
  let component: UsuariosList;
  let fixture: ComponentFixture<UsuariosList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsuariosList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UsuariosList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
