import { UserRole } from '../enums/user-role.enum';
import { MOCK_ACCOUNTS, accountFor } from './accounts';
import { MOCK_LESSOR } from './lessor.fixtures';

describe('mock accounts', () => {
  it('covers every role a person can hold', () => {
    const covered = MOCK_ACCOUNTS.map((account) => account.role);

    for (const role of Object.values(UserRole)) {
      if (role === UserRole.Guest) continue; // a guest is the absence of an account
      expect(covered).withContext(role).toContain(role);
    }
  });

  it('gives each account a role the product recognises', () => {
    for (const account of MOCK_ACCOUNTS) {
      expect(Object.values(UserRole))
        .withContext(account.email ?? account.mobile)
        .toContain(account.role);
    }
  });

  it('resolves an account by email, whatever the casing', () => {
    for (const account of MOCK_ACCOUNTS) {
      expect(accountFor(account.email!.toUpperCase()).id).toBe(account.id);
    }
  });

  it('resolves the same account by mobile, formatted either way', () => {
    for (const account of MOCK_ACCOUNTS) {
      expect(accountFor(account.mobile).id).toBe(account.id);

      const international = `+966 ${account.mobile.slice(1)}`;
      expect(accountFor(international).id).withContext(international).toBe(account.id);
    }
  });

  it('falls back to the lessor so any made-up address still opens a portal', () => {
    expect(accountFor('someone@nowhere.test').id).toBe(MOCK_LESSOR.id);
    expect(accountFor('').id).toBe(MOCK_LESSOR.id);
  });
});
