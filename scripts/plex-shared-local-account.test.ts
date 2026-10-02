import { test } from "node:test";
import assert from "node:assert/strict";
import { selectSharedLocalAccount } from "@/lib/plex/plexUserContext";
import type { PlexAccountBinding } from "@/lib/plex/plexBindingStore";

const accounts = [
  { id: 1, name: "Owner" },
  { id: 340433178, name: "Cassy" },
  { id: 8898531, name: "Cassy" },
  { id: 42, name: "Alice" },
];

test("renamed shared user uses its numeric PMS account, not the deleted namesake", () => {
  assert.deepEqual(selectSharedLocalAccount(accounts, "8898531", "misscassylove", null), accounts[2]);
});

test("duplicate PMS names alone are never enough to bind history", () => {
  assert.equal(selectSharedLocalAccount(accounts, "777", "Cassy", null), null);
});

test("a conflicting unique name and numeric id fail closed", () => {
  assert.equal(selectSharedLocalAccount(accounts, "8898531", "Alice", null), null);
});

test("owner account cannot be selected for a shared user", () => {
  assert.equal(selectSharedLocalAccount(accounts, "1", "unknown", null), null);
  assert.equal(selectSharedLocalAccount(accounts, "999", "Owner", null), null);
});

test("an old automatic binding cannot win against the account id", () => {
  const binding: PlexAccountBinding = {
    movvizUserId: "user", plexAccountId: "8898531", machineIdentifier: "machine",
    localAccountId: 340433178, localAccountName: "Cassy", bindingSource: "ACCOUNT_EXACT", verifiedAt: 1,
  };
  assert.equal(selectSharedLocalAccount(accounts, "8898531", "misscassylove", binding), null);
});

test("a unique exact name can resolve a shared account with a different id", () => {
  assert.deepEqual(selectSharedLocalAccount(accounts, "987", "Alice", null), accounts[3]);
});
