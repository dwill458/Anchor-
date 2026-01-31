# Physical Manifestation (Merchandise) Flow - Implementation Documentation

## Overview

This implementation allows users to create physical manifestations of their charged anchors **without adding a global Shop tab**. The experience is carefully designed to feel like a natural extension of completing an anchor, maintaining the sacred and intentional nature of the app.

---

## Core UX Philosophy ✨

- **The anchor is sacred; merch is secondary**
- **No generic product browsing**
- **Monetization must feel earned, calm, and intentional**
- **Avoid commercial language** (shop, buy, store)
- **Language choices**: "Create Physical Anchor" vs "Buy merch"

---

## 1️⃣ Entry Point: Anchor Detail Screen

### Implementation
**File**: `src/screens/vault/AnchorDetailScreen.tsx`

### Changes Made
- Added `PhysicalAnchorCTA` component import
- Created `handlePhysicalAnchor()` navigation handler
- Component appears **only for charged anchors**
- Placed subtly between stats and action buttons

### CTA Design
```tsx
<PhysicalAnchorCTA
  isCharged={anchor.isCharged}
  onPress={handlePhysicalAnchor}
/>
```

**Visual Treatment**:
- Soft gold accent with subtle glow
- Label: "Bring This Anchor Into the Physical World"
- Subtitle: "Carry your intention with you"
- Sparkles icon (not shopping cart)

---

## 2️⃣ Flow Screens

### Screen 1: Product Selection
**File**: `src/screens/shop/ProductSelectionScreen.tsx`

**Purpose**: Choose manifestation type

**Products Available**:
- 🖼️ Sacred Print
- 🔑 Pocket Anchor (keychain)
- 👕 Wearable Intention (hoodie)
- 👔 Daily Reminder (t-shirt)
- 📱 Digital Guardian (phone case)

**Design Choices**:
- Ceremonial tone in copy
- Shows anchor preview at top
- No aggressive pricing display (subtle "From $XX")
- Each product has intention-based description

### Screen 2: Product Mockup Preview
**File**: `src/screens/shop/ProductMockupScreen.tsx`

**Purpose**: Live preview with customization

**Features**:
- Displays anchor SVG on product mockup
- Size selection (S, M, L, XL, etc.)
- Finish/color selection
- Intention text reminder
- "Continue to Details" button (not "Add to Cart")

**Technical Notes**:
- In production, integrate real product mockups from Printful API
- Currently shows simplified preview

### Screen 3: Checkout
**File**: `src/screens/shop/CheckoutScreen.tsx`

**Purpose**: Collect shipping information and complete order

**Copy Tone**:
- Title: "Your Anchor's Journey"
- Subtitle: "This manifestation will be crafted with intention and shipped to you"
- Button: "Complete Order" (not "Buy Now")

**Fields**:
- Name, Email
- Address, City, State, Zip

**Backend Integration**:
- POST to `/api/orders`
- Creates order in database
- Returns user to Vault on success

---

## 3️⃣ Navigation Flow

**Complete User Journey**:
```
Vault
  → Anchor Detail (charged anchor)
    → Physical Anchor CTA
      → Product Selection
        → Product Mockup
          → Checkout
            → Vault (success)
```

**Navigator**: `VaultStackNavigator.tsx`

**Added Routes**:
```tsx
<Stack.Screen name="ProductSelection" ... />
<Stack.Screen name="ProductMockup" ... />
<Stack.Screen name="Checkout" ... />
```

---

## 4️⃣ Backend API

### Orders Route
**File**: `backend/src/api/routes/orders.ts`

**Endpoints**:

#### POST `/api/orders`
Creates a new order

**Request Body**:
```json
{
  "anchorId": "uuid",
  "productType": "hoodie",
  "size": "L",
  "color": "Charcoal",
  "shippingInfo": {
    "name": "...",
    "email": "...",
    "address": "...",
    "city": "...",
    "state": "...",
    "zip": "..."
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "order-uuid",
    "status": "pending",
    ...
  }
}
```

