import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecuperarReset } from './recuperar-reset';

describe('RecuperarReset', () => {
  let component: RecuperarReset;
  let fixture: ComponentFixture<RecuperarReset>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecuperarReset]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecuperarReset);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
