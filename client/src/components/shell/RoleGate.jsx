import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useChain } from '../../chain';
import { ROLES } from '../../contract';
import { Card, Callout } from '../ui';

/**
 * Gate a console behind the role the contract says this wallet holds.
 *
 * Two outcomes:
 *   - no wallet connected      -> the /access auth screen, with where they were headed
 *   - wallet without the role  -> the console they DO hold, with a reason
 *   - wallet with the role     -> render
 *
 * The role is never taken from the URL or from storage, so a bookmarked link cannot
 * put someone into a console they are not entitled to see.
 */
export default function RoleGate({ role, children }) {
  const { account, primaryRole, roles, isPatient } = useChain();
  const location = useLocation();

  if (!account) {
    return <Navigate to="/access" replace state={{ from: location.pathname }} />;
  }

  const holds =
    role === 'admin' ? roles.admin : role === 'doctor' ? roles.manager : role === 'auditor' ? roles.auditor : isPatient;

  if (!holds) {
    if (primaryRole && primaryRole !== role) {
      // They hold a different role. Send them where they belong rather than
      // showing an error they cannot act on.
      return <Navigate to={ROLES[primaryRole].path} replace state={{ from: location.pathname }} />;
    }
    return (
      <div className="mx-auto max-w-lg">
        <Card title="This wallet holds no role on this contract">
          <p className="text-sm leading-relaxed text-slate-600">
            Nothing is wrong — this address was simply never registered. An administrator has to
            create an identity for it and grant a role before a console can open.
          </p>
          <Link to="/verify" className="btn-secondary mt-4 w-full">
            Verify a record instead
          </Link>
        </Card>
      </div>
    );
  }

  return children;
}