#### GET `/api/orders`
Retrieves user's order history (for future Profile implementation)

### Database Schema
Uses existing `orders` table from Prisma schema:
- Links to `anchor_id`
- Stores product type, variant, pricing
- Shipping information
- Order status tracking

---

## 5️⃣ Type Definitions

**File**: `src/types/index.ts`

**Added Routes**:
```typescript
ProductSelection: {
  anchorId: string;
  sigilSvg: string;
  intentionText: string;
};

ProductMockup: {
  anchorId: string;
  sigilSvg: string;
  intentionText: string;
  productType: 'print' | 'hoodie' | 't-shirt' | 'keychain' | 'phone-case';
};

Checkout: {
  anchorId: string;
  productType: string;
  size: string;
  color: string;
};
```

---

## 6️⃣ Component Architecture

### PhysicalAnchorCTA
**File**: `src/components/PhysicalAnchorCTA.tsx`

**Purpose**: Reusable CTA component

**Props**:
- `isCharged: boolean` - Only shows if true
- `onPress: () => void` - Navigation handler

**Design**:
- Glassmorphism background
- Gold accent borders
- Sparkles icon
- Intentional copy

---

## 7️⃣ Key Design Decisions

### ✅ What We DID
- Entry through charged anchors only
- Ceremonial, respectful copy
- Zen Architect theme throughout
- Subtle CTAs that don't distract
- Full anchor context in every step

### ❌ What We AVOIDED
- Bottom nav Shop tab
- Generic product browsing
- Aggressive pricing displays
- Commercial language (buy, shop, cart)
- Selling other users' anchors

---

## 8️⃣ Future Enhancements

### Phase 4.1 - Discover Integration
- Add inspiration card: "Create a physical version of your own anchor"
- Fork flow for creating anchor before accessing merch

### Phase 4.2 - Profile Orders
- Add lightweight order history section
- Tracking links
- Reorder functionality
- **No browsing or upsells**

### Phase 4.3 - Production Integration
- Printful API integration for real mockups
- Automated fulfillment
- Real-time tracking updates

---

## 9️⃣ Testing Checklist

### Manual Testing
- [ ] CTA only appears on charged anchors
- [ ] Navigation flows correctly through all screens
- [ ] Anchor SVG displays on mockups
- [ ] Size/color selections work
- [ ] Checkout creates order successfully
- [ ] User returns to Vault after completion

### Edge Cases
- [ ] Uncharged anchors don't show CTA
- [ ] Anchor deleted after order initiated
- [ ] Network error during checkout
- [ ] Multiple orders from same anchor

---

## 10️⃣ Files Modified/Created

### Frontend
```
✨ Created:
- src/components/PhysicalAnchorCTA.tsx
- src/screens/shop/ProductSelectionScreen.tsx
- src/screens/shop/ProductMockupScreen.tsx
- src/screens/shop/CheckoutScreen.tsx

📝 Modified:
- src/screens/vault/AnchorDetailScreen.tsx
- src/navigation/VaultStackNavigator.tsx
- src/types/index.ts
- src/screens/shop/index.ts
```

### Backend
```
✨ Created:
- backend/src/api/routes/orders.ts

📝 Modified:
- backend/src/index.ts (registered routes)
```

---

## Success Criteria ✅

- ✅ Merch feels emotionally aligned with ritual completion
- ✅ No sense of "shopping"
- ✅ Conversion feels like preservation, not consumption
- ✅ Brand trust is protected
- ✅ **Emotional integrity > Revenue optimization**

---

## Analytics Events

**Tracking Points**:
- `physical_anchor_initiated` - User taps CTA
- `product_selected` - Product type chosen
- `mockup_customized` - Size/color selected
- `order_completed` - Checkout successful
- `order_failed` - Checkout error

---

## Notes for Product Team

> **Philosophy**: If there is ever a conflict between revenue optimization and emotional integrity, choose emotional integrity.

This implementation respects the sacred space of anchor completion while providing a natural path to physical manifestation. The language, design, and flow are all calibrated to maintain trust and intentionality.
