// The heart of the client. Every wallet and contract call goes through here, so
// no page ever touches ethers directly and a contract change touches one file.
//
// Two rules this file exists to enforce:
//
//   1. ROLE STATE IS READ FROM THE CHAIN, never from the URL or localStorage.
//      The badge and the page body therefore read the same source and cannot
//      contradict each other — a bug this project has hit before.
//
//   2. RE-READ WHENEVER IT COULD HAVE CHANGED. Switching MetaMask accounts,
//      changing network, returning to the tab, or just time passing all
//      trigger a refresh, so nothing needs a manual page reload.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BrowserProvider, Contract, Interface, getAddress, isAddress } from 'ethers';
import { ABI, CONTRACT_ADDRESS, CHAIN_ID } from './contract';
import { chainPermissions, recordsByOwner } from './services/api';

const CONTRACT_INTERFACE = new Interface(ABI);
const POLL_MS = 12_000;

export const hasWallet = () => typeof window !== 'undefined' && Boolean(window.ethereum);

/** Plain-English titles for the named refusals our API returns. */
const API_TITLES = {
  AiConsentRequired: 'AI consent required',
  AccessDenied: 'Access denied by the contract',
  Expired: 'Consent window has closed',
  NotAuthorized: 'Not authorised by the contract',
  RecordNotFound: 'No such record',
  BlobMissing: 'Record bytes are not on this server',
  AI_NOT_CONFIGURED: 'Gemini is not configured',
  AI_UPSTREAM: 'Gemini is busy or unavailable',
  AI_EMPTY: 'Gemini returned nothing usable',
  AI_UNPARSEABLE: 'Gemini returned unparseable output',
  EmptyRecord: 'Record has no readable text',
  ChainUnavailable: 'Chain unreachable',
  BadRequest: 'Invalid request',
};

/** Turn an ethers throw — or one of our backend's refusals — into something a person can act on. */
export function describeError(error) {
  if (!error) return { title: 'Something went wrong', detail: 'No further detail.' };

  if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
    return { title: 'Rejected in wallet', detail: 'You cancelled the request in MetaMask.' };
  }
  if (error.code === 'API_DOWN') {
    return { title: 'Backend unreachable', detail: error.message };
  }

  // A refusal from our own API. These carry named codes that are more useful than
  // anything we could infer, and they distinguish cases the chain cannot: the
  // difference between "you may not read this" and "nobody agreed to the model
  // seeing it" is the whole point of the two AI gates.
  if (error.payload) {
    return {
      title: API_TITLES[error.code] || error.code || 'Request refused',
      detail: error.message,
      code: error.code,
      payload: error.payload,
    };
  }

  const candidates = [
    error.data,
    error.revert?.data,
    error.info?.error?.data,
    error.error?.data,
    error.value,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.startsWith('0x')) continue;
    try {
      const parsed = CONTRACT_INTERFACE.parseError(candidate);
      if (!parsed) continue;
      return namedError(parsed);
    } catch {
      /* not one of ours */
    }
  }

  return {
    title: 'Transaction failed',
    detail: error.shortMessage || error.reason || error.message || 'Unknown error.',
  };
}

function namedError(parsed) {
  switch (parsed.name) {
    case 'AccessControlUnauthorizedAccount':
      return {
        title: 'Not your role',
        detail:
          'The contract refused: this wallet does not hold the role that function requires. ' +
          'The website did not block it — the contract did.',
        code: parsed.name,
      };
    case 'AccessDenied':
      return {
        title: 'Access denied by the contract',
        detail: 'The record owner has not granted this wallet access.',
        code: parsed.name,
      };
    case 'Expired':
      return {
        title: 'Consent window has closed',
        detail: 'The grant was time-boxed, and the contract no longer authorises this read.',
        code: parsed.name,
      };
    case 'NotAuthorized':
      return {
        title: 'Not authorised',
        detail:
          'The contract refused this call. For a record, that usually means you are not the owner.',
        code: parsed.name,
      };
    case 'RecordNotFound':
      return { title: 'No such record', detail: 'That token id does not exist.', code: parsed.name };
    case 'IdentityNotFound':
      return {
        title: 'Identity not registered',
        detail: 'The patient must have a registered identity before a record can be minted to them.',
        code: parsed.name,
      };
    case 'IdentityExists':
      return { title: 'Already registered', detail: 'That wallet already has an identity.', code: parsed.name };
    case 'ERC721NonexistentToken':
      return { title: 'Record does not exist', detail: 'That token has been revoked.', code: parsed.name };
    default:
      return { title: parsed.name, detail: 'The contract rejected the call.', code: parsed.name };
  }
}

