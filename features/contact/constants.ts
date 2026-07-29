/**
 * `user.id` of the placeholder "Website Contact Form" account created by
 * scripts/create-contact-system-user.sql. Used as `senderId` when routing a
 * public contact-form submission into the assigned escrow officer's chat inbox.
 * This account has no `account` row (no credential) and is banned+archived —
 * it can never sign in and is hidden from admin Users lists / New chat pickers.
 */
export const CONTACT_SYSTEM_USER_ID = "sys-website-contact-form"
