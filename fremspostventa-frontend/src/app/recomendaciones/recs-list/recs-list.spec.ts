import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecsList } from './recs-list';

describe('RecsList', () => {
  let component: RecsList;
  let fixture: ComponentFixture<RecsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
