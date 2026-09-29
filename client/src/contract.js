// The client's view of the contract. Matches ../../contracts/AarogyaChain.sol,
// which is the source for the instance deployed on Sepolia.
//
// The custom errors are not decoration: without them ethers can only say
// "execution reverted (unknown custom error)", which is what makes a
// wrong-wallet mistake look like a broken contract on stage.

export const ABI = [
  // identity
  'function createIdentity(address account, string label)',
  'function deactivateIdentity(address account)',
  'function didFor(address account) view returns (string)',
  'function identities(address) view returns (string label, uint64 createdAt, bool active)',

  // manager
  'function requestRecord(address patient, string recordType) returns (uint256)',
  'function emergencyAccess(uint256 tokenId, address viewer, string reason)',

  // admin
  'function mintRecord(address patient, bytes32 recordHash, string cid, string recordType) returns (uint256)',
  'function revokeRecord(uint256 tokenId)',

  // patient / owner
  'function grantAccess(uint256 tokenId, address viewer, uint64 durationSeconds)',
  'function revokeAccess(uint256 tokenId, address viewer)',

  // reads
  'function canAccess(uint256 tokenId, address viewer) view returns (bool)',
  'function viewRecord(uint256 tokenId) view returns (string)',
  'function verifyRecord(uint256 tokenId, bytes32 fileHash) view returns (bool)',
  'function auditRecord(uint256 tokenId) view returns (bytes32 recordHash, string recordType, uint64 mintedAt, address owner)',
  'function locked(uint256 tokenId) view returns (bool)',
  'function consent(uint256, address) view returns (uint64)',
  'function nextTokenId() view returns (uint256)',
  'function nextRequestId() view returns (uint256)',

  // erc721 surface the UI touches
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transferFrom(address from, address to, uint256 tokenId)',

  // access control
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function grantRole(bytes32 role, address account)',
  'function MANAGER_ROLE() view returns (bytes32)',
  'function AUDITOR_ROLE() view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',

  // events
  'event IdentityCreated(address indexed account, string label)',
  'event RecordRequested(uint256 indexed requestId, address indexed requester, address indexed patient, string recordType)',
  'event RecordMinted(uint256 indexed tokenId, address indexed patient, bytes32 recordHash, string recordType)',
  'event RecordRevoked(uint256 indexed tokenId, address indexed admin)',
  'event AccessGranted(uint256 indexed tokenId, address indexed viewer, uint64 expiresAt)',
  'event AccessRevoked(uint256 indexed tokenId, address indexed viewer)',
  'event EmergencyAccessUsed(uint256 indexed tokenId, address indexed viewer, string reason, uint64 expiresAt)',
  'event Locked(uint256 tokenId)',
  'event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)',

  // custom errors
  'error NotAuthorized()',
  'error AccessDenied()',
  'error Expired()',
  'error RecordNotFound()',
  'error IdentityExists()',
  'error IdentityNotFound()',
  'error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)',
  'error ERC721NonexistentToken(uint256 tokenId)',
  'error ERC721InvalidReceiver(address receiver)',
  'error ReentrancyGuardReentrantCall()',
];

export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS || '0x464e6963cE0D833193C83Fc8Bd081614B9344b03';

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 11155111);

export const EXPLORER = `https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`;

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * The AI service's on-chain identity.
 *
 * It holds no key and never signs. It exists only to be the SUBJECT of a consent
 * grant, so that transmitting a record's content to a model is authorised by the
 * patient through the same grantAccess() a doctor uses. The authoritative value
 * comes from the backend (/api/ai/status/:tokenId); this is only a fallback so
 * the UI can render before the first fetch returns.
 */
export const AI_VIEWER_ADDRESS =
  import.meta.env.VITE_AI_VIEWER_ADDRESS || '0x000000000000000000000000000000000000A1A1';

export const AI_VIEWER_LABEL = 'AarogyaChain AI (Gemini)';

/** The four roles, and what each one may actually do. */
export const ROLES = {
  admin: {
    key: 'admin',
    label: 'Admin',
    subtitle: 'Hospital IT',
    path: '/admin',
    can: 'Register identities · mint records · revoke records · grant roles',
    cannot: 'Read a patient file without consent',
  },
  doctor: {
    key: 'doctor',
    label: 'Doctor',
    subtitle: 'Manager role',
    path: '/doctor',
    can: 'Request records · read with consent · emergency break-glass (logged)',
    cannot: 'Mint records · keep access after a window closes',
  },
  auditor: {
    key: 'auditor',
    label: 'Auditor',
    subtitle: 'Auditor role',
    path: '/auditor',
    can: 'Read hash, type, time and owner · read the full event log',
    cannot: 'Ever receive the file location',
  },
  patient: {
    key: 'patient',
    label: 'Patient',
    subtitle: 'Record owner',
    path: '/patient',
    can: 'Own records · grant time-boxed access · revoke at will',
    cannot: 'Transfer a record to anyone else',
  },
};

export const ROLE_ORDER = ['admin', 'doctor', 'auditor', 'patient'];
