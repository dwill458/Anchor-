# 🌟 Physical Manifestation (Merchandise) Feature

## Quick Start

This feature allows users to create physical manifestations of their **charged anchors** through a carefully designed, non-commercial flow.

### Entry Point
Users access this feature through the **Anchor Detail Screen** after charging an anchor. A subtle gold CTA appears:

> ✨ **Bring This Anchor Into the Physical World**  
> *Carry your intention with you*

### Flow Overview
```
Charged Anchor → Product Selection → Mockup Preview → Checkout → Complete
```

---

## 🎨 Design Philosophy

**Core Principles:**
- **No shopping tab** - Entry only through completed anchors
- **Sacred language** - "Manifestation" not "purchase"
- **Earned access** - Only for charged anchors
- **Intentional design** - Zen Architect theme throughout

**Copy Examples:**
- ✅ "Choose Your Manifestation"
- ✅ "Your Anchor's Journey"
- ✅ "Complete Order"
- ❌ "Buy Now"
- ❌ "Add to Cart"
- ❌ "Shop Our Products"

---

## 📁 File Structure

### Frontend
```
src/
├── components/
│   └── PhysicalAnchorCTA.tsx          # Entry point CTA
├── screens/
│   ├── shop/
│   │   ├── ProductSelectionScreen.tsx  # Choose product type
│   │   ├── ProductMockupScreen.tsx     # Customize & preview
│   │   └── CheckoutScreen.tsx          # Complete order
│   └── vault/
│       └── AnchorDetailScreen.tsx      # Updated with CTA
├── navigation/
│   └── VaultStackNavigator.tsx         # Added 3 new routes
└── types/
    └── index.ts                        # Added route types
```

### Backend
```
backend/src/
├── api/
│   └── routes/
│       └── orders.ts                   # Orders API
└── index.ts                            # Registered routes
```

---

## 🛠️ Implementation Details

### Component: PhysicalAnchorCTA

```tsx
<PhysicalAnchorCTA
  isCharged={anchor.isCharged}
  onPress={handlePhysicalAnchor}
/>
```

**Features:**
- Conditional rendering (charged anchors only)
- Sparkles icon (not shopping cart)
- Glassmorphism styling
- Gold accent borders

### Screen: Product Selection

**Products Available:**
- 🖼️ **Sacred Print** - Museum-quality archival print
- 🔑 **Pocket Anchor** - Keychain reminder
- 👕 **Wearable Intention** - Premium hoodie
- 👔 **Daily Reminder** - Organic cotton t-shirt
- 📱 **Digital Guardian** - Phone case

### Screen: Product Mockup

**Customization:**
- **Size**: S, M, L, XL, XXL (varies by product)
- **Finish**: Color/material options
- **Live Preview**: Shows anchor SVG on product

### Screen: Checkout

**Collects:**
- Full Name
- Email
- Shipping Address
- City, State, Zip

**Backend:**
- POST to `/api/orders`
- Validates anchor ownership
- Creates order record
- Returns to Vault on success

---

## 🔌 API Endpoints

### POST `/api/orders`
Create a new order

**Request:**
```json
{
  "anchorId": "uuid",
  "productType": "hoodie",
  "size": "L",
  "color": "Charcoal",
  "shippingInfo": {
    "name": "John Doe",
    "email": "john@example.com",
    "address": "123 Main St",
    "city": "Portland",
    "state": "OR",
    "zip": "97201"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "order-uuid",
    "status": "pending",
    "totalCents": 7550,
    ...
  }
}
```

### GET `/api/orders`
Get all orders for authenticated user

---

## 🗄️ Database Schema

Uses existing `orders` table:
```prisma
model Order {
  id               String   @id @default(uuid())
  userId           String
  productType      String
  productVariant   String
  anchorImageUrl   String?
  subtotalCents    Int
  shippingCents    Int
  taxCents         Int
  totalCents       Int
  status           String   @default("pending")
  shippingName     String
  shippingAddress  Json
  createdAt        DateTime @default(now())
  ...
}
```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] CTA only shows on charged anchors
- [ ] CTA hidden on uncharged anchors
- [ ] All 5 products display correctly
- [ ] Anchor SVG visible in mockup preview
- [ ] Size selection works
- [ ] Color selection works
- [ ] Form validation prevents empty submissions
- [ ] Order creates successfully
- [ ] Navigation returns to Vault
- [ ] Analytics events fire correctly

### Test User Journey

1. Create and charge an anchor
2. View anchor detail
3. Tap "Bring This Anchor Into the Physical World"
4. Select a product (e.g., Hoodie)
5. Choose size and color
6. Fill in shipping information
7. Tap "Complete Order"
8. Verify redirect to Vault

---

## 🚀 Production Readiness

### Required Before Launch:

1. **Payment Processing**
   - [ ] Integrate Stripe
   - [ ] Add pricing API
   - [ ] Handle payment errors

2. **Fulfillment**
   - [ ] Integrate Printful API
   - [ ] Real product mockups
   - [ ] Automated order submission

3. **Communication**
   - [ ] Order confirmation emails
   - [ ] Shipping notifications
   - [ ] Delivery confirmations

### Optional Enhancements:

- [ ] Order history in Profile
- [ ] Tracking link integration
- [ ] Reorder functionality
- [ ] Gift option

---

## 📊 Analytics Events

**Tracked Events:**
- `physical_anchor_initiated` - User taps CTA
- `product_selected` - Product type chosen
- `mockup_customized` - Size/color selected
- `order_completed` - Checkout successful
- `order_failed` - Checkout error

---

## 🎯 Success Criteria

✅ Merch feels like **preservation**, not consumption  
✅ **No shopping feel** - ceremonial and intentional  
✅ **Brand trust protected** - aligns with app values  
✅ **Emotional integrity** over revenue optimization  

---

## 📚 Documentation

- **MERCHANDISE_SUMMARY.md** - Executive overview
- **MERCHANDISE_IMPLEMENTATION.md** - Complete technical guide
- **MERCHANDISE_FLOW_DIAGRAM.md** - Visual navigation flow
- **This file** - Developer quick reference

---

## ⚠️ Known Issues

**TypeScript Lint Errors:**
Some backend files show missing type declarations for `express` and `@prisma/client`. These resolve automatically after:
```bash
cd backend
npm install
npx prisma generate
```

---

## 🤝 Contributing

When adding to this feature:
- Maintain ceremonial language
- Avoid commercial copy
- Respect the sacred nature of anchors
- Test on both charged and uncharged anchors

**Philosophy:**
> *If there is ever a conflict between revenue optimization and emotional integrity, choose emotional integrity.*

---

## 📞 Support

Questions? Check:
1. This README for quick reference
2. `MERCHANDISE_IMPLEMENTATION.md` for deep dive
3. `MERCHANDISE_FLOW_DIAGRAM.md` for visual flow
4. Source code in `src/screens/shop/*`

---

**Built with intention. Designed with care. 🙏✨**
