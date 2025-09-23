import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IaDetail } from './ia-detail';

describe('IaDetail', () => {
  let component: IaDetail;
  let fixture: ComponentFixture<IaDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IaDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IaDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
