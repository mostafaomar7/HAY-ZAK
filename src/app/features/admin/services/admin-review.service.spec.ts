import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { RejectionReasonCode } from '@core/models/admin.model';
import { environment } from '../../../../environments/environment';
import { AdminReviewService } from './admin-review.service';

/**
 * `POST /admin/units/:id/reject` takes one `reason` string.
 *
 * The console was posting `{ reasonCode, note }`, which the server's
 * mass-assignment guard strips before answering "سبب الرفض مطلوب" — so **no
 * listing could be rejected at all**, on either the single or the bulk path.
 */
describe('AdminReviewService — rejecting', () => {
  let service: AdminReviewService;
  let http: HttpTestingController;

  const url = `${environment.apiUrl}${API_ENDPOINTS.admin.rejectUnit('u-1')}`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AdminReviewService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminReviewService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends `reason`, never `reasonCode`', () => {
    service.rejectListing('u-1', { reasonCode: RejectionReasonCode.UnclearPhotos }).subscribe();

    const request = http.expectOne(url);
    const body = request.request.body as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['reason']);
    expect(typeof body['reason']).toBe('string');
    expect((body['reason'] as string).length).toBeGreaterThan(0);
    request.flush({ success: true, data: null });
  });

  /**
   * The lessor reads this on their rejected listing. A bare code would reach
   * them as `UnclearPhotos`.
   */
  it('writes the reason in words, with the operator’s note joined on', () => {
    service
      .rejectListing('u-1', {
        reasonCode: RejectionReasonCode.UnclearPhotos,
        note: 'الصورة الثانية مظلمة',
      })
      .subscribe();

    const request = http.expectOne(url);
    const reason = (request.request.body as { reason: string }).reason;
    expect(reason).not.toContain('UnclearPhotos');
    expect(reason).toContain('الصورة الثانية مظلمة');
    expect(reason).toContain('—');
    request.flush({ success: true, data: null });
  });

  it('sends the label alone when no note was written', () => {
    service
      .rejectListing('u-1', { reasonCode: RejectionReasonCode.ProhibitedGoods, note: '   ' })
      .subscribe();

    const request = http.expectOne(url);
    expect((request.request.body as { reason: string }).reason).not.toContain('—');
    request.flush({ success: true, data: null });
  });

  /** Approving takes no body, and that asymmetry is the rule itself. */
  it('approves with no body at all', () => {
    service.approveListing('u-1').subscribe();

    const request = http.expectOne(
      `${environment.apiUrl}${API_ENDPOINTS.admin.approveUnit('u-1')}`,
    );
    expect(request.request.body).toEqual({});
    request.flush({ success: true, data: null });
  });
});
