# Guide: Phone + Password Login for Portal Users

Portal users (role: `portal`) can log in at `/login` using either their email or phone number.

## Prerequisites

- The portal user must have a phone number stored in their profile (set by admin)
- Phone must be a valid Myanmar number (`09XXXXXXX` or `+959XXXXXXX` format)
- The user must have a password set

## Testing End-to-End

1. In the admin panel, create or edit a portal user and set their phone to `09123456789`
2. Open `/login`
3. Enter `09123456789` in the "Email or Phone Number" field
4. Enter the user's password
5. On success you should land on `/portal`

Both `09123456789` and `+959123456789` are accepted as equivalent inputs.

## How Phone Normalization Works

When an admin saves a phone number, it's normalized to E.164 (`+959XXXXXXX`) before storing:

| Admin enters | Stored as |
|---|---|
| `09123456789` | `+959123456789` |
| `+959123456789` | `+959123456789` |
| `09-123 456 789` | `+959123456789` |

The login form normalizes the user's input the same way before querying.

## Common Errors

**"Invalid credentials" when phone is correct**
- Check that the phone stored in the DB is in E.164 format. If an old record has `09...`, run the data migration:
  ```sql
  UPDATE "user" SET phone = '+95' || SUBSTRING(phone, 2) WHERE phone LIKE '09%';
  ```

**Admin enters a phone and gets a unique constraint error**
- Another user already has that phone number. Each phone must be unique across all users.

## Extending to Other Phone Formats

Phone normalization is in `lib/phone.ts → normalizeMyanmarPhone`. To support international numbers beyond Myanmar, extend that function and update `getEmailForPhoneLoginAction` to try multiple normalizers.
