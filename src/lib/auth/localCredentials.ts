import type { User } from "./types";

export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 40;
export const MIN_PASSWORD_LENGTH = 8;

export type LocalCredentialsError =
  | "username_too_short"
  | "username_too_long"
  | "username_taken"
  | "password_too_short"
  | "wrong_password";

/**
 * Règles du « pseudo local » : un compte (Plex ou local) obtient un pseudo et un mot de passe
 * pour se connecter sans Plex. C'est le MÊME enregistrement utilisateur — même id, mêmes
 * données, même lien Plex — seuls `username` et `passwordHash` changent.
 *
 * - Compte sans mot de passe (Plex seul) : le mot de passe est obligatoire, pas de mot de passe actuel.
 * - Compte avec mot de passe : le mot de passe actuel est exigé ; le nouveau est facultatif
 *   (on peut ne changer que le pseudo).
 */
export function validateLocalCredentials(input: {
  user: Pick<User, "id" | "username" | "passwordHash">;
  username: string;
  password: string;
  currentPassword: string;
  findByUsername: (username: string) => Pick<User, "id"> | null;
  verifyPassword: (password: string, hash: string) => boolean;
}): LocalCredentialsError | null {
  const { user, username, password, currentPassword } = input;
  if (username.length < MIN_USERNAME_LENGTH) return "username_too_short";
  if (username.length > MAX_USERNAME_LENGTH) return "username_too_long";
  const owner = input.findByUsername(username);
  if (owner && owner.id !== user.id) return "username_taken";
  if (user.passwordHash) {
    if (!input.verifyPassword(currentPassword, user.passwordHash)) return "wrong_password";
    if (password && password.length < MIN_PASSWORD_LENGTH) return "password_too_short";
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    return "password_too_short";
  }
  return null;
}
