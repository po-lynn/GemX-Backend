# Infinity GemX — Feature Requirements

Gemstone & jewellery marketplace. This document is the **single source of truth** for planned and built features across Mobile, Admin, and Additional areas.

---

## Mobile features

### User registration & profile management

- Sign-up and login via **phone number**.
- **OTP verification** (via SMS).
- User **profile page**: basic info, settings, preferences.
- **Onboarding flow**: tutorials, tips for new users.

### Secure authentication & security

- **Biometric login** (fingerprint/face) or strong password.
- Data encryption, secure backend.

### For buyers

- **Product feed** after login: show features, ads, and new items.
- **Smart filters**: category, location, price, rating, and across many categories.
- **Search**, sorted lists, filters, **bookmarking / favourites**.
- **Product detail page**:
  - Photos, price, description, location.
  - Seller profile & contact.
  - Ratings & comments.

### For sellers

- **Add product**: photos, price, description, category, condition, location.
- **Manage product status**: active / sold / hidden.
- **Quick post**: user can post an item for sale by taking photos (up to **10 images**).

### Subscription

| Tier      | Products   | Ads   | Extras                |
|----------|------------|-------|------------------------|
| **Basic (Free)** | e.g. 5     | Yes   | —                      |
| **Pro**  | e.g. 50    | No    | —                      |
| **Premium** | Unlimited | No    | Analytic dashboard     |

- **KBZ Pay integration** for subscription payment.

### Homepage

- **Trending products**
- **Recently added**
- **Category-wise products**

### Ratings & comments

- Buyers can **rate products / sellers** (1–5 stars).
- **Comment and feedback** system.
- **Seller rating average** shown on seller profile.

---

## Admin features

### User management

- Admin can **view a list of users** and **suspend / verify KYC / reset password**.
- Admin can **search** user profiles and **review** them.

### Product management

- **List all products** with server-side pagination.
- **Quick search**: title, seller, phone/email.
- **Approve / Reject / Hide / Edit** a product.
- **Mark / Unmark featured**.

### Reviews & ratings

- **List and filter reviews**: by product, seller, reviewer, rating range, date.

### Subscriptions

- **Create / Edit plan**.
- **View current subscriptions**, renewal dates.

---

## Additional features

### Internationalization (multi-language UI)

- **Languages**: English, Myanmar, Thai, Korean across all app navigation, buttons, and system labels.
- **Instant toggle**: switch language without data loss.

### Premium media support (FOC)

- **Video hosting**: optimized video playback for stone luster and “fire”.
- **Digital certificate viewer**: high-resolution viewer for GTI/GRS certificates.

### Dual-currency listing (FOC)

- **Currency**: sellers can price in **USD** or **MMK**.
- **Filtering**: buyers can filter by preferred payment currency.

### Deal management & safety (FOC)

- **Sold-out portfolio**: status toggle so sold items stay in seller history (trust) but are **removed from active market** searches.

### Chat & report system

- **Negotiation**: real-time text, high-res image sharing, location sharing for secure deal-making.
- **Privacy-first admin**: admin can access chat logs **only when a user files a formal Report** (high-end client privacy).
- **Report categories**: Fake Items, Fraud, Unprofessional Behavior.

---

## Doc conventions

When implementing or changing behaviour:

- **Unit / test changes** → update [TDD.md](./TDD.md).
- **API changes** → update [MOBILE-API.md](./MOBILE-API.md).
- **Logic / algorithms / function docs** → update [TECHNICAL-PRODUCTS.md](./TECHNICAL-PRODUCTS.md) (or the relevant technical doc).

See [docs/README.md](./README.md) for the full documentation map.
