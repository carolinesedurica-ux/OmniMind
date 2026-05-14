# Security Specification: OmniMind Intelligence Network

## 1. Data Invariants
- **Workspace Ownership**: A workspace must have a `userId` that matches the authenticated creator's UID.
- **Relational Integrity**: Files, segments, entities, risks, queries, and briefs MUST exist within a valid `workspaceId` context.
- **Collaborator Sandboxing**: Non-owners can only read and write to workspaces (and their subcollections) if their UID is explicitly listed in the `collaborators` array of the parent workspace document.
- **Immutability**: Once created, `userId` and `createdAt` fields on a Workspace must never change. `workspaceId` and `fileId` references in subcollections must remain immutable.
- **Strict Schema**: No shadow fields are allowed. All data must conform to the defined types and size limits (denial-of-wallet protection).

## 2. The "Dirty Dozen" Payloads (Targeting Permission Denials)

1. **Identity Theft (Workspace)**: Creating a workspace with a `userId` belonging to another user.
2. **Unauthorized Listing**: Attempting to list workspaces without being the owner or a collaborator.
3. **Ghost Update (Workspace)**: Attempting to update a workspace's `userId` after creation.
4. **Privilege Escalation**: A collaborator attempting to update the `collaborators` list or `userId` of a resource they don't own.
5. **Orphaned Write (Subcollection)**: Writing a `file` record into a workspace that doesn't exist.
6. **Query Hijack**: Attempting to list queries from a workspace without having access to that workspace.
7. **Resource Poisoning (ID)**: Creating a document with a 1MB string as the document ID.
8. **Value Poisoning (String Size)**: Sending a 1MB string for a `summary` field.
9. **State Shortcutting**: Updating a file's status to `completed` without the required metadata or from a non-authorized role.
10. **Terminal Lock Breach**: Attempting to delete a "completed" file record (assuming terminal locking for audit trails - though not explicitly requested, we follow hardened patterns).
11. **Malicious Collaboration**: A user adding themselves to the `collaborators` array of a workspace they don't own.
12. **PII Leak**: Accessing another user's workspace context via a blanket `read: if signedIn()` rule.

## 3. Test Runner Design
The `firestore.rules.test.ts` will verify:
- Owners have full CRUD.
- Collaborators have partial CRUD (read workspace, write subcollections, but cannot delete workspace or change collaborators).
- Unauthenticated users have NO access.
- Authenticated but non-associated users have NO access.
- Schema validation prevents oversized strings and invalid types.
