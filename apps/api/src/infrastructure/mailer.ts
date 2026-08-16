/**
 * Stub Mailer service for password reset emails and workspace invitations.
 * In development, messages are logged directly to the console.
 */
export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  console.log('----------------------------------------------------');
  console.log(`[STUB EMAIL] Password Reset requested for ${email}`);
  console.log(`Reset link: ${resetUrl}`);
  console.log(`Token: ${resetToken}`);
  console.log('----------------------------------------------------');
}

export async function sendWorkspaceInviteEmail(
  email: string,
  workspaceName: string,
  inviterName: string,
): Promise<void> {
  console.log('----------------------------------------------------');
  console.log(`[STUB EMAIL] Workspace Invite sent to ${email}`);
  console.log(`Invited by: ${inviterName} to join workspace "${workspaceName}"`);
  console.log('----------------------------------------------------');
}
