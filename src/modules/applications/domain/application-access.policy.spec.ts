import { type AuthenticatedUser } from '../../auth/interfaces';
import { AccessDeniedError, ResourceNotFoundError } from '../../../common/errors';
import { Role } from '../../users/enums';
import { type ApplicationOwnership } from '../interfaces';
import * as Policy from './application-access.policy';
const user = (id: string, role: Role): AuthenticatedUser => ({
  id,
  role,
  email: `${id}@example.test`,
});

const admin = user('admin', Role.Admin);
const owner = user('sales-owner', Role.Sales);
const otherSales = user('sales-other', Role.Sales);
const assignedReviewer = user('reviewer-assigned', Role.Reviewer);
const otherReviewer = user('reviewer-other', Role.Reviewer);

const app: ApplicationOwnership = {
  createdById: owner.id,
  assignedReviewerId: assignedReviewer.id,
};

describe('ApplicationAccessPolicy', () => {
  describe('view', () => {
    it.each([admin, owner, assignedReviewer, otherReviewer])('lets %j view', (u) => {
      expect(Policy.canView(u, app)).toBe(true);
    });

    it('hides other users’ applications from SALES as not found', () => {
      expect(Policy.canView(otherSales, app)).toBe(false);
      expect(() => {
        Policy.assertCanView(otherSales, app);
      }).toThrow(ResourceNotFoundError);
    });
  });

  describe('modify', () => {
    it('allows the owning SALES user and ADMIN', () => {
      expect(Policy.canModify(owner, app)).toBe(true);
      expect(Policy.canModify(admin, app)).toBe(true);
    });

    it('reports a foreign SALES user as not found, not forbidden', () => {
      expect(() => {
        Policy.assertCanModify(otherSales, app);
      }).toThrow(ResourceNotFoundError);
    });

    it('forbids reviewers', () => {
      expect(() => {
        Policy.assertCanModify(assignedReviewer, app);
      }).toThrow(AccessDeniedError);
    });
  });

  describe('decide', () => {
    it('allows only the assigned reviewer', () => {
      expect(Policy.canDecide(assignedReviewer, app)).toBe(true);
      expect(() => {
        Policy.assertCanDecide(assignedReviewer, app);
      }).not.toThrow();
    });

    it.each([otherReviewer, admin, owner])('forbids %j', (u) => {
      expect(Policy.canDecide(u, app)).toBe(false);
      expect(() => {
        Policy.assertCanDecide(u, app);
      }).toThrow(AccessDeniedError);
    });

    it('forbids every reviewer while nobody is assigned', () => {
      const unassigned = { ...app, assignedReviewerId: null };
      expect(Policy.canDecide(assignedReviewer, unassigned)).toBe(false);
    });

    it('does not reveal the application to a foreign SALES user', () => {
      expect(() => {
        Policy.assertCanDecide(otherSales, app);
      }).toThrow(ResourceNotFoundError);
    });
  });
});