const ChainContext = createContext(null);

export function ChainProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [chainId, setChainId] = useState(null);
  const [roles, setRoles] = useState({ admin: false, manager: false, auditor: false });
  const [identity, setIdentity] = useState({ label: '', active: false });
  const [did, setDid] = useState('');
  const [ownedRecords, setOwnedRecords] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletError, setWalletError] = useState(null);
  const [readReady, setReadReady] = useState(false);

  const providerRef = useRef(null);
  const accountRef = useRef(null);

  const getReadProvider = useCallback(() => {
    if (!hasWallet()) return null;
    if (!providerRef.current) providerRef.current = new BrowserProvider(window.ethereum);
    return providerRef.current;
  }, []);

  /** A contract for reads: no signer, so MetaMask never prompts. */
  const readContract = useCallback(async () => {
    const provider = getReadProvider();
    if (!provider) return null;
    return new Contract(CONTRACT_ADDRESS, ABI, provider);
  }, [getReadProvider]);

  /** A contract that can write. Prompts for a signature on each transaction. */
  const writeContract = useCallback(async () => {
    const provider = getReadProvider();
    if (!provider) throw new Error('No wallet detected.');
    const signer = await provider.getSigner();
    return new Contract(CONTRACT_ADDRESS, ABI, signer);
  }, [getReadProvider]);

  /**
   * Sign a plain message with the connected wallet.
   *
   * Used to authorise the off-chain display profile. There is no session and no
   * password, so proving "this is the wallet that owns this address" has to be a
   * signature — which is stronger than a session anyway, since it cannot be
   * replayed to change somebody else's data.
   */
  const signMessage = useCallback(
    async (message) => {
      const provider = getReadProvider();
      if (!provider) throw new Error('No wallet detected.');
      const signer = await provider.getSigner();
      return signer.signMessage(message);
    },
    [getReadProvider]
  );

  /**
   * Refresh everything that can change when the user switches accounts.
   * Roles come from the contract; "patient" comes from actually owning a token.
   */
  const refresh = useCallback(
    async (address) => {
      const target = address || accountRef.current;
      if (!target) {
        setRoles({ admin: false, manager: false, auditor: false });
        setIdentity({ label: '', active: false });
        setDid('');
        setOwnedRecords([]);
        return;
      }

      setRefreshing(true);
      try {
        const provider = getReadProvider();
        if (provider) {
          const network = await provider.getNetwork();
          setChainId(Number(network.chainId));
          setReadReady(true);
        }

        // Roles: one authoritative source, the contract.
        const contract = await readContract();
        if (contract) {
          const [adminRole, managerRole, auditorRole] = await Promise.all([
            contract.DEFAULT_ADMIN_ROLE(),
            contract.MANAGER_ROLE(),
            contract.AUDITOR_ROLE(),
          ]);
          const [isAdmin, isManager, isAuditor, record, didString] = await Promise.all([
            contract.hasRole(adminRole, target),
            contract.hasRole(managerRole, target),
            contract.hasRole(auditorRole, target),
            contract.identities(target),
            contract.didFor(target),
          ]);
          setRoles({ admin: isAdmin, manager: isManager, auditor: isAuditor });
          setIdentity({ label: record[0], active: record[2] });
          setDid(didString);
        }

        // The patient role is ownership, not a role grant — so ask the backend.
        try {
          const owned = await recordsByOwner(target);
          setOwnedRecords(owned.records || []);
        } catch {
          setOwnedRecords([]);
        }
      } catch (error) {
        setWalletError(describeError(error));
      } finally {
        setRefreshing(false);
      }
    },
    [getReadProvider, readContract]
  );

  const readAccounts = useCallback(async () => {
    if (!hasWallet()) return { selected: [], permitted: [] };
    const request = window.ethereum.request.bind(window.ethereum);
    const selected = await request({ method: 'eth_accounts' }).catch(() => []);

    // eth_accounts often reports only the active account. wallet_getPermissions
    // returns every account this site was authorised to use, as a caveat.
    let permitted = [];
    try {
      const permissions = await request({ method: 'wallet_getPermissions' });
      const caveat = permissions?.[0]?.caveats?.find((c) => c.type === 'restrictReturnedAccounts');
      if (caveat?.value) permitted = caveat.value;
    } catch {
      /* not supported — fall back to whatever eth_accounts gave us */
    }
    return { selected, permitted };
  }, []);

  /** Connect (or silently re-attach) and load roles for the active account. */
  const syncAccounts = useCallback(
    async ({ prompt = false } = {}) => {
      if (!hasWallet()) return;
      try {
        setConnecting(true);
        setWalletError(null);
        const request = window.ethereum.request.bind(window.ethereum);
        if (prompt) await request({ method: 'eth_requestAccounts' });

        const { selected, permitted } = await readAccounts();
        const unique = [...new Set([...selected, ...permitted])];
        setAvailableAccounts(unique);

        const active = selected[0] || unique[0] || null;
        accountRef.current = active;
        setAccount(active);
        await refresh(active);
      } catch (error) {
        const described = describeError(error);
        setWalletError(described);
      } finally {
        setConnecting(false);
      }
    },
    [readAccounts, refresh]
  );

  /**
   * Switch the active wallet. MetaMask will not let a page silently change the
   * selected account, so this asks for the permission set again and, when the
   * user picks a different account, re-reads the chain.
   */
  const requestAccountSwitch = useCallback(
    async (address) => {
      if (!hasWallet() || !isAddress(address)) return;
      try {
        setConnecting(true);
        setWalletError(null);
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
        await syncAccounts();
      } catch (error) {
        setWalletError(describeError(error));
      } finally {
        setConnecting(false);
      }
    },
    [syncAccounts]
  );

  const switchNetwork = useCallback(async () => {
    if (!hasWallet()) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
      });
    } catch (error) {
      setWalletError(describeError(error));
    }
  }, []);

  // Attach on mount, and keep re-reading whenever the world might have moved.
  useEffect(() => {
    if (!hasWallet()) return undefined;

    syncAccounts();

    const onAccountsChanged = () => syncAccounts();
    const onChainChanged = () => syncAccounts();
    const onFocus = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.ethereum.on?.('accountsChanged', onAccountsChanged);
    window.ethereum.on?.('chainChanged', onChainChanged);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => refresh(), POLL_MS);

    return () => {
      window.ethereum.removeListener?.('accountsChanged', onAccountsChanged);
      window.ethereum.removeListener?.('chainChanged', onChainChanged);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPatient = ownedRecords.length > 0;
  const anyRole = roles.admin || roles.manager || roles.auditor || isPatient;

  const primaryRole = useMemo(() => {
    if (roles.admin) return 'admin';
    if (roles.manager) return 'doctor';
    if (roles.auditor) return 'auditor';
    if (isPatient) return 'patient';
    return null;
  }, [roles, isPatient]);

  const value = useMemo(
    () => ({
      // wallet
      account,
      availableAccounts,
      chainId,
      wrongNetwork: chainId !== null && chainId !== CHAIN_ID,
      connecting,
      refreshing,
      walletError,
      hasWallet: hasWallet(),
      connect: () => syncAccounts({ prompt: true }),
      requestAccountSwitch,
      switchNetwork,
      refresh,
      // identity, all read from the chain
      roles,
      identity,
      did,
      ownedRecords,
      isPatient,
      anyRole,
      primaryRole,
      readReady,
      // contract access
      readContract,
      writeContract,
      signMessage,
    }),
    [
      account,
      availableAccounts,
      chainId,
      connecting,
      refreshing,
      walletError,
      requestAccountSwitch,
      switchNetwork,
      refresh,
      roles,
      identity,
      did,
      ownedRecords,
      isPatient,
      anyRole,
      primaryRole,
      readReady,
      readContract,
      writeContract,
      signMessage,
    ]
  );

  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
}

export function useChain() {
  const context = useContext(ChainContext);
  if (!context) throw new Error('useChain must be used inside <ChainProvider>');
  return context;
}

/** Short 0x1234…abcd form. */
export function shortAddress(address) {
  if (!address || typeof address !== 'string') return '—';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function asChecksum(address) {
  try {
    return getAddress(address);
  } catch {
    return address;
  }
}
