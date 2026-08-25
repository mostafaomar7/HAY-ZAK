import { AdminListState } from './admin-list-state';

describe('AdminListState', () => {
  let state: AdminListState;

  beforeEach(() => {
    state = new AdminListState();
  });

  it('reports loading before the first response', () => {
    expect(state.state()).toBe('loading');
  });

  it('prefers loading over the previous emptiness while reloading', () => {
    state.succeed(0, 0);
    expect(state.state()).toBe('empty');

    state.begin();
    expect(state.state())
      .withContext('a reload must not keep showing "no results" from last time')
      .toBe('loading');
  });

  it('prefers an error over emptiness', () => {
    state.succeed(0, 0);
    state.begin();
    state.fail();

    expect(state.state()).toBe('error');
  });

  it('reports data once rows arrive', () => {
    state.succeed(4, 18);

    expect(state.state()).toBe('data');
    expect(state.total()).toBe(18);
  });

  it('returns to the first page when the filters change', () => {
    state.setPage(3);
    state.applyFilters({ cityId: 'riyadh' });

    expect(state.page()).toBe(1);
    expect(state.filters()).toEqual({ cityId: 'riyadh' });
  });

  it('clears the selection whenever the visible rows change', () => {
    state.setSelection(['a', 'b']);
    state.setPage(2);
    expect(state.selected()).toEqual([]);

    state.setSelection(['c']);
    state.applyFilters({ status: 'x' });
    expect(state.selected()).toEqual([]);
  });

  it('folds the filters, paging and sort into one query object', () => {
    state.applyFilters({ search: 'مستودع' });
    state.setSort({ key: 'waitingHours', direction: 'desc' });

    expect(state.params()).toEqual({
      search: 'مستودع',
      page: '1',
      pageSize: '20',
      sortBy: 'waitingHours',
      sortDirection: 'desc',
    });
  });

  it('omits the sort keys entirely when nothing is sorted', () => {
    expect(Object.keys(state.params())).toEqual(['page', 'pageSize']);
  });
});
