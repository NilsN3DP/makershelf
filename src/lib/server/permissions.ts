import { UserRole } from "@prisma/client";

export type PermissionSet = {
  canRead: boolean;
  canUpload: boolean;
  canEditProjects: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  isReadOnly: boolean;
};

export function resolvePermissions(role: UserRole, flags?: { canUpload?: boolean; readOnly?: boolean }) {
  const isReadOnly = Boolean(flags?.readOnly);
  const inheritedUpload = Boolean(flags?.canUpload);

  if (role === UserRole.ADMIN) {
    return {
      canRead: true,
      canUpload: true,
      canEditProjects: true,
      canManageUsers: true,
      canManageSettings: true,
      isReadOnly: false,
    } satisfies PermissionSet;
  }

  if (role === UserRole.EDITOR) {
    return {
      canRead: true,
      canUpload: !isReadOnly || inheritedUpload,
      canEditProjects: !isReadOnly,
      canManageUsers: false,
      canManageSettings: false,
      isReadOnly,
    } satisfies PermissionSet;
  }

  if (role === UserRole.UPLOADER) {
    return {
      canRead: true,
      canUpload: !isReadOnly || inheritedUpload,
      canEditProjects: !isReadOnly,
      canManageUsers: false,
      canManageSettings: false,
      isReadOnly,
    } satisfies PermissionSet;
  }

  return {
    canRead: true,
    canUpload: false,
    canEditProjects: false,
    canManageUsers: false,
    canManageSettings: false,
    isReadOnly: true,
  } satisfies PermissionSet;
}
